import connectDB from './mongodb';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import SenderAccount from '@/models/SenderAccount';
import WarmupAutoReplySetting from '@/models/WarmupAutoReplySetting';
import WarmupAutoReplyLog from '@/models/WarmupAutoReplyLog';
import { getDelegatedAccessToken } from './emailSender';
import { getRuntimeSenderAccounts } from './senderAccounts';

const DEFAULT_SCAN_LIMIT = 20;
const MIN_SCAN_INTERVAL_MS = 45 * 1000;
const inFlightUsers = global.__warmupAutoReplyUsers || new Set();
const userThrottle = global.__warmupAutoReplyThrottle || new Map();
global.__warmupAutoReplyUsers = inFlightUsers;
global.__warmupAutoReplyThrottle = userThrottle;

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isWarmupCandidate(message, accountEmail, keywords) {
  const fromEmail = normalizeEmail(
    message?.from?.emailAddress?.address ||
    message?.fromEmail ||
    message?.envelope?.from?.[0]?.address ||
    ''
  );
  if (!fromEmail || fromEmail === normalizeEmail(accountEmail)) return false;
  if (/no-?reply|mailer-daemon|postmaster/i.test(fromEmail)) return false;

  const subject = String(message?.subject || '').toLowerCase();
  const preview = String(message?.bodyPreview || message?.preview || '').toLowerCase();
  const haystack = `${subject}\n${preview}`;
  return keywords.some((keyword) => haystack.includes(String(keyword || '').trim().toLowerCase())).valueOf();
}

function normalizeSubjectForReply(subject = '') {
  const trimmed = String(subject || '').trim();
  if (!trimmed) return 'Re: Warmup reply';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

function isGmailAccount(account = {}) {
  const provider = String(account?.provider || '').toLowerCase();
  const host = String(account?.host || '').toLowerCase();
  const from = normalizeEmail(account?.from || account?.user || '');
  return provider === 'gmail' || host.includes('gmail') || from.endsWith('@gmail.com');
}

async function fetchInboxMessages(token, top = DEFAULT_SCAN_LIMIT) {
  const params = new URLSearchParams({
    $top: String(top),
    $orderby: 'receivedDateTime desc',
    $select: 'id,internetMessageId,conversationId,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead'
  });
  const resp = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error?.message || 'Failed to fetch inbox messages for warmup auto reply');
  }
  return Array.isArray(data?.value) ? data.value : [];
}

async function createReplyDraft(token, graphMessageId) {
  const resp = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(graphMessageId)}/createReply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data?.id) {
    throw new Error(data?.error?.message || 'Failed to create warmup reply draft');
  }
  return data;
}

async function updateDraftBody(token, draftId, bodyHtml) {
  const resp = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(draftId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: {
        contentType: 'HTML',
        content: bodyHtml
      }
    })
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data?.error?.message || 'Failed to update warmup reply body');
  }
}

async function sendDraft(token, draftId) {
  const resp = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(draftId)}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data?.error?.message || 'Failed to send warmup reply');
  }
}

async function sendWarmupReply(token, message, replyTemplate) {
  const draft = await createReplyDraft(token, message.id);
  await updateDraftBody(token, draft.id, replyTemplate);
  await sendDraft(token, draft.id);
}

async function fetchGmailInboxMessages(account, top = DEFAULT_SCAN_LIMIT) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: account.user || account.from,
      pass: account.pass
    },
    logger: false
  });

  await client.connect();
  try {
    await client.mailboxOpen('INBOX');
    const sequence = await client.search({ seen: false }, { uid: true });
    const recentUids = sequence.slice(-top).reverse();
    const messages = [];

    for await (const message of client.fetch(recentUids, {
      uid: true,
      envelope: true,
      bodyStructure: true,
      flags: true,
      source: true,
      internalDate: true
    })) {
      const sourceText = message.source ? message.source.toString('utf8') : '';
      const internetMessageIdMatch = sourceText.match(/^message-id:\s*(.+)$/im);
      messages.push({
        id: String(message.uid || ''),
        internetMessageId: internetMessageIdMatch?.[1]?.trim() || '',
        conversationId: '',
        subject: message.envelope?.subject || '',
        preview: sourceText.slice(0, 1000),
        fromEmail: message.envelope?.from?.[0]?.address || '',
        receivedAt: message.internalDate || null
      });
    }

    return messages;
  } finally {
    await client.logout().catch(() => {});
  }
}

async function sendWarmupReplyViaGmail(account, message, replyTemplate) {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: account.user || account.from,
      pass: account.pass
    }
  });

  await transport.sendMail({
    from: account.from,
    to: message.fromEmail,
    subject: normalizeSubjectForReply(message.subject),
    html: replyTemplate,
    inReplyTo: message.internetMessageId || undefined,
    references: message.internetMessageId ? [message.internetMessageId] : undefined
  });
}

