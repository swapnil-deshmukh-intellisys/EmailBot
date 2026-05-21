import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireAuth } from '@/lib/apiAuth';
import {
  CLIENT_DATA_COLUMNS,
  collectExistingEmails,
  makePastedSheetName,
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
    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'No pasted rows provided.' }, { status: 400 });
    }

    const leads = rows.map(rowToLead);
    const existingEmails = await collectExistingEmails(userEmail);
    const summary = summarizeLeads(leads, existingEmails);
    const name = String(body.name || '').trim() || makePastedSheetName();
    const sourceFile = `${name}.pasted`;

    const list = await LeadList.create({
      userId: auth.currentUser?._id || null,
      userEmail,
      name,
      sourceFile,
      sourceFileName: sourceFile,
      kind: 'pasted_data',
      columns: CLIENT_DATA_COLUMNS,
      leads,
      dataCenterMeta: {
        sourceType: 'pasted_data',
        createdBy: auth.currentUser?._id || null,
        createdDate: new Date(),
        ...summary
      }
    });

    return NextResponse.json({
      ok: true,
      message: `Saved ${summary.validClients} valid pasted clients.`,
      list: publicList(list),
      summary
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to save pasted data.' }, { status: 500 });
  }
}
