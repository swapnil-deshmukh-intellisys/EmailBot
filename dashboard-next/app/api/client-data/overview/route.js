import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function normalizeProject(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('tut')) return 'tut';
  if (raw.includes('tec')) return 'tec';
  return raw || 'unassigned';
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
    const [listSummariesRaw, projectRows, verifiedRows] = await Promise.all([
      LeadList.aggregate([
        { $match: ownerQuery },
        {
          $project: {
            name: 1,
            sourceFile: 1,
            kind: 1,
            uploadedAt: { $ifNull: ['$uploadedAt', '$createdAt'] },
            leadCount: { $size: { $ifNull: ['$leads', []] } },
            project: { $toLower: { $ifNull: ['$project', '$projectId'] } }
          }
        },
        { $sort: { uploadedAt: -1 } }
      ]),
      LeadList.aggregate([
        { $match: ownerQuery },
        { $project: { project: { $toLower: { $ifNull: ['$project', '$projectId'] } }, leadCount: { $size: { $ifNull: ['$leads', []] } } } },
        { $group: { _id: '$project', clients: { $sum: '$leadCount' } } }
      ]),
      LeadList.aggregate([
        { $match: ownerQuery },
        { $unwind: { path: '$leads', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            verified: {
              $sum: {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ['$leads.Email', ''] } }, 0] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ])
    ]);
    const projectCounts = { tec: 0, tut: 0, unassigned: 0 };
    projectRows.forEach((row) => {
      const project = normalizeProject(row._id);
      projectCounts[project] = Number(projectCounts[project] || 0) + Number(row.clients || 0);
    });
    const totalClients = Number(verifiedRows[0]?.total || 0);
    const verifiedClients = Number(verifiedRows[0]?.verified || 0);
    const missingEmailClients = Math.max(0, totalClients - verifiedClients);
    const listSummaries = listSummariesRaw.map((list) => ({
      _id: String(list._id),
      name: list.name,
      sourceFile: list.sourceFile,
      kind: list.kind || 'uploaded',
      uploadedAt: list.uploadedAt || null,
      leadCount: Number(list.leadCount || 0),
      projectCounts: { [normalizeProject(list.project)]: Number(list.leadCount || 0) }
    }));

    return NextResponse.json({
      ok: true,
      totalClients,
      verifiedClients,
      missingEmailClients,
      activeLists: listSummaries.length,
      projectCounts: {
        tec: Number(projectCounts.tec || 0),
        tut: Number(projectCounts.tut || 0),
        total: totalClients
      },
      lists: listSummaries
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load client overview' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
