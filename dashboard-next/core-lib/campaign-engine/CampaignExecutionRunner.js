import connectDB from '../database-config/MongoDatabaseConnection.js';
import Campaign from '../../database-models/Campaign.js';
import LeadList from '../../database-models/LeadList.js';
import EmailTemplate from '../../database-models/EmailTemplate.js';
import EmailThread from '../../database-models/EmailThread.js';
import CampaignRecipientClaim from '../../database-models/CampaignRecipientClaim.js';
import UserProfile from '../../database-models/UserProfile.js';
import CreditTransaction from '../../database-models/CreditTransaction.js';
import UserSubscription from '../../database-models/UserSubscription.js';
import CampaignRecipientLog from '../../database-models/CampaignRecipientLog.js';
import { getAvailableAccounts, sendEmailForLead } from '../mail-engine/GraphAndSmtpMailSender.js';
import { resolveSenderAccountById } from '../mail-engine/SenderAccountResolver.js';
import { USER_ACCOUNT_STATUSES } from '../auth-config/AuthSessionService.js';
import { getOrCreateSubscriptionSummary, PLAN_LIMITS } from '../billing/SubscriptionCreditService.js';
import {
  buildTrackingId,
  buildTrackingPixel,
  classifyFailureReason,
  ensureStepLogs,
  normalizeProjectName,
  refreshCampaignRollups
} from './CampaignAnalyticsService.js';

const runners = global.campaignRunners || new Map();
global.campaignRunners = runners;
const startingRunners = global.campaignStartingRunners || new Set();
global.campaignStartingRunners = startingRunners;
const senderSendSlots = global.campaignSenderSendSlots || new Map();
global.campaignSenderSendSlots = senderSendSlots;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();
const normalizeRecipientEmail = (value = '') => normalizeEmail(String(value || '').split(/[;,/]/)[0] || '');
const MAX_CONCURRENT_CAMPAIGNS = Math.max(0, Number(process.env.MAX_CONCURRENT_CAMPAIGNS || 0));
const SENDING_LOCK_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.SENDING_LOCK_TTL_MS || 15 * 60 * 1000));
const DEFAULT_PROFILE_CREDITS = PLAN_LIMITS.Basic;
const CAMPAIGN_WORKER_ID = String(process.env.CAMPAIGN_WORKER_ID || 'web-worker').trim() || 'web-worker';
const WORKER_HEARTBEAT_INTERVAL_MS = Math.max(5000, Number(process.env.CAMPAIGN_WORKER_HEARTBEAT_MS || 15000));
const MIN_CAMPAIGN_SEND_GAP_SECONDS = Math.max(60, Number(process.env.MIN_CAMPAIGN_SEND_GAP_SECONDS || 60));
const DELAY_POLL_INTERVAL_MS = 250;

function senderThreadKey(account = {}) {
  const from = normalizeEmail(account?.from || account?.user || '');
  const provider = String(account?.provider || 'smtp').toLowerCase();
  return `${provider}:${from}`;
}

async function getStoredThreadForLead(lead, account, userEmail = '') {
  const recipientEmail = normalizeRecipientEmail(lead?.Email || lead?.email || lead?.thread?.recipientEmail || '');
  if (!recipientEmail) return null;
  const senderKey = senderThreadKey(account);
  const doc = await EmailThread.findOne({ userEmail, recipientEmail, senderKey }).lean();
  if (!doc) return null;
  return {
    messageId: doc.messageId || '',
    subject: doc.subject || '',
    recipientEmail,
    to: Array.isArray(doc.to) ? doc.to : [],
    cc: Array.isArray(doc.cc) ? doc.cc : [],
    references: Array.isArray(doc.references) ? doc.references : [],
    lastCampaignType: doc.lastCampaignType || '',
    updatedAt: doc.updatedAt || null
  };
}

async function upsertStoredThreadForLead(lead, account, thread, campaignType = '', userEmail = '') {
  if (!String(thread?.messageId || '').trim()) return;
  const recipientEmail = normalizeRecipientEmail(lead?.Email || lead?.email || thread?.recipientEmail || '');
  if (!recipientEmail) return;
  const senderKey = senderThreadKey(account);
  await EmailThread.updateOne(
    { userEmail, recipientEmail, senderKey },
    {
      $set: {
        userEmail,
        recipientEmail,
        senderKey,
        messageId: String(thread?.messageId || ''),
        subject: String(thread?.subject || ''),
        to: Array.isArray(thread?.to) ? thread.to : [],
        cc: Array.isArray(thread?.cc) ? thread.cc : [],
        references: Array.isArray(thread?.references) ? thread.references : [],
        provider: String(account?.provider || 'smtp'),
        lastCampaignType: String(campaignType || ''),
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
}

async function saveCampaignIfExists(campaign) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await campaign.save();
      return true;
    } catch (error) {
      if (error?.name === 'DocumentNotFoundError' || /No document found/i.test(error?.message || '')) {
        return false;
      }
      if (!isTransientInfrastructureError(error) || attempt === 3) {
        throw error;
      }
      await wait(500 * attempt);
    }
  }

  return false;
}

function isTransientInfrastructureError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket hang up') ||
    message.includes('connection') ||
    message.includes('topology') ||
    message.includes('server selection')
  );
}

function appendLog(campaign, message, level = 'info') {
  campaign.logs = campaign.logs || [];
  campaign.logs.push({ message, level, at: new Date() });
  if (campaign.logs.length > 200) {
    campaign.logs = campaign.logs.slice(-200);
  }
}

function campaignCounterSnapshot(campaign) {
  const failureCount = getCampaignFailureCount(campaign);
  return {
    status: campaign.status,
    sentCount: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
    pendingCount: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
    failedCount: failureCount,
    bounced: Number(campaign.stats?.bounced || 0),
    spam: Number(campaign.stats?.spam || 0),
    totalRecipients: Number(campaign.totalRecipients ?? campaign.stats?.total ?? 0),
    workerHeartbeatAt: campaign.workerHeartbeatAt || null
  };
}

function getCampaignFailureCount(campaign = {}) {
  return (
    Number(campaign?.stats?.failed || 0) +
    Number(campaign?.stats?.bounced || 0) +
    Number(campaign?.stats?.spam || 0)
  );
}

function syncCampaignProgressCounters(campaign) {
  const total = Number(campaign.stats?.total || 0);
  const sent = Number(campaign.stats?.sent || 0);
  const failed = getCampaignFailureCount(campaign);
  const pending = Math.max(0, total - sent - failed);

  campaign.totalRecipients = total;
  campaign.sentCount = sent;
  campaign.failedCount = failed;
  campaign.pendingCount = pending;
  campaign.stats.pending = pending;
  return campaign;
}

async function persistCampaignCounters(campaign, reason = 'progress') {
  const now = new Date();
  campaign.updatedAt = now;
  campaign.lastActivityAt = campaign.lastActivityAt || now;
  if (campaign.status === 'Running') {
    campaign.workerHeartbeatAt = now;
  }

  const snapshot = campaignCounterSnapshot(campaign);
  await Campaign.updateOne(
    { _id: campaign._id },
    {
      $set: {
        status: campaign.status,
        workerStatus: campaign.workerStatus || '',
        workerHeartbeatAt: campaign.workerHeartbeatAt || null,
        lastActivityAt: campaign.lastActivityAt || now,
        updatedAt: now,
        totalRecipients: snapshot.totalRecipients,
        sentCount: snapshot.sentCount,
        pendingCount: snapshot.pendingCount,
        failedCount: snapshot.failedCount,
        'stats.total': snapshot.totalRecipients,
        'stats.sent': snapshot.sentCount,
        'stats.pending': snapshot.pendingCount,
        'stats.failed': Number(campaign.stats?.failed || 0),
        'stats.bounced': snapshot.bounced,
        'stats.spam': snapshot.spam
      }
    }
  );
  console.info('[campaign:counter-update]', {
    campaignId: String(campaign._id),
    reason,
    ...snapshot
  });
}

