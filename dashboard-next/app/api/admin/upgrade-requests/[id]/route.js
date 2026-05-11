import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import { reviewSubscriptionUpgradeRequest } from '@/core-lib/billing/SubscriptionCreditService';

export async function PATCH(req, { params }) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const decision = String(body.decision || body.status || '').trim().toLowerCase();
    const result = await reviewSubscriptionUpgradeRequest(params.id, auth.currentUser, decision, {
      planName: body.planName,
      monthlyLimit: body.monthlyLimit,
      dailyLimit: body.dailyLimit
    });
    return NextResponse.json({
      ok: true,
      request: result.request,
      subscription: result.subscription,
      summary: result.summary,
      message: decision === 'approved' ? 'Upgrade approved.' : 'Upgrade rejected.'
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to review upgrade request' }, { status: 400 });
  }
}
