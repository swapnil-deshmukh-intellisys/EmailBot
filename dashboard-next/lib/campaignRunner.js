import connectDB from './mongodb';
import Campaign from '../models/Campaign';
import LeadList from '../models/LeadList';
import EmailTemplate from '../models/EmailTemplate';
import { getAvailableAccounts, sendEmailForLead } from './emailSender';
import { resolveSenderAccountById } from './senderAccounts';

const runners = global.campaignRunners || new Map();
global.campaignRunners = runners;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function appendLog(campaign, message, level = 'info') {
  campaign.logs.push({ message, level, at: new Date() });
  if (campaign.logs.length > 200) {
    campaign.logs = campaign.logs.slice(-200);
  }
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

  const state = { running: true, paused: false, stop: false };
  runners.set(campaignId, state);

  campaign.status = 'Running';
  campaign.startedAt = new Date();
  campaign.stats.total = list.leads.length;
  campaign.stats.sent = list.leads.filter((x) => x.status === 'Sent').length;
  campaign.stats.failed = list.leads.filter((x) => x.status === 'Failed').length;
  campaign.stats.pending = list.leads.filter((x) => x.status !== 'Sent').length;
  appendLog(campaign, `Provider: ${accounts[0].provider || 'smtp'} | Sender: ${accounts[0].from || accounts[0].user || 'unknown'}`);
  appendLog(campaign, 'Campaign started');
  await campaign.save();

  const batchSize = Math.max(1, Number(campaign.options.batchSize || 1));
  const delayMs = Math.max(1000, Number(campaign.options.delaySeconds || 5) * 1000);

  (async () => {
    try {
      const pendingIndexes = [];
      list.leads.forEach((lead, idx) => {
        if (lead.status !== 'Sent') {
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
          await campaign.save();
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
            campaign.stats.sent += 1;
            appendLog(campaign, `Sent: ${lead.Email || lead.email || 'unknown'}`);
          } catch (error) {
            lead.status = 'Failed';
            lead.error = error.message;
            campaign.stats.failed += 1;
            appendLog(campaign, `Failed: ${lead.Email || lead.email || 'unknown'} - ${error.message}`, 'error');
          }

          campaign.stats.pending = Math.max(0, campaign.stats.total - campaign.stats.sent - campaign.stats.failed);
          await list.save();
          await campaign.save();

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

      await campaign.save();
      state.running = false;
    } catch (error) {
      campaign.status = 'Failed';
      appendLog(campaign, `Fatal campaign error: ${error.message}`, 'error');
      await campaign.save();
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