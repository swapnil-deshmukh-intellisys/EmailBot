import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter } from '@/app/api/client-data/_retention';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STEP_LABELS = ['Cover Story', 'Reminder', 'Follow-up', 'Up Cost', 'Final Cost'];

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function leadEmail(lead = {}) {
  return normalizeEmail(lead.Email || lead.email || lead.data?.Email || lead.data?.email || '');
}

function leadName(lead = {}) {
  return [lead.Name || lead.data?.Name, lead.Surname || lead.data?.Surname].filter(Boolean).join(' ').trim();
}

function formatStep(step = {}, index = 0) {
  return {
    stepNumber: Number(step.stepNumber || index + 1),
    label: STEP_LABELS[index] || `Step ${index + 1}`,
    subject: step.subject || '',
    status: step.status || 'Pending',
    sentAt: step.sentAt || null,
    openedAt: step.openedAt || null,
    repliedAt: step.repliedAt || null,
    skippedAt: step.skippedAt || null,
    failedAt: step.failedAt || null,
    failureReason: step.failureReason || ''
  };
}

function emptySteps() {
  return STEP_LABELS.map((label, index) => ({
    stepNumber: index + 1,
    label,
    subject: '',
    status: 'Pending',
    sentAt: null,
    openedAt: null,
    repliedAt: null,
    skippedAt: null,
    failedAt: null,
    failureReason: ''
  }));
}

function clientStage(log = null) {
  if (!log) return 'Not Started';
  if (log.replyReceived) return 'Response Received';
  if (log.followUpStopped) return 'Follow-up Stopped';
  if (log.status === 'Completed') return 'Completed';
  if (log.status === 'Failed') return 'Failed';
  if (log.sentCount > 0) return 'In Progress';
  return log.status || 'Pending';
}

function logActivityTime(log = {}) {
  return log.lastActivityAt || log.lastReplyAt || log.lastSentAt || log.updatedAt || null;
}

function formatCampaignHistory(log = {}) {
  return {
    id: String(log._id || ''),
    campaignId: String(log.campaignId || ''),
    campaignName: log.campaignName || 'Campaign',
    projectName: log.projectName || '',
    status: log.status || 'Pending',
    stage: clientStage(log),
    sentCount: Number(log.sentCount || 0),
    failedCount: Number(log.failedCount || 0),
    openCount: Number(log.openCount || 0),
    replyCount: Number(log.replyCount || 0),
    replyReceived: Boolean(log.replyReceived),
    replyType: log.replyType || '',
    replyPreview: log.replyPreview || '',
    followUpStopped: Boolean(log.followUpStopped || log.replyReceived),
    followUpStopReason: log.followUpStopReason || (log.replyReceived ? 'Client replied - follow-up stopped' : ''),
    lastSentAt: log.lastSentAt || null,
    lastReplyAt: log.lastReplyAt || null,
    lastActivityAt: logActivityTime(log),
    steps: STEP_LABELS.map((label, index) => formatStep(log.stepLogs?.[index] || { stepNumber: index + 1 }, index))
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const listId = String(searchParams.get('listId') || '').trim();
    if (!listId) return NextResponse.json({ ok: false, error: 'listId is required' }, { status: 400 });

    const list = await LeadList.findOne(activeListFilter(buildAuthOwnerFilter(auth, { _id: listId })))
      .select('name sourceFile leads.Name leads.Surname leads.Email leads.Company leads.Designation leads.data')
      .lean();
    if (!list) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });

    const leads = Array.isArray(list.leads) ? list.leads : [];
    const emails = Array.from(new Set(leads.map(leadEmail).filter(Boolean)));
    const logs = emails.length
      ? await CampaignRecipientLog.find(buildAuthOwnerFilter(auth, {
        $or: [
          { email: { $in: emails } },
          { recipientEmail: { $in: emails } }
        ]
      }))
        .select('campaignName projectName recipientEmail recipientName clientName email company designation status currentStep totalSteps sentCount failedCount skippedCount openCount replyCount lastSentAt lastReplyAt replyReceived replyType replyPreview followUpStopped followUpStopReason stepLogs lastActivityAt updatedAt')
        .sort({ lastActivityAt: -1, updatedAt: -1 })
        .lean()
      : [];

    const logsByEmail = logs.reduce((map, log) => {
      const email = normalizeEmail(log.email || log.recipientEmail);
      if (!email) return map;
      if (!map.has(email)) map.set(email, []);
      map.get(email).push(log);
      return map;
    }, new Map());

    const clients = leads.map((lead) => {
      const email = leadEmail(lead);
      const clientLogs = logsByEmail.get(email) || [];
      const latest = clientLogs[0] || null;
      const steps = latest?.stepLogs?.length
        ? STEP_LABELS.map((label, index) => formatStep(latest.stepLogs[index] || { stepNumber: index + 1 }, index))
        : emptySteps();
      const campaignHistory = clientLogs.map(formatCampaignHistory);
      return {
        name: leadName(lead) || latest?.clientName || latest?.recipientName || email || '-',
        email,
        company: lead.Company || lead.data?.Company || latest?.company || '-',
        designation: lead.Designation || lead.data?.Designation || latest?.designation || '-',
        stage: clientStage(latest),
        responseReceived: Boolean(latest?.replyReceived),
        replyType: latest?.replyType || '',
        replyPreview: latest?.replyPreview || '',
        followUpStopped: Boolean(latest?.followUpStopped || latest?.replyReceived),
        followUpStopReason: latest?.followUpStopReason || (latest?.replyReceived ? 'Client replied - follow-up stopped' : ''),
        currentStep: latest?.currentStep || 0,
        sentCount: Number(latest?.sentCount || 0),
        openCount: Number(latest?.openCount || 0),
        replyCount: Number(latest?.replyCount || 0),
        lastSentAt: latest?.lastSentAt || null,
        lastReplyAt: latest?.lastReplyAt || null,
        campaignName: latest?.campaignName || '',
        projectName: latest?.projectName || '',
        steps,
        campaignHistory,
        historyCount: clientLogs.length
      };
    });

    return NextResponse.json({
      ok: true,
      list: {
        _id: String(list._id),
        name: list.name,
        sourceFile: list.sourceFile || '',
        leadCount: leads.length
      },
      clients
    });
  } catch (error) {
    return NextResponse.json({ ok: false, clients: [], error: error.message || 'Failed to load client history' }, { status: 500 });
  }
}
