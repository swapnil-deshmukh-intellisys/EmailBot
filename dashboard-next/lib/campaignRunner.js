import connectDB from './mongodb';
import Campaign from '../models/Campaign';
import LeadList from '../models/LeadList';
import EmailTemplate from '../models/EmailTemplate';
import EmailThread from '../models/EmailThread';
import CampaignRecipientClaim from '../models/CampaignRecipientClaim';
import { getAvailableAccounts, sendEmailForLead } from './emailSender';
import { resolveSenderAccountById } from './senderAccounts';

const runners = global.campaignRunners || new Map();
global.campaignRunners = runners;
const startingRunners = global.campaignStartingRunners || new Set();
global.campaignStartingRunners = startingRunners;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();
const MAX_CONCURRENT_CAMPAIGNS = Math.max(1, Number(process.env.MAX_CONCURRENT_CAMPAIGNS || 20));
const MIN_DELAY_SECONDS = Math.max(60, Number(process.env.MIN_DELAY_SECONDS || 60));
const SENDING_LOCK_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.SENDING_LOCK_TTL_MS || 15 * 60 * 1000));

function senderThreadKey(account = {}) {
  const from = normalizeEmail(account?.from || account?.user || '');
  const provider = String(account?.provider || 'smtp').toLowerCase();
  return `${provider}:${from}`;
}

async function getStoredThreadForLead(lead, account, userEmail = '') {
  const recipientEmail = normalizeEmail(lead?.Email || lead?.email || lead?.thread?.recipientEmail || '');
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
  const recipientEmail = normalizeEmail(lead?.Email || lead?.email || thread?.recipientEmail || '');
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
  try {
    await campaign.save();
    return true;
  } catch (error) {
    if (error?.name === 'DocumentNotFoundError' || /No document found/i.test(error?.message || '')) {
      return false;
    }
    throw error;
  }
}

function appendLog(campaign, message, level = 'info') {
  campaign.logs.push({ message, level, at: new Date() });
  if (campaign.logs.length > 200) {
    campaign.logs = campaign.logs.slice(-200);
  }
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
        [`leads.${idx}.thread.updatedAt`]: thread.updatedAt || null
      }
    }
  );

  if (!result.matchedCount) {
    throw new Error(`Lead list not found for campaign update: ${listId}`);
  }
}

