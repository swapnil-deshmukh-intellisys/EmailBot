import nodemailer from 'nodemailer';
import connectDB from '../database-config/MongoDatabaseConnection.js';
import GraphOAuthAccount from '../../database-models/GraphOAuthAccount.js';
import { decryptString, encryptString } from '../auth-config/TokenCryptoService.js';
import { DELEGATED_MAILBOX_SCOPE, isGraphAppOnlyEnabled } from './MicrosoftGraphOAuthScopes.js';
import { htmlToText } from 'html-to-text';
import { buildEmailParts } from '../../components/email/EmailRenderingSystem.js';

const MAX_SUBJECT_LENGTH = 200;
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

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
  if (!isGraphAppOnlyEnabled()) {
    return null;
  }

  const tenantId = process.env.TENANT_ID || process.env.MS_TENANT_ID || process.env.MS_OAUTH_TENANT;
  const clientId = process.env.CLIENT_ID || process.env.MS_CLIENT_ID || process.env.MS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET || process.env.MS_CLIENT_SECRET || process.env.MS_OAUTH_CLIENT_SECRET;
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
  const body = (template.bodyHtml || template.html || template.body || '').replace(/{{\s*([\w.]+)\s*}}/g, buildReplacer({ useFirstNameForName: true }));
  const plainText = (template.bodyText || '').replace(/{{\s*([\w.]+)\s*}}/g, buildReplacer({ useFirstNameForName: true }));
  return { subject, body, plainText };
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
  if (value.includes('/')) {
    value = value.split('/')[0].trim();
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

const tokenCache = global.graphTokenCache || new Map();
global.graphTokenCache = tokenCache;

function normalizeTenantId(value, fallback = 'organizations') {
  const tenant = String(value || '').trim();
  if (!tenant || tenant.toLowerCase() === 'undefined' || tenant.toLowerCase() === 'null') {
    return fallback || 'organizations';
  }
  return tenant;
}

function inferProjectFromEmail(email = '') {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail.endsWith('@theunicorntimes.com')) return 'tut';
  if (normalizedEmail.endsWith('@theentrepreneurialchronicle.com')) return 'tec';
  return '';
}

function getDelegatedOAuthConfig(accountDoc = {}) {
  const project = inferProjectFromEmail(accountDoc.email || accountDoc.from || '');
  const projectPrefix = project.toUpperCase();
  const projectTenant = projectPrefix ? process.env[`${projectPrefix}_TENANT_ID`] : '';
  const projectClientId = projectPrefix ? process.env[`${projectPrefix}_CLIENT_ID`] : '';
  const projectClientSecret = projectPrefix ? process.env[`${projectPrefix}_CLIENT_SECRET`] : '';

  return {
    project,
    clientId: process.env.MS_CLIENT_ID || process.env.MS_OAUTH_CLIENT_ID || projectClientId || process.env.CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET || process.env.MS_OAUTH_CLIENT_SECRET || projectClientSecret || process.env.CLIENT_SECRET,
    tenant: process.env.MS_OAUTH_TENANT || process.env.MS_TENANT_ID || projectTenant || process.env.TENANT_ID || 'organizations'
  };
}

function getGraphTokenCacheKey(account = {}) {
  return [
    String(account.tenantId || '').trim().toLowerCase(),
    String(account.clientId || '').trim().toLowerCase(),
    String(account.from || '').trim().toLowerCase()
  ].join('::');
}

export async function getGraphAccessToken(account) {
  if (!isGraphAppOnlyEnabled()) {
    throw new Error('Graph app-only sending is disabled. Connect this mailbox with Microsoft OAuth instead.');
  }

  const now = Date.now();
  const cacheKey = getGraphTokenCacheKey(account);
  const cached = tokenCache.get(cacheKey);
  if (cached?.token && cached.expiresAt > now + 60_000) {
    return cached.token;
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

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000)
  });
  return data.access_token;
}