function classifyDeliveryFailure(errorMessage = '') {
  const text = String(errorMessage || '').toLowerCase();
  if (
    text.includes('spam') ||
    text.includes('blocked') ||
    text.includes('policy') ||
    text.includes('junk')
  ) {
    return 'Spam';
  }

  if (
    text.includes('bounce') ||
    text.includes('mailbox unavailable') ||
    text.includes('recipient rejected') ||
    text.includes('invalid recipient') ||
    text.includes('user unknown') ||
    text.includes('address not found') ||
    text.includes('not found') ||
    text.includes('undeliverable') ||
    text.includes('5.1.1') ||
    text.includes('5.1.0') ||
    text.includes('5.2.1') ||
    text.includes('5.4.4') ||
    text.includes('5.7.1')
  ) {
    return 'Bounced';
  }

  return 'Failed';
}

function isCriticalSendError(errorMessage = '') {
  const text = String(errorMessage || '').toLowerCase();
  return (
    text.includes('sender account not found') ||
    text.includes('sender disconnected') ||
    text.includes('failed to get graph access token') ||
    text.includes('failed to refresh graph token') ||
    text.includes('invalid_client') ||
    text.includes('invalid client') ||
    text.includes('client secret') ||
    text.includes('unauthorized_client') ||
    text.includes('authorization_requestdenied') ||
    text.includes('access denied') ||
    text.includes('mail.send') ||
    text.includes('smtp auth') ||
    text.includes('authentication unsuccessful') ||
    text.includes('invalid login') ||
    text.includes('535 authentication') ||
    text.includes('graph app-only sending is disabled') ||
    text.includes('oauth account not found')
  );
}

async function reserveCampaignCredit(userEmail = '', campaignMeta = {}) {
  const normalizedUserEmail = normalizeEmail(userEmail);
  if (!normalizedUserEmail) return { ok: true, skipped: true };

  if (process.env.NODE_ENV === 'development') {
    return { ok: true, devBypass: true };
  }

  const { summary } = await getOrCreateSubscriptionSummary(normalizedUserEmail);
  if (summary.status !== 'active') {
    return { ok: false, message: 'Subscription is not active' };
  }
  if (summary.dailyRemainingCredits <= 0) {
    return { ok: false, message: 'Daily mail limit reached. You can send again tomorrow.' };
  }

  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const subscriptionReservation = await UserSubscription.findOneAndUpdate(
    {
      userEmail: normalizedUserEmail,
      status: 'active',
      dailyRemainingCredits: { $gt: 0 }
    },
    {
      $inc: {
        usedCredits: 1,
        usedToday: 1,
        remainingToday: -1,
        dailyUsedCredits: 1,
        dailyRemainingCredits: -1
      },
      $set: {
        lastDailyResetAt: todayStart,
        lastDailyReset: todayStart
      }
    },
    { new: true }
  ).lean();

  if (!subscriptionReservation) {
    const latest = await getOrCreateSubscriptionSummary(normalizedUserEmail);
    if (latest.summary.dailyRemainingCredits <= 0) {
      return { ok: false, message: 'Daily mail limit reached. You can send again tomorrow.' };
    }
    return { ok: false, message: 'Unable to reserve daily mail credit' };
  }

  const updated = await UserProfile.findOneAndUpdate(
    {
      $or: [
        { identifier: normalizedUserEmail },
        { email: normalizedUserEmail },
        { username: normalizedUserEmail },
        { employeeId: normalizedUserEmail },
        { intellisysUserId: normalizedUserEmail }
      ]
    },
    {
      $inc: {
        usedCredits: 1
      }
    },
    { new: true }
  ).lean();

  if (!updated) {
    const existingProfile = await UserProfile.findOne({ identifier: normalizedUserEmail })
      .select({ _id: 1, remainingCredits: 1 })
      .lean();

    if (existingProfile) {
      await UserSubscription.updateOne(
        { userEmail: normalizedUserEmail },
        {
          $inc: {
            usedCredits: -1,
            usedToday: -1,
            remainingToday: 1,
            dailyUsedCredits: -1,
            dailyRemainingCredits: 1
          }
        }
      );
      return { ok: false, message: 'Unable to reserve daily mail credit' };
    }

    const createdProfile = await UserProfile.findOneAndUpdate(
      { identifier: normalizedUserEmail },
      {
        $setOnInsert: {
          identifier: normalizedUserEmail,
          intellisysUserId: normalizedUserEmail,
          email: normalizedUserEmail,
          username: normalizedUserEmail,
          status: USER_ACCOUNT_STATUSES.ACTIVE,
          role: 'user',
          totalCredits: DEFAULT_PROFILE_CREDITS,
          usedCredits: 1,
          remainingCredits: DEFAULT_PROFILE_CREDITS,
          creditUsagePercent: 0
        }
      },
      { new: true, upsert: true }
    ).lean();

    await CreditTransaction.create({
      userEmail: normalizedUserEmail,
      type: 'debit',
      reason: 'credit_reserved_for_send',
      credits: 1,
      balanceAfter: Math.max(0, Number(subscriptionReservation?.dailyRemainingCredits || 0)),
      campaignId: campaignMeta.campaignId || null,
      campaignName: campaignMeta.campaignName || '',
      recipientEmail: campaignMeta.recipientEmail || '',
      meta: { source: 'campaignRunner', profileCreated: true, project: campaignMeta.project || '', projectId: campaignMeta.projectId || '', projectName: campaignMeta.projectName || '' }
    });

    return { ok: true, profileCreated: true };
  }

  await CreditTransaction.create({
    userEmail: normalizedUserEmail,
    type: 'debit',
    reason: 'credit_reserved_for_send',
    credits: 1,
    balanceAfter: Math.max(0, Number(subscriptionReservation?.dailyRemainingCredits || 0)),
    campaignId: campaignMeta.campaignId || null,
    campaignName: campaignMeta.campaignName || '',
    recipientEmail: campaignMeta.recipientEmail || '',
    meta: { source: 'campaignRunner', project: campaignMeta.project || '', projectId: campaignMeta.projectId || '', projectName: campaignMeta.projectName || '' }
  });

  return { ok: true };
}

async function refundCampaignCredit(userEmail = '', campaignMeta = {}) {
  const normalizedUserEmail = normalizeEmail(userEmail);
  if (!normalizedUserEmail) return;

  if (process.env.NODE_ENV === 'development') {
    return;
  }

  const updated = await UserProfile.findOneAndUpdate(
    { identifier: normalizedUserEmail },
    {
      $inc: {
        usedCredits: -1
      }
    },
    { new: true }
  ).lean();

  await CreditTransaction.create({
    userEmail: normalizedUserEmail,
    campaignId: campaignMeta.campaignId || null,
    campaignName: campaignMeta.campaignName || '',
    recipientEmail: campaignMeta.recipientEmail || '',
    type: 'credit',
    reason: campaignMeta.reason || 'send_failed_refund',
    credits: 1,
    balanceAfter: Math.max(0, Number(updated?.remainingCredits || 0)),
    meta: { source: 'campaignRunner', status: campaignMeta.status || 'Failed' }
  });

  await UserSubscription.updateOne(
    { userEmail: normalizedUserEmail },
    {
      $inc: {
        usedCredits: -1,
        usedToday: -1,
        remainingToday: 1,
        dailyUsedCredits: -1,
        dailyRemainingCredits: 1
      }
    }
  );
}

