import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import SenderAccount from '@/models/SenderAccount';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { getRuntimeSenderAccounts } from '@/lib/senderAccounts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || '').toLowerCase();
    await connectDB();
    const [dbAccounts, oauthAccounts] = await Promise.all([
      SenderAccount.find(buildAuthOwnerFilter(auth)).select('provider from label status health errorCount sentToday dailyLimit updatedAt').sort({ updatedAt: -1 }).lean(),
      GraphOAuthAccount.find({ userEmail }).select('email status health errorCount updatedAt').sort({ updatedAt: -1 }).lean()
    ]);
    const runtimeAccounts = [
      ...getRuntimeSenderAccounts('tec'),
      ...getRuntimeSenderAccounts('tut'),
      ...getRuntimeSenderAccounts('')
    ];
    const accountMap = new Map();
    const addAccount = (account = {}) => {
      const from = String(account.from || account.email || '').trim().toLowerCase();
      const id = String(account.id || account._id || from || Math.random());
      const key = from || id;
      if (!key || accountMap.has(key)) return;
      accountMap.set(key, {
        provider: String(account.provider || 'graph').toLowerCase(),
        from,
        label: account.label || '',
        status: account.status || 'Connected',
        health: account.health || 'Good',
        errorCount: Number(account.errorCount ?? account.errors ?? 0),
        sentToday: Number(account.sentToday || 0),
        dailyLimit: Number(account.dailyLimit || 250),
        updatedAt: account.updatedAt || account.lastSync || null
      });
    };
    runtimeAccounts.forEach(addAccount);
    oauthAccounts.forEach((account) => addAccount({ ...account, provider: 'graph', from: account.email }));
    dbAccounts.forEach(addAccount);
    const accounts = Array.from(accountMap.values());
    const total = accounts.length;
    const active = accounts.filter((account) => ['connected', 'active', 'good'].includes(String(account.status || account.health || '').toLowerCase())).length;
    const failed = accounts.filter((account) => Number(account.errorCount || 0) > 0 || ['failed', 'error', 'disconnected'].includes(String(account.status || '').toLowerCase())).length;
    const providerCounts = accounts.reduce((map, account) => {
      const raw = String(account.provider || 'smtp').toLowerCase();
      const key = raw.includes('graph') ? 'graph' : raw;
      map[key] = Number(map[key] || 0) + 1;
      return map;
    }, {});
    return NextResponse.json({ ok: true, total, active, failed, providerCounts, accounts }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, total: 0, active: 0, failed: 0, providerCounts: {}, accounts: [], error: error.message || 'Failed to load sender health' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
