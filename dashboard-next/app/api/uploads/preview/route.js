import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireUser } from '@/lib/apiAuth';
import { analyzeRows, collectExistingLeadKeys } from '@/core-lib/client-data-config/UploadSheetValidation';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 200;

function readRowsFromWorkbook(buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    dense: false,
    cellFormula: false,
    cellHTML: false
  });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet || !workbook.Sheets[firstSheet]) {
    throw new Error('Uploaded file does not contain a readable sheet');
  }
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
  if (rawRows.length > MAX_ROWS) {
    throw new Error(`Too many rows. Maximum allowed rows is ${MAX_ROWS}.`);
  }
  const columnSet = new Set();
  rawRows.forEach((row) => Object.keys(row || {}).forEach((key) => columnSet.add(String(key || '').trim())));
  if (columnSet.size > MAX_COLUMNS) {
    throw new Error(`Too many columns. Maximum allowed columns is ${MAX_COLUMNS}.`);
  }
  return { rawRows, columns: Array.from(columnSet).filter(Boolean) };
}

export async function POST(req) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;

  let fileName = 'upload-sheet';
  let rawRows = [];
  let columns = [];

  const contentType = String(req.headers.get('content-type') || '').toLowerCase();

  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }
      fileName = String(file.name || 'upload-sheet');
      if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: 'File is too large.' }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = readRowsFromWorkbook(buffer);
      rawRows = parsed.rawRows;
      columns = parsed.columns;
    } else {
      const body = await req.json().catch(() => ({}));
      fileName = String(body.fileName || 'upload-sheet').trim() || 'upload-sheet';
      rawRows = Array.isArray(body.rows) ? body.rows : [];
      columns = Array.isArray(body.columns) ? body.columns : Array.from(new Set(rawRows.flatMap((row) => Object.keys(row || {}))));
    }

    let existingLists = [];
    try {
      await connectDB();
      existingLists = await LeadList.find({ userEmail }).select('leads').lean();
    } catch {
      existingLists = [];
    }
    const existingKeys = collectExistingLeadKeys(existingLists);
    const result = analyzeRows(rawRows, existingKeys);

    return NextResponse.json({
      ok: true,
      fileName,
      columns,
      ...result
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to preview upload' }, { status: 400 });
  }
}
