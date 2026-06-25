import nodemailer from 'nodemailer';
import { htmlToText } from 'html-to-text';
import CampaignEmailReply from '../../database-models/CampaignEmailReply.js';
import CampaignSentEmail from '../../database-models/CampaignSentEmail.js';
import CampaignRecipientLog from '../../database-models/CampaignRecipientLog.js';
import EmailThread from '../../database-models/EmailThread.js';
import { getDelegatedAccessToken, getGraphAccessToken } from './GraphAndSmtpMailSender.js';

const MAX_SUBJECT_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

function cleanHeader(value = '') {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

export function normalizeRecipientList(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => normalizeRecipientList(item)))];
  }
  return String(value || '')
    .split(/[;,]/)
    .map((entry) => cleanHeader(entry).replace(/^mailto:/i, '').replace(/^[<\[('"`\s]+/, '').replace(/[>\])'"`\s]+$/, '').trim().toLowerCase())
    .filter((entry) => entry && EMAIL_PATTERN.test(entry));
}

export function normalizeReplySubject(subject = '') {
  const value = cleanHeader(subject).slice(0, MAX_SUBJECT_LENGTH);
  if (!value) return 'Re:';
  return /^re:/i.test(value) ? value : `Re: ${value}`.slice(0, MAX_SUBJECT_LENGTH);
}

function graphRecipients(values = []) {
  return normalizeRecipientList(values).map((address) => ({ emailAddress: { address } }));
}

function firstSentStep(recipientLog = {}) {
  const steps = Array.isArray(recipientLog.stepLogs) ? recipientLog.stepLogs : [];
  return [...steps].reverse().find((step) => step?.sentAt || step?.messageId || step?.internetMessageId || step?.conversationId) || {};
}

function buildReferences(original = {}) {
  const refs = Array.isArray(original.references) ? original.references : [];
  const parent = String(original.internetMessageId || original.messageId || '').trim();
  return [...new Set([...refs, parent].filter(Boolean))];
}

async function graphRequestWithAccount(account, path, options = {}) {
  const token = account.provider === 'graph_oauth'
    ? await getDelegatedAccessToken(account.oauthAccountId)
    : await getGraphAccessToken(account);
  const url = path.startsWith('http') ? path : `${GRAPH_BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    cache: 'no-store'
  });
  if (response.status === 204) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Microsoft Graph request failed (${response.status})`);
    error.status = response.status;
    error.code = response.status === 401 ? 'MICROSOFT_SESSION_EXPIRED' : data?.error?.code || 'GRAPH_REQUEST_FAILED';
    throw error;
  }
  return data;
}

async function sendGraphThreadReply({ account, original, mode, to, cc, bcc, subject, html }) {
  const messageId = String(original.messageId || '').trim();
  if (!messageId) {
    throw new Error('Original Outlook message id is missing. Sync or resend the campaign before replying in the same Outlook thread.');
  }

  const userPrefix = account.provider === 'graph_oauth'
    ? '/me'
    : `/users/${encodeURIComponent(account.from)}`;
  const action = mode === 'reply_all' ? 'createReplyAll' : 'createReply';
  const draft = await graphRequestWithAccount(account, `${userPrefix}/messages/${encodeURIComponent(messageId)}/${action}`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  if (!draft?.id) throw new Error('Microsoft Graph did not create a reply draft.');

  const patchBody = {
    subject,
    body: { contentType: 'HTML', content: html },
    toRecipients: graphRecipients(to),
    ccRecipients: graphRecipients(cc),
    bccRecipients: graphRecipients(bcc)
  };
  await graphRequestWithAccount(account, `${userPrefix}/messages/${encodeURIComponent(draft.id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patchBody)
  });
  const savedDraft = await graphRequestWithAccount(account, `${userPrefix}/messages/${encodeURIComponent(draft.id)}?$select=id,internetMessageId,conversationId,subject`, {
    method: 'GET'
  }).catch(() => draft);
  await graphRequestWithAccount(account, `${userPrefix}/messages/${encodeURIComponent(draft.id)}/send`, { method: 'POST' });
  return {
    messageId: String(savedDraft?.id || draft.id || ''),
    internetMessageId: String(savedDraft?.internetMessageId || draft.internetMessageId || ''),
    conversationId: String(savedDraft?.conversationId || original.conversationId || ''),
    providerResponse: { graphDraftId: draft.id }
  };
}

async function sendSmtpThreadReply({ account, original, to, cc, bcc, subject, html, text, references }) {
  const inReplyTo = String(original.internetMessageId || original.messageId || '').trim();
  if (!inReplyTo) {
    throw new Error('Original message id is missing, so SMTP cannot attach this reply to the previous thread.');
  }
  if (!account.host || !account.user || !account.pass) {
    throw new Error('SMTP sender configuration is incomplete.');
  }
  const transport = nodemailer.createTransport({
    host: account.host,
    port: Number(account.port || 587),
    secure: Boolean(account.secure),
    auth: { user: account.user, pass: account.pass }
  });
  const info = await transport.sendMail({
    from: account.from || account.user,
    to: normalizeRecipientList(to).join(', '),
    cc: normalizeRecipientList(cc).length ? normalizeRecipientList(cc).join(', ') : undefined,
    bcc: normalizeRecipientList(bcc).length ? normalizeRecipientList(bcc).join(', ') : undefined,
    subject,
    html,
    text,
    inReplyTo,
    references
  });
  return { messageId: String(info?.messageId || '').trim(), internetMessageId: String(info?.messageId || '').trim(), conversationId: '' };
}

export async function sendCampaignThreadReply({ campaign, recipientLog, account, mode = 'reply', to = [], cc = [], bcc = [], subject = '', html = '', text = '' }) {
  const normalizedMode = mode === 'reply_all' ? 'reply_all' : mode === 'reminder' ? 'reminder' : 'reply';
  const step = firstSentStep(recipientLog);
  const sentEmail = await CampaignSentEmail.findOne({ campaignId: campaign._id, recipientEmail: recipientLog.email || recipientLog.recipientEmail })
    .sort({ sentAt: -1 })
    .lean()
    .catch(() => null);
  const original = {
    messageId: step.messageId || sentEmail?.messageId || '',
    internetMessageId: step.internetMessageId || sentEmail?.internetMessageId || step.messageId || '',
    conversationId: step.conversationId || sentEmail?.conversationId || '',
    subject: step.subject || sentEmail?.subject || campaign.inlineTemplate?.subject || campaign.name || '',
    references: sentEmail?.references || []
  };
  const finalSubject = normalizeReplySubject(subject || original.subject);
  const finalHtml = String(html || '').trim();
  if (!finalHtml) throw new Error('Reply message is required.');
  const finalText = String(text || '').trim() || htmlToText(finalHtml, { wordwrap: 130 });
  const finalTo = normalizeRecipientList(to).length ? normalizeRecipientList(to) : normalizeRecipientList(recipientLog.email || recipientLog.recipientEmail);
  const finalCc = normalizedMode === 'reply' ? [] : normalizeRecipientList(cc);
  const finalBcc = normalizeRecipientList(bcc);
  if (!finalTo.length) throw new Error('A valid recipient is required.');

  const provider = String(account.provider || 'smtp').toLowerCase();
  const references = buildReferences(original);
  const replyBase = {
    userId: campaign.userId || null,
    userEmail: campaign.userEmail || '',
    campaignId: campaign._id,
    draftId: campaign.draftId || null,
    recipientLogId: recipientLog._id || null,
    parentMessageId: original.messageId || '',
    parentInternetMessageId: original.internetMessageId || '',
    conversationId: original.conversationId || '',
    inReplyTo: original.internetMessageId || original.messageId || '',
    references,
    originalSubject: original.subject || finalSubject,
    subject: finalSubject,
    to: finalTo,
    cc: finalCc,
    bcc: finalBcc,
    senderId: campaign.senderAccountId || account.id || '',
    senderEmail: account.from || account.user || campaign.senderFrom || '',
    provider,
    project: campaign.projectName || campaign.project || campaign.projectId || '',
    bodyHtml: finalHtml,
    bodyText: finalText,
    type: normalizedMode
  };

  try {
    const sendResult = provider === 'graph' || provider === 'graph_oauth'
      ? await sendGraphThreadReply({ account, original, mode: normalizedMode, to: finalTo, cc: finalCc, bcc: finalBcc, subject: finalSubject, html: finalHtml })
      : await sendSmtpThreadReply({ account, original, to: finalTo, cc: finalCc, bcc: finalBcc, subject: finalSubject, html: finalHtml, text: finalText, references });

    const sentAt = new Date();
    const replyDoc = await CampaignEmailReply.create({
      ...replyBase,
      messageId: sendResult.messageId || '',
      internetMessageId: sendResult.internetMessageId || '',
      conversationId: sendResult.conversationId || original.conversationId || '',
      status: 'sent',
      sentAt
    });

    await CampaignRecipientLog.updateOne(
      { _id: recipientLog._id },
      {
        $set: {
          lastActivityAt: sentAt,
          lastFollowUpAt: sentAt,
          threadStatus: normalizedMode === 'reminder' ? 'Reminder Sent' : normalizedMode === 'reply_all' ? 'Reply All Sent' : 'Reply Sent'
        },
        $inc: {
          reminderSentCount: normalizedMode === 'reminder' ? 1 : 0,
          manualReplySentCount: normalizedMode === 'reply' ? 1 : 0,
          replyAllSentCount: normalizedMode === 'reply_all' ? 1 : 0
        }
      }
    );

    await EmailThread.updateOne(
      {
        userEmail: campaign.userEmail || '',
        recipientEmail: recipientLog.email || recipientLog.recipientEmail || finalTo[0],
        senderKey: `${provider}:${String(account.from || account.user || '').trim().toLowerCase()}`
      },
      {
        $set: {
          userEmail: campaign.userEmail || '',
          userId: campaign.userId || null,
          recipientEmail: recipientLog.email || recipientLog.recipientEmail || finalTo[0],
          senderKey: `${provider}:${String(account.from || account.user || '').trim().toLowerCase()}`,
          messageId: sendResult.messageId || original.messageId || '',
          internetMessageId: sendResult.internetMessageId || original.internetMessageId || '',
          conversationId: sendResult.conversationId || original.conversationId || '',
          inReplyTo: original.internetMessageId || original.messageId || '',
          references,
          originalSubject: original.subject || finalSubject,
          subject: finalSubject,
          to: finalTo,
          cc: finalCc,
          bcc: finalBcc,
          provider,
          senderId: campaign.senderAccountId || account.id || '',
          campaignId: campaign._id,
          draftId: campaign.draftId || null,
          project: campaign.projectName || campaign.project || campaign.projectId || '',
          sentAt,
          updatedAt: sentAt
        }
      },
      { upsert: true }
    );

    return { success: true, reply: replyDoc.toObject ? replyDoc.toObject() : replyDoc };
  } catch (error) {
    await CampaignEmailReply.create({ ...replyBase, status: 'failed', failureReason: error.message || String(error), sentAt: new Date() }).catch(() => null);
    throw error;
  }
}