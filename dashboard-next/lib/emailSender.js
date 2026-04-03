import nodemailer from 'nodemailer';
import connectDB from './mongodb';
import GraphOAuthAccount from '../models/GraphOAuthAccount';
import { decryptString, encryptString } from './tokenCrypto';

const MAX_SUBJECT_LENGTH = 200;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildDefaultAccount() {
  return {
    provider: 'smtp',
    name: 'Default SMTP',
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER
  };
}

function buildGraphAccount() {
  const tenantId = process.env.TENANT_ID;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const sender = process.env.GRAPH_SENDER_EMAIL;

  const normalizedSender = String(sender || '').trim().toLowerCase();
  const senderLooksPlaceholder = !normalizedSender || normalizedSender.includes('your-email') || normalizedSender.includes('example.com');

  if (!tenantId || !clientId || !clientSecret || senderLooksPlaceholder) {
    return null;
  }

  return {
    provider: 'graph',
    name: 'Microsoft Graph (App)',
    tenantId,
    clientId,
    clientSecret,
    from: sender
  };
}

export function getAvailableAccounts(extraAccounts = []) {
  const provider = String(process.env.EMAIL_PROVIDER || 'auto').toLowerCase();
  const accounts = [];
  const graph = buildGraphAccount();
  const def = buildDefaultAccount();

  if ((provider === 'graph' || provider === 'auto') && graph) {
    accounts.push(graph);
  }

  if ((provider === 'smtp' || provider === 'auto') && def.host && def.user && def.pass && def.from) {
    accounts.push(def);
  }

  for (const acct of extraAccounts) {
    if ((provider === 'graph' || provider === 'auto') && acct?.provider === 'graph_oauth' && acct?.oauthAccountId && acct?.from) {
      accounts.push(acct);
    } else if ((provider === 'graph' || provider === 'auto') && acct?.provider === 'graph' && acct?.tenantId && acct?.clientId && acct?.clientSecret && acct?.from) {
      accounts.push(acct);
    } else if ((provider === 'smtp' || provider === 'auto') && acct?.host && acct?.user && acct?.pass && acct?.from) {
      accounts.push(acct);
    }
  }

  return accounts;
}

export function buildAccountCatalogFromEnv() {
  const out = [];
  const graph = buildGraphAccount();
  const smtp = buildDefaultAccount();

  if (graph) {
    out.push({
      id: 'graph-default',
      provider: 'graph',
      label: 'Outlook / Microsoft 365 (Graph App)',
      from: graph.from
    });
  }

  if (smtp.host && smtp.user && smtp.pass && smtp.from) {
    const isGmail = String(smtp.host || '').toLowerCase().includes('gmail');
    out.push({
      id: isGmail ? 'gmail-default' : 'smtp-default',
      provider: isGmail ? 'gmail' : 'smtp',
      label: isGmail ? 'Gmail SMTP' : 'Custom SMTP',
      from: smtp.from
    });
  }

  return out;
}

function getLeadValue(lead, key) {
  if (lead?.[key] !== undefined && lead?.[key] !== null) {
    return lead[key];
  }
  if (lead?.data?.[key] !== undefined && lead?.data?.[key] !== null) {
    return lead.data[key];
  }
  return '';
}

