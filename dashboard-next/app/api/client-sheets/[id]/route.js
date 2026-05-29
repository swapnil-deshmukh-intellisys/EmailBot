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
  legacyLeadToRecord,
  normalizeProject,
  parseSheetId,
  publicRecord,
  publicSheet,
  refreshSheetCounts,
  summarizeRecords
} from '../_sheetUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const parsed = parseSheetId(params.id);
    if (parsed.legacy) {
      const list = await LeadList.findOne(activeListFilter(buildAuthOwnerFilter(auth, { _id: parsed.id }))).lean();
      if (!list) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
      const records = (list.leads || []).map((lead, index) => legacyLeadToRecord(list, lead, index));
      const flaggedRecords = applyDuplicateFlags(records, new Map());
      const sheet = publicSheet({
        _id: `legacy:${String(list._id)}`,
        isLegacy: true,
        sheetName: list.name || list.sourceFile || 'Client Sheet',
        originalFileName: list.sourceFile || list.sourceFileName || list.name || '',
        sourceListId: String(list._id),
        project: normalizeProject(`${list.project || ''} ${list.projectId || ''} ${list.sourceFile || ''} ${list.name || ''}`),
        projectId: list.projectId || '',
        kind: list.kind || 'legacy_lead_list',
        columns: list.columns || [],
        createdAt: list.createdAt || list.uploadedAt,
        updatedAt: list.updatedAt || list.createdAt,
        ...summarizeRecords(flaggedRecords)
      });
      return NextResponse.json({ ok: true, sheet, records: flaggedRecords.map((record) => publicRecord(record, sheet)) });
    }

    const sheet = await ClientSheet.findOne(buildAuthOwnerFilter(auth, { _id: parsed.id, deletedAt: null })).lean();
    if (!sheet) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
    const records = await ClientRecord.find({ sheetId: sheet._id, deletedAt: null }).sort({ rowIndex: 1, createdAt: 1 }).lean();
    const globalCounts = await collectProjectEmailCounts(auth, sheet.project || '');
    const flaggedRecords = applyDuplicateFlags(records, globalCounts);
    const summary = summarizeRecords(flaggedRecords);
    const nextSheet = await ClientSheet.findByIdAndUpdate(sheet._id, { $set: summary }, { new: true }).lean();
    const publicSheetData = publicSheet(nextSheet || sheet);
    return NextResponse.json({ ok: true, sheet: publicSheetData, records: flaggedRecords.map((record) => publicRecord(record, publicSheetData)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load sheet' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const parsed = parseSheetId(params.id);
    const nextName = String(body.sheetName || body.name || '').trim();
    const nextProject = body.project !== undefined || body.projectId !== undefined
      ? normalizeProject(body.project || body.projectId || '')
      : null;

    if (parsed.legacy) {
      const updates = {};
      if (nextName) updates.name = nextName;
      if (nextProject !== null) {
        updates.project = nextProject;
        updates.projectId = nextProject;
      }
      const list = await LeadList.findOneAndUpdate(
        activeListFilter(buildAuthOwnerFilter(auth, { _id: parsed.id })),
        { $set: updates },
        { new: true }
      );
      if (!list) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
      return NextResponse.json({ ok: true, sheet: publicSheet({
        _id: `legacy:${String(list._id)}`,
        isLegacy: true,
        sheetName: list.name,
        originalFileName: list.sourceFile || list.sourceFileName || '',
        sourceListId: String(list._id),
        project: normalizeProject(list.project || list.projectId || ''),
        columns: list.columns || [],
        totalRows: list.leads?.length || 0
      }) });
    }

    const updates = {};
    if (nextName) updates.sheetName = nextName;
    if (nextProject !== null) {
      updates.project = nextProject;
      updates.projectId = nextProject;
    }
    if (body.columnWidths && typeof body.columnWidths === 'object') updates.columnWidths = body.columnWidths;
    if (Array.isArray(body.columns)) updates.columns = body.columns.map(String);

    const sheet = await ClientSheet.findOneAndUpdate(
      buildAuthOwnerFilter(auth, { _id: parsed.id, deletedAt: null }),
      { $set: updates },
      { new: true }
    );
    if (!sheet) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
    return NextResponse.json({ ok: true, sheet: publicSheet(sheet) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to update sheet' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const parsed = parseSheetId(params.id);
    if (parsed.legacy) {
      const list = await LeadList.findOneAndUpdate(
        activeListFilter(buildAuthOwnerFilter(auth, { _id: parsed.id })),
        { $set: { deletedAt: new Date(), deleteReason: 'Moved to bin from Client Data Center', originalKind: 'uploaded' } },
        { new: true }
      );
      if (!list) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
      return NextResponse.json({ ok: true, deletedId: `legacy:${String(list._id)}` });
    }

    const sheet = await ClientSheet.findOneAndUpdate(
      buildAuthOwnerFilter(auth, { _id: parsed.id, deletedAt: null }),
      { $set: { deletedAt: new Date(), deleteReason: 'Moved to bin from Client Data Center' } },
      { new: true }
    );
    if (!sheet) return NextResponse.json({ ok: false, error: 'Sheet not found' }, { status: 404 });
    await ClientRecord.updateMany({ sheetId: sheet._id, deletedAt: null }, { $set: { deletedAt: new Date() } });
    await refreshSheetCounts(sheet._id);
    return NextResponse.json({ ok: true, deletedId: String(sheet._id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to delete sheet' }, { status: 500 });
  }
}
