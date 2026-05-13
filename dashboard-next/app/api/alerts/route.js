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
    const [failedCampaignCount, riskyCampaignCount, stuckCampaignCount, senders, subscription, warmup] = await Promise.all([
      Campaign.countDocuments({ ...ownerQuery, status: 'Failed' }),
      Campaign.countDocuments({ ...ownerQuery, $or: [{ 'stats.bounced': { $gt: 0 } }, { 'stats.spam': { $gt: 0 } }] }),
      Campaign.countDocuments({
        ...ownerQuery,
        status: { $in: ['Queued', 'Scheduled', 'Running'] },
        updatedAt: { $lt: new Date(Date.now() - 1000 * 60 * 60 * 6) }
      }),
      SenderAccount.find(ownerQuery).select('from status health errorCount updatedAt').lean(),
      UserSubscription.findOne({ userEmail }).lean(),
      WarmupAutoReplySetting.findOne({ userEmail }).lean()
    ]);
    const alerts = [];
    if (failedCampaignCount) alerts.push({ severity: 'Critical', title: 'Failed campaigns', message: `${failedCampaignCount} campaign(s) failed. Review delivery errors before restarting.` });
    const remaining = Number(subscription?.remainingCredits || 0);
    if (subscription && remaining <= Math.max(25, Number(subscription.monthlyLimit || 0) * 0.1)) alerts.push({ severity: 'Warning', title: 'Low credits', message: `${remaining} credits remaining.` });
    const senderErrors = senders.filter((item) => Number(item.errorCount || 0) > 0 || ['failed', 'error', 'disconnected'].includes(String(item.status || '').toLowerCase()));
    if (senderErrors.length) alerts.push({ severity: 'Critical', title: 'Sender account errors', message: `${senderErrors.length} sender account(s) need attention.` });
    if (warmup && !warmup.enabled) alerts.push({ severity: 'Warning', title: 'Warmup stopped', message: 'Warmup auto replies are disabled.' });
    if (riskyCampaignCount) alerts.push({ severity: 'Warning', title: 'Bounce or spam warning', message: `${riskyCampaignCount} campaign(s) have bounce/spam signals.` });
    if (stuckCampaignCount) alerts.push({ severity: 'Info', title: 'Pending campaigns stuck', message: `${stuckCampaignCount} campaign(s) have not updated in 6+ hours.` });
    if (!alerts.length) alerts.push({ severity: 'Info', title: 'All clear', message: 'No critical delivery, sender, credit, or warmup alerts right now.' });
    return NextResponse.json({ ok: true, alerts }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, alerts: [], error: error.message || 'Failed to load alerts' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
