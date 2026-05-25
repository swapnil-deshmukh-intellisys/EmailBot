import connectDB from '../database-config/MongoDatabaseConnection.js';
import GraphOAuthAccount from '../../database-models/GraphOAuthAccount.js';
import { getDelegatedAccessToken } from './GraphAndSmtpMailSender.js';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function jsonHeaderValue(value = '') {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

export function getMailboxUserEmail(auth = {}) {
  return normalizeEmail(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '');
}

export async function getCurrentUserMailboxAccount(auth = {}) {
  const userEmail = getMailboxUserEmail(auth);
  if (!userEmail) {
    const error = new Error('User not found');
    error.code = 'USER_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  await connectDB();
  const account = await GraphOAuthAccount.findOne({ userEmail }).sort({ updatedAt: -1 });
  if (!account?._id) {
    const error = new Error('Mailbox not connected');
    error.code = 'MAILBOX_NOT_CONNECTED';
    error.status = 404;
    throw error;
  }

  return account;
}

export function serializeMailboxAccount(account) {
  if (!account) return null;
  return {
    id: String(account._id),
    email: account.email,
    displayName: account.displayName || account.email,
    provider: 'microsoft',
    status: account.status || 'Connected',
    scopes: Array.isArray(account.scopes) ? account.scopes : [],
    expiresAt: account.expiresAt || null,
    lastConnectedAt: account.lastConnectedAt || null,
    lastSync: account.lastSync || null
  };
}

export async function getMailboxAccessToken(account) {
  try {
    return await getDelegatedAccessToken(String(account._id));
  } catch (error) {
    const wrapped = new Error('Microsoft session expired, please reconnect Outlook');
    wrapped.code = 'MICROSOFT_SESSION_EXPIRED';
    wrapped.status = 401;
    wrapped.cause = error;
    throw wrapped;
  }
}

export function normalizeGraphError(error, fallback = 'Microsoft Graph request failed') {
  const status = Number(error?.status || error?.cause?.status || 500);
  const code = error?.code || error?.cause?.code || 'GRAPH_REQUEST_FAILED';
  return {
    status,
    code,
    message: error?.message || fallback
  };
}

export async function graphRequest(account, path, options = {}) {
  const token = await getMailboxAccessToken(account);
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
    const graphCode = data?.error?.code || '';
    const graphMessage = data?.error?.message || '';
    const error = new Error(graphMessage || `Microsoft Graph request failed (${response.status})`);
    error.status = response.status;
    error.code =
      response.status === 401 ? 'MICROSOFT_SESSION_EXPIRED'
        : response.status === 403 ? 'MAILBOX_PERMISSION_DENIED'
          : response.status === 404 ? 'GRAPH_RESOURCE_NOT_FOUND'
            : response.status === 429 ? 'GRAPH_RATE_LIMITED'
              : graphCode || 'GRAPH_REQUEST_FAILED';
    throw error;
  }

  return data;
}

export function buildGraphQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function normalizeFolder(folder = {}) {
  return {
    id: String(folder.id || ''),
    displayName: folder.displayName || folder.wellKnownName || 'Folder',
    wellKnownName: folder.wellKnownName || '',
    parentFolderId: folder.parentFolderId || '',
    childFolderCount: Number(folder.childFolderCount || 0),
    totalItemCount: Number(folder.totalItemCount || 0),
    unreadItemCount: Number(folder.unreadItemCount || 0)
  };
}

function normalizeFolderKey(folder = {}) {
  return String(folder.wellKnownName || folder.displayName || folder.label || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function summarizeMailboxFolders(folders = []) {
  const counts = {
    total: 0,
    unread: 0,
    read: 0,
    open: 0,
    inbox: 0,
    sent: 0,
    drafts: 0,
    deleted: 0,
    archive: 0,
    junk: 0,
    spam: 0
  };

  folders.forEach((folder) => {
    const total = Number(folder.totalItemCount ?? folder.count ?? 0) || 0;
    const unread = Number(folder.unreadItemCount ?? 0) || 0;
    const read = Math.max(0, total - unread);
    const key = normalizeFolderKey(folder);

    counts.total += total;
    counts.unread += unread;
    counts.read += read;
    counts.open += read;

    if (key === 'inbox') counts.inbox += total;
    if (key === 'sentitems' || key === 'sent') counts.sent += total;
    if (key === 'drafts' || key === 'draft') counts.drafts += total;
    if (key === 'deleteditems' || key === 'deleted' || key === 'trash') counts.deleted += total;
    if (key === 'archive') counts.archive += total;
    if (key === 'junkemail' || key === 'junk' || key.includes('junk')) counts.junk += total;
    if (key === 'spam' || key.includes('spam')) counts.spam += total;
  });

  if (!counts.spam) counts.spam = counts.junk;
  return counts;
}

export function normalizeMessage(message = {}, folder = null) {
  const from = message.from?.emailAddress || {};
  const sender = message.sender?.emailAddress || {};
  return {
    id: String(message.id || ''),
    folderId: folder?.id || message.parentFolderId || '',
    folderName: folder?.displayName || '',
    subject: message.subject || '(No subject)',
    preview: message.bodyPreview || '',
    from: {
      name: from.name || sender.name || '',
      email: from.address || sender.address || ''
    },
    sender: {
      name: sender.name || from.name || '',
      email: sender.address || from.address || ''
    },
    to: Array.isArray(message.toRecipients)
      ? message.toRecipients.map((item) => item?.emailAddress).filter(Boolean)
      : [],
    cc: Array.isArray(message.ccRecipients)
      ? message.ccRecipients.map((item) => item?.emailAddress).filter(Boolean)
      : [],
    receivedDateTime: message.receivedDateTime || null,
    sentDateTime: message.sentDateTime || null,
    createdDateTime: message.createdDateTime || null,
    lastModifiedDateTime: message.lastModifiedDateTime || null,
    hasAttachments: Boolean(message.hasAttachments),
    importance: message.importance || 'normal',
    isRead: Boolean(message.isRead),
    isDraft: Boolean(message.isDraft),
    flag: message.flag || null,
    webLink: message.webLink || '',
    conversationId: message.conversationId || '',
    internetMessageId: message.internetMessageId || ''
  };
}

export function normalizeMessageDetail(message = {}) {
  return {
    ...normalizeMessage(message),
    body: {
      contentType: message.body?.contentType || 'html',
      content: message.body?.content || ''
    },
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map((item) => ({
          id: item.id,
          name: item.name,
          contentType: item.contentType,
          size: item.size,
          isInline: Boolean(item.isInline)
        }))
      : []
  };
}

export function buildRecipients(value = '') {
  return String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((address) => ({ emailAddress: { address: jsonHeaderValue(address) } }));
}
