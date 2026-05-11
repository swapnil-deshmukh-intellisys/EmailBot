import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import { requireAuth } from '@/lib/apiAuth';
import {
  classifyReplyType,
  ensureStepLogs,
  refreshCampaignRollups
} from '@/core-lib/campaign-engine/CampaignAnalyticsService';
import {
  getCurrentUserMailboxAccount,
  graphRequest,
  normalizeGraphError
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function stripHtml(value = '') {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function stopFutureSteps(stepLogs = [], replyAt = new Date()) {
  return ensureStepLogs(stepLogs, 5).map((step) => {
    if (Number(step.stepNumber) <= 1 || ['Sent', 'Opened', 'Replied'].includes(step.status)) return step;
    return {
      ...step,
      status: 'Skipped',
      skippedAt: step.skippedAt || replyAt,
      failureReason: 'Client replied - follow-up stopped'
    };
  });
}

export async function POST(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userEmail = normalizeEmail(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '');
  const campaignId = String(params?.id || '').trim();
  if (!mongoose.isValidObjectId(campaignId)) return NextResponse.json({ success: false, error: 'Invalid campaign id' }, { status: 400 });

  await connectDB();
  const campaign = await Campaign.findOne({ _id: campaignId, userEmail }).lean();
  if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found for current user' }, { status: 404 });

  try {
    const mailbox = await getCurrentUserMailboxAccount(auth);
    const response = await graphRequest(
      mailbox,
      '/me/messages?$top=50&$orderby=receivedDateTime desc&$select=subject,bodyPreview,from,sender,receivedDateTime,conversationId,internetMessageId,inReplyTo'
    );
    const messages = Array.isArray(response?.value) ? response.value : [];
    const recipients = await CampaignRecipientLog.find({ campaignId: campaign._id }).lean();
    let matched = 0;

    for (const message of messages) {
      const fromEmail = normalizeEmail(message.from?.emailAddress?.address || message.sender?.emailAddress?.address || '');
      if (!fromEmail) continue;
      const recipient = recipients.find((item) => normalizeEmail(item.email) === fromEmail);
      if (!recipient) continue;
      const preview = stripHtml(message.bodyPreview || '').slice(0, 500);
      const replyAt = message.receivedDateTime ? new Date(message.receivedDateTime) : new Date();
      const replyType = classifyReplyType(`${message.subject || ''} ${preview}`);
      const isAutoReply = replyType === 'auto-reply';
      const stepLogs = isAutoReply ? ensureStepLogs(recipient.stepLogs, 5) : stopFutureSteps(recipient.stepLogs, replyAt);
      stepLogs[0] = {
        ...stepLogs[0],
        status: isAutoReply ? 'Auto Reply' : 'Replied',
        repliedAt: replyAt,
        conversationId: message.conversationId || stepLogs[0].conversationId || '',
        internetMessageId: message.internetMessageId || stepLogs[0].internetMessageId || ''
      };

      await CampaignRecipientLog.updateOne(
        { _id: recipient._id },
        {
          $set: {
            status: isAutoReply ? 'Auto Reply' : 'Replied',
            replyReceived: !isAutoReply,
            replyType,
            replyPreview: preview,
            lastReplyAt: replyAt,
            followUpStopped: !isAutoReply,
            followUpStopReason: isAutoReply ? 'Auto reply detected' : 'Client replied - follow-up stopped',
            dnc: replyType === 'unsubscribe',
            unsubscribe: replyType === 'unsubscribe',
            stepLogs,
            lastActivityAt: replyAt
          },
          $inc: { replyCount: 1 }
        }
      );
      matched += 1;
    }

    await refreshCampaignRollups(campaign._id);
    await Campaign.updateOne(
      { _id: campaign._id },
      {
        $push: { logs: { level: 'info', message: `Reply sync completed: ${matched} replies matched`, at: new Date() } },
        $set: { lastActivityAt: new Date() }
      }
    );

    return NextResponse.json({ success: true, matched, message: `${matched} replies matched.` });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Reply sync failed');
    await Campaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
          lastError: normalized.message,
          lastErrorAt: new Date(),
          failureReason: normalized.code === 'MICROSOFT_SESSION_EXPIRED' ? 'Microsoft token expired' : normalized.message
        },
        $push: { logs: { level: 'error', message: `Reply sync failed: ${normalized.message}`, at: new Date() } }
      }
    ).catch(() => {});
    return NextResponse.json({ success: false, code: normalized.code, error: normalized.message, message: normalized.message }, { status: normalized.status || 500 });
  }
}
