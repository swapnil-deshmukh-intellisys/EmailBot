import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';

function normalizeEmail(raw) {
  let value = String(raw || '').trim();
  const mdMailto = value.match(/\]\(mailto:([^)]+)\)/i);
  if (mdMailto?.[1]) value = mdMailto[1].trim();
  value = value.replace(/^mailto:/i, '').trim();
  value = value.replace(/^[<[\("'`\s]+/, '').replace(/[>\])"'`\s]+$/, '');
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.includes(';')) value = value.split(';')[0].trim();
  return value;
}

function normalizeRow(row) {
  const obj = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = String(key).trim();
    obj[cleanKey] = value;
  }

  const email = normalizeEmail(obj.Email || obj.email || '');

  return {
    Name: obj.Name || obj.name || '',
    Email: email,
    Company: obj.Company || obj.company || '',
    data: obj,
    status: 'Pending'
  };
}

function extractColumns(rows) {
  const columns = [];
  const seen = new Set();

  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      const cleanKey = String(key || '').trim();
      if (!cleanKey || seen.has(cleanKey)) continue;
      seen.add(cleanKey);
      columns.push(cleanKey);
    }
  }

  return columns;
}

export async function POST(req) {
  await connectDB();

  const form = await req.formData();
  const file = form.get('file');

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const fileName = file.name || 'upload';
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
  const columns = extractColumns(rows);

  const leads = rows
    .map(normalizeRow)
    .filter((row) => row.Email && String(row.Email).includes('@'));

  if (!leads.length) {
    return NextResponse.json({ error: 'No valid leads with Email found in file' }, { status: 400 });
  }

  const list = await LeadList.create({
    name: `${fileName} - ${new Date().toLocaleString()}`,
    sourceFile: fileName,
    columns,
    sheetStyle: {
      fontFamily: 'Segoe UI',
      fontSize: 14,
      headerBg: '#edf2f7',
      headerColor: '#1e293b',
      cellBg: '#ffffff',
      cellColor: '#0f172a',
      columnWidths: {}
    },
    leads
  });

  return NextResponse.json({
    ok: true,
    listId: String(list._id),
    count: leads.length,
    previewColumns: columns,
    previewRows: rows,
    sheetStyle: list.sheetStyle,
    preview: leads
  });
}
