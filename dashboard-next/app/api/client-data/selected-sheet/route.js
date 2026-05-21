import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireAuth } from '@/lib/apiAuth';
import {
  CLIENT_DATA_COLUMNS,
  publicList,
  rowToLead,
  summarizeLeads
} from '../_dataCenterUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const name = String(body.name || '').trim() || `Selected Clients ${new Date().toLocaleDateString()}`;
    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'Select at least one client first.' }, { status: 400 });
    }

    const leads = rows.map(rowToLead);
    const summary = summarizeLeads(leads);
    const parentListIds = Array.isArray(body.parentListIds) ? body.parentListIds.map(String).filter(Boolean) : [];
    const sourceFile = String(body.sourceFile || '').trim() || `${name}.selected`;
    const list = await LeadList.create({
      userId: auth.currentUser?._id || null,
      userEmail,
      name,
      sourceFile,
      sourceFileName: sourceFile,
      kind: 'selected_client_sheet',
      clonedFrom: parentListIds.join(','),
      columns: CLIENT_DATA_COLUMNS,
      leads,
      dataCenterMeta: {
        sourceType: 'selected_client_sheet',
        createdBy: auth.currentUser?._id || null,
        createdDate: new Date(),
        parentListIds,
        ...summary
      }
    });

    return NextResponse.json({
      ok: true,
      message: `Created selected-client sheet with ${summary.totalClients} clients.`,
      list: publicList(list),
      ...publicList(list),
      summary
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to create selected sheet.' }, { status: 500 });
  }
}
