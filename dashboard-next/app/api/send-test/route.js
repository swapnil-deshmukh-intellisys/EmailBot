import { NextResponse } from 'next/server';
import { sendEmailForLead } from '@/lib/emailSender';
import { resolveSenderAccountById } from '@/lib/senderAccounts';
import { requireUser } from '@/lib/apiAuth';

function stripHtml(value = '') {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function POST(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    const { accountId, to, subject, body, project } = await req.json();
    if (!to) {
      return NextResponse.json({ error: 'Test recipient email is required' }, { status: 400 });
    }
    if (!String(subject || '').trim()) {
      return NextResponse.json({ error: 'Test email subject is required' }, { status: 400 });
    }
    if (!stripHtml(body)) {
      return NextResponse.json({ error: 'Test email body is required' }, { status: 400 });
    }

    const account = await resolveSenderAccountById(accountId, {
      userEmail,
      project: String(project || '').trim().toLowerCase(),
      senderFrom: accountId && String(accountId).startsWith('graphapp:')
        ? String(accountId).slice('graphapp:'.length)
        : ''
    });
    if (!account) {
      const isPresetGraphAccount = String(accountId || '').startsWith('graphapp:');
      return NextResponse.json(
        {
          error: isPresetGraphAccount
            ? 'Selected sender is not connected. Connect this Mail ID or configure Microsoft Graph app credentials before sending.'
            : 'Sender account not found'
        },
        { status: isPresetGraphAccount ? 400 : 404 }
      );
    }
    const result = await sendEmailForLead({
      account,
      template: { subject, body },
      lead: { Email: to, Name: 'Test Recipient', FirstName: 'Test', firstName: 'Test' }
    });

    return NextResponse.json({ ok: true, success: true, message: 'Test email sent', result });
  } catch (error) {
    return NextResponse.json({ ok: false, success: false, error: error.message || 'Test email failed' }, { status: 400 });
  }
}
