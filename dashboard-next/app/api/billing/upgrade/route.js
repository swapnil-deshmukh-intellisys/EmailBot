import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import { requestSubscriptionUpgrade } from '@/core-lib/billing/SubscriptionCreditService';

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
      .trim()
      .toLowerCase();
    const { request, subscription, summary } = await requestSubscriptionUpgrade(userEmail, auth.currentUser, body?.planName);

    return NextResponse.json({
      ok: true,
      request,
      subscription,
      summary,
      profile: summary,
      message: `Upgrade request sent to admin for ${summary.requestedUpgradePlan}.`
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to upgrade plan' }, { status: 400 });
  }
}