async function persistLeadProgress(listId, idx, lead) {
  const thread = lead?.thread || {};
  const result = await LeadList.updateOne(
    { _id: listId },
    {
      $set: {
        [`leads.${idx}.status`]: lead.status || 'Pending',
        [`leads.${idx}.error`]: lead.error || '',
        [`leads.${idx}.sentAt`]: lead.sentAt || null,
        [`leads.${idx}.failedAt`]: lead.failedAt || null,
        [`leads.${idx}.sendingStartedAt`]: lead.sendingStartedAt || null,
        [`leads.${idx}.thread.messageId`]: String(thread.messageId || ''),
        [`leads.${idx}.thread.subject`]: String(thread.subject || ''),
        [`leads.${idx}.thread.recipientEmail`]: String(thread.recipientEmail || ''),
        [`leads.${idx}.thread.to`]: Array.isArray(thread.to) ? thread.to : [],
        [`leads.${idx}.thread.cc`]: Array.isArray(thread.cc) ? thread.cc : [],
        [`leads.${idx}.thread.references`]: Array.isArray(thread.references) ? thread.references : [],
        [`leads.${idx}.thread.lastCampaignType`]: String(thread.lastCampaignType || ''),
        [`leads.${idx}.thread.campaignName`]: String(thread.campaignName || ''),
        [`leads.${idx}.thread.updatedAt`]: thread.updatedAt || null
      }
    }
  );

  if (!result.matchedCount) {
    throw new Error(`Lead list not found for campaign update: ${listId}`);
  }
}

