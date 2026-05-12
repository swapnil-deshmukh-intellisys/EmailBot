import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

function projectKey(value = '') {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('tut')) return 'tut';
  if (raw.includes('tec')) return 'tec';
  return 'unassigned';
}

function emptyProject() {
  return { campaigns: 0, running: 0, completed: 0, failed: 0, paused: 0, stopped: 0, clients: 0, sent: 0, pending: 0, bounced: 0, spam: 0 };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const query = buildAuthOwnerFilter(auth);
    const [campaignRows, clientRows] = await Promise.all([
      Campaign.aggregate([
        { $match: query },
        {
          $project: {
            project: { $toLower: { $ifNull: ['$project', { $ifNull: ['$projectId', '$projectName'] }] } },
            status: { $toLower: '$status' },
            sent: { $ifNull: ['$sentCount', { $ifNull: ['$stats.sent', 0] }] },
            pending: { $ifNull: ['$pendingCount', { $ifNull: ['$stats.pending', 0] }] },
            bounced: { $ifNull: ['$stats.bounced', 0] },
            spam: { $ifNull: ['$stats.spam', 0] }
          }
        },
        {
          $group: {
            _id: { project: '$project', status: '$status' },
            campaigns: { $sum: 1 },
            sent: { $sum: '$sent' },
            pending: { $sum: '$pending' },
            bounced: { $sum: '$bounced' },
            spam: { $sum: '$spam' }
          }
        }
      ]),
      LeadList.aggregate([
        { $match: query },
        { $project: { project: { $toLower: { $ifNull: ['$project', '$projectId'] } }, clients: { $size: { $ifNull: ['$leads', []] } } } },
        { $group: { _id: '$project', clients: { $sum: '$clients' } } }
      ])
    ]);
    const projects = { tec: emptyProject(), tut: emptyProject(), unassigned: emptyProject() };
    campaignRows.forEach((row) => {
      const key = projectKey(row._id?.project);
      const bucket = projects[key] || projects.unassigned;
      const status = String(row._id?.status || '').toLowerCase();
      const count = Number(row.campaigns || 0);
      bucket.campaigns += count;
      if (['running', 'queued', 'scheduled'].includes(status)) bucket.running += count;
      if (status === 'completed') bucket.completed += count;
      if (status === 'failed') bucket.failed += count;
      if (status === 'paused') bucket.paused += count;
      if (status === 'stopped') bucket.stopped += count;
      bucket.sent += Number(row.sent || 0);
      bucket.pending += Number(row.pending || 0);
      bucket.bounced += Number(row.bounced || 0);
      bucket.spam += Number(row.spam || 0);
    });
    clientRows.forEach((row) => {
      const key = projectKey(row._id);
      const bucket = projects[key] || projects.unassigned;
      bucket.clients += Number(row.clients || 0);
    });
    return NextResponse.json({ ok: true, projects }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, projects: {}, error: error.message || 'Failed to load project report' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
