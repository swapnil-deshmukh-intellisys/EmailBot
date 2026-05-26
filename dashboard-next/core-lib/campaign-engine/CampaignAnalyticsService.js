import crypto from 'crypto';
import Campaign from '../../database-models/Campaign.js';
import CampaignRecipientLog from '../../database-models/CampaignRecipientLog.js';
import LeadList from '../../database-models/LeadList.js';
import { computeCampaignDisplayStatus } from './CampaignStatusSummary.js';

export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function normalizeProjectName(value = '') {
  const raw = String(value || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'tec') return 'TEC';
  if (lower === 'tut') return 'TUT';
  if (lower.includes('entrepreneurial')) return 'The Entrepreneurial Chronicles';
  if (lower.includes('unicorn')) return 'The Unicorn Times';
  return raw ? raw.toUpperCase() : '-';
}

function getLeadValue(lead = {}, keys = []) {
  for (const key of keys) {
    const direct = lead?.[key];
    if (direct !== undefined && direct !== null && String(direct).trim()) return String(direct).trim();
    const nested = lead?.data?.[key];
    if (nested !== undefined && nested !== null && String(nested).trim()) return String(nested).trim();
  }
  return '';
}

function getLeadEmail(lead = {}) {
  return normalizeEmail(getLeadValue(lead, ['Email', 'email', 'E-mail', 'Mail', 'mail']));
}

function getLeadName(lead = {}) {
  return [getLeadValue(lead, ['Name', 'name', 'First Name', 'firstName']), getLeadValue(lead, ['Surname', 'surname', 'Last Name', 'lastName'])]
    .filter(Boolean)
    .join(' ')
    .trim();
}

export function classifyFailureReason(message = '') {
  const text = String(message || '').toLowerCase();
  if (!text) return '';
  if (text.includes('daily mail limit')) return 'Daily limit reached';
  if (text.includes('monthly') || text.includes('credit')) return 'Credits finished';
  if (text.includes('token') || text.includes('session expired')) return 'Microsoft token expired';
  if (text.includes('smtp') || text.includes('auth')) return 'SMTP failed';
  if (text.includes('sender') || text.includes('account')) return 'Sender disconnected';
  if (text.includes('list')) return 'Lead list missing';
  if (text.includes('template') || text.includes('draft')) return 'Draft/template missing';
  if (text.includes('bounce')) return 'Recipient bounced';
  if (text.includes('duplicate')) return 'Duplicate skipped';
  return String(message || '').trim().slice(0, 120);
}

