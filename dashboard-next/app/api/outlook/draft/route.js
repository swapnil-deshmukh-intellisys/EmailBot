import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import {
  buildRecipients,
  getCurrentUserMailboxAccount,
  graphRequest,
  normalizeGraphError
} from '@/core-lib/mail-engine/MicrosoftGraphMailboxService';
import MailDraft from '@/models/MailDraft';

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const account = await getCurrentUserMailboxAccount(auth);
    const payload = {
      subject: String(body.subject || ''),
      body: { contentType: 'HTML', content: String(body.body || '') },
      toRecipients: buildRecipients(body.to),
      ccRecipients: buildRecipients(body.cc)
    };
    const message = await graphRequest(account, '/me/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await MailDraft.create({
      userId: auth.currentUser?._id || null,
      userEmail,
      accountId: String(account._id),
      projectId: String(body.projectId || body.project || ''),
      provider: 'outlook',
      graphMessageId: message?.id || '',
      toEmails: payload.toRecipients.map((item) => item.emailAddress.address),
      ccEmails: payload.ccRecipients.map((item) => item.emailAddress.address),
      subject: payload.subject,
      body: String(body.body || ''),
      campaignId: body.campaignId || null
    }).catch(() => null);
    return NextResponse.json({ success: true, message: 'Draft created', draft: message || null });
  } catch (error) {
    const normalized = normalizeGraphError(error, 'Unable to create draft');
    return NextResponse.json({ success: false, code: normalized.code, message: normalized.message, error: normalized.message }, { status: normalized.status });
  }
}