function buildGmailAccountPool(userEmail = '') {
  const runtimeAccounts = getRuntimeSenderAccounts()
    .filter((account) => isGmailAccount(account))
    .map((account) => ({
      id: account.id || `runtime:${account.from}`,
      provider: 'gmail',
      from: account.from,
      user: account.user,
      pass: account.pass,
      host: account.host
    }));

  return SenderAccount.find({ userEmail, provider: { $in: ['gmail', 'smtp'] } }).lean().then((dbAccounts) => {
    const gmailDbAccounts = dbAccounts
      .filter((account) => isGmailAccount(account))
      .map((account) => ({
        id: `db:${String(account._id)}`,
        provider: 'gmail',
        from: account.from,
        user: account.user,
        pass: account.pass,
        host: account.host
      }));

    const map = new Map();
    [...runtimeAccounts, ...gmailDbAccounts].forEach((account) => {
      const key = normalizeEmail(account.from || account.user || '');
      if (key && !map.has(key) && account.pass) {
        map.set(key, account);
      }
    });
    return Array.from(map.values());
  });
}

async function processGraphWarmupReplies({ normalizedUserEmail, setting, account }) {
  const token = await getDelegatedAccessToken(String(account._id));
  const messages = await fetchInboxMessages(token, Math.max(5, Number(setting.maxRepliesPerRun || 3) * 4));
  const mailboxEmail = normalizeEmail(account.email);
  const keywords = Array.isArray(setting.keywords) && setting.keywords.length
    ? setting.keywords
    : ['warmup', 'warm up', 'warming'];

  let replied = 0;
  let skipped = 0;
  let processed = 0;

  for (const message of messages) {
    if (replied >= Math.max(1, Number(setting.maxRepliesPerRun || 3))) break;

    const graphMessageId = String(message?.id || '').trim();
    if (!graphMessageId) continue;
    processed += 1;

    const existing = await WarmupAutoReplyLog.findOne({
      userEmail: normalizedUserEmail,
      mailboxEmail,
      graphMessageId
    }).lean();

    if (existing) {
      skipped += 1;
      continue;
    }
    if (!isWarmupCandidate(message, mailboxEmail, keywords)) continue;

    try {
      await sendWarmupReply(token, message, String(setting.replyTemplate || ''));
        await WarmupAutoReplyLog.create({
          userEmail: normalizedUserEmail,
          mailboxEmail,
          graphMessageId,
          internetMessageId: String(message?.internetMessageId || ''),
          conversationId: String(message?.conversationId || ''),
          fromEmail: normalizeEmail(message?.from?.emailAddress?.address || ''),
          subject: String(message?.subject || ''),
          status: 'replied',
          note: stripHtml(message?.bodyPreview || '').slice(0, 200),
          replyBody: String(setting.replyTemplate || ''),
          repliedAt: new Date()
        });
      replied += 1;
    } catch (error) {
      await WarmupAutoReplyLog.create({
        userEmail: normalizedUserEmail,
        mailboxEmail,
        graphMessageId,
        internetMessageId: String(message?.internetMessageId || ''),
        conversationId: String(message?.conversationId || ''),
        fromEmail: normalizeEmail(message?.from?.emailAddress?.address || ''),
        subject: String(message?.subject || ''),
        status: 'failed',
        note: String(error?.message || 'Warmup reply failed').slice(0, 300),
        repliedAt: new Date()
      }).catch(() => {});
    }
  }

  return { processed, replied, skipped };
}

