import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import UserProfile from '@/models/UserProfile';
import {
  getOrCreateSubscriptionSummary,
  updateSubscriptionLimitsForAdmin
} from '@/core-lib/billing/SubscriptionCreditService';

function getUserEmail(user = {}) {
  return String(user.email || user.identifier || user.username || '').trim().toLowerCase();
}

export async function GET(req, { params }) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const user = await UserProfile.findById(params.id).lean();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const userEmail = getUserEmail(user);
  const { subscription, summary } = await getOrCreateSubscriptionSummary(userEmail, user);
  return NextResponse.json({ ok: true, subscription, summary });
}

export async function PATCH(req, { params }) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const user = await UserProfile.findById(params.id).lean();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const userEmail = getUserEmail(user);
    const { subscription, summary } = await updateSubscriptionLimitsForAdmin(userEmail, auth.currentUser, body);
    return NextResponse.json({
      ok: true,
      subscription,
      summary,
      message: 'Subscription limits updated.'
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to update subscription limits' }, { status: 400 });
  }
}
