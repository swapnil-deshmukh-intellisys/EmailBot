import connectDB from './mongodb';
import Campaign from '../models/Campaign';
import LeadList from '../models/LeadList';
import EmailTemplate from '../models/EmailTemplate';
import { getAvailableAccounts, sendEmailForLead } from './emailSender';
import { resolveSenderAccountById } from './senderAccounts';

const runners = global.campaignRunners || new Map();
global.campaignRunners = runners;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const result = await LeadList.updateOne(
    { _id: listId },
    {
      $set: {
        [`leads.${idx}.status`]: lead.status || 'Pending',
        [`leads.${idx}.error`]: lead.error || '',
        [`leads.${idx}.sentAt`]: lead.sentAt || null,
        [`leads.${idx}.failedAt`]: lead.failedAt || null
      }
    }
  );

  if (!result.matchedCount) {
    throw new Error(`Lead list not found for campaign update: ${listId}`);
  }
}
function parseRowRange(rowRange = '', totalLeads = 0) {
  const match = String(rowRange || '').trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  const start = Math.max(1, Number(match[1]));
  const end = Math.min(Number(match[2]), totalLeads);
  if (!start || !end || start > end) return null;
  return { start, end };
}

export async function startCampaignRunner(campaignId) {
  await connectDB();

  if (runners.get(campaignId)?.running) {
    return { started: false, message: 'Campaign already running' };
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
    const resolved = await resolveSenderAccountById(campaign.senderAccountId);
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
  const claim = await Campaign.updateOne(
    {
      _id: campaign._id,
      status: { $nin: ['Running', 'Completed', 'Failed'] }
    },
    {
      $set: {
        status: 'Running',
        startedAt: startTime
      }
    }
  );

  if (!claim.matchedCount) {
    return { started: false, message: 'Campaign already started by another process' };
  }

  const state = { running: true, paused: false, stop: false };
  runners.set(campaignId, state);
  const selectedRange = parseRowRange(campaign.options?.rowRange, list.leads.length);
  const allowedIndexes = selectedRange
    ? new Set(Array.from({ length: selectedRange.end - selectedRange.start + 1 }, (_, i) => selectedRange.start - 1 + i))
    : null;
  const scopedLeads = allowedIndexes ? list.leads.filter((_, idx) => allowedIndexes.has(idx)) : list.leads;

  scopedLeads.forEach((lead) => {
    lead.status = 'Pending';
    lead.error = '';
    lead.sentAt = null;
    lead.failedAt = null;
  });
  await list.save();

  campaign.status = 'Running';
  campaign.options.delaySeconds = Math.max(60, Number(campaign.options?.delaySeconds || 60));
  campaign.startedAt = startTime;
  campaign.stats.total = scopedLeads.length;
  campaign.stats.sent = 0;
  campaign.stats.failed = 0;
  campaign.stats.pending = scopedLeads.length;
  appendLog(campaign, `Provider: ${accounts[0].provider || 'smtp'} | Sender: ${accounts[0].from || accounts[0].user || 'unknown'}`);
  if (selectedRange) {
    appendLog(campaign, `Row range selected: ${selectedRange.start}-${selectedRange.end}`);
  }
  appendLog(campaign, 'Campaign started');
  if (!(await saveCampaignIfExists(campaign))) {
    state.running = false;
    return { started: false, message: 'Campaign was removed before start' };
  }

  const batchSize = Math.max(1, Number(campaign.options.batchSize || 1));
  const delayMs = Math.max(60000, Number(campaign.options.delaySeconds || 60) * 1000);
  appendLog(campaign, `Mail gap: ${Math.round(delayMs / 1000)} seconds per email`);

  (async () => {
    try {
      const pendingIndexes = [];
      list.leads.forEach((lead, idx) => {
        if ((!allowedIndexes || allowedIndexes.has(idx)) && lead.status !== 'Sent') {
          pendingIndexes.push(idx);
          if (lead.status !== 'Failed') {
            lead.status = 'Pending';
          }
        }
      });

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
          const lead = list.leads[idx];
          const account = accounts[(campaign.stats.sent + campaign.stats.failed) % accounts.length];
          const selectedTemplate = inlineTemplate || templateFromDb;

          try {
            await sendEmailForLead({ template: selectedTemplate, lead, account });
            lead.status = 'Sent';
            lead.error = '';
            lead.sentAt = new Date();
            lead.failedAt = null;
            campaign.stats.sent += 1;
            appendLog(campaign, `Sent: ${lead.Email || lead.email || 'unknown'}`);
          } catch (error) {
            lead.status = 'Failed';
            lead.error = error.message;
            lead.failedAt = new Date();
            campaign.stats.failed += 1;
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

          await wait(delayMs);
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