export async function getDelegatedAccessToken(oauthAccountId) {
  await connectDB();
  const doc = await GraphOAuthAccount.findById(oauthAccountId);
  if (!doc) {
    throw new Error('OAuth account not found');
  }

  const { clientId, clientSecret, tenant, project } = getDelegatedOAuthConfig(doc);
  if (!clientId || !clientSecret) {
    const projectHint = project ? ` or ${project.toUpperCase()}_CLIENT_ID/${project.toUpperCase()}_CLIENT_SECRET` : '';
    throw new Error(`Microsoft OAuth client credentials are not set. Configure MS_CLIENT_ID/MS_CLIENT_SECRET, MS_OAUTH_CLIENT_ID/MS_OAUTH_CLIENT_SECRET, CLIENT_ID/CLIENT_SECRET${projectHint}.`);
  }

  const now = Date.now();
  const expiresAtMs = new Date(doc.expiresAt).getTime();
  if (doc.accessTokenEnc && expiresAtMs > now + 60_000) {
    return decryptString(doc.accessTokenEnc);
  }

  const refreshToken = decryptString(doc.refreshTokenEnc);
  const scope = (doc.scopes && doc.scopes.length)
    ? doc.scopes.join(' ')
    : DELEGATED_MAILBOX_SCOPE;

  const tokenTenant = normalizeTenantId(doc.tenantId, tenant);
  const tokenUrl = `https://login.microsoftonline.com/${tokenTenant}/oauth2/v2.0/token`;
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeGraphSentSubject(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeGraphSentRecipient(value = '') {
  return String(value || '').trim().toLowerCase();
}

async function graphJsonRequest(url, token) {
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!resp.ok) {
    return null;
  }

  return resp.json().catch(() => null);
}

async function resolveRecentGraphSentMessage({ token, userPath, subject, to, sentAfter = new Date() }) {
  const normalizedSubject = normalizeGraphSentSubject(subject);
  const normalizedRecipient = normalizeGraphSentRecipient(to);
  const sentAfterMs = new Date(sentAfter).getTime() - 120000;
  const url = `${GRAPH_BASE_URL}${userPath}/mailFolders/SentItems/messages?$top=15&$orderby=sentDateTime desc&$select=id,subject,internetMessageId,conversationId,sentDateTime,toRecipients`;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const data = await graphJsonRequest(url, token);
    const messages = Array.isArray(data?.value) ? data.value : [];
    const matched = messages.find((message) => {
      const messageSubject = normalizeGraphSentSubject(message?.subject || '');
      const messageSentAtMs = new Date(message?.sentDateTime || 0).getTime();
      const messageRecipients = Array.isArray(message?.toRecipients)
        ? message.toRecipients.map((item) => normalizeGraphSentRecipient(item?.emailAddress?.address || ''))
        : [];
      return (
        messageSubject === normalizedSubject &&
        messageSentAtMs >= sentAfterMs &&
        messageRecipients.includes(normalizedRecipient)
      );
    });

    if (matched) {
      return {
        messageId: String(matched.id || ''),
        internetMessageId: String(matched.internetMessageId || ''),
        conversationId: String(matched.conversationId || '')
      };
    }

    if (attempt < 3) {
      await wait(750 * (attempt + 1));
    }
  }

  return {
    messageId: '',
    internetMessageId: '',
    conversationId: ''
  };
}

async function sendViaGraphApp({ account, to, subject, body }) {
  const token = await getGraphAccessToken(account);
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(account.from)}/sendMail`;
  const sentAfter = new Date();
  console.info('[graph_send_started]', {
    sender: account.from,
    recipient: to,
    subject,
    htmlLength: String(body || '').length
  });

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

  const metadata = await resolveRecentGraphSentMessage({
    token,
    userPath: `/users/${encodeURIComponent(account.from)}`,
    subject,
    to,
    sentAfter
  });

  return {
    ...metadata,
    providerResponse: { status: resp.status, statusText: resp.statusText }
  };
}

async function sendViaGraphDelegated({ account, to, subject, body }) {
  const token = await getDelegatedAccessToken(account.oauthAccountId);
  const url = 'https://graph.microsoft.com/v1.0/me/sendMail';
  const sentAfter = new Date();
  console.info('[graph_send_started]', {
    sender: account.from,
    recipient: to,
    subject,
    htmlLength: String(body || '').length,
    delegated: true
  });

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

  const metadata = await resolveRecentGraphSentMessage({
    token,
    userPath: '/me',
    subject,
    to,
    sentAfter
  });

  return {
    ...metadata,
    providerResponse: { status: resp.status, statusText: resp.statusText }
  };
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

function dedupeHeaderValues(values = []) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function normalizeSubjectForReply(subject = '') {
  const trimmed = sanitizeSubject(subject);
  if (!trimmed) return 'Re:';
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`.slice(0, MAX_SUBJECT_LENGTH);
}

async function sendViaSmtpThreaded({ account, to, cc = [], subject, body, text, inReplyTo, references = [] }) {
  console.info('[smtp_send_started]', {
    sender: account.from || account.user,
    recipient: to,
    ccCount: cc.length,
    subject,
    htmlLength: String(body || '').length,
    textLength: String(text || '').length
  });
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
    text: text || '',
    inReplyTo: inReplyTo || undefined,
    references: references.length ? references : undefined
  });

  return { messageId: String(info?.messageId || '').trim() };
}

