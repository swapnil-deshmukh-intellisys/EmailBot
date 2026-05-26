import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter, moveExpiredUploadsToBin } from '@/app/api/client-data/_retention';

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
  if (raw.includes('tut') || raw.includes('unicorn') || raw.includes('theunicorntimes.com')) return 'tut';
  if (raw.includes('tec') || raw.includes('entrepreneurial') || raw.includes('theentrepreneurialchronicle.com')) return 'tec';
  return raw || 'unassigned';
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
    const requestedProject = normalizeProject(new URL(req.url).searchParams.get('project') || '');
    await moveExpiredUploadsToBin(LeadList, ownerQuery);
    const lists = await LeadList.aggregate([
      { $match: activeListFilter(ownerQuery) },
      {
        $project: {
          name: 1,
          sourceFile: 1,
          sourceFileName: 1,
          kind: 1,
          uploadedAt: 1,
          createdAt: 1,
          autoDeleteAt: 1,
          project: 1,
          projectId: 1,
          projectName: 1,
          leadCount: { $size: { $ifNull: ['$leads', []] } }
        }
      },
      { $sort: { uploadedAt: -1, createdAt: -1 } }
    ]);

    const mappedLists = lists.map((list) => ({
      _id: String(list._id),
      name: list.name,
      sourceFile: list.sourceFile || list.sourceFileName || '',
      kind: list.kind || 'uploaded',
      project: normalizeProject(list.project || list.projectId || list.projectName || list.name || list.sourceFile || 'unassigned'),
      uploadedAt: list.uploadedAt || null,
      createdAt: list.createdAt || null,
      autoDeleteAt: list.autoDeleteAt || null,
      leadCount: Number(list.leadCount || 0)
    }));
    const scopedLists = requestedProject && requestedProject !== 'unassigned'
      ? mappedLists.filter((list) => list.project === requestedProject)
      : mappedLists;

    return NextResponse.json({
      ok: true,
      lists: scopedLists
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, lists: [], error: error.message || 'Failed to load sheets' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
