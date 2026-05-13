import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { campaignMetrics, campaignProjectKey, campaignsByListId, countMeaningfulLeads, emptyProjectMetrics, listProjectKey } from '../reportDataUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const query = buildAuthOwnerFilter(auth);
    const [campaigns, lists] = await Promise.all([
      Campaign.find(query)
        .select('status project projectId projectName senderFrom senderAccount listId totalRecipients sentCount pendingCount failedCount stats')
        .lean(),
      LeadList.find(query)
        .select('name sourceFile sourceFileName project projectId projectName leads')
        .lean()
    ]);
    const projects = { tec: emptyProjectMetrics(), tut: emptyProjectMetrics(), unassigned: emptyProjectMetrics() };
    campaigns.forEach((campaign) => {
      const key = campaignProjectKey(campaign);
      const bucket = projects[key] || projects.unassigned;
      const status = String(campaign.status || '').toLowerCase();
      const metrics = campaignMetrics(campaign);
      bucket.campaigns += 1;
      if (['running', 'queued', 'scheduled', 'sending'].includes(status)) bucket.running += 1;
      if (status === 'completed') bucket.completed += 1;
      if (status === 'failed') bucket.failed += 1;
      if (status === 'paused') bucket.paused += 1;
      if (status === 'stopped') bucket.stopped += 1;
      bucket.sent += metrics.sent;
      bucket.pending += metrics.pending;
      bucket.bounced += metrics.bounced;
      bucket.spam += metrics.spam;
    });

    const campaignMap = campaignsByListId(campaigns);
    lists.forEach((list) => {
      const key = listProjectKey(list, campaignMap);
      const bucket = projects[key] || projects.unassigned;
      bucket.clients += countMeaningfulLeads(list);
    });
    return NextResponse.json({ ok: true, projects }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, projects: {}, error: error.message || 'Failed to load project report' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
