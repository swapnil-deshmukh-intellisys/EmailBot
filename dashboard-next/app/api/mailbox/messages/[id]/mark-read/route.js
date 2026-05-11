import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import {
  getCurrentUserMailboxAccount,
  graphRequest,
  normalizeGraphError
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const body = await req.json().catch(() => ({}));
    const isRead = typeof body?.isRead === 'boolean' ? body.isRead : true;
    const account = await getCurrentUserMailboxAccount(auth);
    await graphRequest(account, `/me/messages/${encodeURIComponent(String(params.id))}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead })
    });
    return NextResponse.json({ success: true, isRead });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to update read state');
    return NextResponse.json({ success: false, code: normalized.code, message: normalized.message, error: normalized.message }, { status: normalized.status });
  }
}
