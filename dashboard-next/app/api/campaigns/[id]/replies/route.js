import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import CampaignSentEmail from '@/models/CampaignSentEmail';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { resolveSenderAccountById } from '@/lib/senderAccounts';
import { sendCampaignThreadReply, normalizeRecipientList, normalizeReplySubject } from '@/core-lib/mail-engine/CampaignThreadReplyService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function jsonError(status, code, message) {
  return NextResponse.json({ success: false, code, message, error: message }, { status, headers: NO_STORE_HEADERS });
}

function latestSentStep(recipientLog = {}) {
  const steps = Array.isArray(recipientLog.stepLogs) ? recipientLog.stepLogs : [];
  return [...steps].reverse().find((step) => step?.sentAt || step?.messageId || step?.internetMessageId || step?.conversationId) || {};
}

function resolveOriginalSubject(campaign = {}, recipientLog = {}) {
  const step = latestSentStep(recipientLog);
  return step.subject || campaign.inlineTemplate?.subject || campaign.name || '';
}

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const campaignId = String(params?.id || '').trim();
    if (!mongoose.isValidObjectId(campaignId)) return jsonError(400, 'INVALID_CAMPAIGN_ID', 'Invalid campaign id.');
    const url = new URL(req.url);
    const recipientLogId = String(url.searchParams.get('recipientLogId') || '').trim();
    const recipientEmail = String(url.searchParams.get('recipientEmail') || '').trim().toLowerCase();

    await connectDB();
    const campaign = await Campaign.findOne(buildAuthOwnerFilter(auth, { _id: campaignId })).lean();
    if (!campaign) return jsonError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found for current user.');

    if (!recipientLogId && !recipientEmail) return jsonError(400, 'RECIPIENT_REQUIRED', 'Recipient email history was not provided.');

    const recipientQuery = recipientLogId && mongoose.isValidObjectId(recipientLogId)
      ? { _id: recipientLogId, campaignId: campaign._id }
      : {
          campaignId: campaign._id,
          $or: [
            { email: recipientEmail },
            { recipientEmail }
          ]
        };
    const recipientLog = await CampaignRecipientLog.findOne(recipientQuery).lean();
    if (!recipientLog) return jsonError(404, 'RECIPIENT_NOT_FOUND', 'Recipient email history was not found.');

    const step = latestSentStep(recipientLog);
    const originalSubject = resolveOriginalSubject(campaign, recipientLog);
    const to = normalizeRecipientList(recipientLog.email || recipientLog.recipientEmail);
    const cc = normalizeRecipientList(step.cc || []);
    const sentEmailFilters = [
      recipientLog._id ? { recipientLogId: recipientLog._id } : null,
      step.messageId ? { messageId: step.messageId } : null,
      step.internetMessageId ? { internetMessageId: step.internetMessageId } : null,
      recipientLog.email || recipientLog.recipientEmail ? { recipientEmail: recipientLog.email || recipientLog.recipientEmail } : null
    ].filter(Boolean);
    const sentEmail = sentEmailFilters.length
      ? await CampaignSentEmail.findOne({ campaignId: campaign._id, $or: sentEmailFilters }).sort({ sentAt: -1 }).lean()
      : null;

    return NextResponse.json({
      success: true,
      compose: {
        mode: url.searchParams.get('mode') || 'reply',
        to,
        cc,
        bcc: [],
        subject: normalizeReplySubject(originalSubject),
        originalSubject,
        previous: {
          subject: originalSubject,
          sentAt: step.sentAt || recipientLog.lastSentAt || null,
          messageId: step.messageId || '',
          internetMessageId: step.internetMessageId || '',
          conversationId: step.conversationId || '',
          previewHtml: sentEmail?.bodyHtml || campaign.inlineTemplate?.bodyHtml || campaign.inlineTemplate?.body || ''
        }
      }
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError(500, 'CAMPAIGN_REPLY_PREFILL_FAILED', error.message || 'Unable to prepare campaign reply.');
  }
}

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const campaignId = String(params?.id || '').trim();
    if (!mongoose.isValidObjectId(campaignId)) return jsonError(400, 'INVALID_CAMPAIGN_ID', 'Invalid campaign id.');
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || body.action || 'reply').trim().toLowerCase();
    const recipientLogId = String(body.recipientLogId || '').trim();
    const recipientEmail = String(body.recipientEmail || '').trim().toLowerCase();

    await connectDB();
    const campaign = await Campaign.findOne(buildAuthOwnerFilter(auth, { _id: campaignId })).lean();
    if (!campaign) return jsonError(404, 'CAMPAIGN_NOT_FOUND', 'Campaign not found for current user.');

    if (!recipientLogId && !recipientEmail) return jsonError(400, 'RECIPIENT_REQUIRED', 'Recipient email history was not provided.');

    const recipientQuery = recipientLogId && mongoose.isValidObjectId(recipientLogId)
      ? { _id: recipientLogId, campaignId: campaign._id }
      : {
          campaignId: campaign._id,
          $or: [
            { email: recipientEmail },
            { recipientEmail }
          ]
        };
    const recipientLog = await CampaignRecipientLog.findOne(recipientQuery).lean();
    if (!recipientLog) return jsonError(404, 'RECIPIENT_NOT_FOUND', 'Recipient email history was not found.');

    const senderFrom = String(campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user || '').trim().toLowerCase();
    const account = campaign.senderAccountId
      ? await resolveSenderAccountById(campaign.senderAccountId, { userEmail: campaign.userEmail || '', project: campaign.project || campaign.projectId || '', senderFrom })
      : await resolveSenderAccountById(`graphapp:${senderFrom}`, { userEmail: campaign.userEmail || '', project: campaign.project || campaign.projectId || '', senderFrom });
    const fallbackAccount = account || (campaign.senderAccount?.provider ? { id: campaign.senderAccountId || '', ...campaign.senderAccount } : null);
    if (!fallbackAccount) return jsonError(400, 'MISSING_SENDER_ID', 'Sender account is missing or disconnected for this campaign.');

    const result = await sendCampaignThreadReply({
      campaign,
      recipientLog,
      account: fallbackAccount,
      mode,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      html: body.html || body.bodyHtml || body.message,
      text: body.text || body.bodyText || ''
    });

    const successMessage = mode === 'reminder' ? 'Reminder sent in the same thread.' : mode === 'reply_all' ? 'Reply all sent in the same thread.' : 'Reply sent in the same thread.';
    return NextResponse.json({ success: true, message: successMessage, reply: result.reply }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const text = String(error.message || error || 'Unable to send campaign reply.');
    const lower = text.toLowerCase();
    const status = lower.includes('expired') || lower.includes('token') ? 401 : lower.includes('missing') || lower.includes('invalid') ? 400 : 500;
    const code = status === 401 ? 'MICROSOFT_SESSION_EXPIRED' : status === 400 ? 'CAMPAIGN_REPLY_INVALID' : 'CAMPAIGN_REPLY_SEND_FAILED';
    return jsonError(status, code, text);
  }
}