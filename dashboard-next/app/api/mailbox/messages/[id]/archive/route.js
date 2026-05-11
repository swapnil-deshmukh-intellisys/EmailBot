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
    const account = await getCurrentUserMailboxAccount(auth);
    await graphRequest(account, `/me/messages/${encodeURIComponent(String(params.id))}/move`, {
      method: 'POST',
      body: JSON.stringify({ destinationId: 'archive' })
    });
    return NextResponse.json({ success: true, message: 'Email archived' });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to archive email');
    return NextResponse.json({ success: false, code: normalized.code, message: normalized.message, error: normalized.message }, { status: normalized.status });
  }
}
