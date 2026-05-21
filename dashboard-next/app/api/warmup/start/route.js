import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { requireAuth } from '@/lib/apiAuth';
import { triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { resolveSenderAccountById } from '@/lib/senderAccounts';
import {
  cloneWarmupLeadListForCampaign,
  ensureWarmupLeadList,
  getWarmupDrafts,
  getWarmupSenders,
  normalizeProject,
  NO_STORE_HEADERS,
  serializeWarmupCampaign,
  toProjectLabel,
  WARMUP_DRAFT_TYPE,
  WARMUP_MIN_LEADS
} from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function jsonError(message, status = 400) {
  return NextResponse.json({ success: false, error: message, message }, { status, headers: NO_STORE_HEADERS });
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const body = await req.json().catch(() => ({}));
    const project = normalizeProject(body.project);
    const senderId = String(body.senderId || body.senderAccountId || '').trim();
    const draftId = String(body.draftId || '').trim();
    const editedSubject = String(body.subject || '').trim();
    const editedBody = String(body.body || '').trim();

    if (!project) return jsonError('Select a valid project.');
    if (!senderId) return jsonError('Select a sender ID.');
    if (!draftId) return jsonError('Select a warmup draft.');

    const senderOptions = await getWarmupSenders({ userEmail, project });
    const selectedSender = senderOptions.find((sender) => sender.id === senderId);
    if (!selectedSender) return jsonError('Selected sender ID does not belong to the selected project.', 404);
    if (String(selectedSender.status || '').toLowerCase() !== 'connected') {
      return jsonError('Selected sender ID is not connected.');
    }
    if (selectedSender.dailyLimit > 0 && selectedSender.sentToday >= selectedSender.dailyLimit) {
      return jsonError('Selected sender ID already reached its daily sending limit.');
    }

    const duplicateRunning = await Campaign.findOne({
      userEmail,
      senderAccountId: senderId,
      project,
      type: WARMUP_DRAFT_TYPE,
      status: { $in: ['Queued', 'Running', 'Scheduled'] }
    }).lean();
    if (duplicateRunning) {
      return jsonError('A warmup campaign is already running or queued for this sender ID.');
    }

    const drafts = await getWarmupDrafts({ userEmail, project, senderId });
    const selectedDraft = drafts.find((draft) => String(draft._id) === draftId);
    if (!selectedDraft?.subject || !selectedDraft?.body) {
      return jsonError('Selected warmup draft is missing or empty.', 404);
    }
    const campaignSubject = editedSubject || selectedDraft.subject;
    const campaignBody = editedBody || selectedDraft.body;
    if (!campaignSubject || !campaignBody) {
      return jsonError('Warmup draft subject and body are required.');
    }

    const { list: masterList, missing } = await ensureWarmupLeadList({ userEmail, userId: auth.currentUser._id || null });
    if (missing || !masterList || !Array.isArray(masterList.leads) || masterList.leads.length < WARMUP_MIN_LEADS) {
      return jsonError('Upload a warmup sheet with at least one valid email client.');
    }

    const resolvedSender = await resolveSenderAccountById(senderId, { userEmail, project });
    if (!resolvedSender) return jsonError('Selected sender account cannot be resolved.');

    const campaignList = await cloneWarmupLeadListForCampaign({
      masterList,
      userEmail,
      userId: auth.currentUser._id || null,
      project,
      senderFrom: resolvedSender.from || selectedSender.from
    });

    // New warmup flow: create a normal queued campaign so the existing scheduler/runner handles sending safely.
    const campaign = await Campaign.create({
      userId: auth.currentUser._id || null,
      userEmail,
      name: `Warmup ${toProjectLabel(project)} ${selectedSender.from} ${new Date().toLocaleString()}`,
      project,
      projectId: project,
      projectName: toProjectLabel(project),
      senderFrom: String(resolvedSender.from || selectedSender.from || '').trim().toLowerCase(),
      type: WARMUP_DRAFT_TYPE,
      listId: campaignList._id,
      draftType: WARMUP_DRAFT_TYPE,
      draftId: selectedDraft._id,
      inlineTemplate: {
        subject: campaignSubject,
        body: campaignBody
      },
      senderAccountId: senderId,
      senderAccount: {
        provider: resolvedSender.provider,
        label: resolvedSender.label,
        from: resolvedSender.from
      },
      status: 'Queued',
      scheduleMode: 'send_now',
      country: 'India',
      timezone: 'Asia/Kolkata',
      options: {
        batchSize: 1,
        delayInterval: 1,
        durationUnit: 'minutes',
        delaySeconds: 60,
        replyMode: false
      },
      stats: {
        total: campaignList.leads.length,
        sent: 0,
        failed: 0,
        bounced: 0,
        spam: 0,
        pending: campaignList.leads.length
      },
      totalRecipients: campaignList.leads.length,
      pendingCount: campaignList.leads.length,
      queueRequestedAt: new Date(),
      queueReason: 'Queued by warmup start request',
      logs: [{ level: 'info', message: 'Warmup campaign queued', at: new Date() }]
    });

    await triggerCampaignSchedulerTick();
    const startedCampaign = await Campaign.findById(campaign._id).lean();
    const publicCampaign = serializeWarmupCampaign(startedCampaign || campaign);
    const normalizedStatus = String(publicCampaign.status || '').toLowerCase();
    const message = normalizedStatus === 'running'
      ? 'Warmup mail sending started. Campaign is running in the background.'
      : 'Warmup campaign queued. Mail sending will start automatically.';

    return NextResponse.json({
      success: true,
      ok: true,
      queued: normalizedStatus === 'queued',
      running: normalizedStatus === 'running',
      schedulerTriggered: true,
      message,
      campaign: publicCampaign
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to start warmup campaign' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
