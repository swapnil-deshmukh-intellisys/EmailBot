import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import ClientRecord from '@/models/ClientRecord';
import ClientSheet from '@/models/ClientSheet';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import {
  CLIENT_SHEET_COLUMNS,
  normalizeEmail,
  ownerEmail,
  ownerUserId,
  parseSheetId,
  recordToLead
} from '../../_sheetUtils';

export async function POST(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const parsed = parseSheetId(params.id);
    const selectedIds = Array.isArray(body.recordIds) ? body.recordIds.map(String).filter(Boolean) : [];
    const includeRepeated = Boolean(body.includeRepeated);
    const includeInvalid = Boolean(body.includeInvalid);
    const name = String(body.name || `Selected Clients ${new Date().toLocaleDateString()}`).trim();

    let sheetName = name;
    let sourceFile = `${name}.selected`;
    let leads = [];

    if (parsed.legacy) {
      const source = await LeadList.findOne(buildAuthOwnerFilter(auth, { _id: parsed.id })).lean();
      if (!source) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
      sheetName = source.name || name;
      sourceFile = source.sourceFile || sourceFile;
      const wanted = new Set(selectedIds);
      leads = (source.leads || [])
        .map((lead, index) => ({ lead, id: `legacy:${String(source._id)}:${index}` }))
        .filter((item) => !wanted.size || wanted.has(item.id))
        .filter((item) => includeInvalid || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizeEmail(item.lead.Email || item.lead.data?.Email)))
        .map((item) => item.lead);
    } else {
      const sheet = await ClientSheet.findOne(buildAuthOwnerFilter(auth, { _id: parsed.id, deletedAt: null })).lean();
      if (!sheet) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
      sheetName = sheet.sheetName || name;
      sourceFile = sheet.originalFileName || sourceFile;
      const query = {
        ...buildAuthOwnerFilter(auth),
        sheetId: sheet._id,
        deletedAt: null,
        ...(selectedIds.length ? { _id: { $in: selectedIds } } : {})
      };
      const records = await ClientRecord.find(query).sort({ rowIndex: 1 }).lean();
      leads = records
        .filter((record) => includeRepeated || !record.isRepeated)
        .filter((record) => includeInvalid || !record.isInvalid)
        .map(recordToLead);
    }

    if (!leads.length) return NextResponse.json({ ok: false, error: 'No fresh valid clients available for campaign.' }, { status: 400 });

    const list = await LeadList.create({
      userId: ownerUserId(auth),
      userEmail: ownerEmail(auth),
      name,
      sourceFile,
      sourceFileName: sourceFile,
      kind: 'selected_client_sheet',
      clonedFrom: parsed.id,
      columns: CLIENT_SHEET_COLUMNS,
      leads,
      dataCenterMeta: {
        sourceType: 'client_sheet_campaign_selection',
        sourceSheetId: params.id,
        sourceSheetName: sheetName,
        totalClients: leads.length,
        includeRepeated,
        includeInvalid
      }
    });

    return NextResponse.json({
      ok: true,
      listId: String(list._id),
      name: list.name,
      redirectUrl: `/dashboard/user?listId=${encodeURIComponent(String(list._id))}&source=client-data`,
      message: `Created campaign-ready list with ${leads.length} clients.`
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to create campaign list' }, { status: 500 });
  }
}