function getLeadField(lead = {}, keys = []) {
  for (const key of keys) {
    const value = lead?.[key] ?? lead?.data?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

async function upsertRecipientLogForLead({ campaign, lead, idx, status = 'Pending', stepNumber = 1, trackingId = '', failureReason = '', sendResult = null, provider = '' }) {
  const email = normalizeRecipientEmail(lead?.Email || lead?.email || '');
  if (!email || !campaign?._id) return null;
  const now = new Date();
  const existing = await CampaignRecipientLog.findOne({ campaignId: campaign._id, email }).lean();
  const stepLogs = ensureStepLogs(existing?.stepLogs || [], 5);
  const stepIndex = Math.max(0, Math.min(stepLogs.length - 1, Number(stepNumber || 1) - 1));
  const step = {
    ...stepLogs[stepIndex],
    stepNumber,
    status,
    trackingId: trackingId || stepLogs[stepIndex]?.trackingId || '',
    messageId: sendResult?.messageId || stepLogs[stepIndex]?.messageId || '',
    internetMessageId: sendResult?.internetMessageId || stepLogs[stepIndex]?.internetMessageId || '',
    conversationId: sendResult?.conversationId || stepLogs[stepIndex]?.conversationId || '',
    failureReason: failureReason || stepLogs[stepIndex]?.failureReason || '',
    provider: provider || stepLogs[stepIndex]?.provider || ''
  };
  if (status === 'Sent') step.sentAt = lead.sentAt || now;
  if (['Failed', 'Bounced', 'Spam'].includes(status)) step.failedAt = lead.failedAt || now;
  stepLogs[stepIndex] = step;
  const failed = ['Failed', 'Bounced', 'Spam'].includes(status);
  const sent = status === 'Sent';
  return CampaignRecipientLog.findOneAndUpdate(
    { campaignId: campaign._id, email },
    {
      $setOnInsert: {
        userId: campaign.userId || null,
        userEmail: campaign.userEmail || '',
        campaignId: campaign._id,
        projectId: campaign.projectId || campaign.project || '',
        projectName: normalizeProjectName(campaign.projectName || campaign.project || ''),
        recipientId: String(idx),
        recipientEmail: email,
        clientName: [getLeadField(lead, ['Name', 'name']), getLeadField(lead, ['Surname', 'surname'])].filter(Boolean).join(' '),
        recipientName: [getLeadField(lead, ['Name', 'name']), getLeadField(lead, ['Surname', 'surname'])].filter(Boolean).join(' '),
        email,
        company: getLeadField(lead, ['Company', 'company', 'Organization', 'Organisation']),
        designation: getLeadField(lead, ['Designation', 'designation', 'Title', 'title']),
        totalSteps: 5
      },
      $set: {
        campaignName: String(campaign.name || ''),
        status,
        currentStep: stepNumber,
        stepLogs,
        sentCount: sent ? Math.max(1, Number(existing?.sentCount || 0)) : Number(existing?.sentCount || 0),
        failedCount: failed ? Math.max(1, Number(existing?.failedCount || 0)) : Number(existing?.failedCount || 0),
        pendingCount: status === 'Pending' || status === 'Sending' ? 1 : 0,
        skippedCount: status === 'Skipped' ? 1 : Number(existing?.skippedCount || 0),
        lastSentAt: sent ? (lead.sentAt || now) : existing?.lastSentAt || null,
        lastFailedAt: failed ? (lead.failedAt || now) : existing?.lastFailedAt || null,
        failureReason: failed ? classifyFailureReason(failureReason || lead.error || status) : existing?.failureReason || '',
        bounceReason: status === 'Bounced' ? classifyFailureReason(failureReason || lead.error || status) : existing?.bounceReason || '',
        lastActivityAt: now
      }
    },
    { upsert: true, new: true }
  ).lean();
}

async function claimLeadForSend(listId, idx, claimedAt = new Date()) {
  const staleBefore = new Date(claimedAt.getTime() - SENDING_LOCK_TTL_MS);
  const result = await LeadList.updateOne(
    {
      _id: listId,
      $or: [
        { [`leads.${idx}.status`]: 'Pending' },
        { [`leads.${idx}.status`]: 'Failed' },
        { [`leads.${idx}.status`]: 'Sent' },
        { [`leads.${idx}.status`]: 'Bounced' },
        { [`leads.${idx}.status`]: 'Spam' },
        {
          [`leads.${idx}.status`]: 'Sending',
          [`leads.${idx}.sendingStartedAt`]: { $lt: staleBefore }
        }
      ]
    },
    {
      $set: {
        [`leads.${idx}.status`]: 'Sending',
        [`leads.${idx}.error`]: '',
        [`leads.${idx}.sendingStartedAt`]: claimedAt
      }
    }
  );

  return Boolean(result.modifiedCount);
}

async function claimRecipientForCampaign(campaignId, listId, idx, recipientEmail, claimedAt = new Date()) {
  if (!recipientEmail) return false;

  const reusedFailedClaim = await CampaignRecipientClaim.updateOne(
    { campaignId, recipientEmail, status: 'Failed' },
    {
      $set: {
        listId,
        leadIndex: idx,
        status: 'Sending',
        claimedAt,
        sentAt: null,
        failedAt: null,
        error: ''
      }
    }
  );

  if (reusedFailedClaim.modifiedCount) {
    return true;
  }

  try {
    await CampaignRecipientClaim.create({
      campaignId,
      recipientEmail,
      listId,
      leadIndex: idx,
      status: 'Sending',
      claimedAt
    });
    return true;
  } catch (error) {
    if (error?.code === 11000) {
      return false;
    }
    throw error;
  }
}

async function markRecipientClaimStatus(campaignId, recipientEmail, status, extra = {}) {
  if (!recipientEmail) return;

  const update = {
    status,
    error: String(extra.error || '')
  };

  if (status === 'Sent') {
    update.sentAt = extra.sentAt || new Date();
    update.failedAt = null;
  } else if (status === 'Failed' || status === 'Bounced' || status === 'Spam') {
    update.failedAt = extra.failedAt || new Date();
    update.sentAt = null;
  }

  await CampaignRecipientClaim.updateOne(
    { campaignId, recipientEmail },
    { $set: update }
  );
}

function parseRowRange(rowRange = '', totalLeads = 0) {
  const match = String(rowRange || '').trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  const start = Math.max(1, Number(match[1]));
  const end = Math.min(Number(match[2]), totalLeads);
  if (!start || !end || start > end) return null;
  return { start, end };
}

function shouldRefreshHeartbeat(lastBeatAt = 0) {
  return !lastBeatAt || (Date.now() - lastBeatAt) >= WORKER_HEARTBEAT_INTERVAL_MS;
}

async function syncCampaignHeartbeat(campaign, lastHeartbeatAt = 0) {
  if (shouldRefreshHeartbeat(lastHeartbeatAt)) {
    campaign.workerHeartbeatAt = new Date();
    await saveCampaignIfExists(campaign);
    return Date.now();
  }
  return lastHeartbeatAt;
}

async function waitForCampaignDelay(state, campaign, delayMs, lastHeartbeatAt = 0) {
  const nextSendAt = new Date(Date.now() + delayMs);
  appendLog(campaign, `Next send scheduled at ${nextSendAt.toISOString()}`);
  await saveCampaignIfExists(campaign);

  let heartbeatAt = lastHeartbeatAt;
  while (Date.now() < nextSendAt.getTime()) {
    if (state.stop) {
      return { completed: false, interruptedBy: 'stop', lastHeartbeatAt: heartbeatAt };
    }

    if (state.paused) {
      return { completed: false, interruptedBy: 'pause', lastHeartbeatAt: heartbeatAt };
    }

    heartbeatAt = await syncCampaignHeartbeat(campaign, heartbeatAt);
    const remainingMs = Math.max(0, nextSendAt.getTime() - Date.now());
    await wait(Math.min(DELAY_POLL_INTERVAL_MS, remainingMs));
  }

  return { completed: true, interruptedBy: '', lastHeartbeatAt: heartbeatAt };
}

async function waitForSenderSendSlot(state, campaign, account, gapMs, lastHeartbeatAt = 0) {
  const senderKey = senderThreadKey(account);
  const now = Date.now();
  const reservedAt = Math.max(now, Number(senderSendSlots.get(senderKey) || 0));
  senderSendSlots.set(senderKey, reservedAt + gapMs);

  if (reservedAt <= now) {
    return { completed: true, interruptedBy: '', lastHeartbeatAt };
  }

  appendLog(campaign, `Sender throttle: next mail from ${account.from || account.user || 'sender'} at ${new Date(reservedAt).toISOString()}`);
  await saveCampaignIfExists(campaign);

  let heartbeatAt = lastHeartbeatAt;
  while (Date.now() < reservedAt) {
    if (state.stop) {
      return { completed: false, interruptedBy: 'stop', lastHeartbeatAt: heartbeatAt };
    }

    if (state.paused) {
      senderSendSlots.set(senderKey, Math.max(Date.now(), Number(senderSendSlots.get(senderKey) || 0)));
      return { completed: false, interruptedBy: 'pause', lastHeartbeatAt: heartbeatAt };
    }

    heartbeatAt = await syncCampaignHeartbeat(campaign, heartbeatAt);
    const remainingMs = Math.max(0, reservedAt - Date.now());
    await wait(Math.min(DELAY_POLL_INTERVAL_MS, remainingMs));
  }

  return { completed: true, interruptedBy: '', lastHeartbeatAt: heartbeatAt };
}

export async function validateCampaignExecutionPreflight(campaign, options = {}) {
  await connectDB();

  if (!campaign?._id) {
    throw new Error('Campaign not found');
  }

  const campaignUserEmail = normalizeEmail(campaign.userEmail || '');
  const requestUserEmail = normalizeEmail(options?.userEmail || '');
  if (requestUserEmail && campaignUserEmail && campaignUserEmail !== requestUserEmail) {
    throw new Error('You cannot start another user campaign');
  }

  const profile = campaignUserEmail
    ? await UserProfile.findOne({
        $or: [
          { identifier: campaignUserEmail },
          { email: campaignUserEmail },
          { username: campaignUserEmail },
          { employeeId: campaignUserEmail },
          { intellisysUserId: campaignUserEmail }
        ]
      }).lean()
    : null;
  if (!profile && process.env.NODE_ENV === 'production') {
    throw new Error('User profile not found for campaign owner');
  }

  const list = await LeadList.findById(campaign.listId).lean();
  if (!list) {
    throw new Error('Lead list not found');
  }
  const listUserEmail = normalizeEmail(list.userEmail || '');
  if (campaignUserEmail && listUserEmail && listUserEmail !== campaignUserEmail) {
    throw new Error('Lead list does not belong to campaign owner');
  }

  const validLeads = Array.isArray(list.leads)
    ? list.leads.filter((lead) => normalizeRecipientEmail(lead?.Email || lead?.email || ''))
    : [];
  if (!validLeads.length) {
    throw new Error('Recipient list is empty');
  }

  const hasPendingRecipients = validLeads.some((lead) => {
    const status = String(lead?.status || '').toLowerCase();
    return !['sent', 'failed', 'bounced', 'spam'].includes(status);
  });
  if (campaignUserEmail && hasPendingRecipients) {
    const { summary } = await getOrCreateSubscriptionSummary(campaignUserEmail, profile);
    if (summary.status !== 'active') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dev Mode Bypass] Subscription status is not active for ${campaignUserEmail}, but allowing execution.`);
      } else {
        throw new Error('Subscription is not active');
      }
    }
    if (summary.dailyRemainingCredits <= 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dev Mode Bypass] Daily limit is reached for ${campaignUserEmail}, but allowing execution.`);
      } else {
        throw new Error('Daily mail limit reached. You can send again tomorrow.');
      }
    }
    if (summary.sendingDisabled) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dev Mode Bypass] Sending is disabled for ${campaignUserEmail}, but allowing execution.`);
      } else {
        throw new Error('Sending is disabled for this account.');
      }
    }
  }

  const templateFromDb = campaign.templateId ? await EmailTemplate.findById(campaign.templateId).lean() : null;
  if (templateFromDb) {
    const templateUserEmail = normalizeEmail(templateFromDb.userEmail || '');
    if (campaignUserEmail && templateUserEmail && templateUserEmail !== campaignUserEmail) {
      throw new Error('Template does not belong to campaign owner');
    }
  }
  const inlineTemplate = campaign.inlineTemplate?.subject && (campaign.inlineTemplate?.bodyHtml || campaign.inlineTemplate?.body)
    ? { subject: campaign.inlineTemplate.subject, body: campaign.inlineTemplate.body, bodyHtml: campaign.inlineTemplate.bodyHtml, bodyText: campaign.inlineTemplate.bodyText }
    : null;
  if (!inlineTemplate && !templateFromDb) {
    throw new Error('Template not found');
  }

  if (campaign.senderAccountId) {
    const sender = await resolveSenderAccountById(campaign.senderAccountId, {
      userEmail: campaign.userEmail || '',
      project: campaign.project || '',
      senderFrom: campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user || ''
    });
    if (!sender) {
      throw new Error('No sender account found for this user');
    }
    console.info('[sender_account_resolved]', {
      campaignId: String(campaign._id || ''),
      userEmail: campaign.userEmail || '',
      provider: sender.provider || 'smtp',
      sender: sender.from || sender.user || '',
      project: campaign.project || ''
    });
    const senderStatus = String(sender.status || 'Connected').trim().toLowerCase();
    if (senderStatus && !['connected', 'active', 'good', 'verified'].includes(senderStatus)) {
      throw new Error(`Sender account is not connected: ${sender.status}`);
    }
  } else if (!campaign.senderAccount?.provider && campaign.senderFrom) {
    const sender = await resolveSenderAccountById(`graphapp:${normalizeEmail(campaign.senderFrom)}`, {
      userEmail: campaign.userEmail || '',
      project: campaign.project || '',
      senderFrom: campaign.senderFrom
    });
    if (!sender && !getAvailableAccounts().length) {
      throw new Error('No sender account configured');
    }
  } else if (!campaign.senderAccount?.provider && !getAvailableAccounts().length) {
    throw new Error('No sender account configured');
  }

  return { list, template: inlineTemplate || templateFromDb };
}

export async function startCampaignRunner(campaignId, options = {}) {
  if (startingRunners.has(campaignId)) {
    return { started: false, message: 'Campaign start already in progress' };
  }

  startingRunners.add(campaignId);

  try {
    await connectDB();
  const trigger = String(options?.trigger || 'manual').toLowerCase();

  if (runners.get(campaignId)?.running) {
    return { started: false, message: 'Campaign already running' };
  }

  const runningCount = Array.from(runners.values()).filter((state) => state?.running).length;
  if (MAX_CONCURRENT_CAMPAIGNS > 0 && runningCount >= MAX_CONCURRENT_CAMPAIGNS) {
    return {
      started: false,
      message: `Maximum concurrent running campaigns reached (${MAX_CONCURRENT_CAMPAIGNS}).`
    };
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  appendLog(campaign, `Runner start requested (${trigger})`);

  const list = await LeadList.findById(campaign.listId);
  const templateFromDb = campaign.templateId ? await EmailTemplate.findById(campaign.templateId) : null;
  const inlineTemplate = campaign.inlineTemplate?.subject && (campaign.inlineTemplate?.bodyHtml || campaign.inlineTemplate?.body)
    ? { subject: campaign.inlineTemplate.subject, body: campaign.inlineTemplate.body, bodyHtml: campaign.inlineTemplate.bodyHtml, bodyText: campaign.inlineTemplate.bodyText }
    : null;

  if (!list || (!inlineTemplate && !templateFromDb)) {
    appendLog(campaign, 'Runner blocked: list or template missing', 'error');
    throw new Error('List or template missing');
  }

  let accounts = [];
  if (campaign.senderAccountId) {
    appendLog(campaign, `Resolving sender account ${campaign.senderAccountId}`);
    const resolved = await resolveSenderAccountById(campaign.senderAccountId, {
      userEmail: campaign.userEmail || '',
      project: campaign.project || '',
      senderFrom: campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user || ''
    });
    if (!resolved) {
      appendLog(campaign, `Sender account not found: ${campaign.senderAccountId}`, 'error');
      throw new Error('Sender account not found');
    }
    appendLog(campaign, `Sender resolved: ${resolved.provider || 'smtp'} | ${resolved.from || resolved.user || 'unknown'}`);
    console.info('[sender_account_resolved]', {
      campaignId: String(campaign._id || ''),
      userEmail: campaign.userEmail || '',
      provider: resolved.provider || 'smtp',
      sender: resolved.from || resolved.user || '',
      project: campaign.project || ''
    });
    accounts = [resolved];
  } else if (campaign.senderAccount?.provider) {
    appendLog(campaign, `Using sender snapshot: ${campaign.senderAccount.provider} | ${campaign.senderAccount.from || 'unknown'}`);
    accounts = [campaign.senderAccount];
  } else if (campaign.senderFrom) {
    appendLog(campaign, `Resolving sender from campaign sender email ${campaign.senderFrom}`);
    const resolved = await resolveSenderAccountById(`graphapp:${normalizeEmail(campaign.senderFrom)}`, {
      userEmail: campaign.userEmail || '',
      project: campaign.project || '',
      senderFrom: campaign.senderFrom
    });
    accounts = resolved ? [resolved] : getAvailableAccounts();
  } else {
    appendLog(campaign, 'Using runtime sender accounts');
    accounts = getAvailableAccounts();
  }

  if (!accounts.length) {
    appendLog(campaign, 'Runner blocked: no email provider account configured', 'error');
    throw new Error('No email provider account configured. Set Graph (TENANT_ID/CLIENT_ID/CLIENT_SECRET/GRAPH_SENDER_EMAIL) or SMTP env values.');
  }

  const startTime = new Date();
  const claimQuery = trigger === 'recovery'
    ? {
        _id: campaign._id,
        status: 'Running',
        startedAt: campaign.startedAt || null
      }
      : {
          _id: campaign._id,
          status: { $in: ['Draft', 'Queued', 'Paused', 'Scheduled'] }
        };
  const claim = await Campaign.updateOne(
    claimQuery,
    {
      $set: {
        status: 'Running',
        startedAt: startTime,
        scheduledAt: null,
        queueRequestedAt: null,
        queueReason: '',
        workerId: CAMPAIGN_WORKER_ID,
        workerLockedBy: CAMPAIGN_WORKER_ID,
        workerStatus: 'running',
        workerLockedAt: startTime,
        workerHeartbeatAt: startTime,
        lastRunError: '',
        lastRunErrorAt: null
      }
    }
  );

  if (!claim.matchedCount) {
    return { started: false, message: 'Campaign already started by another process' };
  }

  const state = { running: true, paused: false, stop: false, stopReason: '' };
  runners.set(campaignId, state);
  const campaignType = String(campaign.type || campaign.draftType || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const replyMode = typeof campaign.options?.replyMode === 'boolean'
    ? campaign.options.replyMode
    : ['reminder', 'follow_up', 'updated_cost', 'final_cost'].includes(campaignType);
  const selectedRange = parseRowRange(campaign.options?.rowRange, list.leads.length);
  const configuredBatchSize = Math.max(1, Math.floor(Number(campaign.options?.batchSize || 1) || 1));
  const configuredDelaySeconds = Math.max(
    MIN_CAMPAIGN_SEND_GAP_SECONDS,
    Math.floor(Number(campaign.options?.delaySeconds || MIN_CAMPAIGN_SEND_GAP_SECONDS) || MIN_CAMPAIGN_SEND_GAP_SECONDS)
  );
  const allowedIndexes = selectedRange
    ? new Set(Array.from({ length: selectedRange.end - selectedRange.start + 1 }, (_, i) => selectedRange.start - 1 + i))
    : null;
  const scopedLeads = allowedIndexes ? list.leads.filter((_, idx) => allowedIndexes.has(idx)) : list.leads;
  const existingClaims = await CampaignRecipientClaim.find({ campaignId: campaign._id }).lean();
  const claimStatusByEmail = existingClaims.reduce((map, claim) => {
    const email = normalizeRecipientEmail(claim?.recipientEmail || '');
    if (email) map.set(email, String(claim?.status || '').toLowerCase());
    return map;
  }, new Map());
  const claimErrorByEmail = existingClaims.reduce((map, claim) => {
    const email = normalizeRecipientEmail(claim?.recipientEmail || '');
    if (email) map.set(email, String(claim?.error || ''));
    return map;
  }, new Map());
  const scopedClaimStatuses = scopedLeads.map((lead) => {
    const email = normalizeRecipientEmail(lead?.Email || lead?.email || '');
    return email ? claimStatusByEmail.get(email) || '' : '';
  });

  campaign.status = 'Running';
  campaign.startedAt = startTime;
  campaign.scheduledAt = null;
  campaign.queueReason = '';
  campaign.workerId = CAMPAIGN_WORKER_ID;
  campaign.workerLockedBy = CAMPAIGN_WORKER_ID;
  campaign.workerStatus = 'running';
  campaign.workerLockedAt = startTime;
  campaign.workerHeartbeatAt = startTime;
  campaign.lastRunError = '';
  campaign.lastRunErrorAt = null;
  const scopedSent = scopedClaimStatuses.filter((status) => status === 'sent').length;
  const scopedFailed = scopedLeads.filter((lead) => {
    const email = normalizeRecipientEmail(lead?.Email || lead?.email || '');
    const status = email ? claimStatusByEmail.get(email) || '' : '';
    const error = email ? claimErrorByEmail.get(email) || '' : '';
    return status === 'failed' && !isCriticalSendError(error);
  }).length;
  const scopedBounced = scopedClaimStatuses.filter((status) => status === 'bounced').length;
  const scopedSpam = scopedClaimStatuses.filter((status) => status === 'spam').length;
  campaign.stats.total = scopedLeads.length;
  campaign.stats.sent = scopedSent;
  campaign.stats.failed = scopedFailed;
  campaign.stats.bounced = scopedBounced;
  campaign.stats.spam = scopedSpam;
  syncCampaignProgressCounters(campaign);
  appendLog(campaign, `Provider: ${accounts[0].provider || 'smtp'} | Sender: ${accounts[0].from || accounts[0].user || 'unknown'}`);
  appendLog(campaign, `Campaign worker claimed: ${CAMPAIGN_WORKER_ID}`);
  console.info('[campaign_runner_started]', {
    campaignId: String(campaign._id || ''),
    userEmail: campaign.userEmail || '',
    provider: accounts[0].provider || 'smtp',
    sender: accounts[0].from || accounts[0].user || '',
    totalRecipients: scopedLeads.length,
    draftType: campaignType,
    htmlLength: String((inlineTemplate || templateFromDb)?.bodyHtml || (inlineTemplate || templateFromDb)?.body || '').length
  });
  if (trigger === 'scheduler') {
    appendLog(campaign, 'Campaign auto-started by scheduler');
  }
  if (selectedRange) {
    appendLog(campaign, `Row range selected: ${selectedRange.start}-${selectedRange.end}`);
  }
  appendLog(campaign, 'Campaign started');
  if (!(await saveCampaignIfExists(campaign))) {
    state.running = false;
    return { started: false, message: 'Campaign was removed before start' };
  }

  const delayMs = configuredDelaySeconds * 1000;
  appendLog(
    campaign,
    configuredBatchSize > 1
      ? `Mail gap: ${configuredDelaySeconds} seconds between emails (batch size setting: ${configuredBatchSize})`
      : `Mail gap: ${configuredDelaySeconds} seconds between emails`
  );

  (async () => {
    try {
      let lastHeartbeatAt = Date.now();
      const pendingIndexes = [];
      const now = Date.now();
      list.leads.forEach((lead, idx) => {
        if (allowedIndexes && !allowedIndexes.has(idx)) {
          return;
        }

        const recipientEmail = normalizeRecipientEmail(lead?.Email || lead?.email || '');
        if (!recipientEmail) {
          pendingIndexes.push(idx);
          return;
        }

        const campaignRecipientStatus = claimStatusByEmail.get(recipientEmail) || '';
        const previousClaimError = claimErrorByEmail.get(recipientEmail) || '';
        const retryableSenderFailure = campaignRecipientStatus === 'failed' && isCriticalSendError(previousClaimError);
        if (['sent', 'bounced', 'spam'].includes(campaignRecipientStatus) || (campaignRecipientStatus === 'failed' && !retryableSenderFailure)) {
          return;
        }

        const normalizedStatus = String(lead.status || '').toLowerCase();
        const sendingStartedAtMs = lead?.sendingStartedAt ? new Date(lead.sendingStartedAt).getTime() : 0;
        const hasFreshSendingLock = normalizedStatus === 'sending' && sendingStartedAtMs && (now - sendingStartedAtMs) < SENDING_LOCK_TTL_MS;

        if (hasFreshSendingLock) {
          return;
        }

        pendingIndexes.push(idx);
        if (normalizedStatus !== 'failed' || retryableSenderFailure) {
          lead.status = 'Pending';
          lead.sendingStartedAt = null;
          if (retryableSenderFailure) {
            lead.error = '';
            lead.failedAt = null;
          }
        }
      });
      await list.save();

      for (let i = 0; i < pendingIndexes.length; i += 1) {
        if (state.stop) {
          appendLog(campaign, 'Campaign stopped');
          break;
        }

        while (state.paused) {
          campaign.status = 'Paused';
          if (shouldRefreshHeartbeat(lastHeartbeatAt)) {
            campaign.workerHeartbeatAt = new Date();
            lastHeartbeatAt = Date.now();
          }
          if (!(await saveCampaignIfExists(campaign))) {
            state.running = false;
            return;
          }
          await wait(1000);
        }

        campaign.status = 'Running';
        lastHeartbeatAt = await syncCampaignHeartbeat(campaign, lastHeartbeatAt);
        const idx = pendingIndexes[i];
        const lead = list.leads[idx];
        const recipientEmail = normalizeRecipientEmail(lead?.Email || lead?.email || '');
        if (!recipientEmail) {
          lead.status = 'Failed';
          lead.error = 'Lead has no email address';
          lead.failedAt = new Date();
          lead.sendingStartedAt = null;
          campaign.stats.failed += 1;
          syncCampaignProgressCounters(campaign);
          appendLog(campaign, `Failed: unknown - Lead has no email address`, 'error');
          await persistLeadProgress(list._id, idx, lead);
          if (!(await saveCampaignIfExists(campaign))) {
            state.running = false;
            return;
          }
          continue;
        }
        const existingRecipientLog = await CampaignRecipientLog.findOne({ campaignId: campaign._id, email: recipientEmail }).lean();
        const hasBlockingReply = existingRecipientLog?.replyReceived && existingRecipientLog?.replyType !== 'auto-reply';
        if (hasBlockingReply || existingRecipientLog?.followUpStopped || existingRecipientLog?.dnc || existingRecipientLog?.unsubscribe) {
          lead.status = 'Failed';
          lead.error = existingRecipientLog?.followUpStopReason || 'Client replied - follow-up stopped';
          lead.failedAt = new Date();
          lead.sendingStartedAt = null;
          campaign.stats.failed += 1;
          syncCampaignProgressCounters(campaign);
          const stepLogs = ensureStepLogs(existingRecipientLog?.stepLogs || [], 5).map((step) => (
            Number(step.stepNumber) > 1 && !['Sent', 'Opened', 'Replied'].includes(step.status)
              ? { ...step, status: 'Skipped', skippedAt: step.skippedAt || new Date(), failureReason: 'Client replied - follow-up stopped' }
              : step
          ));
          await CampaignRecipientLog.updateOne(
            { _id: existingRecipientLog._id },
            {
              $set: {
                status: 'Follow-up Stopped',
                followUpStopped: true,
                followUpStopReason: existingRecipientLog?.followUpStopReason || 'Client replied - follow-up stopped',
                stepLogs,
                lastActivityAt: new Date()
              }
            }
          );
          appendLog(campaign, `Skipped follow-up for ${recipientEmail}: Client replied - follow-up stopped`);
          await persistLeadProgress(list._id, idx, lead);
          await refreshCampaignRollups(campaign._id).catch(() => {});
          if (!(await saveCampaignIfExists(campaign))) {
            state.running = false;
            return;
          }
          continue;
        }
        const claimedAt = new Date();
        const claimed = await claimLeadForSend(list._id, idx, claimedAt);
        if (!claimed) {
          continue;
        }
        const claimedRecipient = await claimRecipientForCampaign(campaign._id, list._id, idx, recipientEmail, claimedAt);
        if (!claimedRecipient) {
          lead.status = 'Failed';
          lead.error = 'Skipped duplicate recipient in this campaign';
          lead.sentAt = null;
          lead.failedAt = new Date();
          lead.sendingStartedAt = null;
          campaign.stats.failed += 1;
          syncCampaignProgressCounters(campaign);
          appendLog(campaign, `Skipped duplicate recipient: ${recipientEmail}`);
          await persistLeadProgress(list._id, idx, lead);
          if (!(await saveCampaignIfExists(campaign))) {
            state.running = false;
            return;
          }
          continue;
        }
        lead.status = 'Sending';
        lead.error = '';
        lead.sendingStartedAt = claimedAt;
        const currentStep = Math.max(1, Number(campaign.workflowStep || 1));
        const trackingId = buildTrackingId(campaign._id, recipientEmail, currentStep);
        await upsertRecipientLogForLead({
          campaign,
          lead,
          idx,
          status: 'Sending',
          stepNumber: currentStep,
          trackingId
        });

        const creditReservation = await reserveCampaignCredit(campaign.userEmail || '', {
          campaignId: campaign._id,
          campaignName: campaign.name,
          recipientEmail,
          project: campaign.project,
          projectId: campaign.projectId,
          projectName: campaign.projectName
        });
        if (!creditReservation.ok) {
          lead.status = 'Failed';
          lead.error = creditReservation.message || 'Credit limit reached';
          lead.failedAt = new Date();
          lead.sendingStartedAt = null;
          campaign.stats.failed += 1;
          syncCampaignProgressCounters(campaign);
          campaign.failureReason = classifyFailureReason(creditReservation.message || 'Credit limit reached');
          campaign.lastError = creditReservation.message || 'Credit limit reached';
          campaign.lastErrorAt = new Date();
          campaign.lastActivityAt = new Date();
          appendLog(campaign, `Campaign stopped: ${creditReservation.message || 'Credit limit reached'}`, 'error');
          await upsertRecipientLogForLead({
            campaign,
            lead,
            idx,
            status: 'Failed',
            stepNumber: currentStep,
            trackingId,
            failureReason: creditReservation.message || 'Credit limit reached'
          });
          await persistLeadProgress(list._id, idx, lead);
          if (!(await saveCampaignIfExists(campaign))) {
            state.running = false;
            return;
          }
          if (process.env.NODE_ENV !== 'development') {
            state.stop = true;
            state.stopReason = 'credit_limit';
            break;
          }
          appendLog(campaign, 'Credit limit reached, but continuing in development mode.', 'info');
          continue;
        }

        const account = accounts[(campaign.stats.sent + campaign.stats.failed) % accounts.length];
        const selectedTemplate = inlineTemplate || templateFromDb;
        const storedThread = await getStoredThreadForLead(lead, account, campaign.userEmail || '');
        const replyContext = lead?.thread?.messageId ? lead.thread : storedThread;
        const senderSlot = await waitForSenderSendSlot(state, campaign, account, delayMs, lastHeartbeatAt);
        lastHeartbeatAt = senderSlot.lastHeartbeatAt;
        if (!senderSlot.completed) {
          lead.status = 'Pending';
          lead.error = '';
          lead.sendingStartedAt = null;
          await persistLeadProgress(list._id, idx, lead);
          await CampaignRecipientClaim.deleteOne({
            campaignId: campaign._id,
            recipientEmail,
            status: 'Sending'
          }).catch(() => {});
          await CampaignRecipientLog.updateOne(
            { campaignId: campaign._id, email: recipientEmail, status: 'Sending' },
            {
              $set: {
                status: 'Pending',
                pendingCount: 1,
                lastActivityAt: new Date()
              }
            }
          ).catch(() => {});
          if (senderSlot.interruptedBy === 'pause') {
            i -= 1;
          }
          continue;
        }

        try {
          appendLog(campaign, `Sending to ${recipientEmail} with ${account.provider || 'smtp'} via ${account.from || account.user || 'unknown'}`);
          console.info('[lead_send_started]', {
            campaignId: String(campaign._id || ''),
            recipientEmail,
            provider: account.provider || 'smtp',
            sender: account.from || account.user || '',
            step: currentStep,
            draftType: campaignType
          });
          const sendResult = await sendEmailForLead({
            template: selectedTemplate,
            lead,
            account,
            campaignType,
            replyMode,
            replyContext: replyContext || null,
            trackingPixelHtml: buildTrackingPixel(trackingId)
          });
          lead.status = 'Sent';
          lead.error = '';
          lead.sentAt = new Date();
          lead.failedAt = null;
          lead.sendingStartedAt = null;
          if (sendResult?.thread) {
            lead.thread = {
              ...sendResult.thread,
              campaignName: String(campaign.name || '')
            };
            await upsertStoredThreadForLead(lead, account, sendResult.thread, campaignType, campaign.userEmail || '');
          } else {
            lead.thread = {
              ...(lead.thread || {}),
              campaignName: String(campaign.name || '')
            };
          }
          campaign.stats.sent += 1;
          syncCampaignProgressCounters(campaign);
          campaign.lastActivityAt = new Date();
          await markRecipientClaimStatus(campaign._id, recipientEmail, 'Sent', { sentAt: lead.sentAt });
          await upsertRecipientLogForLead({
            campaign,
            lead,
            idx,
            status: 'Sent',
            stepNumber: currentStep,
            trackingId,
            sendResult,
            provider: account.provider || ''
          });
          appendLog(
            campaign,
            `Sent: ${lead.Email || lead.email || 'unknown'}${sendResult?.isReply ? ' (reply)' : ''}`
          );
          console.info('[lead_send_success]', {
            campaignId: String(campaign._id || ''),
            recipientEmail,
            provider: account.provider || 'smtp',
            sender: account.from || account.user || '',
            step: currentStep,
            messageId: sendResult?.messageId || ''
          });
          if (replyMode && !sendResult?.isReply) {
            appendLog(
              campaign,
              `Reply mode fallback to new email: no previous messageId for ${lead.Email || lead.email || 'unknown'}`,
              'info'
            );
          }
        } catch (error) {
          appendLog(campaign, `Send failed for ${recipientEmail}: ${error.message}`, 'error');
          console.error('[lead_send_failed]', {
            campaignId: String(campaign._id || ''),
            recipientEmail,
            provider: account.provider || 'smtp',
            sender: account.from || account.user || '',
            step: currentStep,
            error: error.message || String(error)
          });
          await refundCampaignCredit(campaign.userEmail || '', {
            campaignId: campaign._id,
            campaignName: campaign.name || '',
            recipientEmail,
            reason: 'send_failed_refund',
            status: 'Failed'
          });
          const failureStatus = classifyDeliveryFailure(error.message);
          lead.status = failureStatus;
          lead.error = error.message;
          lead.failedAt = new Date();
          lead.sendingStartedAt = null;
          if (failureStatus === 'Bounced') {
            campaign.stats.bounced += 1;
          } else if (failureStatus === 'Spam') {
            campaign.stats.spam += 1;
          } else {
            campaign.stats.failed += 1;
          }
          syncCampaignProgressCounters(campaign);
          campaign.failureReason = campaign.failureReason || classifyFailureReason(error.message);
          campaign.lastError = error.message;
          campaign.lastErrorAt = new Date();
          campaign.lastActivityAt = new Date();
          await upsertRecipientLogForLead({
            campaign,
            lead,
            idx,
            status: failureStatus,
            stepNumber: currentStep,
            trackingId,
            failureReason: error.message,
            provider: account.provider || ''
          });
          await markRecipientClaimStatus(campaign._id, recipientEmail, failureStatus, { failedAt: lead.failedAt, error: error.message });
          appendLog(campaign, `${failureStatus}: ${lead.Email || lead.email || 'unknown'} - ${error.message}`, 'error');
          if (isCriticalSendError(error.message)) {
            state.stop = true;
            state.stopReason = 'critical_send_error';
            campaign.failureReason = classifyFailureReason(error.message);
            campaign.lastRunError = error.message;
            campaign.lastRunErrorAt = new Date();
            appendLog(campaign, `Campaign failed because sender configuration is not usable: ${error.message}`, 'error');
          }
        }

        syncCampaignProgressCounters(campaign);
        campaign.status = 'Running';
        campaign.workerStatus = 'running';
        campaign.queueReason = '';
        campaign.workerHeartbeatAt = new Date();
        lastHeartbeatAt = Date.now();
        await persistLeadProgress(list._id, idx, lead);
        await persistCampaignCounters(campaign, lead.status === 'Sent' ? 'send-success' : 'send-failure');
        if (state.stop || i === pendingIndexes.length - 1 || (i + 1) % 10 === 0) {
          await refreshCampaignRollups(campaign._id).catch(() => {});
        }
        if (!(await saveCampaignIfExists(campaign))) {
          state.running = false;
          return;
        }

        if (state.stop) {
          break;
        }

        const hasMoreCandidates = i < pendingIndexes.length - 1;
        if (hasMoreCandidates) {
          const delayState = await waitForCampaignDelay(state, campaign, delayMs, lastHeartbeatAt);
          lastHeartbeatAt = delayState.lastHeartbeatAt;
          if (!delayState.completed) {
            continue;
          }
        }
      }

      if (state.stop) {
        if (state.stopReason === 'credit_limit') {
          campaign.status = 'Failed';
          campaign.finishedAt = new Date();
          campaign.failureReason = campaign.failureReason || 'Credits finished';
          campaign.lastError = campaign.lastError || 'Credit limit reached';
          campaign.lastErrorAt = campaign.lastErrorAt || new Date();
          campaign.lastRunError = campaign.lastError;
          campaign.lastRunErrorAt = campaign.lastErrorAt;
          campaign.lastActivityAt = new Date();
          campaign.workerId = '';
          campaign.workerLockedBy = '';
          campaign.workerStatus = 'failed';
          campaign.workerLockedAt = null;
          campaign.workerHeartbeatAt = null;
          appendLog(campaign, 'Campaign failed: credit limit reached', 'error');
        } else if (state.stopReason === 'critical_send_error') {
          campaign.status = 'Failed';
          campaign.finishedAt = new Date();
          campaign.failureReason = campaign.failureReason || 'Sender account failed';
          campaign.lastError = campaign.lastError || campaign.lastRunError || 'Sender account failed';
          campaign.lastErrorAt = campaign.lastErrorAt || new Date();
          campaign.lastRunError = campaign.lastRunError || campaign.lastError;
          campaign.lastRunErrorAt = campaign.lastRunErrorAt || campaign.lastErrorAt;
          campaign.lastActivityAt = new Date();
          campaign.workerId = '';
          campaign.workerLockedBy = '';
          campaign.workerStatus = 'failed';
          campaign.workerLockedAt = null;
          campaign.workerHeartbeatAt = null;
          appendLog(campaign, 'Campaign failed: sender configuration requires attention', 'error');
        } else {
          campaign.status = 'Stopped';
          campaign.workerId = '';
          campaign.workerLockedBy = '';
          campaign.workerStatus = 'stopped';
          campaign.workerLockedAt = null;
          campaign.workerHeartbeatAt = null;
          campaign.finishedAt = new Date();
        }
      } else {
        campaign.status = 'Completed';
        campaign.finishedAt = new Date();
        campaign.completedAt = campaign.finishedAt;
        campaign.workerId = '';
        campaign.workerLockedBy = '';
        campaign.workerStatus = 'completed';
        campaign.workerLockedAt = null;
        campaign.workerHeartbeatAt = null;
        appendLog(campaign, 'campaign_runner_completed: Campaign completed');
        console.info('[campaign_runner_completed]', {
          campaignId: String(campaign._id || ''),
          status: campaign.status,
          sent: Number(campaign.stats?.sent || 0),
          failed: getCampaignFailureCount(campaign),
          pending: Number(campaign.stats?.pending || 0)
        });
        console.info('[campaign_completed]', {
          campaignId: String(campaign._id || ''),
          status: campaign.status,
          sent: Number(campaign.stats?.sent || 0),
          failed: getCampaignFailureCount(campaign),
          pending: Number(campaign.stats?.pending || 0)
        });
      }

      if (!(await saveCampaignIfExists(campaign))) {
        state.running = false;
        return;
      }
      await persistCampaignCounters(campaign, `final-${String(campaign.status || '').toLowerCase()}`);
      state.running = false;
    } catch (error) {
      const transientFailure = isTransientInfrastructureError(error);
      campaign.status = transientFailure ? 'Queued' : 'Failed';
      campaign.workerId = '';
      campaign.workerLockedBy = '';
      campaign.workerStatus = transientFailure ? 'transient_requeued' : 'failed';
      campaign.workerLockedAt = null;
      campaign.workerHeartbeatAt = null;
      if (transientFailure) {
        campaign.queueRequestedAt = new Date();
        campaign.queueReason = `Requeued after transient runner error: ${error.message}`;
      }
      campaign.lastRunError = error.message;
      campaign.lastRunErrorAt = new Date();
      appendLog(
        campaign,
        transientFailure
          ? `Transient runner error, campaign re-queued: ${error.message}`
          : `Fatal campaign error: ${error.message}`,
        'error'
      );
      await saveCampaignIfExists(campaign);
      state.running = false;
    }
  })();

  return { started: true };
  } finally {
    startingRunners.delete(campaignId);
  }
}

export async function pauseCampaignRunner(campaignId) {
  const state = runners.get(campaignId);
  if (!state || !state.running) {
    return { ok: false, message: 'Campaign is not running' };
  }
  state.paused = true;
  return { ok: true };
}

export async function resumeCampaignRunner(campaignId) {
  const state = runners.get(campaignId);
  if (!state || !state.running) {
    return { ok: false, message: 'Campaign is not running' };
  }
  state.paused = false;
  return { ok: true };
}

export async function stopCampaignRunner(campaignId) {
  const state = runners.get(campaignId);
  if (!state || !state.running) {
    return { ok: false, message: 'Campaign is not running' };
  }
  state.stop = true;
  state.stopReason = 'manual';
  state.paused = false;
  return { ok: true };
}

export function getRunnerState(campaignId) {
  return runners.get(campaignId) || { running: false, paused: false };
}

