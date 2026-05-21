import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import Campaign from '@/models/Campaign';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import LeadList from '@/models/LeadList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function clean(value = '') {
  return String(value || '').trim();
}

function normalizeEmail(value = '') {
  return clean(value).toLowerCase();
}

function displayNameForLead(log = {}) {
  return clean(log.clientName || log.recipientName || log.email || log.recipientEmail || 'Client');
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const leadResponseId = clean(body.leadResponseId || body.id);
    if (!leadResponseId) {
      return NextResponse.json({ ok: false, error: 'Lead response id is required.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const userEmail = normalizeEmail(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '');
    const log = await CampaignRecipientLog.findOne(buildAuthOwnerFilter(auth, { _id: leadResponseId })).lean();
    if (!log) {
      return NextResponse.json({ ok: false, error: 'Lead response not found for current user.' }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const sourceCampaign = log.campaignId
      ? await Campaign.findOne(buildAuthOwnerFilter(auth, { _id: log.campaignId })).lean()
      : null;
    const leadEmail = normalizeEmail(log.recipientEmail || log.email);
    if (!leadEmail) {
      return NextResponse.json({ ok: false, error: 'Lead response does not contain an email address.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const leadName = displayNameForLead(log);
    const project = normalizeEmail(log.projectId || sourceCampaign?.projectId || sourceCampaign?.project || '').replace(/[^a-z0-9_-]+/g, '') || 'lead';
    const listName = `Lead response - ${leadName}`.slice(0, 110);
    const campaignName = clean(body.name) || `Follow-up - ${leadName}`.slice(0, 120);
    const now = new Date();

    const leadList = await LeadList.create({
      userId: auth.currentUser?._id || null,
      userEmail,
      name: listName,
      project,
      projectId: project,
      sourceFile: 'lead-response',
      sourceFileId: leadResponseId,
      sourceFileName: sourceCampaign?.name || log.campaignName || 'Client response',
      uploadDate: now,
      kind: 'lead-response',
      columns: ['Name', 'Email', 'Company', 'Designation', 'Response', 'Source Campaign'],
      leads: [{
        Name: leadName,
        Email: leadEmail,
        Company: clean(log.company),
        Designation: clean(log.designation),
        status: 'Pending',
        data: {
          Name: leadName,
          Email: leadEmail,
          Company: clean(log.company),
          Designation: clean(log.designation),
          Response: clean(log.replyPreview || log.notes),
          ReplyType: clean(log.replyType),
          SourceCampaign: clean(log.campaignName || sourceCampaign?.name),
          SourceCampaignId: String(log.campaignId || ''),
          LeadResponseId: leadResponseId
        }
      }],
      uploadedAt: now
    });

    const senderFrom = normalizeEmail(sourceCampaign?.senderFrom || sourceCampaign?.senderAccount?.from || sourceCampaign?.senderAccount?.user || '');
    const campaign = await Campaign.create({
      userId: auth.currentUser?._id || null,
      userEmail,
      name: campaignName,
      project,
      projectId: project,
      projectName: project.toUpperCase(),
      senderFrom,
      type: 'followup',
      listId: leadList._id,
      draftType: 'followup',
      draftId: null,
      inlineTemplate: {
        subject: `Following up, ${leadName}`,
        body: `Hi ${leadName},\n\nThanks for your response. I wanted to follow up with the next details and continue the conversation.\n\nBest regards,`
      },
      senderAccountId: sourceCampaign?.senderAccountId || '',
      senderAccount: sourceCampaign?.senderAccount
        ? {
            provider: sourceCampaign.senderAccount.provider || '',
            label: sourceCampaign.senderAccount.label || '',
            from: sourceCampaign.senderAccount.from || sourceCampaign.senderAccount.user || ''
          }
        : undefined,
      workflowStep: 3,
      workflowStepLabel: 'Lead response follow-up',
      scheduleMode: 'send_now',
      country: sourceCampaign?.country || 'India',
      timezone: sourceCampaign?.timezone || 'Asia/Kolkata',
      status: 'Draft',
      tracking: { enabled: true, opens: true, clicks: false, replies: true, updatedAt: now },
      options: {
        batchSize: 1,
        delayInterval: 1,
        durationUnit: 'minutes',
        delaySeconds: 60,
        rowRange: '',
        replyMode: true
      },
      stats: { total: 1, sent: 0, failed: 0, bounced: 0, spam: 0, pending: 1 },
      totalRecipients: 1,
      sentCount: 0,
      pendingCount: 1,
      failedCount: 0,
      openCount: 0,
      replyCount: 0,
      lastActivityAt: now,
      logs: [{ level: 'info', message: 'Campaign created from lead response', at: now }]
    });

    return NextResponse.json({
      ok: true,
      campaign,
      list: { id: String(leadList._id), name: leadList.name, count: 1 }
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create campaign from lead response.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