async function claimLeadForSend(listId, idx, claimedAt = new Date()) {
  const staleBefore = new Date(claimedAt.getTime() - SENDING_LOCK_TTL_MS);
  const result = await LeadList.updateOne(
    {
      _id: listId,
      $or: [
        { [`leads.${idx}.status`]: 'Pending' },
        { [`leads.${idx}.status`]: 'Failed' },
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
  } else if (status === 'Failed') {
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
  if (runningCount >= MAX_CONCURRENT_CAMPAIGNS) {
    return {
      started: false,
      message: `Maximum concurrent running campaigns reached (${MAX_CONCURRENT_CAMPAIGNS}).`
    };
  }

  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const list = await LeadList.findById(campaign.listId);
  const templateFromDb = campaign.templateId ? await EmailTemplate.findById(campaign.templateId) : null;
  const inlineTemplate = campaign.inlineTemplate?.subject && campaign.inlineTemplate?.body
    ? { subject: campaign.inlineTemplate.subject, body: campaign.inlineTemplate.body }
    : null;

  if (!list || (!inlineTemplate && !templateFromDb)) {
    throw new Error('List or template missing');
  }

  let accounts = [];
  if (campaign.senderAccountId) {
    const resolved = await resolveSenderAccountById(campaign.senderAccountId, { userEmail: campaign.userEmail || '' });
    if (!resolved) {
      throw new Error('Sender account not found');
    }
    accounts = [resolved];
  } else if (campaign.senderAccount?.provider) {
    accounts = [campaign.senderAccount];
  } else {
    accounts = getAvailableAccounts();
  }

  if (!accounts.length) {
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
        status: { $in: ['Draft', 'Paused', 'Scheduled'] }
      };
  const claim = await Campaign.updateOne(
    claimQuery,
    {
      $set: {
        status: 'Running',
        startedAt: startTime,
        scheduledAt: null
      }
    }
  );

  if (!claim.matchedCount) {
    return { started: false, message: 'Campaign already started by another process' };
  }

  const state = { running: true, paused: false, stop: false };
  runners.set(campaignId, state);
  const campaignType = String(campaign.type || campaign.draftType || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const replyMode = typeof campaign.options?.replyMode === 'boolean'
    ? campaign.options.replyMode
    : ['reminder', 'follow_up', 'updated_cost', 'final_cost'].includes(campaignType);
  const selectedRange = parseRowRange(campaign.options?.rowRange, list.leads.length);
  const allowedIndexes = selectedRange
    ? new Set(Array.from({ length: selectedRange.end - selectedRange.start + 1 }, (_, i) => selectedRange.start - 1 + i))
    : null;
  const scopedLeads = allowedIndexes ? list.leads.filter((_, idx) => allowedIndexes.has(idx)) : list.leads;

  const normalizedDelaySeconds = Math.max(MIN_DELAY_SECONDS, Number(campaign.options?.delaySeconds || 60));
  campaign.status = 'Running';
  campaign.options.delaySeconds = normalizedDelaySeconds;
  campaign.startedAt = startTime;
  campaign.scheduledAt = null;
  const scopedSent = scopedLeads.filter((lead) => String(lead?.status || '').toLowerCase() === 'sent').length;
  const scopedFailed = scopedLeads.filter((lead) => String(lead?.status || '').toLowerCase() === 'failed').length;
  campaign.stats.total = scopedLeads.length;
  campaign.stats.sent = scopedSent;
  campaign.stats.failed = scopedFailed;
  campaign.stats.pending = Math.max(0, scopedLeads.length - scopedSent - scopedFailed);
  appendLog(campaign, `Provider: ${accounts[0].provider || 'smtp'} | Sender: ${accounts[0].from || accounts[0].user || 'unknown'}`);
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

  const batchSize = Math.max(1, Number(campaign.options.batchSize || 1));
  const delayMs = Math.max(MIN_DELAY_SECONDS * 1000, Number(campaign.options.delaySeconds || normalizedDelaySeconds) * 1000);
  appendLog(campaign, `Mail gap: ${Math.round(delayMs / 1000)} seconds per email`);

  (async () => {
    try {
      const pendingIndexes = [];
      const now = Date.now();
      list.leads.forEach((lead, idx) => {
        if (allowedIndexes && !allowedIndexes.has(idx)) {
          return;
        }

        const normalizedStatus = String(lead.status || '').toLowerCase();
        const sendingStartedAtMs = lead?.sendingStartedAt ? new Date(lead.sendingStartedAt).getTime() : 0;
        const hasFreshSendingLock = normalizedStatus === 'sending' && sendingStartedAtMs && (now - sendingStartedAtMs) < SENDING_LOCK_TTL_MS;

        if (normalizedStatus === 'sent' || hasFreshSendingLock) {
          return;
        }

        pendingIndexes.push(idx);
        if (normalizedStatus !== 'failed') {
          lead.status = 'Pending';
          lead.sendingStartedAt = null;
        }
      });
      await list.save();

      for (let i = 0; i < pendingIndexes.length; i += batchSize) {
        if (state.stop) {
          appendLog(campaign, 'Campaign stopped');
          break;
        }

        while (state.paused) {
          campaign.status = 'Paused';
          if (!(await saveCampaignIfExists(campaign))) {
            state.running = false;
            return;
          }
          await wait(1000);
        }

        campaign.status = 'Running';
        const batch = pendingIndexes.slice(i, i + batchSize);

        for (const idx of batch) {
          const sendCycleStartedAt = Date.now();
          const lead = list.leads[idx];
          const recipientEmail = normalizeEmail(lead?.Email || lead?.email || '');
          if (!recipientEmail) {
            lead.status = 'Failed';
            lead.error = 'Lead has no email address';
            lead.failedAt = new Date();
            lead.sendingStartedAt = null;
            campaign.stats.failed += 1;
            campaign.stats.pending = Math.max(0, campaign.stats.total - campaign.stats.sent - campaign.stats.failed);
            appendLog(campaign, `Failed: unknown - Lead has no email address`, 'error');
            await persistLeadProgress(list._id, idx, lead);
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
            lead.status = 'Sent';
            lead.error = 'Skipped duplicate recipient in this campaign';
            lead.sentAt = new Date();
            lead.failedAt = null;
            lead.sendingStartedAt = null;
            campaign.stats.sent += 1;
            campaign.stats.pending = Math.max(0, campaign.stats.total - campaign.stats.sent - campaign.stats.failed);
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

          const account = accounts[(campaign.stats.sent + campaign.stats.failed) % accounts.length];
          const selectedTemplate = inlineTemplate || templateFromDb;
          const storedThread = await getStoredThreadForLead(lead, account, campaign.userEmail || '');
          const replyContext = lead?.thread?.messageId ? lead.thread : storedThread;

          try {
            const sendResult = await sendEmailForLead({
              template: selectedTemplate,
              lead,
              account,
              campaignType,
              replyMode,
              replyContext: replyContext || null
            });
            lead.status = 'Sent';
            lead.error = '';
            lead.sentAt = new Date();
            lead.failedAt = null;
            lead.sendingStartedAt = null;
            if (sendResult?.thread) {
              lead.thread = sendResult.thread;
              await upsertStoredThreadForLead(lead, account, sendResult.thread, campaignType, campaign.userEmail || '');
            }
            campaign.stats.sent += 1;
            await markRecipientClaimStatus(campaign._id, recipientEmail, 'Sent', { sentAt: lead.sentAt });
            appendLog(
              campaign,
              `Sent: ${lead.Email || lead.email || 'unknown'}${sendResult?.isReply ? ' (reply)' : ''}`
            );
            if (replyMode && !sendResult?.isReply) {
              appendLog(
                campaign,
                `Reply mode fallback to new email: no previous messageId for ${lead.Email || lead.email || 'unknown'}`,
                'info'
              );
            }
          } catch (error) {
            lead.status = 'Failed';
            lead.error = error.message;
            lead.failedAt = new Date();
            lead.sendingStartedAt = null;
            campaign.stats.failed += 1;
            await markRecipientClaimStatus(campaign._id, recipientEmail, 'Failed', { failedAt: lead.failedAt, error: error.message });
            appendLog(campaign, `Failed: ${lead.Email || lead.email || 'unknown'} - ${error.message}`, 'error');
          }

          campaign.stats.pending = Math.max(0, campaign.stats.total - campaign.stats.sent - campaign.stats.failed);
          await persistLeadProgress(list._id, idx, lead);
          if (!(await saveCampaignIfExists(campaign))) {
            state.running = false;
            return;
          }

          if (state.stop) {
            break;
          }

          const elapsedMs = Date.now() - sendCycleStartedAt;
          const waitMs = Math.max(0, delayMs - elapsedMs);
          if (waitMs > 0) {
            await wait(waitMs);
          }
        }
      }

      if (state.stop) {
        campaign.status = 'Paused';
      } else {
        campaign.status = 'Completed';
        campaign.finishedAt = new Date();
        appendLog(campaign, 'Campaign completed');
      }

      if (!(await saveCampaignIfExists(campaign))) {
        state.running = false;
        return;
      }
      state.running = false;
    } catch (error) {
      campaign.status = 'Failed';
      appendLog(campaign, `Fatal campaign error: ${error.message}`, 'error');
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
  state.paused = false;
  return { ok: true };
}

export function getRunnerState(campaignId) {
  return runners.get(campaignId) || { running: false, paused: false };
}
