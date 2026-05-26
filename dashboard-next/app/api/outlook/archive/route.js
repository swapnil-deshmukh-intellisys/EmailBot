import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { getCurrentUserMailboxAccount, graphRequest, normalizeGraphError } from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const body = await req.json().catch(() => ({}));
    const messageId = String(body.messageId || body.id || '').trim();
    if (!messageId) return NextResponse.json({ success: false, error: 'Message id is required', message: 'Message id is required' }, { status: 400 });
    const account = await getCurrentUserMailboxAccount(auth);
    await graphRequest(account, `/me/messages/${encodeURIComponent(messageId)}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationId: 'archive' })
    });
    return NextResponse.json({ success: true, message: 'Email archived' });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to archive email');
    return NextResponse.json({ success: false, code: normalized.code, message: normalized.message, error: normalized.message }, { status: normalized.status });
  }
}
