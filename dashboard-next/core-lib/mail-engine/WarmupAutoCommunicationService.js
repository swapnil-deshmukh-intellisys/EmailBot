import crypto from 'crypto';
import connectDB from '../database-config/MongoDatabaseConnection.js';
import WarmupConversation from '../../database-models/WarmupConversation.js';
import WarmupMessage from '../../database-models/WarmupMessage.js';
import SenderAccount from '../../database-models/SenderAccount.js';
import GraphOAuthAccount from '../../database-models/GraphOAuthAccount.js';
import { getPresetSenderEmails, resolveSenderAccountById } from './SenderAccountResolver.js';
import { sendEmailForLead } from './GraphAndSmtpMailSender.js';

export const WARMUP_SEQUENCE = [
  'Hi {name}, just checking this thread.',
  'Received your note, everything looks fine here.',
  'Great, sending one more quick confirmation.',
  'Confirmed from my side, the message came through.',
  'Thanks, I am checking the thread flow again.',
  'Got it clearly, no issue on this side.',
  'Perfect, this exchange looks active now.',
  'Yes, the conversation is still coming through.',
  'Thanks for confirming the final check.',
  'Ok thanks'
];

const schedulerState = global.__warmupAutoCommunicationScheduler || {
  started: false,
  intervalId: null,
  tickPromise: null
};
global.__warmupAutoCommunicationScheduler = schedulerState;

const normalizeEmail = (value = '') => String(value || '').trim().toLowerCase();
const isConnectedStatus = (value = '') => ['connected', 'active', 'verified', 'good'].includes(String(value || '').trim().toLowerCase());

export function buildWarmupThreadId({ userId = '', projectId = '', senderEmail = '', receiverEmail = '', runId = '' }) {
  return crypto
    .createHash('sha1')
    .update([userId, projectId, normalizeEmail(senderEmail), normalizeEmail(receiverEmail), runId].join(':'))
    .digest('hex');
}

function providerName(account = {}) {
  const provider = String(account.provider || '').toLowerCase();
  if (provider === 'graph' || provider === 'graph_oauth') return 'outlook';
  if (provider === 'gmail') return 'gmail';
  if (provider === 'smtp') return 'smtp';
  return 'internal';
}

function renderBody(template = '', email = '') {
  const name = String(email || '').split('@')[0] || 'there';
  return String(template || '').replace(/\{name\}/gi, name);
}

function buildNeutralSubject(conversation) {
  return `Quick check ${conversation.threadId.slice(0, 8)}`;
}