function getFirstNonEmptyLeadValue(lead, keys = []) {
  for (const key of keys) {
    const value = getLeadValue(lead, key);
    if (String(value || '').trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function getLeadNameParts(lead) {
  const baseName = getFirstNonEmptyLeadValue(lead, [
    'Name',
    'name',
    'Full Name',
    'full name',
    'FullName',
    'fullName',
    'full_name',
    'fullname'
  ]);
  const surname = getFirstNonEmptyLeadValue(lead, [
    'Surname',
    'surname',
    'Last Name',
    'last name',
    'LastName',
    'lastName',
    'last_name',
    'lastname'
  ]);
  const fullName = [baseName, surname].filter(Boolean).join(' ').trim() || baseName;
  const explicitFirstName = getFirstNonEmptyLeadValue(lead, [
    'FirstName',
    'First Name',
    'first name',
    'firstName',
    'first_name',
    'firstname'
  ]);
  const firstName = explicitFirstName || String(fullName || '').split(/\s+/).filter(Boolean)[0] || '';
  return { fullName, firstName };
}

function renderTemplate(template, lead) {
  const { fullName, firstName } = getLeadNameParts(lead);
  const buildReplacer = ({ useFirstNameForName = false } = {}) => (_, key) => {
    const normalizedKey = String(key || '').toLowerCase();
    if (normalizedKey === 'name') {
      return (useFirstNameForName ? firstName || fullName : fullName || firstName || '').toString();
    }
    if (normalizedKey === 'firstname' || normalizedKey === 'first_name') {
      return (firstName || fullName || '').toString();
    }
    if (normalizedKey === 'fullname' || normalizedKey === 'full_name') {
      return (fullName || firstName || '').toString();
    }
    return getLeadValue(lead, key).toString();
  };
  const customSubject = String(lead?.data?.title || '').trim();
  const subjectTemplate = customSubject || (template.subject || '');
  const subject = subjectTemplate.replace(/{{\s*([\w.]+)\s*}}/g, buildReplacer());
  const body = (template.body || '').replace(/{{\s*([\w.]+)\s*}}/g, buildReplacer({ useFirstNameForName: true }));
  return { subject, body };
}

function normalizeRecipient(raw) {
  let value = String(raw || '').trim();

  // Markdown mailto format: [user@example.com](mailto:user@example.com)
  const mdMailto = value.match(/\]\(mailto:([^)]+)\)/i);
  if (mdMailto?.[1]) {
    value = mdMailto[1].trim();
  }

  // Plain mailto format: mailto:user@example.com
  value = value.replace(/^mailto:/i, '').trim();

  // Remove wrappers such as <...>, [...], (...), quotes.
  value = value.replace(/^[<[\("'`\s]+/, '').replace(/[>\])"'`\s]+$/, '');

  // If multiple values are provided, pick first.
  if (value.includes(',')) {
    value = value.split(',')[0].trim();
  }
  if (value.includes(';')) {
    value = value.split(';')[0].trim();
  }

  return value.replace(/[\r\n]/g, '').trim();
}

function isValidEmailAddress(value = '') {
  return SIMPLE_EMAIL_PATTERN.test(String(value || '').trim());
}

function sanitizeSubject(value = '') {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SUBJECT_LENGTH);
}

const tokenCache = global.graphTokenCache || { token: null, expiresAt: 0 };
global.graphTokenCache = tokenCache;

async function getGraphAccessToken(account) {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${account.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.set('client_id', account.clientId);
  params.set('client_secret', account.clientSecret);
  params.set('grant_type', 'client_credentials');
  params.set('scope', 'https://graph.microsoft.com/.default');

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to get Graph access token');
  }

  tokenCache.token = data.access_token;
  tokenCache.expiresAt = Date.now() + (Number(data.expires_in || 3600) * 1000);
  return tokenCache.token;
}

export async function getDelegatedAccessToken(oauthAccountId) {
  const clientId = process.env.MS_CLIENT_ID || process.env.MS_OAUTH_CLIENT_ID || process.env.CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET || process.env.MS_OAUTH_CLIENT_SECRET || process.env.CLIENT_SECRET;
  const tenant = process.env.MS_TENANT_ID || process.env.MS_OAUTH_TENANT || process.env.TENANT_ID || 'common';

  if (!clientId || !clientSecret) {
    throw new Error('MS_CLIENT_ID/MS_CLIENT_SECRET (or MS_OAUTH_CLIENT_ID/MS_OAUTH_CLIENT_SECRET or CLIENT_ID/CLIENT_SECRET) are not set');
  }

  await connectDB();
  const doc = await GraphOAuthAccount.findById(oauthAccountId);
  if (!doc) {
    throw new Error('OAuth account not found');
  }

  const now = Date.now();
  const expiresAtMs = new Date(doc.expiresAt).getTime();
  if (doc.accessTokenEnc && expiresAtMs > now + 60_000) {
    return decryptString(doc.accessTokenEnc);
  }

  const refreshToken = decryptString(doc.refreshTokenEnc);
  const scope = (doc.scopes && doc.scopes.length)
    ? doc.scopes.join(' ')
    : ['offline_access', 'User.Read', 'Mail.Send', 'Mail.Read', 'Mail.ReadWrite'].join(' ');

  const tokenUrl = `https://login.microsoftonline.com/${doc.tenantId || tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', refreshToken);
  params.set('scope', scope);

  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to refresh Graph token');
  }

  doc.accessTokenEnc = encryptString(data.access_token);
  if (data.refresh_token) {
    doc.refreshTokenEnc = encryptString(data.refresh_token);
  }
  doc.expiresAt = new Date(Date.now() + (Number(data.expires_in || 3600) * 1000));
  if (data.scope) {
    doc.scopes = String(data.scope).split(' ').filter(Boolean);
  }
  doc.lastConnectedAt = new Date();
  await doc.save();

  return data.access_token;
}

function buildGraphPayload({ to, subject, body }) {
  return {
    message: {
      subject,
      body: { contentType: 'HTML', content: body },
      toRecipients: [{ emailAddress: { address: to } }]
    },
    saveToSentItems: true
  };
}

async function sendViaGraphApp({ account, to, subject, body }) {
  const token = await getGraphAccessToken(account);
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(account.from)}/sendMail`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildGraphPayload({ to, subject, body }))
  });

  if (!resp.ok) {
    let errMsg = `Graph send failed (${resp.status})`;
    try {
      const data = await resp.json();
      const code = data?.error?.code ? `[${data.error.code}] ` : '';
      const msg = data?.error?.message || '';
      const reqId = data?.error?.innerError?.['request-id'] || data?.error?.innerError?.requestId || '';
      const reqPart = reqId ? ` (request-id: ${reqId})` : '';
      errMsg = `${code}${msg}${reqPart}`.trim() || errMsg;
    } catch (error) {
      // Ignore parse errors.
    }
    throw new Error(errMsg);
  }
}

async function sendViaGraphDelegated({ account, to, subject, body }) {
  const token = await getDelegatedAccessToken(account.oauthAccountId);
  const url = 'https://graph.microsoft.com/v1.0/me/sendMail';

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildGraphPayload({ to, subject, body }))
  });

  if (!resp.ok) {
    let errMsg = `Graph send failed (${resp.status})`;
    try {
      const data = await resp.json();
      const code = data?.error?.code ? `[${data.error.code}] ` : '';
      const msg = data?.error?.message || '';
      const reqId = data?.error?.innerError?.['request-id'] || data?.error?.innerError?.requestId || '';
      const reqPart = reqId ? ` (request-id: ${reqId})` : '';
      errMsg = `${code}${msg}${reqPart}`.trim() || errMsg;
    } catch (error) {
      // Ignore parse errors.
    }
    throw new Error(errMsg);
  }
}

