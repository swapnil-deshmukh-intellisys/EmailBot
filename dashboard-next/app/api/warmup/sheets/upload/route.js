import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import WarmupSheet from '@/models/WarmupSheet';
import { requireAuth } from '@/lib/apiAuth';
import { normalizeProject, NO_STORE_HEADERS } from '../../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPROVAL_HEADERS = ['warmupApproved', 'warmup approved', 'approved', 'Warmup Approved'];
const APPROVED_VALUES = new Set(['true', 'yes', 'approved', '1']);

function normalizeEmail(value = '') {
  return String(value || '').trim().replace(/^mailto:/i, '').toLowerCase();
}

function isApproved(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return APPROVED_VALUES.has(normalized);
}

function pick(row = {}, keys = []) {
  for (const key of keys) {
    const found = Object.keys(row).find((item) => item.trim().toLowerCase() === key.toLowerCase());
    if (found && String(row[found] ?? '').trim()) return row[found];
  }
  return '';
}

function hasApprovalColumn(rows = []) {
  return rows.some((row) =>
    Object.keys(row || {}).some((key) =>
      APPROVAL_HEADERS.some((header) => key.trim().toLowerCase() === header.toLowerCase())
    )
  );
}

function normalizeRow(row = {}) {
  const email = normalizeEmail(pick(row, ['email', 'Email', 'Email ID', 'Mail ID', 'mail']));
  const name = String(pick(row, ['name', 'Name', 'First Name', 'firstName']) || '').trim();
  const warmupApproved = isApproved(pick(row, APPROVAL_HEADERS));
  return { name, email, warmupApproved, data: row };
}

function buildRows(rawRows = []) {
  const approvalColumnMissing = !hasApprovalColumn(rawRows);
  const rows = [];
  const skippedReasons = [];
  let approvedRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  const seenApprovedEmails = new Set();

  for (const rawRow of rawRows) {
    const row = normalizeRow(rawRow);
    if (approvalColumnMissing) row.warmupApproved = true;
    if (row.warmupApproved) approvedRows += 1;

    if (!row.email || !SIMPLE_EMAIL_PATTERN.test(row.email)) {
      invalidRows += 1;
      skippedReasons.push({ email: row.email || '', reason: 'invalid_email' });
      rows.push(row);
      continue;
    }

    if (row.warmupApproved) {
      if (seenApprovedEmails.has(row.email)) {
        duplicateRows += 1;
        skippedReasons.push({ email: row.email, reason: 'duplicate' });
      } else {
        seenApprovedEmails.add(row.email);
      }
    }

    rows.push(row);
  }

  return {
    rows,
    parseStats: {
      totalRows: rawRows.length,
      approvedRows,
      invalidRows,
      duplicateRows,
      approvalColumnMissing,
      skippedReasons
    }
  };
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const form = await req.formData();
    const file = form.get('file');
    const projectId = normalizeProject(form.get('projectId') || form.get('project') || '') || 'warmup';
    if (!file) {
      return NextResponse.json({ success: false, error: 'Choose a warmup sheet first.' }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, error: 'File is too large. Maximum upload size is 5MB.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellFormula: false, cellHTML: false });
    const firstSheet = workbook.SheetNames[0];
    const rawRows = firstSheet ? XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' }) : [];
    const { rows, parseStats } = buildRows(rawRows);
    console.log('[WarmupSheetUpload] parsed', {
      sheetName: file.name || 'warmup-sheet.xlsx',
      projectId,
      totalRows: parseStats.totalRows,
      approvedRows: parseStats.approvedRows,
      invalidRows: parseStats.invalidRows,
      duplicateRows: parseStats.duplicateRows,
      approvalColumnMissing: parseStats.approvalColumnMissing,
      skippedReasons: parseStats.skippedReasons.slice(0, 25)
    });

    const sheet = await WarmupSheet.create({
      userId: auth.currentUser._id || null,
      userEmail,
      projectId,
      sheetName: file.name || 'warmup-sheet.xlsx',
      rows,
      parseStats,
      uploadedAt: new Date(),
      isDefault: true
    });
    await WarmupSheet.updateMany({ _id: { $ne: sheet._id }, userEmail, projectId }, { $set: { isDefault: false } });

    return NextResponse.json({
      success: true,
      sheet: {
        id: String(sheet._id),
        sheetName: sheet.sheetName,
        projectId: sheet.projectId,
        total: sheet.rows.length,
        approved: sheet.rows.filter((row) => row.warmupApproved).length,
        parseStats: sheet.parseStats
      }
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to upload warmup sheet.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