export async function findVerifiedWarmupAccountByEmail({ userEmail = '', projectId = '', email = '', includeRuntime = false }) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const [dbAccount, oauthAccount] = await Promise.all([
    SenderAccount.findOne({ userEmail, from: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean(),
    GraphOAuthAccount.findOne({ userEmail, email: new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).lean()
  ]);

  if (dbAccount && isConnectedStatus(dbAccount.status || dbAccount.health)) {
    const resolved = await resolveSenderAccountById(`db:${String(dbAccount._id)}`, {
      userEmail,
      project: projectId,
      senderFrom: normalized
    });
    if (resolved?.from) return resolved;
  }
  if (oauthAccount && isConnectedStatus(oauthAccount.status || oauthAccount.health)) {
    const resolved = await resolveSenderAccountById(`oauth:${String(oauthAccount._id)}`, {
      userEmail,
      project: projectId,
      senderFrom: normalized
    });
    if (resolved?.from) return resolved;
  }

  if (!includeRuntime) return null;

  const projectPresetEmails = new Set(getPresetSenderEmails(projectId));
  if (!projectPresetEmails.has(normalized)) return null;
  const runtime = await resolveSenderAccountById(`graphapp:${normalized}`, { userEmail, project: projectId, senderFrom: normalized });
  return runtime ? { id: runtime.id, provider: runtime.provider, from: runtime.from, status: 'Connected' } : null;
}

async function createWarmupMessage(conversation, account, messageNumber) {
  const existing = await WarmupMessage.findOne({ conversationId: conversation._id, messageNumber }).lean();
  if (existing && existing.status !== 'failed') return existing;

  const senderEmail = normalizeEmail(conversation.senderEmail);
  const receiverEmail = normalizeEmail(conversation.receiverEmail);
  const isSenderTurn = messageNumber % 2 === 1;
  const fromEmail = isSenderTurn ? senderEmail : receiverEmail;
  const toEmail = isSenderTurn ? receiverEmail : senderEmail;
  const body = renderBody(WARMUP_SEQUENCE[messageNumber - 1] || WARMUP_SEQUENCE[WARMUP_SEQUENCE.length - 1], toEmail);
  const subject = buildNeutralSubject(conversation);
  const toAccount = await findVerifiedWarmupAccountByEmail({
    userEmail: conversation.userEmail,
    projectId: conversation.projectId,
    email: toEmail,
    includeRuntime: true
  });
  const fromAccount = isSenderTurn
    ? account
    : await findVerifiedWarmupAccountByEmail({
        userEmail: conversation.userEmail,
        projectId: conversation.projectId,
        email: fromEmail,
        includeRuntime: true
      });
  const canSendReal = Boolean(fromAccount && toAccount);
  const receiverAccountId = conversation.receiverAccountId || `bot:${receiverEmail}`;
  const fromAccountId = fromAccount?.id || (isSenderTurn ? conversation.selectedSenderId : receiverAccountId);
  const toAccountId = toAccount?.id || (isSenderTurn ? receiverAccountId : conversation.selectedSenderId);
  const receiverType = receiverAccountId && !receiverAccountId.startsWith('bot:') && !receiverAccountId.startsWith('approved:')
    ? 'connected_sender'
    : 'simulated';
  const fromType = fromAccount ? 'connected_sender' : 'internal_bot';
  const toType = toAccount ? 'connected_sender' : (isSenderTurn ? receiverType : 'connected_sender');

  const base = {
    userId: conversation.userId || null,
    userEmail: conversation.userEmail || '',
    projectId: conversation.projectId || '',
    conversationId: conversation._id,
    threadId: conversation.threadId,
    messageNumber,
    fromAccountId,
    toAccountId,
    fromEmail,
    toEmail,
    fromType,
    toType,
    subject,
    body
  };

  if (!canSendReal) {
    const simulatedPayload = {
      ...base,
      status: 'simulated',
      provider: 'internal',
      sentAt: new Date(),
      failedReason: '',
      simulatedReply: true
    };
    if (existing?._id) {
      return WarmupMessage.findByIdAndUpdate(existing._id, { $set: simulatedPayload }, { new: true }).lean();
    }
    return WarmupMessage.create(simulatedPayload);
  }

  try {
    const sendResult = await sendEmailForLead({
      account: fromAccount,
      template: { subject, body },
      lead: { Email: toEmail, Name: toEmail.split('@')[0] }
    });
    const sentPayload = {
      ...base,
      status: 'sent',
      provider: providerName(fromAccount),
      providerMessageId: sendResult?.messageId || sendResult?.internetMessageId || '',
      sentAt: new Date(),
      failedReason: '',
      simulatedReply: false
    };
    if (existing?._id) {
      return WarmupMessage.findByIdAndUpdate(existing._id, { $set: sentPayload }, { new: true }).lean();
    }
    return WarmupMessage.create(sentPayload);
  } catch (error) {
    const failedPayload = {
      ...base,
      status: 'failed',
      provider: providerName(fromAccount),
      failedReason: error.message || 'provider send failed',
      simulatedReply: false
    };
    if (existing?._id) {
      return WarmupMessage.findByIdAndUpdate(existing._id, { $set: failedPayload }, { new: true }).lean();
    }
    return WarmupMessage.create(failedPayload);
  }
}

export async function processDueWarmupCommunications({ limit = 25 } = {}) {
  await connectDB();
  const now = new Date();
  const conversations = await WarmupConversation.find({
    status: { $in: ['pending', 'running'] },
    nextMessageAt: { $ne: null, $lte: now },
    $expr: { $lt: ['$currentMessageNumber', { $ifNull: ['$totalMessages', 10] }] }
  })
    .sort({ nextMessageAt: 1, createdAt: 1 })
    .limit(limit);

  const results = [];
  for (const conversation of conversations) {
    const totalMessages = Math.max(1, Math.min(10, Number(conversation.totalMessages || 10) || 10));
    const currentNumber = Number(conversation.currentMessageNumber || 0);
    const failedCurrentMessage = currentNumber > 0
      ? await WarmupMessage.findOne({
          conversationId: conversation._id,
          messageNumber: currentNumber,
          status: 'failed'
        }).lean()
      : null;
    const nextNumber = failedCurrentMessage ? currentNumber : currentNumber + 1;
    const account = await resolveSenderAccountById(conversation.selectedSenderId, {
      userEmail: conversation.userEmail,
      project: conversation.projectId,
      senderFrom: conversation.senderEmail
    });

    if (!account) {
      conversation.status = 'failed';
      conversation.lastError = 'No verified sender account found for this email.';
      conversation.failedReason = 'missing connected sender account';
      await conversation.save();
      results.push({ conversationId: String(conversation._id), status: 'failed' });
      continue;
    }

    const message = await createWarmupMessage(conversation, account, nextNumber);
    conversation.currentMessageNumber = nextNumber;
    conversation.status = nextNumber >= totalMessages ? 'completed' : 'running';
    conversation.lastMessageAt = message.sentAt || new Date();
    conversation.nextMessageAt = nextNumber >= totalMessages
      ? null
      : new Date(Date.now() + Math.max(1, Number(conversation.delayMinutes || 1)) * 60 * 1000);
    conversation.completedAt = nextNumber >= totalMessages ? new Date() : null;
    conversation.lastError = message.status === 'failed' ? message.failedReason || 'Message send failed' : '';
    conversation.failedReason = conversation.lastError;
    await conversation.save();
    results.push({ conversationId: String(conversation._id), messageNumber: nextNumber, status: message.status });
  }

  return { processed: results.length, results };
}

export function initWarmupAutoCommunicationScheduler() {
  if (schedulerState.started) return;
  schedulerState.started = true;
  schedulerState.intervalId = setInterval(() => {
    schedulerState.tickPromise = processDueWarmupCommunications().catch((error) => {
      console.error('[warmup-auto-communication] scheduler failed', error);
    });
  }, Math.max(15000, Number(process.env.WARMUP_AUTO_COMMUNICATION_INTERVAL_MS || 30000)));
  if (typeof schedulerState.intervalId.unref === 'function') schedulerState.intervalId.unref();
}
