import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import {
  getCurrentUserMailboxAccount,
  normalizeGraphError,
  serializeMailboxAccount
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const account = await getCurrentUserMailboxAccount(auth);
    return NextResponse.json({
      success: true,
      connected: true,
      account: serializeMailboxAccount(account)
    });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Mailbox not connected');
    if (normalized.code === 'MAILBOX_NOT_CONNECTED') {
      return NextResponse.json({
        success: true,
        connected: false,
        account: null,
        message: 'Mailbox not connected'
      });
    }
    return NextResponse.json(
      {
        success: false,
        connected: false,
        account: null,
        code: normalized.code,
        message: normalized.message,
        error: normalized.message
      },
      { status: normalized.status }
    );
  }
}
