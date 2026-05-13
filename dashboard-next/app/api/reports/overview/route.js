import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { campaignMetrics, campaignsByListId, countMeaningfulLeads, listProjectKey } from '../reportDataUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const ownerQuery = buildAuthOwnerFilter(auth);
    const [campaigns, lists] = await Promise.all([
      Campaign.find(ownerQuery)
        .select('status project projectId projectName senderFrom senderAccount listId totalRecipients sentCount pendingCount failedCount stats')
        .lean(),
      LeadList.find(ownerQuery)
        .select('name sourceFile sourceFileName project projectId projectName leads')
        .lean()
    ]);

    const delivery = { total: 0, sent: 0, pending: 0, failed: 0, bounced: 0, spam: 0 };
    const campaignCounts = { total: 0, running: 0, completed: 0, failed: 0, paused: 0, stopped: 0 };
    campaigns.forEach((campaign) => {
      const metrics = campaignMetrics(campaign);
      delivery.total += metrics.total;
      delivery.sent += metrics.sent;
      delivery.pending += metrics.pending;
      delivery.failed += metrics.failed;
      delivery.bounced += metrics.bounced;
      delivery.spam += metrics.spam;

      const status = String(campaign.status || '').toLowerCase();
      campaignCounts.total += 1;
      if (['running', 'queued', 'scheduled', 'sending'].includes(status)) campaignCounts.running += 1;
      if (status === 'completed') campaignCounts.completed += 1;
      if (status === 'failed') campaignCounts.failed += 1;
      if (status === 'paused') campaignCounts.paused += 1;
      if (status === 'stopped') campaignCounts.stopped += 1;
    });

    const campaignMap = campaignsByListId(campaigns);
    const clientCounts = { tec: 0, tut: 0, total: 0 };
    lists.forEach((list) => {
      const project = listProjectKey(list, campaignMap);
      const count = countMeaningfulLeads(list);
      clientCounts.total += count;
      if (project === 'tec') clientCounts.tec += count;
      if (project === 'tut') clientCounts.tut += count;
    });

    return NextResponse.json({ ok: true, delivery, campaignCounts, clientCounts }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load report overview' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
