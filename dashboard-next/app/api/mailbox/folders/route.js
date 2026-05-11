import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import {
  buildGraphQuery,
  getCurrentUserMailboxAccount,
  graphRequest,
  normalizeFolder,
  normalizeGraphError,
  serializeMailboxAccount
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

async function fetchFolderChildren(account, folderId, depth = 0) {
  if (!folderId || depth > 3) return [];
  const query = buildGraphQuery({
    $top: 100,
    $select: 'id,displayName,wellKnownName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount'
  });
  const data = await graphRequest(account, `/me/mailFolders/${encodeURIComponent(folderId)}/childFolders${query}`);
  const childFolders = Array.isArray(data?.value) ? data.value : [];
  const normalized = [];

  for (const child of childFolders) {
    const folder = normalizeFolder(child);
    normalized.push(folder);
    if (folder.childFolderCount > 0) {
      normalized.push(...await fetchFolderChildren(account, folder.id, depth + 1));
    }
  }

  return normalized;
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const account = await getCurrentUserMailboxAccount(auth);
    const query = buildGraphQuery({
      $top: 100,
      $select: 'id,displayName,wellKnownName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount'
    });
    const data = await graphRequest(account, `/me/mailFolders${query}`);
    const topFolders = Array.isArray(data?.value) ? data.value.map(normalizeFolder) : [];
    const allFolders = [];

    for (const folder of topFolders) {
      allFolders.push(folder);
      if (folder.childFolderCount > 0) {
        allFolders.push(...await fetchFolderChildren(account, folder.id));
      }
    }

    account.lastSync = new Date();
    account.status = 'Connected';
    await account.save();

    return NextResponse.json({
      success: true,
      connected: true,
      account: serializeMailboxAccount(account),
      folders: allFolders
    });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to fetch mailbox folders');
    return NextResponse.json(
      {
        success: false,
        connected: normalized.code !== 'MAILBOX_NOT_CONNECTED',
        folders: [],
        code: normalized.code,
        message: normalized.message,
        error: normalized.message
      },
      { status: normalized.status }
    );
  }
}
