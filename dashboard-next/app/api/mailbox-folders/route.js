import { NextResponse } from 'next/server';
import { requireAuth } from '@/core-lib/auth-config/ApiAuthGuard';
import { getWarmupAutoReplySetting, processWarmupAutoReplies } from '@/lib/warmupAutoReply';
import {
  getCurrentUserMailboxAccount,
  graphRequest,
  normalizeFolder,
  normalizeMessage,
  serializeMailboxAccount
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

const DEFAULT_FOLDER_ORDER = ['inbox', 'sentitems', 'drafts', 'deleteditems', 'junkemail', 'archive'];

function toLegacyFolder(folder = {}) {
  return {
    id: folder.id,
    graphId: folder.id,
    label: folder.displayName || folder.wellKnownName || 'Folder',
    displayName: folder.displayName || folder.wellKnownName || 'Folder',
    wellKnownName: folder.wellKnownName || '',
    count: Number(folder.totalItemCount || 0),
    unreadItemCount: Number(folder.unreadItemCount || 0),
    totalItemCount: Number(folder.totalItemCount || 0),
    childFolderCount: Number(folder.childFolderCount || 0)
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const warmupSetting = await getWarmupAutoReplySetting(auth.userEmail, { lean: true });
    const account = await getCurrentUserMailboxAccount(auth).catch((error) => {
      if (error?.code === 'MAILBOX_NOT_CONNECTED') return null;
      throw error;
    });

    if (!account) {
      return NextResponse.json({
        connected: false,
        folders: [],
        messages: [],
        warmupAutoReply: warmupSetting || null,
        error: 'Mailbox not connected'
      });
    }

    const warmupRun = await processWarmupAutoReplies(auth.userEmail).catch(() => null);
    const folderData = await graphRequest(
      account,
      '/me/mailFolders?$top=100&$select=id,displayName,wellKnownName,totalItemCount,unreadItemCount,childFolderCount'
    );
    const graphFolders = (Array.isArray(folderData?.value) ? folderData.value : [])
      .map(normalizeFolder)
      .sort((a, b) => {
        const aIndex = DEFAULT_FOLDER_ORDER.indexOf(String(a.wellKnownName || '').toLowerCase());
        const bIndex = DEFAULT_FOLDER_ORDER.indexOf(String(b.wellKnownName || '').toLowerCase());
        if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        return String(a.displayName || '').localeCompare(String(b.displayName || ''));
      });

    const folderResults = await Promise.all(graphFolders.map(async (folder) => {
      try {
        const messageData = await graphRequest(
          account,
          `/me/mailFolders/${encodeURIComponent(folder.id)}/messages?$top=15&$orderby=receivedDateTime desc&$select=id,subject,from,sender,toRecipients,receivedDateTime,sentDateTime,lastModifiedDateTime,createdDateTime,isDraft,isRead,bodyPreview,conversationId,internetMessageId,importance,hasAttachments,flag`
        );
        const messages = (Array.isArray(messageData?.value) ? messageData.value : []).map(normalizeMessage);
        return { ...toLegacyFolder(folder), count: Math.max(Number(folder.totalItemCount || 0), messages.length), messages };
      } catch {
        return { ...toLegacyFolder(folder), messages: [] };
      }
    }));

    const messages = folderResults.flatMap((folder) =>
      folder.messages.map((message) => ({
        id: message.id,
        folderId: folder.graphId || folder.id,
        folderLabel: folder.label || folder.displayName,
        subject: message.subject || '(No subject)',
        from: message.from?.email || message.sender?.email || '',
        to: Array.isArray(message.to) ? message.to.map((entry) => entry?.email || entry?.address).filter(Boolean) : [],
        receivedAt: message.receivedDateTime || message.sentDateTime || null,
        updatedAt: message.lastModifiedDateTime || message.createdDateTime || null,
        isDraft: Boolean(message.isDraft),
        isRead: Boolean(message.isRead),
        bodyPreview: message.preview || '',
        conversationId: message.conversationId || '',
        internetMessageId: message.internetMessageId || '',
        hasAttachments: Boolean(message.hasAttachments),
        importance: message.importance || 'normal',
        flag: message.flag || null
      }))
    );

    return NextResponse.json({
      connected: true,
      account: serializeMailboxAccount(account),
      warmupAutoReply: warmupSetting || null,
      warmupRun,
      folders: folderResults.map(({ messages: folderMessages, ...folder }) => folder),
      messages
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        folders: [],
        messages: [],
        error: error.message || 'Failed to load mailbox folders'
      },
      { status: 500 }
    );
  }
}
