import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireUser } from '@/lib/apiAuth';

function normalizeLeadRow(row = {}) {
  const data = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [String(key || '').trim(), value ?? ''])
  );
  return {
    Name: data.Name || data.name || '',
    Email: String(data.Email || data.email || '').trim().toLowerCase(),
    Company: data.Company || data.company || '',
    data
  };
}

export async function POST(req) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const sourceListId = String(body.sourceListId || '').trim();
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const columns = Array.isArray(body.columns) ? body.columns.map((column) => String(column || '').trim()).filter(Boolean) : [];

  if (!name) {
    return NextResponse.json({ error: 'List name is required' }, { status: 400 });
  }

  const sourceList = sourceListId ? await LeadList.findOne({ _id: sourceListId, userEmail }).lean() : null;
  const sourceFile = String(body.sourceFile || sourceList?.sourceFile || `${name}.csv`).trim() || `${name}.csv`;
  const leadRows = rows.length
    ? rows.map(normalizeLeadRow).filter((row) => row.Email)
    : (sourceList?.leads || []).map((lead) => ({
        Name: lead.Name || lead.data?.Name || '',
        Email: String(lead.Email || lead.data?.Email || '').trim().toLowerCase(),
        Company: lead.Company || lead.data?.Company || '',
        data: lead.data || {}
      }));

  const list = await LeadList.create({
    userEmail,
    name,
    sourceFile,
    kind: 'custom',
    clonedFrom: sourceListId || '',
    columns: columns.length ? columns : sourceList?.columns || [],
    sheetStyle: sourceList?.sheetStyle || {
      fontFamily: 'Segoe UI',
      fontSize: 14,
      headerBg: '#edf2f7',
      headerColor: '#1e293b',
      cellBg: '#ffffff',
      cellColor: '#0f172a',
      columnWidths: {}
    },
    leads: leadRows
  });

  return NextResponse.json({
    ok: true,
    listId: String(list._id),
    count: leadRows.length,
    name: list.name,
    sourceFile: list.sourceFile,
    kind: list.kind,
    uploadedAt: list.uploadedAt,
    clonedFrom: list.clonedFrom
  });
}
