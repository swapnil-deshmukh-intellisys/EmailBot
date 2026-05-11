import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import { getOrCreateSubscriptionSummary } from '@/core-lib/billing/SubscriptionCreditService';

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
      .trim()
      .toLowerCase();
    const { subscription, summary } = await getOrCreateSubscriptionSummary(userEmail, auth.currentUser);
    return NextResponse.json({ ok: true, subscription, summary });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load subscription' }, { status: 400 });
  }
}
