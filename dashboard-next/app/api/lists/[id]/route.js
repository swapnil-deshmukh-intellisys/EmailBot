import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireUser } from '@/lib/apiAuth';

function normalizeEmail(raw) {
  let value = String(raw || '').trim();
  const mdMailto = value.match(/\]\(mailto:([^)]+)\)/i);
  if (mdMailto?.[1]) value = mdMailto[1].trim();
  value = value.replace(/^mailto:/i, '').trim();
  value = value.replace(/^[<[\("'`\s]+/, '').replace(/[>\])"'`\s]+$/, '');
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.includes(';')) value = value.split(';')[0].trim();
  return value.toLowerCase();
}

export async function GET(req, { params }) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();
    const list = await LeadList.findOne({ _id: params.id, userEmail }).lean();
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    return NextResponse.json({
      _id: String(list._id),
      name: list.name,
      sourceFile: list.sourceFile,
      uploadedAt: list.uploadedAt || null,
      uploadDate: list.uploadDate || null,
      createdAt: list.createdAt || null,
      columns: list.columns || [],
      sheetStyle: list.sheetStyle || {},
      leads: list.leads
    });
  } catch (error) {
    if (String(process.env.DEV_DEMO_DATA || '').trim().toLowerCase() === 'true' && String(params?.id || '') === 'demo-list-1') {
      return NextResponse.json({
        _id: 'demo-list-1',
        name: 'Demo Leads',
        sourceFile: 'demo.xlsx',
        columns: ['Name', 'Email', 'Company'],
        sheetStyle: {},
        leads: [
          { Name: 'John Doe', Email: 'john@example.com', Company: 'Acme', status: 'Sent', data: { Name: 'John Doe', Email: 'john@example.com', Company: 'Acme' } },
          { Name: 'Jane Smith', Email: 'jane@example.com', Company: 'Globex', status: 'Pending', data: { Name: 'Jane Smith', Email: 'jane@example.com', Company: 'Globex' } }
        ],
        error: error.message || 'Failed to load list'
      });
    }
    return NextResponse.json({ error: error.message || 'Failed to load list' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();

  const list = await LeadList.findOne({ _id: params.id, userEmail });
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }

  const body = await req.json();
  const nextName = String(body?.name || '').trim();
  const rows = Array.isArray(body.rows) ? body.rows : null;
  const columns = Array.isArray(body.columns) ? body.columns.map((c) => String(c || '').trim()).filter(Boolean) : null;
  const sheetStyle = body.sheetStyle && typeof body.sheetStyle === 'object' ? body.sheetStyle : null;

  // Metadata-only update: allow sheet renaming without requiring full rows payload.
  if (!rows && nextName) {
    list.name = nextName;
    await list.save();
    return NextResponse.json({ ok: true, name: list.name });
  }

  if (!rows) {
    return NextResponse.json({ error: 'rows are required (or provide a sheet name to rename)' }, { status: 400 });
  }

  if (nextName) {
    list.name = nextName;
  }

  list.columns = columns || list.columns || [];
  if (sheetStyle) {
    list.sheetStyle = {
      ...list.sheetStyle?.toObject?.(),
      ...sheetStyle,
      columnWidths: {
        ...(list.sheetStyle?.columnWidths || {}),
        ...(sheetStyle.columnWidths || {})
      }
    };
  }
  const seenEmails = new Set();
  list.leads = rows.reduce((acc, row, index) => {
    const data = Object.fromEntries(
      Object.entries(row || {}).map(([key, value]) => [String(key || '').trim(), value ?? ''])
    );
    const email = normalizeEmail(data.Email || data.email || '');
    if (!email || seenEmails.has(email)) {
      return acc;
    }
    seenEmails.add(email);

    const previousLead = list.leads[index] || {};
    acc.push({
      ...previousLead.toObject?.(),
      Name: data.Name || data.name || '',
      Email: email,
      Company: data.Company || data.company || '',
      data: {
        ...data,
        Email: email
      },
      status: previousLead.status || 'Pending',
      error: previousLead.error || '',
      sentAt: previousLead.sentAt || null,
      failedAt: previousLead.failedAt || null
    });
    return acc;
  }, []);

  await list.save();

  return NextResponse.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();
  const deleted = await LeadList.findOneAndDelete({ _id: params.id, userEmail });
  if (!deleted) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deletedId: String(params.id) });
}
