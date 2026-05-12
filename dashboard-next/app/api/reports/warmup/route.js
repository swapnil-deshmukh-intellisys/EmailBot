import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WarmupAutoReplySetting from '@/models/WarmupAutoReplySetting';
import WarmupAutoReplyLog from '@/models/WarmupAutoReplyLog';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || '').toLowerCase();
    await connectDB();
    const [setting, logs] = await Promise.all([
      WarmupAutoReplySetting.findOne({ userEmail }).lean(),
      WarmupAutoReplyLog.find({ userEmail }).select('mailboxEmail status repliedAt createdAt').sort({ createdAt: -1 }).limit(500).lean()
    ]);
    const activeAccounts = new Set(logs.map((log) => log.mailboxEmail).filter(Boolean)).size;
    const sent = logs.filter((log) => log.status === 'replied').length;
    const failed = logs.filter((log) => log.status === 'failed').length;
    const received = logs.length;
    const enabled = Boolean(setting?.enabled);
    const health = !enabled ? 'Stopped' : failed > sent ? 'Needs Attention' : 'Healthy';
    return NextResponse.json({ ok: true, enabled, activeAccounts, sent, received, failed, health, lastCheckedAt: setting?.lastCheckedAt || null }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, enabled: false, activeAccounts: 0, sent: 0, received: 0, failed: 0, health: 'Unknown', error: error.message || 'Failed to load warmup report' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
