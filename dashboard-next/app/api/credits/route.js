import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import CreditTransaction from '@/models/CreditTransaction';
import { getOrCreateSubscriptionSummary } from '@/core-lib/billing/SubscriptionCreditService';

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
      .trim()
      .toLowerCase();

    const [{ summary }, transactions] = await Promise.all([
      getOrCreateSubscriptionSummary(userEmail, auth.currentUser),
      CreditTransaction.find({ userEmail }).sort({ createdAt: -1 }).limit(20).lean()
    ]);

    return NextResponse.json({
      ok: true,
      summary,
      transactions
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to load credit history',
      summary: {
        planName: 'Basic',
        currentPlan: 'Basic',
        upgradeTargetPlan: 'Starter',
        upgradeTargetCredits: 2000,
        nextPlan: 'Starter',
        monthlyLimit: 300,
        totalCredits: 300,
        usedCredits: 0,
        remainingCredits: 300,
        usagePercentage: 0,
        creditUsagePercent: 0,
        dailyLimit: 500,
        usedToday: 0,
        remainingToday: 500,
        lastDailyResetAt: null,
        dailyUsedCredits: 0,
        dailyRemainingCredits: 500,
        dailyUsagePercentage: 0,
        upgradeRequestPending: false,
        requestedUpgradePlan: null,
        pendingUpgradeRequestId: null,
        status: 'active',
        warningLevel: 'healthy',
        dailyWarningLevel: 'healthy',
        sendingDisabled: false
      },
      transactions: []
    });
  }
}