async function processGmailWarmupReplies({ normalizedUserEmail, setting, gmailAccounts }) {
  const keywords = Array.isArray(setting.keywords) && setting.keywords.length
    ? setting.keywords
    : ['warmup', 'warm up', 'warming'];

  let processed = 0;
  let replied = 0;
  let skipped = 0;
  const maxReplies = Math.max(1, Number(setting.maxRepliesPerRun || 3));

  for (const account of gmailAccounts) {
    if (replied >= maxReplies) break;
    const mailboxEmail = normalizeEmail(account.from || account.user || '');
    let messages = [];

    try {
      messages = await fetchGmailInboxMessages(account, Math.max(5, maxReplies * 4));
    } catch (error) {
      await WarmupAutoReplyLog.create({
        userEmail: normalizedUserEmail,
        mailboxEmail,
        graphMessageId: `gmail-error:${Date.now()}:${mailboxEmail}`,
        internetMessageId: '',
        conversationId: '',
        fromEmail: mailboxEmail,
        subject: 'Gmail inbox read failed',
        status: 'failed',
        note: String(error?.message || 'Gmail inbox read failed').slice(0, 300),
        repliedAt: new Date()
      }).catch(() => {});
      continue;
    }

    for (const message of messages) {
      if (replied >= maxReplies) break;

      const messageKey = String(message?.id || '').trim();
      if (!messageKey) continue;
      processed += 1;

      const existing = await WarmupAutoReplyLog.findOne({
        userEmail: normalizedUserEmail,
        mailboxEmail,
        graphMessageId: messageKey
      }).lean();

      if (existing) {
        skipped += 1;
        continue;
      }
      if (!isWarmupCandidate(message, mailboxEmail, keywords)) continue;

      try {
        await sendWarmupReplyViaGmail(account, message, String(setting.replyTemplate || ''));
        await WarmupAutoReplyLog.create({
          userEmail: normalizedUserEmail,
          mailboxEmail,
          graphMessageId: messageKey,
          internetMessageId: String(message?.internetMessageId || ''),
          conversationId: '',
          fromEmail: normalizeEmail(message?.fromEmail || ''),
          subject: String(message?.subject || ''),
          status: 'replied',
          note: stripHtml(message?.preview || '').slice(0, 200),
          replyBody: String(setting.replyTemplate || ''),
          repliedAt: new Date()
        });
        replied += 1;
      } catch (error) {
        await WarmupAutoReplyLog.create({
          userEmail: normalizedUserEmail,
          mailboxEmail,
          graphMessageId: messageKey,
          internetMessageId: String(message?.internetMessageId || ''),
          conversationId: '',
          fromEmail: normalizeEmail(message?.fromEmail || ''),
          subject: String(message?.subject || ''),
          status: 'failed',
          note: String(error?.message || 'Gmail warmup reply failed').slice(0, 300),
          repliedAt: new Date()
        }).catch(() => {});
      }
    }
  }

  return { processed, replied, skipped };
}

export async function getWarmupAutoReplySetting(userEmail = '', options = {}) {
  await connectDB();
  const normalizedUserEmail = normalizeEmail(userEmail);
  if (!normalizedUserEmail) {
    return null;
  }
  const query = WarmupAutoReplySetting.findOneAndUpdate(
    { userEmail: normalizedUserEmail },
    { $setOnInsert: { userEmail: normalizedUserEmail } },
    { upsert: true, new: true }
  );
  const setting = options?.lean ? await query.lean() : await query;
  return setting;
}

export async function processWarmupAutoReplies(userEmail = '', options = {}) {
  const normalizedUserEmail = normalizeEmail(userEmail);
  if (!normalizedUserEmail) {
    return { ok: false, processed: 0, replied: 0, skipped: 0, reason: 'missing-user' };
  }

  const force = Boolean(options?.force);
  const lastRunAt = Number(userThrottle.get(normalizedUserEmail) || 0);
  if (!force && lastRunAt && (Date.now() - lastRunAt) < MIN_SCAN_INTERVAL_MS) {
    return { ok: true, processed: 0, replied: 0, skipped: 0, reason: 'throttled' };
  }
  if (inFlightUsers.has(normalizedUserEmail)) {
    return { ok: true, processed: 0, replied: 0, skipped: 0, reason: 'in-flight' };
  }

  inFlightUsers.add(normalizedUserEmail);
  userThrottle.set(normalizedUserEmail, Date.now());

  try {
    await connectDB();
    const [setting, graphAccount, gmailAccounts] = await Promise.all([
      getWarmupAutoReplySetting(normalizedUserEmail, { lean: true }),
      GraphOAuthAccount.findOne({ userEmail: normalizedUserEmail }).sort({ updatedAt: -1 }),
      buildGmailAccountPool(normalizedUserEmail)
    ]);

    if (!setting?.enabled) {
      return { ok: true, processed: 0, replied: 0, skipped: 0, reason: 'disabled' };
    }
    if (!graphAccount?._id && !gmailAccounts.length) {
      return { ok: false, processed: 0, replied: 0, skipped: 0, reason: 'mailbox-not-connected' };
    }

    const [graphResult, gmailResult] = await Promise.all([
      graphAccount?._id
        ? processGraphWarmupReplies({ normalizedUserEmail, setting, account: graphAccount })
        : Promise.resolve({ processed: 0, replied: 0, skipped: 0 }),
      gmailAccounts.length
        ? processGmailWarmupReplies({ normalizedUserEmail, setting, gmailAccounts })
        : Promise.resolve({ processed: 0, replied: 0, skipped: 0 })
    ]);

    const processed = Number(graphResult.processed || 0) + Number(gmailResult.processed || 0);
    const replied = Number(graphResult.replied || 0) + Number(gmailResult.replied || 0);
    const skipped = Number(graphResult.skipped || 0) + Number(gmailResult.skipped || 0);

    await WarmupAutoReplySetting.updateOne(
      { userEmail: normalizedUserEmail },
      {
        $set: {
          lastCheckedAt: new Date(),
          lastRepliedAt: replied ? new Date() : setting.lastRepliedAt || null
        }
      }
    );

    return { ok: true, processed, replied, skipped, reason: 'completed' };
  } finally {
    inFlightUsers.delete(normalizedUserEmail);
  }
}
