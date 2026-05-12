import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const ownerQuery = buildAuthOwnerFilter(auth);
    const [campaignStats, campaignStatusCounts, clientProjectCounts] = await Promise.all([
      Campaign.aggregate([
        { $match: ownerQuery },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$totalRecipients', { $ifNull: ['$stats.total', 0] }] } },
            sent: { $sum: { $ifNull: ['$sentCount', { $ifNull: ['$stats.sent', 0] }] } },
            pending: { $sum: { $ifNull: ['$pendingCount', { $ifNull: ['$stats.pending', 0] }] } },
            failed: { $sum: { $ifNull: ['$failedCount', { $ifNull: ['$stats.failed', 0] }] } },
            bounced: { $sum: { $ifNull: ['$stats.bounced', 0] } },
            spam: { $sum: { $ifNull: ['$stats.spam', 0] } }
          }
        }
      ]),
      Campaign.aggregate([
        { $match: ownerQuery },
        { $group: { _id: { $toLower: '$status' }, count: { $sum: 1 } } }
      ]),
      LeadList.aggregate([
        { $match: ownerQuery },
        { $project: { project: { $toLower: { $ifNull: ['$project', '$projectId'] } }, leadCount: { $size: { $ifNull: ['$leads', []] } } } },
        { $group: { _id: '$project', clients: { $sum: '$leadCount' } } }
      ])
    ]);

    const delivery = campaignStats[0] || { total: 0, sent: 0, pending: 0, failed: 0, bounced: 0, spam: 0 };
    const campaignCounts = { total: 0, running: 0, completed: 0, failed: 0, paused: 0, stopped: 0 };
    campaignStatusCounts.forEach((item) => {
      const status = String(item._id || '').toLowerCase();
      const count = Number(item.count || 0);
      campaignCounts.total += count;
      if (['running', 'queued', 'scheduled'].includes(status)) campaignCounts.running += count;
      if (status === 'completed') campaignCounts.completed += count;
      if (status === 'failed') campaignCounts.failed += count;
      if (status === 'paused') campaignCounts.paused += count;
      if (status === 'stopped') campaignCounts.stopped += count;
    });
    const clientCounts = { tec: 0, tut: 0, total: 0 };
    clientProjectCounts.forEach((item) => {
      const project = String(item._id || '').toLowerCase();
      const count = Number(item.clients || 0);
      clientCounts.total += count;
      if (project.includes('tec')) clientCounts.tec += count;
      if (project.includes('tut')) clientCounts.tut += count;
    });

    return NextResponse.json({ ok: true, delivery, campaignCounts, clientCounts }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load report overview' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
