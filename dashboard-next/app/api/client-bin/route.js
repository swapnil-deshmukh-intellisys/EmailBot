import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ClientBinRecord from '@/models/ClientBinRecord';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { refreshSheetCounts } from '@/app/api/client-sheets/_sheetUtils';

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const records = await ClientBinRecord.find(buildAuthOwnerFilter(auth, { restoredAt: null }))
      .sort({ deletedAt: -1 })
      .limit(500)
      .lean();
    return NextResponse.json({
      ok: true,
      records: records.map((record) => ({
        _id: String(record._id),
        sheetId: record.sheetId ? String(record.sheetId) : '',
        sheetName: record.sheetName || '',
        deletedReason: record.deletedReason || '',
        deletedAt: record.deletedAt || null,
        restorePayload: record.restorePayload || {}
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, records: [], error: error.message || 'Failed to load bin records' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const binId = String(body.binId || body.id || '').trim();
    if (!binId) return NextResponse.json({ ok: false, error: 'binId is required' }, { status: 400 });
    const bin = await ClientBinRecord.findOne(buildAuthOwnerFilter(auth, { _id: binId, restoredAt: null }));
    if (!bin) return NextResponse.json({ ok: false, error: 'Bin record not found' }, { status: 404 });

    if (bin.sourceRecordId) {
      await ClientRecord.updateOne(
        buildAuthOwnerFilter(auth, { _id: bin.sourceRecordId }),
        { $unset: { deletedAt: '' } }
      );
      await refreshSheetCounts(bin.sheetId);
    }
    bin.restoredAt = new Date();
    await bin.save();
    return NextResponse.json({ ok: true, restoredId: String(bin._id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to restore bin record' }, { status: 500 });
  }
}
