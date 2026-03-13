import { NextResponse } from 'next/server';
import { sendEmailForLead } from '@/lib/emailSender';
import { resolveSenderAccountById } from '@/lib/senderAccounts';

export async function POST(req) {
  try {
    const { accountId, to, subject, body } = await req.json();
    if (!to) {
      return NextResponse.json({ error: 'Test recipient email is required' }, { status: 400 });
    }

    const account = await resolveSenderAccountById(accountId);
    if (!account) {
      return NextResponse.json({ error: 'Sender account not found' }, { status: 404 });
    }
    await sendEmailForLead({
      account,
      template: { subject: subject || 'Test Email', body: body || '<p>This is a test email.</p>' },
      lead: { Email: to }
    });

    return NextResponse.json({ ok: true, message: 'Test email sent' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Test email failed' }, { status: 400 });
  }
}