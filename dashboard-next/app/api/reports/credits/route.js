import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CreditTransaction from '@/models/CreditTransaction';
import UserSubscription from '@/models/UserSubscription';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

function projectKey(value = '') {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('tut')) return 'tut';
  if (raw.includes('tec')) return 'tec';
  return 'unassigned';
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || '').toLowerCase();
    await connectDB();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [subscription, transactions] = await Promise.all([
      UserSubscription.findOne({ userEmail }).lean(),
      CreditTransaction.find({ userEmail, type: 'debit' }).select('credits meta createdAt').sort({ createdAt: -1 }).limit(1000).lean()
    ]);
    const usedToday = transactions.filter((item) => new Date(item.createdAt) >= today).reduce((sum, item) => sum + Math.abs(Number(item.credits || 0)), 0);
    const projectWise = { tec: 0, tut: 0, unassigned: 0 };
    transactions.forEach((item) => {
      const key = projectKey(item?.meta?.project || item?.meta?.projectId || item?.meta?.projectName);
      projectWise[key] = Number(projectWise[key] || 0) + Math.abs(Number(item.credits || 0));
    });
    return NextResponse.json({
      ok: true,
      totalCredits: Number(subscription?.monthlyLimit || subscription?.totalCredits || 0),
      usedCredits: Number(subscription?.usedCredits || 0),
      remainingCredits: Number(subscription?.remainingCredits || 0),
      usedToday,
      projectWise
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, totalCredits: 0, usedCredits: 0, remainingCredits: 0, usedToday: 0, projectWise: {}, error: error.message || 'Failed to load credits' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
