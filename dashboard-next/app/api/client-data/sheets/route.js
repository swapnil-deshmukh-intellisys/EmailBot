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

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
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

    return NextResponse.json({
      ok: true,
      lists: lists.map((list) => ({
        _id: String(list._id),
        name: list.name,
        sourceFile: list.sourceFile || list.sourceFileName || '',
        kind: list.kind || 'uploaded',
        project: list.project || list.projectId || list.projectName || 'unassigned',
        uploadedAt: list.uploadedAt || null,
        createdAt: list.createdAt || null,
        autoDeleteAt: list.autoDeleteAt || null,
        leadCount: Number(list.leadCount || 0)
      }))
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, lists: [], error: error.message || 'Failed to load sheets' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