export async function sendEmailForLead({ template, lead, account, campaignType = '', replyMode = false, replyContext = null, trackingPixelHtml = '' }) {
  const { subject, body: renderedBody, plainText: renderedPlainText } = renderTemplate(template, lead);
  const emailParts = buildEmailParts({
    html: trackingPixelHtml ? `${renderedBody}\n${trackingPixelHtml}` : renderedBody,
    text: renderedPlainText
  });
  const body = emailParts.bodyHtml;
  const finalPlainText = emailParts.bodyText || htmlToText(body, { wordwrap: 130 });
  const to = normalizeRecipient(lead.Email || lead.email);

  if (!to || !isValidEmailAddress(to)) {
    throw new Error('Lead has no email address');
  }

  const normalizedType = String(campaignType || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const supportsReply = replyMode && ['reminder', 'follow_up', 'updated_cost', 'final_cost'].includes(normalizedType);
  const previousMessageId = String(replyContext?.messageId || '').trim();
  const previousInternetMessageId = String(replyContext?.internetMessageId || '').trim();
  const isReply = supportsReply && Boolean(previousMessageId || previousInternetMessageId);

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
  let sentInternetMessageId = previousInternetMessageId;
  let sentConversationId = String(replyContext?.conversationId || '').trim();
  let providerResponse = null;

  console.info('[email_html_built]', {
    provider: account.provider || 'smtp',
    sender: account.from || account.user || '',
    recipient: to,
    subject: finalSubject,
    htmlLength: body.length,
    textLength: finalPlainText.length
  });

  try {
    if (account.provider === 'graph_oauth') {
      const result = await sendViaGraphDelegated({ account, to, subject: finalSubject, body });
      sentMessageId = result?.messageId || '';
      sentInternetMessageId = result?.internetMessageId || previousInternetMessageId || '';
      sentConversationId = result?.conversationId || sentConversationId || '';
      providerResponse = result?.providerResponse || null;
    } else if (account.provider === 'graph') {
      const result = await sendViaGraphApp({ account, to, subject: finalSubject, body });
      sentMessageId = result?.messageId || '';
      sentInternetMessageId = result?.internetMessageId || previousInternetMessageId || '';
      sentConversationId = result?.conversationId || sentConversationId || '';
      providerResponse = result?.providerResponse || null;
    } else {
      const references = isReply
        ? dedupeHeaderValues([
            ...(Array.isArray(replyContext?.references) ? replyContext.references : []),
            previousInternetMessageId || previousMessageId
          ])
        : [];
      const result = await sendViaSmtpThreaded({
        account,
        to: toRecipients.join(', '),
        cc: ccRecipients,
        subject: finalSubject,
        body,
        text: finalPlainText,
        inReplyTo: isReply ? (previousInternetMessageId || previousMessageId) : undefined,
        references
      });
      sentMessageId = result?.messageId || '';
      sentInternetMessageId = result?.internetMessageId || sentInternetMessageId || '';
      sentConversationId = result?.conversationId || sentConversationId || '';
      providerResponse = result || null;
    }
  } catch (error) {
    console.error('[email_send_failed]', {
      provider: account.provider || 'smtp',
      sender: account.from || account.user || '',
      recipient: to,
      subject: finalSubject,
      htmlLength: body.length,
      textLength: finalPlainText.length,
      error: error.message || String(error)
    });
    throw error;
  }

  console.info('[email_send_success]', {
    provider: account.provider || 'smtp',
    sender: account.from || account.user || '',
    recipient: to,
    subject: finalSubject,
    messageId: sentMessageId,
    internetMessageId: sentInternetMessageId,
    conversationId: sentConversationId,
    providerResponse
  });

  const references = isReply
    ? dedupeHeaderValues([
        ...(Array.isArray(replyContext?.references) ? replyContext.references : []),
        previousInternetMessageId || previousMessageId
      ])
    : [];

  return {
    to,
    subject: finalSubject,
    messageId: sentMessageId,
    internetMessageId: sentInternetMessageId,
    conversationId: sentConversationId,
    bodyHtml: body,
    bodyText: finalPlainText,
    providerResponse,
    isReply,
    thread: {
      messageId: sentMessageId || previousMessageId || '',
      internetMessageId: sentInternetMessageId || previousInternetMessageId || '',
      conversationId: sentConversationId || String(replyContext?.conversationId || '').trim(),
      threadId: sentConversationId || String(replyContext?.conversationId || '').trim(),
      inReplyTo: isReply ? (previousInternetMessageId || previousMessageId) : '',
      originalSubject: sanitizeSubject(replyContext?.originalSubject || replyContext?.subject || subject),
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