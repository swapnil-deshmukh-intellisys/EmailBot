import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import { requireUser } from '@/lib/apiAuth';
import { getDelegatedAccessToken } from '@/lib/emailSender';
import { getWarmupAutoReplySetting, processWarmupAutoReplies } from '@/lib/warmupAutoReply';

const FOLDERS = [
  { id: 'inbox', label: 'Received' },
  { id: 'sentitems', label: 'Sending' },
  { id: 'drafts', label: 'Draft' },
  { id: 'junkemail', label: 'Junk' },
  { id: 'deleteditems', label: 'Deleted' }
];

async function fetchFolderMessages(token, folderId) {
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?$top=15&$select=id,subject,from,toRecipients,receivedDateTime,lastModifiedDateTime,isDraft,parentFolderId,bodyPreview,conversationId,internetMessageId`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: 'no-store'
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Failed to fetch ${folderId} messages`);
  }

  return Array.isArray(data?.value) ? data.value : [];
}

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;

    await connectDB();
    const account = await GraphOAuthAccount.findOne({ userEmail }).sort({ updatedAt: -1 }).lean();
    const warmupSetting = await getWarmupAutoReplySetting(userEmail, { lean: true });

    if (!account?._id) {
      return NextResponse.json({
        connected: false,
        folders: [],
        messages: [],
        warmupAutoReply: warmupSetting || null,
        error: 'Connect a Microsoft account with mailbox permission to see received, sent, junk, spam, draft, and deleted mail.'
      });
    }

    const warmupRun = await processWarmupAutoReplies(userEmail).catch(() => null);
    const token = await getDelegatedAccessToken(String(account._id));

    const folderResults = await Promise.all(
      FOLDERS.map(async (folder) => {
        const messages = await fetchFolderMessages(token, folder.id);
        return {
          ...folder,
          count: messages.length,
          messages
        };
      })
    );

    const messages = folderResults.flatMap((folder) =>
      folder.messages.map((message) => ({
        id: `${folder.id}-${message.id}`,
        folderId: folder.id,
        folderLabel: folder.label,
        subject: message.subject || '(No subject)',
        from: message.from?.emailAddress?.address || '',
        to: Array.isArray(message.toRecipients)
          ? message.toRecipients.map((entry) => entry?.emailAddress?.address).filter(Boolean)
          : [],
        receivedAt: message.receivedDateTime || null,
        updatedAt: message.lastModifiedDateTime || null,
        isDraft: Boolean(message.isDraft),
        bodyPreview: message.bodyPreview || '',
        conversationId: message.conversationId || '',
        internetMessageId: message.internetMessageId || ''
      }))
    );

    return NextResponse.json({
      connected: true,
      account: {
        email: account.email,
        displayName: account.displayName || account.email
      },
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