export function classifyReplyType(text = '') {
  const value = String(text || '').toLowerCase();
  if (/(unsubscribe|remove me|do not contact|don't contact|stop emailing)/i.test(value)) return 'unsubscribe';
  if (/(out of office|automatic reply|auto.?reply|vacation)/i.test(value)) return 'auto-reply';
  if (/(not interested|no thanks|not now|decline)/i.test(value)) return 'negative';
  if (/(interested|yes|sounds good|send details|call me|let's|lets|cover story)/i.test(value)) return 'positive';
  return 'neutral';
}

export function ensureStepLogs(stepLogs = [], totalSteps = 5) {
  const existing = Array.isArray(stepLogs) ? stepLogs : [];
  return Array.from({ length: totalSteps }, (_, index) => {
    const stepNumber = index + 1;
    const found = existing.find((item) => Number(item.stepNumber) === stepNumber) || {};
    return {
      stepNumber,
      subject: found.subject || '',
      status: found.status || 'Pending',
      sentAt: found.sentAt || null,
      openedAt: found.openedAt || null,
      repliedAt: found.repliedAt || null,
      failedAt: found.failedAt || null,
      skippedAt: found.skippedAt || null,
      failureReason: found.failureReason || '',
      messageId: found.messageId || '',
      internetMessageId: found.internetMessageId || '',
      conversationId: found.conversationId || '',
      trackingId: found.trackingId || ''
    };
  });
}

export function buildTrackingId(campaignId = '', email = '', stepNumber = 1) {
  return crypto
    .createHash('sha1')
    .update(`${campaignId}:${normalizeEmail(email)}:${stepNumber}:${Date.now()}:${Math.random()}`)
    .digest('hex');
}

export function getTrackingBaseUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

export function buildTrackingPixel(trackingId = '') {
  if (!trackingId) return '';
  return `<img src="${getTrackingBaseUrl()}/api/campaigns/tracking/open/${encodeURIComponent(trackingId)}" width="1" height="1" style="display:none" alt="" />`;
}

export async function ensureRecipientLogsForCampaign(campaign, listDoc = null) {
  const campaignId = campaign?._id;
  if (!campaignId) return [];
  const list = listDoc || (campaign.listId ? await LeadList.findById(campaign.listId).lean() : null);
  const leads = Array.isArray(list?.leads) ? list.leads : [];
  if (!leads.length) return CampaignRecipientLog.find({ campaignId }).sort({ lastActivityAt: -1, createdAt: -1 }).lean();

  const projectName = normalizeProjectName(campaign.projectName || campaign.project || '');
  const campaignName = String(campaign.name || '').trim();
  const existingLogs = await CampaignRecipientLog.find({ campaignId }).lean();
  const existingByEmail = existingLogs.reduce((map, item) => {
    map.set(normalizeEmail(item.email), item);
    return map;
  }, new Map());
  const uniqueLeads = leads.reduce((items, lead, index) => {
    const email = getLeadEmail(lead);
    if (!email || items.seen.has(email)) return items;
    items.seen.add(email);
    items.rows.push({ lead, email, index });
    return items;
  }, { seen: new Set(), rows: [] }).rows;
  const operations = uniqueLeads.map(({ lead, email, index }) => {
      const existing = existingByEmail.get(email) || {};
      const status = String(lead.status || 'Pending');
      const failed = status === 'Failed' || status === 'Bounced' || status === 'Spam';
      const lastActivityAt = lead.sentAt || lead.failedAt || lead.sendingStartedAt || campaign.updatedAt || campaign.createdAt || new Date();
      const stepLogs = ensureStepLogs(existing.stepLogs || [], 5);
      if (status === 'Sent') {
        stepLogs[0] = {
          ...stepLogs[0],
          status: ['Opened', 'Replied'].includes(stepLogs[0].status) ? stepLogs[0].status : 'Sent',
          sentAt: stepLogs[0].sentAt || lead.sentAt || null,
          messageId: stepLogs[0].messageId || lead.thread?.messageId || ''
        };
      } else if (failed) {
        stepLogs[0] = {
          ...stepLogs[0],
          status: existing.replyReceived || existing.followUpStopped ? stepLogs[0].status : status,
          failedAt: stepLogs[0].failedAt || lead.failedAt || null,
          failureReason: stepLogs[0].failureReason || lead.error || ''
        };
      }
      const preservedStatus = existing.replyReceived
        ? 'Replied'
        : existing.followUpStopped
          ? 'Follow-up Stopped'
          : Number(existing.openCount || 0) > 0
            ? 'Opened'
            : status;
      return {
        updateOne: {
          filter: { campaignId, email },
          update: {
            $setOnInsert: {
              userId: campaign.userId || null,
              userEmail: campaign.userEmail || '',
              campaignId,
              recipientId: String(index),
              clientName: getLeadName(lead),
              email,
              company: getLeadValue(lead, ['Company', 'company', 'Organisation', 'Organization']),
              designation: getLeadValue(lead, ['Designation', 'designation', 'Title', 'title']),
              totalSteps: 5,
              stepLogs,
              createdAt: new Date()
            },
            $set: {
              campaignName,
              projectId: campaign.projectId || campaign.project || '',
              projectName,
              status: preservedStatus,
              sentCount: Math.max(Number(existing.sentCount || 0), status === 'Sent' ? 1 : 0),
              failedCount: Math.max(Number(existing.failedCount || 0), failed ? 1 : 0),
              lastSentAt: existing.lastSentAt || lead.sentAt || null,
              failureReason: existing.failureReason || (failed ? classifyFailureReason(lead.error || status) : ''),
              lastActivityAt: existing.lastActivityAt || lastActivityAt,
              updatedAt: new Date()
            }
          },
          upsert: true
        }
      };
    });

  if (operations.length) await CampaignRecipientLog.bulkWrite(operations, { ordered: false });
  return CampaignRecipientLog.find({ campaignId }).sort({ lastActivityAt: -1, createdAt: -1 }).lean();
}

export function deriveCampaignReason(campaign = {}) {
  if (campaign.failureReason) return campaign.failureReason;
  if (campaign.lastError) return classifyFailureReason(campaign.lastError);
  const logs = Array.isArray(campaign.logs) ? [...campaign.logs].reverse() : [];
  const errorLog = logs.find((log) => String(log.level || '').toLowerCase() === 'error' || /failed|stopped:/i.test(log.message || ''));
  return classifyFailureReason(errorLog?.message || '');
}

export function getSafeActions(campaign = {}) {
  const status = String(computeCampaignDisplayStatus(campaign) || 'Draft').toLowerCase();
  return {
    canView: true,
    canStart: ['draft', 'queued', 'scheduled', 'failed', 'stopped'].includes(status),
    canPause: ['running', 'queued', 'scheduled'].includes(status),
    canResume: status === 'paused',
    canStop: ['running', 'queued', 'scheduled', 'paused', 'draft'].includes(status),
    actionLabel: status === 'failed' ? 'Retry/Fix Issue' : status === 'paused' ? 'Resume' : status === 'running' ? 'Pause' : 'Start'
  };
}

export function serializeCampaignForList(campaign = {}, recipientLogs = []) {
  const logs = Array.isArray(recipientLogs) ? recipientLogs : [];
  const summaryLog = logs.find((item) => item?.__summary);
  const totalRecipients = Math.max(
    Number(campaign.totalRecipients || 0),
    Number(campaign.stats?.total || 0),
    Number(summaryLog?.sentCount || 0) + Number(summaryLog?.failedCount || 0)
  );
  const sentCount = summaryLog
    ? Number(summaryLog.sentCount || 0)
    : Number(campaign.sentCount ?? campaign.stats?.sent ?? 0);
  const failedCount = summaryLog
    ? Number(summaryLog.failedCount || 0)
    : Number(campaign.failedCount ?? campaign.stats?.failed ?? 0);
  const skippedCount = summaryLog ? Number(summaryLog.skippedCount || 0) : Number(campaign.skippedCount || 0);
  const pendingCount = Math.max(
    0,
    summaryLog
      ? totalRecipients - sentCount - failedCount - skippedCount
      : Number(campaign.pendingCount ?? campaign.stats?.pending ?? Math.max(totalRecipients - sentCount - failedCount, 0))
  );
  const openCount = summaryLog ? Number(summaryLog.openCount || 0) : logs.reduce((sum, item) => sum + Number(item.openCount || 0), 0);
  const replyCount = summaryLog ? Number(summaryLog.replyCount || 0) : logs.reduce((sum, item) => sum + Number(item.replyCount || 0), 0);
  const positiveReplyCount = summaryLog ? Number(summaryLog.positiveReplyCount || 0) : logs.filter((item) => item.replyType === 'positive').length;
  const negativeReplyCount = summaryLog ? Number(summaryLog.negativeReplyCount || 0) : logs.filter((item) => item.replyType === 'negative' || item.replyType === 'unsubscribe').length;
  const followUpStoppedCount = summaryLog ? Number(summaryLog.followUpStoppedCount || 0) : logs.filter((item) => item.followUpStopped).length;
  const lastActivityAt = summaryLog?.lastActivityAt || logs
    .map((item) => item.lastActivityAt || item.updatedAt || item.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || campaign.lastActivityAt || campaign.updatedAt || campaign.createdAt || null;
  return {
    ...campaign,
    _id: String(campaign._id),
    totalRecipients,
    sentCount,
    pendingCount,
    failedCount,
    stats: {
      ...(campaign.stats || {}),
      total: totalRecipients,
      sent: sentCount,
      pending: pendingCount,
      failed: failedCount,
      bounced: summaryLog ? Number(summaryLog.bouncedCount || 0) : Number(campaign.stats?.bounced || 0),
      spam: summaryLog ? Number(summaryLog.spamCount || 0) : Number(campaign.stats?.spam || 0)
    },
    displayStatus: computeCampaignDisplayStatus({ ...campaign, sentCount, pendingCount, failedCount }),
    projectName: normalizeProjectName(campaign.projectName || campaign.project || ''),
    projectId: campaign.projectId || campaign.project || '',
    openCount: Number(campaign.openCount || campaign.trackingStats?.openCount || openCount),
    replyCount: Number(campaign.replyCount || campaign.trackingStats?.replyCount || replyCount),
    positiveReplyCount: Number(campaign.positiveReplyCount || positiveReplyCount),
    negativeReplyCount: Number(campaign.negativeReplyCount || negativeReplyCount),
    followUpStoppedCount: Number(campaign.followUpStoppedCount || followUpStoppedCount),
    failureReason: deriveCampaignReason(campaign),
    lastActivityAt,
    safeActions: getSafeActions(campaign)
  };
}

export function buildTimeline(campaign = {}, recipientLogs = []) {
  const campaignEvents = (Array.isArray(campaign.logs) ? campaign.logs : []).map((log) => ({
    at: log.at || campaign.updatedAt,
    type: String(log.message || '').split(':')[0] || 'Campaign event',
    message: log.message || '',
    level: log.level || 'info'
  }));
  const recipientEvents = recipientLogs.flatMap((item) => {
    const events = [];
    const clientLabel = [item.clientName || item.recipientName || item.email, item.company, item.designation]
      .filter(Boolean)
      .join(' | ');
    const meta = {
      recipientId: item.recipientId || '',
      email: item.email || item.recipientEmail || '',
      clientName: item.clientName || item.recipientName || '',
      company: item.company || '',
      designation: item.designation || '',
      campaignName: item.campaignName || campaign.name || '',
      currentStep: Number(item.currentStep || 1),
      totalSteps: Number(item.totalSteps || 5),
      openCount: Number(item.openCount || 0),
      replyCount: Number(item.replyCount || 0),
      replyType: item.replyType || '',
      replyPreview: item.replyPreview || '',
      failureReason: item.failureReason || item.bounceReason || ''
    };
    if (item.lastSentAt) events.push({ at: item.lastSentAt, type: 'Sent', message: `${clientLabel || item.email} sent`, level: 'success', meta });
    if (item.lastOpenedAt) events.push({ at: item.lastOpenedAt, type: 'Open', message: `${clientLabel || item.email} opened`, level: 'info', meta });
    if (item.lastReplyAt) events.push({ at: item.lastReplyAt, type: 'Reply received', message: `${clientLabel || item.email} replied`, level: 'success', meta });
    if (item.followUpStopped) events.push({ at: item.lastReplyAt || item.updatedAt, type: 'Follow-up stopped', message: item.followUpStopReason, level: 'warning', meta });
    (Array.isArray(item.stepLogs) ? item.stepLogs : []).forEach((step) => {
      const status = String(step?.status || '').trim();
      if (!status || status === 'Pending') return;
      const at = step.repliedAt || step.openedAt || step.sentAt || step.failedAt || step.skippedAt;
      if (!at) return;
      events.push({
        at,
        type: `Step ${step.stepNumber}: ${status}`,
        message: `${clientLabel || item.email} - ${step.subject || status}`,
        level: ['Failed', 'Bounced', 'Spam'].includes(status) ? 'error' : status === 'Opened' ? 'info' : 'success',
        meta: { ...meta, stepNumber: Number(step.stepNumber || 1), trackingId: step.trackingId || '', messageId: step.messageId || step.internetMessageId || '' }
      });
    });
    return events;
  });
  return [...campaignEvents, ...recipientEvents]
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 100);
}

export async function refreshCampaignRollups(campaignId) {
  const logs = await CampaignRecipientLog.find({ campaignId }).lean();
  const campaign = await Campaign.findById(campaignId).select('totalRecipients stats').lean();
  const totalRecipients = Math.max(
    Number(campaign?.totalRecipients || 0),
    Number(campaign?.stats?.total || 0),
    logs.length
  );
  const sentCount = logs.filter((item) => String(item.status || '').toLowerCase() === 'sent').length;
  const failedCount = logs.filter((item) => ['failed', 'bounced', 'spam'].includes(String(item.status || '').toLowerCase())).length;
  const bouncedCount = logs.filter((item) => String(item.status || '').toLowerCase() === 'bounced').length;
  const spamCount = logs.filter((item) => String(item.status || '').toLowerCase() === 'spam').length;
  const skippedCount = logs.filter((item) => String(item.status || '').toLowerCase() === 'skipped' || item.followUpStopped).length;
  const pendingCount = Math.max(0, totalRecipients - sentCount - failedCount - skippedCount);
  const openCount = logs.reduce((sum, item) => sum + Number(item.openCount || 0), 0);
  const replyCount = logs.reduce((sum, item) => sum + Number(item.replyCount || 0), 0);
  const positiveReplyCount = logs.filter((item) => item.replyType === 'positive').length;
  const negativeReplyCount = logs.filter((item) => item.replyType === 'negative' || item.replyType === 'unsubscribe').length;
  const followUpStoppedCount = logs.filter((item) => item.followUpStopped).length;
  const lastActivityAt = logs
    .map((item) => item.lastActivityAt || item.updatedAt || item.createdAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] || null;
  await Campaign.updateOne(
    { _id: campaignId },
    {
      $set: {
        openCount,
        replyCount,
        totalRecipients,
        sentCount,
        pendingCount,
        failedCount,
        skippedCount,
        bouncedCount,
        'stats.total': totalRecipients,
        'stats.sent': sentCount,
        'stats.failed': failedCount,
        'stats.bounced': bouncedCount,
        'stats.spam': spamCount,
        'stats.pending': pendingCount,
        positiveReplyCount,
        negativeReplyCount,
        followUpStoppedCount,
        ...(lastActivityAt ? { lastActivityAt } : {}),
        'trackingStats.openCount': openCount,
        'trackingStats.replyCount': replyCount
      }
    }
  );
}
