import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import Campaign from '@/models/Campaign';
import CampaignRecipientClaim from '@/models/CampaignRecipientClaim';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import LeadList from '@/models/LeadList';
import SenderAccount from '@/models/SenderAccount';
import { getCampaignSchedulerState } from '@/lib/campaignScheduler';
import { resolveSenderAccountById } from '@/lib/senderAccounts';
import { computeCampaignDisplayStatus } from '@/core-lib/campaign-engine/CampaignStatusSummary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeStatus(value = '') {
  return String(value || '').trim().toLowerCase();
}

function countLeadStatuses(leads = []) {
  return leads.reduce(
    (counts, lead) => {
      const status = normalizeStatus(lead?.status || 'Pending');
      counts.total += 1;
      if (!status || status === 'pending') counts.pending += 1;
      else if (status === 'sending' || status === 'processing') counts.processing += 1;
      else if (status === 'sent') counts.sent += 1;
      else if (status === 'failed' || status === 'bounced' || status === 'spam') counts.failed += 1;
      else if (status === 'skipped') counts.skipped += 1;
      else counts.other += 1;
      return counts;
    },
    { total: 0, pending: 0, processing: 0, sent: 0, failed: 0, skipped: 0, other: 0 }
  );
}

function summarizeLogs(campaign = {}, recipientErrors = []) {
  const campaignLogs = Array.isArray(campaign.logs) ? campaign.logs : [];
  const normalizedCampaignLogs = campaignLogs.map((log) => ({
    level: log.level || 'info',
    message: log.message || '',
    at: log.at || null,
    source: 'campaign'
  }));
  const normalizedRecipientErrors = recipientErrors.map((log) => ({
    level: 'error',
    message: [log.email || log.recipientEmail || 'unknown recipient', log.failureReason || log.bounceReason || 'Failed'].filter(Boolean).join(' - '),
    at: log.lastActivityAt || log.updatedAt || log.createdAt || null,
    source: 'recipient'
  }));

  return [...normalizedCampaignLogs, ...normalizedRecipientErrors]
    .sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, 20);
}

async function getSenderAccountDebug(campaign) {
  const senderAccountId = String(campaign?.senderAccountId || '').trim();
  const senderFrom = normalizeEmail(campaign?.senderFrom || campaign?.senderAccount?.from || campaign?.senderAccount?.user || '');
  const userEmail = normalizeEmail(campaign?.userEmail || '');
  const project = String(campaign?.project || campaign?.projectId || '').trim().toLowerCase();
  const debug = {
    senderAccountId,
    senderFrom,
    provider: '',
    status: '',
    health: '',
    found: false,
    source: '',
    tokenExpiresAt: null,
    tokenExpired: false,
    error: ''
  };

  try {
    if (senderAccountId.startsWith('db:')) {
      const dbId = senderAccountId.slice(3);
      const doc = mongoose.isValidObjectId(dbId)
        ? await SenderAccount.findOne({ _id: dbId, userEmail }).lean()
        : null;
      if (doc) {
        debug.found = true;
        debug.source = 'sender_accounts';
        debug.provider = doc.provider || '';
        debug.status = doc.status || '';
        debug.health = doc.health || '';
        debug.senderFrom = doc.from || senderFrom;
      }
    } else if (senderAccountId.startsWith('oauth:')) {
      const oauthId = senderAccountId.slice(6);
      const doc = mongoose.isValidObjectId(oauthId)
        ? await GraphOAuthAccount.findOne({ _id: oauthId, userEmail }).lean()
        : null;
      if (doc) {
        debug.found = true;
        debug.source = 'graph_oauth_accounts';
        debug.provider = 'graph_oauth';
        debug.status = doc.status || '';
        debug.health = doc.health || '';
        debug.senderFrom = doc.email || senderFrom;
        debug.tokenExpiresAt = doc.expiresAt || null;
        debug.tokenExpired = doc.expiresAt ? new Date(doc.expiresAt).getTime() <= Date.now() : false;
      }
    }

    if (!debug.found) {
      const resolved = senderAccountId
        ? await resolveSenderAccountById(senderAccountId, { userEmail, project, senderFrom })
        : await resolveSenderAccountById(`graphapp:${senderFrom}`, { userEmail, project, senderFrom });
      if (resolved) {
        debug.found = true;
        debug.source = String(resolved.id || '').startsWith('graphapp:') ? 'runtime_graph_app' : 'runtime';
        debug.provider = resolved.provider || '';
        debug.status = resolved.status || 'Configured';
        debug.senderFrom = resolved.from || resolved.user || senderFrom;
      }
    }

    if (!debug.found && campaign?.senderAccount?.provider) {
      debug.found = true;
      debug.source = 'campaign_snapshot';
      debug.provider = campaign.senderAccount.provider || '';
      debug.status = campaign.senderAccount.status || 'Snapshot';
      debug.senderFrom = campaign.senderAccount.from || campaign.senderAccount.user || senderFrom;
    }
  } catch (error) {
    debug.error = error.message || 'Sender account debug failed';
  }

  return debug;
}

