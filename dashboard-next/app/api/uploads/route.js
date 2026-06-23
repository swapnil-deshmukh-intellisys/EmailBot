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
  if (value.includes('/')) value = value.split('/')[0].trim();
  return value.toLowerCase();
}

function getRowValue(obj, keys) {
  const normalizedObj = {};
  for (const [k, v] of Object.entries(obj)) {
    normalizedObj[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = v;
  }
  for (const key of keys) {
    const searchKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (searchKey in normalizedObj) {
      const val = String(normalizedObj[searchKey] ?? '').trim();
      if (val) return val;
    }
  }
  return '';
}

function normalizeRow(row) {
  const obj = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = String(key).trim();
    if (!cleanKey || BLOCKED_KEYS.has(cleanKey)) continue;
    obj[cleanKey] = value;
  }

  const email = normalizeEmail(getRowValue(obj, ['Email', 'email', 'Email Address', 'emailAddress', 'email_address']));

  return {
    Name: getRowValue(obj, ['Name', 'name', 'First Name', 'firstName', 'Client Name', 'clientName', 'client_name', 'client name']),
    Surname: getRowValue(obj, ['Surname', 'surname', 'Last Name', 'lastName', 'last name', 'last_name']),
    Email: email,
    Company: getRowValue(obj, ['Company', 'company', 'Company Name', 'companyName', 'company_name', 'company name']),
    companyName: getRowValue(obj, ['Company', 'company', 'Company Name', 'companyName', 'company_name', 'company name']),
    Designation: getRowValue(obj, ['Designation', 'designation', 'Title', 'title', 'Job Title', 'jobTitle', 'job title', 'job_title']),
    Phone: getRowValue(obj, ['Phone', 'phone', 'Telephone', 'telephone', 'mobile', 'Mobile', 'Mobile Number', 'Phone Number']),
    linkedinUrl: getRowValue(obj, ['linkedinUrl', 'linkedin', 'LinkedIn', 'Linkedin URL', 'linkedin_url', 'linkedin url']),
    Domain: getRowValue(obj, ['Domain', 'domain']),
    Sector: getRowValue(obj, ['Sector', 'sector', 'Industry', 'industry']),
    Country: getRowValue(obj, ['Country', 'country']),
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
  let userEmail = '';
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();

  try {
    await connectDB();

    if (!checkUploadRateLimit(req, userEmail)) {
      console.warn('[uploads:rate-limit]', { userEmail });
      return NextResponse.json(
        { ok: false, error: 'Too many uploads. Please wait a minute before trying again.' },
        { status: 429 }
      );
    }

    const form = await req.formData();
    const file = form.get('file');

    if (!file) {
      console.warn('[uploads:missing-file]', { userEmail });
      return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name || 'upload';
    const extension = getFileExtension(fileName);
    const mimeType = String(file.type || '').trim().toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      console.warn('[uploads:bad-extension]', { userEmail, fileName, extension });
      return NextResponse.json({ ok: false, error: 'Only .xlsx and .csv files are allowed' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      console.warn('[uploads:bad-mime]', { userEmail, fileName, mimeType });
      return NextResponse.json({ ok: false, error: 'Unsupported file type' }, { status: 400 });
    }

    if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
      console.warn('[uploads:file-too-large]', { userEmail, fileName, size: file.size });
      return NextResponse.json(
        { ok: false, error: `File is too large. Maximum upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > MAX_UPLOAD_BYTES) {
      console.warn('[uploads:buffer-too-large]', { userEmail, fileName, size: buffer.length });
      return NextResponse.json(
        { ok: false, error: `File is too large. Maximum upload size is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.` },
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
      console.warn('[uploads:no-readable-sheet]', { userEmail, fileName });
      return NextResponse.json({ ok: false, error: 'Uploaded file does not contain a readable sheet' }, { status: 400 });
    }

    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
    if (rawRows.length > MAX_ROWS) {
      console.warn('[uploads:too-many-rows]', { userEmail, fileName, rowCount: rawRows.length });
      return NextResponse.json(
        { ok: false, error: `Too many rows. Maximum allowed rows is ${MAX_ROWS}.` },
        { status: 400 }
      );
    }

    const rows = rawRows.map((row) => normalizeRow(row).data);
    const columns = extractColumns(rows);

    if (columns.length > MAX_COLUMNS) {
      console.warn('[uploads:too-many-columns]', { userEmail, fileName, columnCount: columns.length });
      return NextResponse.json(
        { ok: false, error: `Too many columns. Maximum allowed columns is ${MAX_COLUMNS}.` },
        { status: 400 }
      );
    }

    const leads = dedupeLeadsByEmail(rows
      .map(normalizeRow)
      .filter((row) => row.Email && String(row.Email).includes('@')));

    if (!leads.length) {
      console.warn('[uploads:no-valid-leads]', { userEmail, fileName, totalRows: rawRows.length });
      return NextResponse.json({ ok: false, error: 'No valid leads with Email found in file' }, { status: 400 });
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

    const responseData = {
      listId: String(list._id),
      totalRows: rawRows.length,
      validRows: leads.length,
      count: leads.length,
      previewColumns: columns,
      previewRows: rows,
      sheetStyle: list.sheetStyle,
      preview: leads
    };
    console.info('[uploads:success]', { userEmail, fileName, listId: responseData.listId, totalRows: rawRows.length, validRows: leads.length });
    return NextResponse.json({ ok: true, success: true, data: responseData, ...responseData });
  } catch (error) {
    console.error('[uploads:failed]', { userEmail, message: error?.message || 'Upload failed', stack: error?.stack || '' });
    return NextResponse.json({ ok: false, success: false, error: error?.message || 'Upload failed' }, { status: 500 });
  }
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
