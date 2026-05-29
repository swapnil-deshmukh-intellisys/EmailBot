import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ClientSheet from '@/models/ClientSheet';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import {
  CLIENT_SHEET_COLUMNS,
  getLegacyListsAsSheets,
  normalizeProject,
  ownerEmail,
  ownerUserId,
  publicSheet
} from './_sheetUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const url = new URL(req.url);
    const project = normalizeProject(url.searchParams.get('project') || '');
    const includeLegacy = url.searchParams.get('includeLegacy') !== 'false';
    const owner = buildAuthOwnerFilter(auth, { deletedAt: null });
    const query = {
      ...owner,
      ...(project && project !== 'unassigned' ? { project } : {})
    };

    const [nativeSheets, legacySheets] = await Promise.all([
      ClientSheet.find(query).sort({ updatedAt: -1 }).lean(),
      includeLegacy ? getLegacyListsAsSheets(auth, project) : Promise.resolve([])
    ]);

    const sheets = [
      ...nativeSheets.map(publicSheet),
      ...legacySheets
    ].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

    const totals = sheets.reduce((acc, sheet) => {
      acc.totalSheets += 1;
      acc.totalClients += Number(sheet.totalRows || 0);
      acc.repeatedClients += Number(sheet.repeatedCount || 0);
      acc.contactedClients += Number(sheet.contactedCount || 0);
      acc.freshLeads += Number(sheet.freshCount || 0);
      acc.invalidRows += Number(sheet.invalidCount || 0);
      return acc;
    }, {
      totalSheets: 0,
      totalClients: 0,
      repeatedClients: 0,
      contactedClients: 0,
      freshLeads: 0,
      invalidRows: 0
    });

    return NextResponse.json({ ok: true, sheets, totals });
  } catch (error) {
    return NextResponse.json({ ok: false, sheets: [], totals: {}, error: error.message || 'Failed to load client sheets' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const sheetName = String(body.sheetName || body.name || 'New Sheet').trim() || 'New Sheet';
    const project = normalizeProject(body.project || body.projectId || '');
    const sheet = await ClientSheet.create({
      userId: ownerUserId(auth),
      userEmail: ownerEmail(auth),
      project,
      projectId: String(body.projectId || project || ''),
      sheetName,
      originalFileName: String(body.originalFileName || '').trim(),
      kind: String(body.kind || 'manual'),
      columns: Array.isArray(body.columns) && body.columns.length ? body.columns.map(String) : CLIENT_SHEET_COLUMNS,
      createdBy: ownerEmail(auth)
    });

    return NextResponse.json({ ok: true, sheet: publicSheet(sheet) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to create sheet' }, { status: 500 });
  }
}
