import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { refreshSheetCounts } from '@/app/api/client-sheets/_sheetUtils';

function getListQuery(auth, listId) {
  return buildAuthOwnerFilter(auth, { _id: listId });
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const rowIds = Array.isArray(body?.rowIds) ? body.rowIds : [];
    if (!rowIds.length) {
      return NextResponse.json({ ok: false, error: 'No row IDs provided' }, { status: 400 });
    }

    const byList = new Map();
    const recordIds = [];
    for (const rowId of rowIds) {
      const normalizedRowId = String(rowId).trim();
      if (normalizedRowId.startsWith('record:')) {
        const recordId = normalizedRowId.slice('record:'.length);
        if (recordId) recordIds.push(recordId);
        continue;
      }
      const parts = normalizedRowId.split('__');
      const listId = parts[0];
      const indexToken = parts[1];
      const leadIndex = Number(indexToken);
      if (!listId || !Number.isInteger(leadIndex) || leadIndex < 0) continue;
      if (!byList.has(listId)) byList.set(listId, []);
      byList.get(listId).push(leadIndex);
    }

    const touched = [];
    const touchedSheets = new Set();
    if (recordIds.length) {
      const records = await ClientRecord.find({
        ...buildAuthOwnerFilter(auth),
        _id: { $in: recordIds },
        deletedAt: null
      }).select('sheetId').lean();
      if (records.length) {
        await ClientRecord.updateMany(
          { ...buildAuthOwnerFilter(auth), _id: { $in: records.map((record) => record._id) }, deletedAt: null },
          { $set: { deletedAt: new Date() } }
        );
        records.forEach((record) => {
          if (record.sheetId) touchedSheets.add(String(record.sheetId));
        });
      }
    }

    for (const [listId, indices] of byList.entries()) {
      const list = await LeadList.findOne(getListQuery(auth, listId));
      if (!list) continue;

      // Sort indices descending so splicing doesn't shift the indices of remaining elements in list.leads!
      indices.sort((a, b) => b - a);
      for (const index of indices) {
        if (Array.isArray(list.leads) && list.leads[index]) {
          list.leads.splice(index, 1);
        }
      }
      await list.save();
      touched.push(listId);
    }

    for (const sheetId of touchedSheets) {
      await refreshSheetCounts(sheetId);
    }

    return NextResponse.json({ ok: true, deletedCount: rowIds.length, updatedLists: touched, updatedSheets: Array.from(touchedSheets) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to bulk delete rows' }, { status: 500 });
  }
}
