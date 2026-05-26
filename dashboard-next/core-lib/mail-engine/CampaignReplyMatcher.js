import connectDB from '../database-config/MongoDatabaseConnection.js';
import Campaign from '../../database-models/Campaign.js';
import LeadList from '../../database-models/LeadList.js';
import CampaignReply from '../../database-models/CampaignReply.js';

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();

function classifyReply({ subject = '', preview = '', isRead = true } = {}) {
  if (!isRead) return 'unread';
  const text = `${subject} ${preview}`.toLowerCase();
  if (/(not interested|unsubscribe|remove me|stop emailing|no thanks)\b/.test(text)) return 'not_interested';
  if (/(interested|sounds good|let'?s talk|schedule|book|send details|yes|positive)\b/.test(text)) return 'positive';
  if (/(no\b|not now|decline|won'?t|cannot|can't|negative)\b/.test(text)) return 'negative';
  if (/(follow up|later|next week|circle back|remind me)\b/.test(text)) return 'follow_up';
  return 'unknown';
}

async function findCampaignForSender({ userEmail, fromEmail }) {
  const normalizedFrom = normalizeEmail(fromEmail);
  if (!userEmail || !normalizedFrom) return null;

  const list = await LeadList.findOne({
    userEmail,
    $or: [
      { 'leads.Email': normalizedFrom },
      { 'leads.email': normalizedFrom },
      { 'leads.data.Email': normalizedFrom },
      { 'leads.data.email': normalizedFrom }
    ]
  }).sort({ updatedAt: -1, createdAt: -1 }).lean();
  if (!list?._id) return null;

  const campaign = await Campaign.findOne({ userEmail, listId: list._id }).sort({ updatedAt: -1, createdAt: -1 });
  if (!campaign?._id) return null;
  return { campaign, list };
}

export async function syncCampaignReplyFromMessage({ auth = {}, account = null, message = {} }) {
  const userEmail = normalizeEmail(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '');
  const fromEmail = normalizeEmail(message.from?.email || message.sender?.email || '');
  const messageId = String(message.id || '').trim();
  if (!userEmail || !fromEmail || !messageId) return null;

  await connectDB();
  const match = await findCampaignForSender({ userEmail, fromEmail });
  if (!match?.campaign?._id) return null;

  const replyType = classifyReply({ subject: message.subject, preview: message.preview, isRead: message.isRead });
  const existing = await CampaignReply.findOne({ userEmail, messageId }).lean();
  const doc = await CampaignReply.findOneAndUpdate(
    { userEmail, messageId },
    {
      $set: {
        userId: auth.currentUser?._id || null,
        userEmail,
        projectId: match.campaign.projectId || match.campaign.project || '',
        campaignId: match.campaign._id,
        leadListId: match.list._id,
        leadEmail: fromEmail,
        accountId: account?._id ? String(account._id) : '',
        conversationId: message.conversationId || '',
        fromEmail,
        subject: message.subject || '',
        bodyPreview: message.preview || '',
        replyType,
        receivedAt: message.receivedDateTime || message.createdDateTime || new Date()
      }
    },
    { upsert: true, new: true }
  );

  if (!existing) {
    match.campaign.replyCount = Number(match.campaign.replyCount || 0) + 1;
    match.campaign.trackingStats = {
      ...(match.campaign.trackingStats || {}),
      replyCount: Number(match.campaign.trackingStats?.replyCount || 0) + 1
    };
    if (replyType === 'positive') match.campaign.positiveReplyCount = Number(match.campaign.positiveReplyCount || 0) + 1;
    if (['negative', 'not_interested'].includes(replyType)) match.campaign.negativeReplyCount = Number(match.campaign.negativeReplyCount || 0) + 1;
    match.campaign.lastActivityAt = new Date();
    await match.campaign.save().catch(() => {});
  }

  return doc;
}

export async function syncCampaignRepliesFromMessages({ auth = {}, account = null, messages = [] }) {
  const results = [];
  for (const message of messages) {
    const result = await syncCampaignReplyFromMessage({ auth, account, message }).catch(() => null);
    if (result) results.push(result);
  }
  return results;
}
