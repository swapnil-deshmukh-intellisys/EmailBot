import { NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import WarmupSheet from '@/models/WarmupSheet';
import WarmupConversation from '@/models/WarmupConversation';
import { requireAuth } from '@/lib/apiAuth';
import { resolveSenderAccountById } from '@/lib/senderAccounts';
import { buildWarmupThreadId, findVerifiedWarmupAccountByEmail, processDueWarmupCommunications } from '@/core-lib/mail-engine/WarmupAutoCommunicationService';
import { normalizeProject, NO_STORE_HEADERS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPROVAL_HEADERS = ['warmupApproved', 'warmup approved', 'approved', 'Warmup Approved'];
const APPROVED_VALUES = new Set(['true', 'yes', 'approved', '1']);
const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();
const isConnectedStatus = (value = '') => ['connected', 'active', 'verified', 'good'].includes(String(value || '').trim().toLowerCase());

function isApprovedValue(value) {
  if (value === true) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return APPROVED_VALUES.has(normalized);
}

function pick(row = {}, keys = []) {
  for (const key of keys) {
    const found = Object.keys(row || {}).find((item) => item.trim().toLowerCase() === key.toLowerCase());
    if (found && String(row[found] ?? '').trim()) return row[found];
  }
  return '';
}

function hasApprovalColumn(rows = []) {
  return rows.some((row) => {
    const data = row?.data || {};
    return Object.keys(data).some((key) =>
      APPROVAL_HEADERS.some((header) => key.trim().toLowerCase() === header.toLowerCase())
    );
  });
}

function rowApproved(row = {}, approvalColumnMissing = false) {
  if (approvalColumnMissing) return true;
  return Boolean(row?.warmupApproved) || isApprovedValue(pick(row?.data || {}, APPROVAL_HEADERS));
}

function jsonError(message, status = 400) {
  return NextResponse.json({ success: false, error: message, message }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userId = auth.currentUser._id || null;
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const body = await req.json().catch(() => ({}));
    const selectedSenderId = String(body.selectedSenderId || body.senderId || '').trim();
    const warmupSheetId = String(body.warmupSheetId || body.sheetId || '').trim();
    const projectId = normalizeProject(body.projectId || body.project || '') || '';
    const delayMinutes = Math.max(1, Math.floor(Number(body.delayMinutes || body.delay || 1) || 1));
    const totalMessages = 10;
    const runId = String(body.runId || crypto.randomUUID()).trim();

    if (!selectedSenderId) return jsonError('Please select a sender ID.');
    if (!warmupSheetId) return jsonError('Please select a warmup sheet.');

    const selectedSender = await resolveSenderAccountById(selectedSenderId, { userEmail, project: projectId });
    if (!selectedSender?.from) return jsonError('No verified sender account found for this email.', 404);
    if (selectedSender.status && !isConnectedStatus(selectedSender.status)) return jsonError('No verified sender account found for this email.', 404);

    const sheetQuery = { _id: warmupSheetId, userEmail };
    if (projectId) sheetQuery.projectId = projectId;
    const sheet = await WarmupSheet.findOne(sheetQuery).lean();
    if (!sheet) return jsonError('Please select a warmup sheet.', 404);
    const resolvedProjectId = normalizeProject(sheet.projectId || projectId) || projectId || 'warmup';
    const senderEmail = normalizeEmail(selectedSender.from);
    const sheetRows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const approvalColumnMissing = Boolean(sheet.parseStats?.approvalColumnMissing) || !hasApprovalColumn(sheetRows);
    const approvedRows = sheetRows.filter((row) => rowApproved(row, approvalColumnMissing));

    const seen = new Set();
    const skipped = [];
    const approvedValidRows = [];
    const receivers = [];
    let invalidRowsCount = 0;
    let duplicateRowsCount = 0;
    for (const row of approvedRows) {
      const email = normalizeEmail(row.email || row.data?.Email || row.data?.email || '');
      if (!email || !SIMPLE_EMAIL_PATTERN.test(email)) {
        invalidRowsCount += 1;
        skipped.push({ email, reason: 'invalid_email' });
        continue;
      }
      approvedValidRows.push({ ...row, email });
      if (email === senderEmail) {
        skipped.push({ email, reason: 'selected_sender' });
        continue;
      }
      if (seen.has(email)) {
        duplicateRowsCount += 1;
        skipped.push({ email, reason: 'duplicate' });
        continue;
      }
      seen.add(email);
      receivers.push(email);
    }

    console.log('[WarmupAutoCommunication] validation', {
      userEmail,
      projectId: resolvedProjectId,
      sheetId: String(sheet._id),
      totalRowsParsed: sheetRows.length,
      approvedRowsCount: approvedRows.length,
      approvedValidRowsCount: approvedValidRows.length,
      invalidRowsCount,
      duplicateRowsCount,
      skippedReasons: skipped.slice(0, 50),
      approvalColumnMissing
    });

    if (approvedRows.length === 0) return jsonError('No approved rows found.');
    if (approvedValidRows.length === 0) return jsonError('All approved rows invalid.');
    if (duplicateRowsCount > 0 && receivers.length < 2 && approvedValidRows.length > receivers.length) {
      return jsonError('All approved rows duplicated.');
    }
    if (approvedValidRows.length < 2) return jsonError('Warmup sheet must contain at least 2 approved IDs.');
    if (receivers.length < 1) return jsonError('Only 1 approved ID found.');

    const created = [];
    const failed = [];
    for (const receiverEmail of receivers) {
      const receiverAccount = await findVerifiedWarmupAccountByEmail({ userEmail, projectId: resolvedProjectId, email: receiverEmail, includeRuntime: true });
      const receiverAccountId = receiverAccount?.id || `bot:${receiverEmail}`;
      const mode = receiverAccount ? 'real' : 'simulated';
      const activeExisting = await WarmupConversation.findOne({
        userEmail,
        projectId: resolvedProjectId,
        warmupSheetId: sheet._id,
        senderEmail,
        receiverEmail,
        status: { $in: ['pending', 'running', 'paused'] }
      }).lean();
      if (activeExisting) {
        skipped.push({ email: receiverEmail, reason: 'duplicate_conversation_running' });
        continue;
      }
      const threadId = buildWarmupThreadId({ userId: String(userId || userEmail), projectId: resolvedProjectId, senderEmail, receiverEmail, runId });
      try {
        const doc = await WarmupConversation.create({
          userId,
          userEmail,
          projectId: resolvedProjectId,
          warmupSheetId: sheet._id,
          selectedSenderId,
          receiverAccountId,
          senderEmail,
          receiverEmail,
          threadId,
          totalMessages,
          currentMessageNumber: 0,
          status: 'pending',
          mode,
          delayMinutes,
          nextMessageAt: new Date(),
          lastError: '',
          failedReason: ''
        });
        created.push({ id: String(doc._id), selectedSenderId, receiverAccountId, receiverEmail, mode });
      } catch (error) {
        failed.push({ email: receiverEmail, reason: error.message || 'create_failed' });
      }
    }

    await processDueWarmupCommunications({ limit: 10 }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: 'Auto communication started successfully.',
      summary: {
        created: created.length,
        skipped: skipped.length,
        failed: failed.length,
        approved: approvedRows.length,
        approvedValidRows: approvedValidRows.length,
        receivers: receivers.length,
        invalidRows: invalidRowsCount,
        duplicateRows: duplicateRowsCount
      },
      runId,
      created,
      skipped,
      failed
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to start auto communication.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
