import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import ClientSheet from '@/models/ClientSheet';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter } from '@/app/api/client-data/_retention';
import {
  applyDuplicateFlags,
  collectProjectEmailCounts,
  normalizeEmail,
  parseSheetId,
  publicRecord,
  rawRowToRecord,
  refreshSheetCounts
} from '../../_sheetUtils';

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const parsed = parseSheetId(params.id);
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : [body.row || {}];

    if (parsed.legacy) {
      const list = await LeadList.findOne(activeListFilter(buildAuthOwnerFilter(auth, { _id: parsed.id })));
      if (!list) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
      const created = [];
      rows.forEach((row) => {
        const email = normalizeEmail(row.email || row.Email);
        const lead = {
          Name: row.name || row.Name || '',
          Surname: row.surname || row.Surname || '',
          Designation: row.designation || row.Designation || '',
          Company: row.companyName || row.cmpName || row.Company || '',
          Sector: row.sector || row.Sector || '',
          Country: row.country || row.Country || '',
          Email: email,
          data: {
            ...row,
            Name: row.name || row.Name || '',
            Email: email,
            Company: row.companyName || row.cmpName || row.Company || ''
          },
          status: 'Pending'
        };
        list.leads.push(lead);
        created.push({ rowId: `legacy:${String(list._id)}:${list.leads.length - 1}` });
      });
      await list.save();
      return NextResponse.json({ ok: true, created });
    }

    const sheet = await ClientSheet.findOne(buildAuthOwnerFilter(auth, { _id: parsed.id, deletedAt: null }));
    if (!sheet) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
    const count = await ClientRecord.countDocuments({ sheetId: sheet._id, deletedAt: null });
    const records = rows.map((row, index) => rawRowToRecord(row, {
      userId: sheet.userId,
      userEmail: sheet.userEmail,
      project: sheet.project,
      projectId: sheet.projectId,
      sheetId: sheet._id,
      rowIndex: count + index,
      originalFileName: sheet.originalFileName,
      sheetName: sheet.sheetName
    }));
    const globalCounts = await collectProjectEmailCounts(auth, sheet.project);
    const flaggedRecords = applyDuplicateFlags(records, globalCounts);
    const inserted = flaggedRecords.length ? await ClientRecord.insertMany(flaggedRecords) : [];
    await refreshSheetCounts(sheet._id);
    return NextResponse.json({ ok: true, records: inserted.map((record) => publicRecord(record, sheet)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to add rows' }, { status: 500 });
  }
}
