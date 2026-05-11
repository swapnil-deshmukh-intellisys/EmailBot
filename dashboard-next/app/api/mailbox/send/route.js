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
    const toRecipients = buildRecipients(body.to);
    if (!toRecipients.length) {
      return NextResponse.json({ success: false, message: 'At least one recipient is required', error: 'At least one recipient is required' }, { status: 400 });
    }
    const account = await getCurrentUserMailboxAccount(auth);
    await graphRequest(account, '/me/sendMail', {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: String(body.subject || ''),
          body: { contentType: 'HTML', content: String(body.body || '') },
          toRecipients,
          ccRecipients: buildRecipients(body.cc)
        },
        saveToSentItems: true
      })
    });
    return NextResponse.json({ success: true, message: 'Email sent' });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to send email');
    return NextResponse.json({ success: false, code: normalized.code, message: normalized.message, error: normalized.message }, { status: normalized.status });
  }
}
