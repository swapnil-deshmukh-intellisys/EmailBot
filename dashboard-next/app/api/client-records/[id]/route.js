import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { refreshSheetCounts } from '@/app/api/client-sheets/_sheetUtils';

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const record = await ClientRecord.findOneAndUpdate(
      buildAuthOwnerFilter(auth, { _id: params.id, deletedAt: null }),
      { $set: body },
      { new: true }
    );
    if (!record) return NextResponse.json({ ok: false, error: 'Record not found' }, { status: 404 });
    await refreshSheetCounts(record.sheetId);
    return NextResponse.json({ ok: true, recordId: String(record._id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to update record' }, { status: 500 });
  }
}
