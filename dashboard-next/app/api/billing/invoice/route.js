import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireUser } from '@/lib/apiAuth';
import UserProfile from '@/models/UserProfile';
import CreditTransaction from '@/models/CreditTransaction';

function toInvoiceText(profile, latestTransactions = []) {
  const lines = [
    'Mailbot Invoice Summary',
    `Plan: ${profile.planName || 'Basic'}`,
    `Total Credits: ${profile.totalCredits ?? 0}`,
    `Used Credits: ${profile.usedCredits ?? 0}`,
    `Credits Left: ${profile.remainingCredits ?? 0}`,
    `Usage %: ${profile.creditUsagePercent ?? 0}%`,
    '',
    'Recent Credit Activity'
  ];

  if (!latestTransactions.length) {
    lines.push('No credit transactions found.');
    return lines.join('\n');
  }

  latestTransactions.forEach((item) => {
    const amount = Number(item.credits || 0);
    const sign = item.type === 'credit' ? '+' : '-';
    lines.push(
      `${item.reason || item.type || 'Credit change'} | ${sign}${Math.abs(amount)} | ${new Date(item.createdAt).toISOString()}`
    );
  });

  return lines.join('\n');
}

export async function GET(req) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();

  const profile = await UserProfile.findOne({ identifier: userEmail }).lean();
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const latestTransactions = await CreditTransaction.find({ userEmail }).sort({ createdAt: -1 }).limit(10).lean();
  const invoiceText = toInvoiceText(profile, latestTransactions);

  return new NextResponse(invoiceText, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="mailbot-invoice-${String(userEmail).split('@')[0] || 'profile'}.txt"`
    }
  });
}