export async function GET(req, { params }) {
  const campaignId = String(params?.id || '').trim();

  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    if (!mongoose.isValidObjectId(campaignId)) {
      return NextResponse.json({ ok: false, error: 'Invalid campaign id' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    await connectDB();
    const campaign = await Campaign.findOne(buildAuthOwnerFilter(auth, { _id: campaignId })).lean();
    if (!campaign) {
      return NextResponse.json({ ok: false, error: 'Campaign not found for current user' }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const [leadList, claimCounts, logCounts, recipientErrors, senderAccount] = await Promise.all([
      LeadList.findById(campaign.listId).select('userEmail projectId projectName leads.status leads.email leads.Email').lean(),
      CampaignRecipientClaim.aggregate([
        { $match: { campaignId: campaign._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      CampaignRecipientLog.aggregate([
        { $match: { campaignId: campaign._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      CampaignRecipientLog.find({
        campaignId: campaign._id,
        $or: [
          { status: { $in: ['Failed', 'Bounced', 'Spam'] } },
          { failureReason: { $ne: '' } },
          { bounceReason: { $ne: '' } }
        ]
      })
        .select('email recipientEmail status failureReason bounceReason lastActivityAt updatedAt createdAt')
        .sort({ lastActivityAt: -1, updatedAt: -1 })
        .limit(20)
        .lean(),
      getSenderAccountDebug(campaign)
    ]);

    const leadCounts = countLeadStatuses(leadList?.leads || []);
    const claimStatusCounts = Object.fromEntries(claimCounts.map((item) => [item._id || 'Unknown', item.count]));
    const logStatusCounts = Object.fromEntries(logCounts.map((item) => [item._id || 'Unknown', item.count]));
    const campaignTotal = Number(campaign.totalRecipients ?? campaign.stats?.total ?? leadCounts.total ?? 0);
    const sent = Number(campaign.sentCount ?? campaign.stats?.sent ?? leadCounts.sent ?? 0);
    const failed = Number(campaign.failedCount ?? campaign.stats?.failed ?? leadCounts.failed ?? 0);
    const processing = Number(claimStatusCounts.Sending || claimStatusCounts.Processing || leadCounts.processing || 0);
    const pending = Number(campaign.pendingCount ?? campaign.stats?.pending ?? Math.max(0, campaignTotal - sent - failed - processing));

    return NextResponse.json(
      {
        ok: true,
        campaignId,
        status: campaign.status || '',
        displayStatus: computeCampaignDisplayStatus(campaign),
        userId: String(campaign.userId || ''),
        userEmail: campaign.userEmail || '',
        projectId: campaign.projectId || campaign.project || '',
        projectName: campaign.projectName || campaign.project || '',
        senderId: campaign.senderAccountId || '',
        senderAccount,
        queue: {
          total: campaignTotal,
          pending,
          processing,
          sent,
          failed,
          skipped: leadCounts.skipped,
          leadStatusCounts: leadCounts,
          claimStatusCounts,
          recipientLogStatusCounts: logStatusCounts
        },
        worker: {
          lastWorkerHeartbeat: campaign.workerHeartbeatAt || null,
          lockedBy: campaign.workerLockedBy || campaign.workerId || '',
          lockExpiresAt: campaign.workerHeartbeatAt
            ? new Date(new Date(campaign.workerHeartbeatAt).getTime() + Number(getCampaignSchedulerState().workerLockStaleMs || 0))
            : null,
          workerStatus: campaign.workerStatus || '',
          queueRequestedAt: campaign.queueRequestedAt || null,
          queueReason: campaign.queueReason || '',
          lastRunError: campaign.lastRunError || campaign.lastError || '',
          lastRunErrorAt: campaign.lastRunErrorAt || campaign.lastErrorAt || null,
          scheduler: getCampaignSchedulerState()
        },
        logs: summarizeLogs(campaign, recipientErrors)
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Campaign debug failed' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
