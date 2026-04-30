import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import UploadFile from '@/models/UploadFile';
import { requireAuth } from '@/lib/apiAuth';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 200;
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.csv']);
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'text/plain',
  ''
]);
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_UPLOADS = 10;

const uploadRateState =
  global.__uploadRateState ||
  (global.__uploadRateState = new Map());

function getFileExtension(fileName = '') {
  const normalized = String(fileName || '').trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf('.');
  return dotIndex >= 0 ? normalized.slice(dotIndex) : '';
}

function getClientKey(req, userEmail = '') {
  const forwardedFor = req.headers.get('x-forwarded-for') || '';
  const ip = forwardedFor.split(',')[0]?.trim() || 'unknown';
  return `${String(userEmail || '').toLowerCase()}::${ip}`;
}

function checkUploadRateLimit(req, userEmail = '') {
  const now = Date.now();
  const key = getClientKey(req, userEmail);
  const bucket = uploadRateState.get(key) || [];
  const freshEntries = bucket.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (freshEntries.length >= RATE_LIMIT_MAX_UPLOADS) {
    return false;
  }

  freshEntries.push(now);
  uploadRateState.set(key, freshEntries);
  return true;
}

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

function normalizeRow(row) {
  const obj = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = String(key).trim();
    if (!cleanKey || BLOCKED_KEYS.has(cleanKey)) continue;
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

function dedupeLeadsByEmail(leads = []) {
  const seen = new Set();
  const deduped = [];

  for (const lead of leads) {
    const email = normalizeEmail(lead?.Email || lead?.email || '');
    if (!email || seen.has(email)) continue;
    seen.add(email);
    deduped.push({
      ...lead,
      Email: email
    });
  }

  return deduped;
}

export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
  await connectDB();

  if (!checkUploadRateLimit(req, userEmail)) {
    return NextResponse.json(
      { error: 'Too many uploads. Please wait a minute before trying again.' },
      { status: 429 }
    );
  }

  const form = await req.formData();
  const file = form.get('file');

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const fileName = file.name || 'upload';
  const extension = getFileExtension(fileName);
  const mimeType = String(file.type || '').trim().toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: 'Only .xlsx and .csv files are allowed' }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Maximum upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Maximum upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` },
      { status: 400 }
    );
  }

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    dense: false,
    cellFormula: false,
    cellHTML: false
  });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet || !workbook.Sheets[firstSheet]) {
    return NextResponse.json({ error: 'Uploaded file does not contain a readable sheet' }, { status: 400 });
  }

  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows. Maximum allowed rows is ${MAX_ROWS}.` },
      { status: 400 }
    );
  }

  const rows = rawRows.map((row) => normalizeRow(row).data);
  const columns = extractColumns(rows);

  if (columns.length > MAX_COLUMNS) {
    return NextResponse.json(
      { error: `Too many columns. Maximum allowed columns is ${MAX_COLUMNS}.` },
      { status: 400 }
    );
  }

  const leads = dedupeLeadsByEmail(rows
    .map(normalizeRow)
    .filter((row) => row.Email && String(row.Email).includes('@')));

  if (!leads.length) {
    return NextResponse.json({ error: 'No valid leads with Email found in file' }, { status: 400 });
  }

  const list = await LeadList.create({
    userId: auth.currentUser._id,
    userEmail,
    name: `${fileName} - ${new Date().toLocaleString()}`,
    sourceFile: fileName,
    kind: 'uploaded',
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

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  await connectDB();

  try {
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const uploads = await UploadFile.find({ userEmail }).sort({ uploadedDate: -1, createdAt: -1 }).lean();
    return NextResponse.json({
      uploads: uploads.map((upload) => ({
        _id: String(upload._id),
        fileName: upload.fileName,
        uploadedDate: upload.uploadedDate,
        totalRecords: Number(upload.totalRecords || 0),
        validRecords: Number(upload.validRecords || 0),
        duplicateRecords: Number(upload.duplicateRecords || 0),
        invalidRecords: Number(upload.invalidRecords || 0),
        uploadedBy: upload.uploadedBy || '',
        status: upload.status || 'Valid',
        sourceListId: upload.sourceListId ? String(upload.sourceListId) : '',
        previewRows: Array.isArray(upload.previewRows) ? upload.previewRows : []
      }))
    });
  } catch (error) {
    return NextResponse.json({ uploads: [], error: error.message || 'Failed to load uploads' }, { status: 500 });
  }
}
