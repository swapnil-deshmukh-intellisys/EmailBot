import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import UploadFile from '@/models/UploadFile';
import { requireAuth } from '@/lib/apiAuth';
import { analyzeRows, collectExistingLeadKeys } from '@/core-lib/client-data-config/UploadSheetValidation';

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
  if (value.includes('/')) value = value.split('/')[0].trim();
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

const FALLBACK_PREVIEW_COLUMNS = ['Name', 'Surname', 'Email', 'Company', 'Designation', 'Phone', 'Domain', 'Sector', 'Country'];

function extractPreviewColumns(rows = [], fallback = []) {
  const seen = new Set();
  const columns = [];
  const preferred = [...FALLBACK_PREVIEW_COLUMNS, ...fallback];

  for (const column of preferred) {
    const clean = String(column || '').trim();
    if (!clean || seen.has(clean)) continue;
    if (rows.some((row) => Object.prototype.hasOwnProperty.call(row || {}, clean))) {
      seen.add(clean);
      columns.push(clean);
    }
  }

  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      const clean = String(key || '').trim();
      if (
        !clean ||
        seen.has(clean) ||
        ['data', 'dedupe', 'reasons', 'rowId', 'rowNumber', 'status', 'validationStatus', 'duplicateMatches', 'matchedSources'].includes(clean)
      ) continue;
      seen.add(clean);
      columns.push(clean);
    }
  }

  return columns.length ? columns : fallback;
}

function leadFromPreviewRow(row = {}, fileName = '') {
  const email = normalizeEmail(row.Email || row.email || row?.data?.Email || '');
  const data = {
    ...(row.data && typeof row.data === 'object' ? row.data : {}),
    Name: row.Name || row?.data?.Name || '',
    Surname: row.Surname || row?.data?.Surname || '',
    Email: email,
    Company: row.Company || row?.data?.Company || '',
    Designation: row.Designation || row?.data?.Designation || '',
    Phone: row.Phone || row?.data?.Phone || '',
    LinkedInUrl: row.LinkedInUrl || row.linkedinUrl || row?.data?.LinkedInUrl || '',
    linkedinUrl: row.linkedinUrl || row.LinkedInUrl || row?.data?.linkedinUrl || '',
    Domain: row.Domain || row?.data?.Domain || '',
    Sector: row.Sector || row?.data?.Sector || '',
    Country: row.Country || row?.data?.Country || ''
  };

  return {
    Name: data.Name,
    Surname: data.Surname,
    Email: email,
    Company: data.Company,
    companyName: data.Company,
    Designation: data.Designation,
    Phone: data.Phone,
    linkedinUrl: data.linkedinUrl || data.LinkedInUrl,
    Domain: data.Domain,
    Sector: data.Sector,
    Country: data.Country,
    sourceFileName: fileName,
    uploadDate: new Date(),
    validationStatus: 'Valid',
    data,
    status: 'Pending'
  };
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

  const existingLists = await LeadList.find({ userEmail })
    .select('name sourceFile uploadedAt createdAt leads')
    .lean();
  const existingLeadKeys = collectExistingLeadKeys(existingLists);
  const analysis = analyzeRows(rows, {
    ...existingLeadKeys,
    companyNames: new Set()
  });
  const previewRows = (Array.isArray(analysis.rows) ? analysis.rows : []).map((row) => {
    const fullNameCompanyMatch = row?.dedupe?.fullNameCompany && existingLeadKeys.fullNameCompany?.has(row.dedupe.fullNameCompany);
    if (!fullNameCompanyMatch) return row;
    const reasons = Array.from(new Set([...(Array.isArray(row.reasons) ? row.reasons : []), 'Matched existing client by name and company']));
    return {
      ...row,
      status: 'Duplicate',
      validationStatus: 'Duplicate',
      reasons
    };
  });
  const validRows = previewRows.filter((row) => row.validationStatus === 'Valid');
  const duplicateRows = previewRows.filter((row) => row.validationStatus === 'Duplicate');
  const uploadSummary = {
    totalRecords: previewRows.length,
    validRecords: validRows.length,
    duplicateRecords: duplicateRows.length,
    repeatedRecords: duplicateRows.length,
    repeatedClientCount: duplicateRows.length,
    invalidRecords: 0
  };
  const previewColumns = extractPreviewColumns(previewRows, columns);
  const leads = validRows
    .filter((row) => normalizeEmail(row.Email || row?.data?.Email || '').includes('@'))
    .map((row) => leadFromPreviewRow(row, fileName));

  if (!leads.length) {
    const duplicateMessage = duplicateRows.length
      ? `All ${duplicateRows.length} uploaded client(s) already exist or repeat in this sheet. No new clients were saved.`
      : 'No valid leads with Email found in file';
    return NextResponse.json({ error: duplicateMessage }, { status: 400 });
  }

  const list = await LeadList.create({
    userId: auth.currentUser._id,
    userEmail,
    name: `${fileName} - ${new Date().toLocaleString()}`,
    sourceFile: fileName,
    kind: 'uploaded',
    columns: previewColumns,
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
    duplicateCount: duplicateRows.length,
    summary: uploadSummary,
    previewColumns,
    previewRows,
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
