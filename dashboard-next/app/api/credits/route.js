import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireUser } from '@/lib/apiAuth';
import CreditTransaction from '@/models/CreditTransaction';
import UserProfile from '@/models/UserProfile';

const PLAN_UPGRADES = {
  Basic: { nextPlan: 'Pro', credits: 12000 },
  Pro: { nextPlan: 'Enterprise', credits: 30000 }
};

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();

    const [profile, transactions] = await Promise.all([
      UserProfile.findOne({ identifier: userEmail }).lean(),
      CreditTransaction.find({ userEmail }).sort({ createdAt: -1 }).limit(20).lean()
    ]);

    const currentPlan = String(profile?.planName || 'Basic').trim() || 'Basic';
    const upgradePlan = PLAN_UPGRADES[currentPlan] || null;

    return NextResponse.json({
      ok: true,
      summary: {
        planName: currentPlan,
        upgradeTargetPlan: upgradePlan?.nextPlan || currentPlan,
        upgradeTargetCredits: Number(upgradePlan?.credits || profile?.totalCredits || 6000),
        totalCredits: Number(profile?.totalCredits || 6000),
        usedCredits: Number(profile?.usedCredits || 0),
        remainingCredits: Number(profile?.remainingCredits || 6000),
        creditUsagePercent: Number(profile?.creditUsagePercent || 0)
      },
      transactions
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error.message || 'Failed to load credit history',
        summary: {
          planName: 'Basic',
          upgradeTargetPlan: 'Pro',
          upgradeTargetCredits: 12000,
          totalCredits: 6000,
          usedCredits: 0,
          remainingCredits: 6000,
          creditUsagePercent: 0
        },
        transactions: []
      },
      { status: 400 }
    );
  }
}
