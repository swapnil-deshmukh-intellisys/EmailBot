import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ClientRecord from '@/models/ClientRecord';
import { requireAuth } from '@/lib/apiAuth';
import {
  applyDuplicateFlags,
  collectProjectEmailCounts,
  parseSheetId,
  publicRecord
} from '@/app/api/client-sheets/_sheetUtils';

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const parsed = parseSheetId(body.sheetId || '');
    if (parsed.legacy) {
      return NextResponse.json({ ok: true, records: [], message: 'Legacy sheet duplicate flags are calculated while loading the sheet.' });
    }
    const records = await ClientRecord.find({ sheetId: parsed.id, deletedAt: null }).sort({ rowIndex: 1 }).lean();
    const globalCounts = await collectProjectEmailCounts(auth, body.project || '');
    const flagged = applyDuplicateFlags(records, globalCounts);
    for (const record of flagged) {
      await ClientRecord.updateOne({ _id: record._id }, { $set: { isRepeated: record.isRepeated, duplicateReason: record.duplicateReason, isInvalid: record.isInvalid, invalidReason: record.invalidReason } });
    }
    return NextResponse.json({ ok: true, records: flagged.map((record) => publicRecord(record, { _id: parsed.id })) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to detect duplicates' }, { status: 500 });
  }
}
