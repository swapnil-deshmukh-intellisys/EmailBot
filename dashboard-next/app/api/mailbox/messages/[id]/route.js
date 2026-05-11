import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import {
  getCurrentUserMailboxAccount,
  graphRequest,
  normalizeGraphError,
  normalizeMessageDetail
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const messageId = String(params?.id || '').trim();
    if (!messageId) {
      return NextResponse.json({ success: false, message: 'Message id is required', error: 'Message id is required' }, { status: 400 });
    }

    const account = await getCurrentUserMailboxAccount(auth);
    const data = await graphRequest(
      account,
      `/me/messages/${encodeURIComponent(messageId)}?$expand=attachments&$select=id,subject,from,sender,toRecipients,ccRecipients,receivedDateTime,sentDateTime,createdDateTime,lastModifiedDateTime,bodyPreview,parentFolderId,hasAttachments,importance,isRead,isDraft,flag,webLink,conversationId,internetMessageId,body`
    );

    return NextResponse.json({
      success: true,
      message: normalizeMessageDetail(data)
    });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to fetch email details');
    const message = normalized.code === 'GRAPH_RESOURCE_NOT_FOUND' ? 'Email not found' : normalized.message;
    return NextResponse.json(
      { success: false, code: normalized.code, message, error: message },
      { status: normalized.status }
    );
  }
}
