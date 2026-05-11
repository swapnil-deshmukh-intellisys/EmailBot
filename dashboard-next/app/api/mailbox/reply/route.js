import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import {
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
    if (!messageId) {
      return NextResponse.json({ success: false, message: 'Message id is required', error: 'Message id is required' }, { status: 400 });
    }
    const account = await getCurrentUserMailboxAccount(auth);
    await graphRequest(account, `/me/messages/${encodeURIComponent(messageId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ comment: String(body.comment || '') })
    });
    return NextResponse.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to reply to email');
    return NextResponse.json({ success: false, code: normalized.code, message: normalized.message, error: normalized.message }, { status: normalized.status });
  }
}
