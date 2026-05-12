import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import SenderAccount from '@/models/SenderAccount';
import UserSubscription from '@/models/UserSubscription';
import WarmupAutoReplySetting from '@/models/WarmupAutoReplySetting';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || '').toLowerCase();
    await connectDB();
    const ownerQuery = buildAuthOwnerFilter(auth);
    const [campaigns, senders, subscription, warmup] = await Promise.all([
      Campaign.find(ownerQuery).select('name status stats pendingCount updatedAt lastError').sort({ updatedAt: -1 }).limit(200).lean(),
      SenderAccount.find(ownerQuery).select('from status health errorCount updatedAt').lean(),
      UserSubscription.findOne({ userEmail }).lean(),
      WarmupAutoReplySetting.findOne({ userEmail }).lean()
    ]);
    const alerts = [];
    const failedCampaigns = campaigns.filter((item) => String(item.status || '').toLowerCase() === 'failed');
    if (failedCampaigns.length) alerts.push({ severity: 'Critical', title: 'Failed campaigns', message: `${failedCampaigns.length} campaign(s) failed. Review delivery errors before restarting.` });
    const remaining = Number(subscription?.remainingCredits || 0);
    if (subscription && remaining <= Math.max(25, Number(subscription.monthlyLimit || 0) * 0.1)) alerts.push({ severity: 'Warning', title: 'Low credits', message: `${remaining} credits remaining.` });
    const senderErrors = senders.filter((item) => Number(item.errorCount || 0) > 0 || ['failed', 'error', 'disconnected'].includes(String(item.status || '').toLowerCase()));
    if (senderErrors.length) alerts.push({ severity: 'Critical', title: 'Sender account errors', message: `${senderErrors.length} sender account(s) need attention.` });
    if (warmup && !warmup.enabled) alerts.push({ severity: 'Warning', title: 'Warmup stopped', message: 'Warmup auto replies are disabled.' });
    const riskyCampaigns = campaigns.filter((item) => Number(item?.stats?.bounced || 0) + Number(item?.stats?.spam || 0) > 0);
    if (riskyCampaigns.length) alerts.push({ severity: 'Warning', title: 'Bounce or spam warning', message: `${riskyCampaigns.length} campaign(s) have bounce/spam signals.` });
    const stuckSince = Date.now() - 1000 * 60 * 60 * 6;
    const stuck = campaigns.filter((item) => ['queued', 'scheduled', 'running'].includes(String(item.status || '').toLowerCase()) && new Date(item.updatedAt).getTime() < stuckSince);
    if (stuck.length) alerts.push({ severity: 'Info', title: 'Pending campaigns stuck', message: `${stuck.length} campaign(s) have not updated in 6+ hours.` });
    if (!alerts.length) alerts.push({ severity: 'Info', title: 'All clear', message: 'No critical delivery, sender, credit, or warmup alerts right now.' });
    return NextResponse.json({ ok: true, alerts }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, alerts: [], error: error.message || 'Failed to load alerts' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
