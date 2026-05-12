import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SenderAccount from '@/models/SenderAccount';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const accounts = await SenderAccount.find(buildAuthOwnerFilter(auth)).select('provider from label status health errorCount sentToday dailyLimit updatedAt').sort({ updatedAt: -1 }).lean();
    const total = accounts.length;
    const active = accounts.filter((account) => ['connected', 'active', 'good'].includes(String(account.status || account.health || '').toLowerCase())).length;
    const failed = accounts.filter((account) => Number(account.errorCount || 0) > 0 || ['failed', 'error', 'disconnected'].includes(String(account.status || '').toLowerCase())).length;
    const providerCounts = accounts.reduce((map, account) => {
      const key = String(account.provider || 'smtp').toLowerCase();
      map[key] = Number(map[key] || 0) + 1;
      return map;
    }, {});
    return NextResponse.json({ ok: true, total, active, failed, providerCounts, accounts }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, total: 0, active: 0, failed: 0, providerCounts: {}, accounts: [], error: error.message || 'Failed to load sender health' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
