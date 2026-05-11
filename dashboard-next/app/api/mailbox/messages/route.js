import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import {
  buildGraphQuery,
  getCurrentUserMailboxAccount,
  graphRequest,
  normalizeGraphError,
  normalizeMessage
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

const MESSAGE_SELECT = [
  'id',
  'subject',
  'from',
  'sender',
  'toRecipients',
  'ccRecipients',
  'receivedDateTime',
  'sentDateTime',
  'createdDateTime',
  'lastModifiedDateTime',
  'bodyPreview',
  'parentFolderId',
  'hasAttachments',
  'importance',
  'isRead',
  'isDraft',
  'flag',
  'webLink',
  'conversationId',
  'internetMessageId'
].join(',');

function normalizeFolderId(value = '') {
  const folder = String(value || 'inbox').trim();
  return folder || 'inbox';
}

function buildMessagePath(url) {
  const folder = normalizeFolderId(url.searchParams.get('folder') || 'inbox');
  const top = Math.min(50, Math.max(1, Number(url.searchParams.get('top') || 25) || 25));
  const skip = Math.max(0, Number(url.searchParams.get('skip') || 0) || 0);
  const unread = String(url.searchParams.get('unread') || '').toLowerCase() === 'true';
  const flagged = String(url.searchParams.get('flagged') || '').toLowerCase() === 'true';
  const search = String(url.searchParams.get('search') || '').trim();
  const filters = [];

  if (unread) filters.push('isRead eq false');
  if (flagged) filters.push("flag/flagStatus eq 'flagged'");

  const queryParams = {
    $top: top,
    $skip: skip,
    $select: MESSAGE_SELECT,
    $orderby: 'receivedDateTime desc'
  };
  if (filters.length) queryParams.$filter = filters.join(' and ');
  if (search) queryParams.$search = `"${search.replace(/"/g, '\\"')}"`;

  const query = buildGraphQuery(queryParams);
  return {
    folder,
    path: `/me/mailFolders/${encodeURIComponent(folder)}/messages${query}`,
    search
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const account = await getCurrentUserMailboxAccount(auth);
    const url = new URL(req.url);
    const { folder, path, search } = buildMessagePath(url);
    const data = await graphRequest(account, path, search ? { headers: { ConsistencyLevel: 'eventual' } } : {});
    const messages = Array.isArray(data?.value)
      ? data.value.map((message) => normalizeMessage(message, { id: folder }))
      : [];

    return NextResponse.json({
      success: true,
      folderId: folder,
      messages,
      nextLink: data?.['@odata.nextLink'] || ''
    });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to fetch inbox messages');
    const message = normalized.code === 'GRAPH_RESOURCE_NOT_FOUND' ? 'Folder not found' : normalized.message;
    return NextResponse.json(
      {
        success: false,
        messages: [],
        code: normalized.code,
        message,
        error: message
      },
      { status: normalized.status }
    );
  }
}
