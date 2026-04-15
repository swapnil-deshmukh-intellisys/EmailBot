import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireUser } from '@/lib/apiAuth';
import UserProfile from '@/models/UserProfile';
import CreditTransaction from '@/models/CreditTransaction';

const PLAN_UPGRADES = {
  Basic: { nextPlan: 'Pro', credits: 12000 },
  Pro: { nextPlan: 'Enterprise', credits: 30000 }
};

export async function POST(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const requestedPlan = String(body?.planName || '').trim();
    const currentProfile = await UserProfile.findOne({ identifier: userEmail });
    if (!currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const currentPlan = String(currentProfile.planName || 'Basic').trim() || 'Basic';
    const nextPlanConfig = PLAN_UPGRADES[currentPlan];

    if (!nextPlanConfig && !requestedPlan) {
      return NextResponse.json({
        ok: true,
        profile: currentProfile.toObject(),
        message: 'Plan is already at the highest tier.'
      });
    }

    const nextPlan = requestedPlan || nextPlanConfig?.nextPlan || currentPlan;
    const nextCredits = Number.isFinite(Number(body?.totalCredits))
      ? Math.max(0, Number(body.totalCredits))
      : PLAN_UPGRADES[currentPlan]?.credits || currentProfile.totalCredits || 6000;

    const previousTotalCredits = Math.max(0, Number(currentProfile.totalCredits || 0));
    const totalCredits = Math.max(0, nextCredits);
    const usedCredits = Math.max(0, Number(currentProfile.usedCredits || 0));
    const remainingCredits = Math.max(0, totalCredits - usedCredits);
    const creditUsagePercent = totalCredits ? Math.min(100, Math.round((usedCredits / totalCredits) * 100)) : 0;

    currentProfile.planName = nextPlan;
    currentProfile.totalCredits = totalCredits;
    currentProfile.remainingCredits = remainingCredits;
    currentProfile.creditUsagePercent = creditUsagePercent;
    await currentProfile.save();

    await CreditTransaction.create({
      userEmail,
      campaignId: null,
      type: 'credit',
      credits: Math.max(0, totalCredits - previousTotalCredits),
      reason: 'plan_upgrade',
      campaignName: nextPlan,
      recipientEmail: '',
      balanceAfter: remainingCredits,
      meta: {
        previousPlan: currentPlan,
        upgradedTo: nextPlan
      }
    });

    return NextResponse.json({
      ok: true,
      profile: currentProfile.toObject(),
      message: `Upgraded to ${nextPlan}.`
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to upgrade plan' }, { status: 400 });
  }
}
