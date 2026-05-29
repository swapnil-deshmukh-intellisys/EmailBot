import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter } from '@/app/api/client-data/_retention';
import { moveRecordsToBin, refreshSheetCounts } from '@/app/api/client-sheets/_sheetUtils';

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const recordIds = Array.isArray(body.recordIds) ? body.recordIds.map(String).filter(Boolean) : [];
    const reason = String(body.reason || 'Deleted selected rows').trim();
    if (!recordIds.length) return NextResponse.json({ ok: false, error: 'No rows selected' }, { status: 400 });

    const nativeIds = recordIds.filter((id) => !id.startsWith('legacy:'));
    const legacyIds = recordIds.filter((id) => id.startsWith('legacy:'));
    const touchedSheets = new Set();
    let deletedCount = 0;

    if (nativeIds.length) {
      const records = await ClientRecord.find({ ...buildAuthOwnerFilter(auth), _id: { $in: nativeIds }, deletedAt: null }).lean();
      await moveRecordsToBin({ auth, records, reason });
      await ClientRecord.updateMany({ ...buildAuthOwnerFilter(auth), _id: { $in: nativeIds }, deletedAt: null }, { $set: { deletedAt: new Date() } });
      records.forEach((record) => touchedSheets.add(String(record.sheetId)));
      deletedCount += records.length;
    }

    const byList = new Map();
    legacyIds.forEach((id) => {
      const [, listId, indexToken] = id.split(':');
      if (!listId) return;
      if (!byList.has(listId)) byList.set(listId, []);
      byList.get(listId).push(Number(indexToken));
    });
    for (const [listId, indexes] of byList.entries()) {
      const list = await LeadList.findOne(activeListFilter(buildAuthOwnerFilter(auth, { _id: listId })));
      if (!list) continue;
      const sorted = indexes.filter((index) => Number.isInteger(index) && index >= 0).sort((a, b) => b - a);
      const removed = [];
      sorted.forEach((index) => {
        if (!list.leads[index]) return;
        removed.push({ ...list.leads[index].toObject?.(), sourceListId: String(list._id), legacyLeadIndex: index, sheetName: list.name });
        list.leads.splice(index, 1);
      });
      if (removed.length) {
        await moveRecordsToBin({ auth, records: removed, reason, legacyList: list });
        await list.save();
        touchedSheets.add(`legacy:${listId}`);
        deletedCount += removed.length;
      }
    }

    for (const sheetId of touchedSheets) {
      if (!sheetId.startsWith('legacy:')) await refreshSheetCounts(sheetId);
    }

    return NextResponse.json({ ok: true, deletedCount, touchedSheets: Array.from(touchedSheets) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to delete records' }, { status: 500 });
  }
}