export async function verifyAccountConnection(account) {
  if (!account?.provider) {
    throw new Error('Account provider is required');
  }

  if (account.provider === 'graph') {
    await getGraphAccessToken(account);
    return { ok: true, message: 'Graph (app) account connected' };
  }

  if (account.provider === 'graph_oauth') {
    const token = await getDelegatedAccessToken(account.oauthAccountId);
    const resp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      const msg = data?.error?.message || 'Graph OAuth account verification failed';
      throw new Error(msg);
    }
    return { ok: true, message: 'Graph OAuth account connected' };
  }

  if (!account.host || !account.user || !account.pass) {
    throw new Error('SMTP host/user/pass are required');
  }

  const transport = nodemailer.createTransport({
    host: account.host,
    port: Number(account.port || 587),
    secure: Boolean(account.secure),
    auth: { user: account.user, pass: account.pass }
  });
  await transport.verify();
  return { ok: true, message: 'SMTP account connected' };
}

function splitRecipients(value) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => splitRecipients(item));
  }
  return String(value || '')
    .split(/[;,]/)
    .map((entry) => normalizeRecipient(entry))
    .filter((entry) => entry && isValidEmailAddress(entry));
}

function dedupeRecipients(values = []) {
  return [...new Set(values.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean))];
}

function normalizeSubjectForReply(subject = '') {
  const trimmed = sanitizeSubject(subject);
  if (!trimmed) return 'Re:';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`.slice(0, MAX_SUBJECT_LENGTH);
}

async function sendViaSmtpThreaded({ account, to, cc = [], subject, body, inReplyTo, references = [] }) {
  const transport = nodemailer.createTransport({
    host: account.host,
    port: account.port,
    secure: account.secure,
    auth: {
      user: account.user,
      pass: account.pass
    }
  });

  const info = await transport.sendMail({
    from: account.from,
    to,
    cc: cc.length ? cc : undefined,
    subject,
    html: body,
    inReplyTo: inReplyTo || undefined,
    references: references.length ? references : undefined
  });

  return { messageId: String(info?.messageId || '').trim() };
}

export async function sendEmailForLead({ template, lead, account, campaignType = '', replyMode = false, replyContext = null }) {
  const { subject, body } = renderTemplate(template, lead);
  const to = normalizeRecipient(lead.Email || lead.email);

  if (!to || !isValidEmailAddress(to)) {
    throw new Error('Lead has no email address');
  }

  const normalizedType = String(campaignType || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const supportsReply = replyMode && ['reminder', 'follow_up', 'updated_cost', 'final_cost'].includes(normalizedType);
  const previousMessageId = String(replyContext?.messageId || '').trim();
  const isReply = supportsReply && Boolean(previousMessageId);

  const previousTo = splitRecipients(replyContext?.to);
  const previousCc = splitRecipients(replyContext?.cc);
  const toRecipients = dedupeRecipients([to, ...previousTo]);
  const ccRecipients = dedupeRecipients(previousCc.filter((entry) => !toRecipients.includes(entry)));
  const finalSubject = isReply
    ? normalizeSubjectForReply(replyContext?.subject || subject)
    : sanitizeSubject(subject);

  if (!finalSubject) {
    throw new Error('Email subject is required');
  }

  let sentMessageId = '';

  if (account.provider === 'graph_oauth') {
    await sendViaGraphDelegated({ account, to, subject: finalSubject, body });
  } else if (account.provider === 'graph') {
    await sendViaGraphApp({ account, to, subject: finalSubject, body });
  } else {
    const result = await sendViaSmtpThreaded({
      account,
      to: toRecipients.join(', '),
      cc: ccRecipients,
      subject: finalSubject,
      body,
      inReplyTo: isReply ? previousMessageId : undefined,
      references: isReply ? [previousMessageId] : []
    });
    sentMessageId = result?.messageId || '';
  }

  const references = dedupeRecipients([previousMessageId, ...(Array.isArray(replyContext?.references) ? replyContext.references : [])]);

  return {
    to,
    subject: finalSubject,
    messageId: sentMessageId,
    isReply,
    thread: {
      messageId: sentMessageId || previousMessageId || '',
      subject: finalSubject,
      recipientEmail: to,
      to: toRecipients,
      cc: ccRecipients,
      references,
      lastCampaignType: normalizedType,
      updatedAt: new Date()
    }
  };
}
