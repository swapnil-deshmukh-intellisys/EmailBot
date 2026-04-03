import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import { requireUser } from '@/lib/apiAuth';
import { getDelegatedAccessToken } from '@/lib/emailSender';

const FOLDERS = [
  { id: 'inbox', label: 'Received' },
  { id: 'sentitems', label: 'Sending' },
  { id: 'drafts', label: 'Draft' },
  { id: 'junkemail', label: 'Junk' },
  { id: 'deleteditems', label: 'Deleted' }
];

async function fetchFolderMessages(token, folderId) {
  const url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages?$top=15&$select=id,subject,from,toRecipients,receivedDateTime,lastModifiedDateTime,isDraft,parentFolderId`;
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

    if (!account?._id) {
      return NextResponse.json({
        connected: false,
        folders: [],
        messages: [],
        error: 'Connect a Microsoft account with mailbox permission to see received, sent, junk, spam, draft, and deleted mail.'
      });
    }

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
        isDraft: Boolean(message.isDraft)
      }))
    );

    return NextResponse.json({
      connected: true,
      account: {
        email: account.email,
        displayName: account.displayName || account.email
      },
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
