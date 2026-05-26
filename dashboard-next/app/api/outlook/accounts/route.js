import { NextResponse } from 'next/server';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import ConnectedMailAccount from '@/models/ConnectedMailAccount';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';

function serialize(account = {}) {
  return {
    id: String(account._id || ''),
    provider: 'outlook',
    email: account.email || '',
    displayName: account.displayName || account.email || '',
    tenantId: account.tenantId || 'organizations',
    scopes: Array.isArray(account.scopes) ? account.scopes : [],
    status: account.status || 'Connected',
    expiresAt: account.expiresAt || null,
    projectId: account.projectId || '',
    dailyLimit: Number(account.dailyLimit || 250),
    warmupEnabled: Boolean(account.warmupEnabled),
    lastSyncAt: account.lastSyncAt || account.lastSync || null,
    tokenEncrypted: Boolean(account.refreshTokenEncrypted || account.refreshTokenEnc)
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const [connected, oauth] = await Promise.all([
      ConnectedMailAccount.find({ userEmail }).sort({ updatedAt: -1 }).lean(),
      GraphOAuthAccount.find({ userEmail }).sort({ updatedAt: -1 }).lean()
    ]);
    const byEmail = new Map();
    oauth.forEach((account) => byEmail.set(String(account.email || '').toLowerCase(), serialize(account)));
    connected.forEach((account) => byEmail.set(String(account.email || '').toLowerCase(), { ...byEmail.get(String(account.email || '').toLowerCase()), ...serialize(account) }));
    const accounts = Array.from(byEmail.values()).filter((account) => account.email);
    return NextResponse.json({
      success: true,
      connected: accounts.length > 0,
      accounts,
      account: accounts[0] || null
    });
  } catch (error) {
    return NextResponse.json({ success: false, connected: false, accounts: [], error: error.message || 'Failed to load Outlook accounts' }, { status: 500 });
  }
}
