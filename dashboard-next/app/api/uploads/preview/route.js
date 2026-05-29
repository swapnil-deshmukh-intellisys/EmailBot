import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireUser } from '@/lib/apiAuth';
import { analyzeRows, collectExistingLeadKeys, mapRawRowToLead } from '@/core-lib/client-data-config/UploadSheetValidation';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const MAX_COLUMNS = 200;

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value = '') {
  return String(value || '').replace(/[^\d+]/g, '');
}

function normalizeLinkedIn(value = '') {
  return normalize(value).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function buildExistingRows(lists = []) {
  const rows = [];
  for (const list of lists || []) {
    (list.leads || []).forEach((lead, index) => {
      const mapped = mapRawRowToLead({ ...(lead?.data || {}), ...lead });
      rows.push({
        sourceListId: String(list._id || ''),
        sourceListName: String(list.name || ''),
        sourceFile: String(list.sourceFile || list.name || ''),
        uploadedAt: list.uploadedAt || list.createdAt || null,
        leadIndex: index,
        name: [mapped.Name, mapped.Surname].filter(Boolean).join(' '),
        email: mapped.Email,
        phone: mapped.Phone,
        linkedinUrl: mapped.LinkedInUrl || mapped.linkedinUrl || '',
        companyName: mapped.Company
      });
    });
  }
  return rows;
}

function findExistingMatches(row = {}, existingRows = []) {
  const mapped = mapRawRowToLead(row);
  const email = normalize(mapped.Email);
  const phone = normalizePhone(mapped.Phone);
  const linkedinUrl = normalizeLinkedIn(mapped.LinkedInUrl || mapped.linkedinUrl || '');
  const companyName = normalize(mapped.Company);
  return existingRows
    .map((existing) => {
      const matchFields = [];
      if (email && normalize(existing.email) === email) matchFields.push('email');
      if (phone && normalizePhone(existing.phone) === phone) matchFields.push('phone');
      if (linkedinUrl && normalizeLinkedIn(existing.linkedinUrl) === linkedinUrl) matchFields.push('linkedinUrl');
      if (companyName && normalize(existing.companyName) === companyName) matchFields.push('companyName');
      return matchFields.length ? { matchFields, existing } : null;
    })
    .filter(Boolean);
}

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
  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
    if (sheetRows.length > MAX_ROWS) {
      throw new Error(`Sheet "${sheetName}" has too many rows. Maximum allowed rows is ${MAX_ROWS}.`);
    }
    const sheetColumns = new Set();
    sheetRows.forEach((row) => Object.keys(row || {}).forEach((key) => sheetColumns.add(String(key || '').trim())));
    if (sheetColumns.size > MAX_COLUMNS) {
      throw new Error(`Sheet "${sheetName}" has too many columns. Maximum allowed columns is ${MAX_COLUMNS}.`);
    }
    return { sheetName, rawRows: sheetRows, columns: Array.from(sheetColumns).filter(Boolean) };
  });
  const rawRows = sheets[0]?.rawRows || [];
  if (rawRows.length > MAX_ROWS) {
    throw new Error(`Too many rows. Maximum allowed rows is ${MAX_ROWS}.`);
  }
  const columnSet = new Set();
  rawRows.forEach((row) => Object.keys(row || {}).forEach((key) => columnSet.add(String(key || '').trim())));
  if (columnSet.size > MAX_COLUMNS) {
    throw new Error(`Too many columns. Maximum allowed columns is ${MAX_COLUMNS}.`);
  }
  return { rawRows, columns: Array.from(columnSet).filter(Boolean), sheets };
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
      var workbookSheets = parsed.sheets;
    } else {
      const body = await req.json().catch(() => ({}));
      fileName = String(body.fileName || 'upload-sheet').trim() || 'upload-sheet';
      rawRows = Array.isArray(body.rows) ? body.rows : [];
      columns = Array.isArray(body.columns) ? body.columns : Array.from(new Set(rawRows.flatMap((row) => Object.keys(row || {}))));
    }

    let existingLists = [];
    try {
      await connectDB();
      existingLists = await LeadList.find({ userEmail }).select('name sourceFile uploadedAt createdAt leads').lean();
    } catch {
      existingLists = [];
    }
    const existingKeys = collectExistingLeadKeys(existingLists);
    const existingRows = buildExistingRows(existingLists);
    const result = analyzeRows(rawRows, existingKeys);
    const rowsWithMatches = (result.rows || []).map((row) => {
      const duplicateMatches = findExistingMatches(row, existingRows);
      return {
        ...row,
        duplicateMatches,
        matchedSources: duplicateMatches.map((item) => item.existing.sourceFile).filter(Boolean)
      };
    });

    const payload = {
      ok: true,
      fileName,
      columns,
      ...result,
      rows: rowsWithMatches
    };
    if (Array.isArray(workbookSheets) && workbookSheets.length) {
      payload.workbookSheetCount = workbookSheets.length;
      payload.sheets = workbookSheets.map((sheet) => ({
        sheetName: sheet.sheetName,
        columns: sheet.columns,
        rowCount: sheet.rawRows.length
      }));
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to preview upload' }, { status: 400 });
  }
}
