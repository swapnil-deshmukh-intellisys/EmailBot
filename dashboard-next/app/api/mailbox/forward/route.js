import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import {
  buildRecipients,
  getCurrentUserMailboxAccount,
  graphRequest,
  normalizeGraphError
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const body = await req.json().catch(() => ({}));
    const messageId = String(body.messageId || '').trim();
    const toRecipients = buildRecipients(body.to);
    if (!messageId || !toRecipients.length) {
      return NextResponse.json({ success: false, message: 'Message id and recipient are required', error: 'Message id and recipient are required' }, { status: 400 });
    }
    const account = await getCurrentUserMailboxAccount(auth);
    await graphRequest(account, `/me/messages/${encodeURIComponent(messageId)}/forward`, {
      method: 'POST',
      body: JSON.stringify({ comment: String(body.comment || ''), toRecipients })
    });
    return NextResponse.json({ success: true, message: 'Email forwarded' });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to forward email');
    return NextResponse.json({ success: false, code: normalized.code, message: normalized.message, error: normalized.message }, { status: normalized.status });
  }
}
