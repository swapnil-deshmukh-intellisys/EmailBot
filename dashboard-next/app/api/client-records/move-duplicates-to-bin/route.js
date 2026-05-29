import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { moveRecordsToBin, parseSheetId, refreshSheetCounts } from '@/app/api/client-sheets/_sheetUtils';

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const parsed = parseSheetId(body.sheetId || '');
    if (parsed.legacy) return NextResponse.json({ ok: false, error: 'Use row selection to move legacy duplicates to bin.' }, { status: 400 });

    const records = await ClientRecord.find(buildAuthOwnerFilter(auth, { sheetId: parsed.id, deletedAt: null, isRepeated: true })).lean();
    if (!records.length) return NextResponse.json({ ok: true, movedCount: 0 });
    await moveRecordsToBin({ auth, records, reason: 'Moved repeated clients to bin' });
    await ClientRecord.updateMany({ _id: { $in: records.map((record) => record._id) } }, { $set: { deletedAt: new Date() } });
    await refreshSheetCounts(parsed.id);
    return NextResponse.json({ ok: true, movedCount: records.length });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to move duplicates to bin' }, { status: 500 });
  }
}
