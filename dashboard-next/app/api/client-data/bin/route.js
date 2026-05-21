import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter, binListFilter, moveExpiredUploadsToBin, nextAutoDeleteDate } from '@/app/api/client-data/_retention';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
    await moveExpiredUploadsToBin(LeadList, ownerQuery);
    const lists = await LeadList.aggregate([
      { $match: binListFilter(ownerQuery) },
      {
        $project: {
          name: 1,
          sourceFile: 1,
          sourceFileName: 1,
          kind: 1,
          originalKind: 1,
          deletedAt: 1,
          deleteReason: 1,
          uploadedAt: 1,
          createdAt: 1,
          leadCount: { $size: { $ifNull: ['$leads', []] } }
        }
      },
      { $sort: { deletedAt: -1 } }
    ]);

    return NextResponse.json({
      ok: true,
      lists: lists.map((list) => ({
        _id: String(list._id),
        name: list.name,
        sourceFile: list.sourceFile || list.sourceFileName || '',
        kind: list.kind || list.originalKind || 'uploaded',
        deletedAt: list.deletedAt || null,
        deleteReason: list.deleteReason || '',
        uploadedAt: list.uploadedAt || null,
        createdAt: list.createdAt || null,
        leadCount: Number(list.leadCount || 0)
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, lists: [], error: error.message || 'Failed to load bin storage' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const listId = String(body?.listId || '').trim();
    if (!listId) return NextResponse.json({ ok: false, error: 'listId is required' }, { status: 400 });

    const restored = await LeadList.findOneAndUpdate(
      binListFilter(buildAuthOwnerFilter(auth, { _id: listId })),
      {
        $set: { deleteReason: '', autoDeleteAt: nextAutoDeleteDate() },
        $unset: { deletedAt: '' }
      },
      { new: true }
    );
    if (!restored) return NextResponse.json({ ok: false, error: 'Deleted sheet not found' }, { status: 404 });
    return NextResponse.json({ ok: true, restoredId: String(restored._id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to restore sheet' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const listId = String(body?.listId || '').trim();
    if (!listId) return NextResponse.json({ ok: false, error: 'listId is required' }, { status: 400 });

    const moved = await LeadList.findOneAndUpdate(
      activeListFilter(buildAuthOwnerFilter(auth, { _id: listId })),
      {
        $set: {
          deletedAt: new Date(),
          deleteReason: 'Moved to bin by user',
          originalKind: 'uploaded'
        }
      },
      { new: true }
    );
    if (!moved) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
    return NextResponse.json({ ok: true, deletedId: String(moved._id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to move sheet to bin' }, { status: 500 });
  }
}
