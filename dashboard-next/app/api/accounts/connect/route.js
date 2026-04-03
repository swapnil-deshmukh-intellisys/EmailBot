import { NextResponse } from 'next/server';
import { verifyAccountConnection } from '@/lib/emailSender';
import { resolveSenderAccountById } from '@/lib/senderAccounts';
import { requireUser } from '@/lib/apiAuth';

export async function POST(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    const body = await req.json();
    const account = await resolveSenderAccountById(body.accountId, { userEmail });
    if (!account) {
      return NextResponse.json({ error: 'Sender account not found' }, { status: 404 });
    }
    const result = await verifyAccountConnection(account);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Account connection failed' }, { status: 400 });
  }
}
