import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CreditTransaction from '@/models/CreditTransaction';
import UserSubscription from '@/models/UserSubscription';
import Campaign from '@/models/Campaign';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { campaignMetrics, campaignProjectKey } from '../reportDataUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

function projectKey(value = '') {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('tut')) return 'tut';
  if (raw.includes('tec')) return 'tec';
  return 'unassigned';
}

function allocateUsedCreditsByCampaigns(campaigns = [], usedCredits = 0) {
  const sentByProject = campaigns.reduce((acc, campaign) => {
    const key = campaignProjectKey(campaign);
    const metrics = campaignMetrics(campaign);
    acc[key] = Number(acc[key] || 0) + Number(metrics.sent || 0);
    return acc;
  }, { tec: 0, tut: 0, unassigned: 0 });
  const sentTotal = Number(sentByProject.tec || 0) + Number(sentByProject.tut || 0) + Number(sentByProject.unassigned || 0);
  if (!sentTotal || !usedCredits) return sentByProject;
  return {
    tec: Math.round((Number(sentByProject.tec || 0) / sentTotal) * usedCredits),
    tut: Math.round((Number(sentByProject.tut || 0) / sentTotal) * usedCredits),
    unassigned: Math.max(0, usedCredits - Math.round((Number(sentByProject.tec || 0) / sentTotal) * usedCredits) - Math.round((Number(sentByProject.tut || 0) / sentTotal) * usedCredits))
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || '').toLowerCase();
    await connectDB();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [subscription, transactions, campaigns] = await Promise.all([
      UserSubscription.findOne({ userEmail }).lean(),
      CreditTransaction.find({ userEmail, type: 'debit' }).select('credits meta createdAt').sort({ createdAt: -1 }).limit(1000).lean(),
      Campaign.find(buildAuthOwnerFilter(auth))
        .select('project projectId projectName senderFrom senderAccount sentCount stats')
        .lean()
    ]);
    const usedCredits = Number(subscription?.usedCredits || 0);
    const usedToday = transactions.filter((item) => new Date(item.createdAt) >= today).reduce((sum, item) => sum + Math.abs(Number(item.credits || 0)), 0);
    const projectWise = { tec: 0, tut: 0, unassigned: 0 };
    transactions.forEach((item) => {
      const key = projectKey(item?.meta?.project || item?.meta?.projectId || item?.meta?.projectName);
      projectWise[key] = Number(projectWise[key] || 0) + Math.abs(Number(item.credits || 0));
    });
    const hasTransactionProjectSplit = Number(projectWise.tec || 0) || Number(projectWise.tut || 0);
    const actualProjectWise = hasTransactionProjectSplit
      ? projectWise
      : allocateUsedCreditsByCampaigns(campaigns, usedCredits);
    return NextResponse.json({
      ok: true,
      totalCredits: Number(subscription?.monthlyLimit || subscription?.totalCredits || 0),
      usedCredits,
      remainingCredits: Number(subscription?.remainingCredits || 0),
      usedToday,
      projectWise: actualProjectWise
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, totalCredits: 0, usedCredits: 0, remainingCredits: 0, usedToday: 0, projectWise: {}, error: error.message || 'Failed to load credits' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
