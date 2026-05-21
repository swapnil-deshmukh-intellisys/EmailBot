import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireAuth } from '@/lib/apiAuth';
import { getWarmupAutoReplySetting } from '@/lib/warmupAutoReply';
import { NO_STORE_HEADERS, WARMUP_MASTER_KIND, WARMUP_TARGET_LEADS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function getFileExtension(fileName = '') {
  const dotIndex = String(fileName || '').trim().toLowerCase().lastIndexOf('.');
  return dotIndex >= 0 ? String(fileName || '').trim().toLowerCase().slice(dotIndex) : '';
}

function normalizeEmail(raw) {
  let value = String(raw || '').trim();
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.includes(';')) value = value.split(';')[0].trim();
  return value.replace(/^mailto:/i, '').trim().toLowerCase();
}

function findEmailInRow(data = {}) {
  const directEmail = normalizeEmail(data.Email || data.email || data['Email ID'] || data['Mail ID'] || data.Mail || '');
  if (directEmail && directEmail.includes('@')) return directEmail;

  const candidates = Object.values(data)
    .map((value) => String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0])
    .filter(Boolean)
    .map(normalizeEmail);
  return candidates.find((email) => !email.includes('intellisys')) || candidates[0] || '';
}

function cleanRow(row = {}) {
  const data = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = String(key || '').trim();
    if (!cleanKey || BLOCKED_KEYS.has(cleanKey)) continue;
    data[cleanKey] = value;
  }
  const email = findEmailInRow(data);
  return {
    Name: data.Name || data.name || '',
    Surname: data.Surname || data.surname || '',
    Email: email,
    Company: data.Company || data.company || '',
    Designation: data.Title || data.Designation || data.designation || '',
    data,
    status: 'Pending'
  };
}

function extractColumns(rows = []) {
  const seen = new Set();
  const columns = [];
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      const cleanKey = String(key || '').trim();
      if (!cleanKey || seen.has(cleanKey)) return;
      seen.add(cleanKey);
      columns.push(cleanKey);
    });
  });
  return columns;
}

function serializeWarmupList(list) {
  const leads = Array.isArray(list.leads) ? list.leads : [];
  return {
    id: String(list._id),
    name: list.name,
    kind: list.kind,
    sourceFile: list.sourceFile || '',
    sourceFileName: list.sourceFileName || '',
    columns: Array.isArray(list.columns) ? list.columns : [],
    total: Math.min(leads.length, WARMUP_TARGET_LEADS),
    sourceTotal: leads.length,
    leads: leads.map((lead) => lead?.data || lead).slice(0, WARMUP_TARGET_LEADS)
  };
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const form = await req.formData();
    const file = form.get('file');
    if (!file) {
      return NextResponse.json({ success: false, error: 'Choose a warmup sheet first.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const fileName = file.name || 'warmup-sheet.xlsx';
    const extension = getFileExtension(fileName);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json({ success: false, error: 'Only .xlsx and .csv files are allowed.' }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, error: 'File is too large. Maximum upload size is 5MB.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', dense: false, cellFormula: false, cellHTML: false });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet || !workbook.Sheets[firstSheet]) {
      return NextResponse.json({ success: false, error: 'Uploaded file does not contain a readable sheet.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
    const columns = extractColumns(rawRows);
    const seen = new Set();
    const leads = rawRows
      .map(cleanRow)
      .filter((lead) => lead.Email && lead.Email.includes('@'))
      .filter((lead) => {
        if (seen.has(lead.Email)) return false;
        seen.add(lead.Email);
        return true;
      });

    if (!leads.length) {
      return NextResponse.json({ success: false, error: 'No valid client emails found in uploaded sheet.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    await LeadList.updateMany({ userEmail, kind: WARMUP_MASTER_KIND }, { $set: { kind: 'uploaded' } });
    const list = await LeadList.create({
      userId: auth.currentUser._id || null,
      userEmail,
      name: `${fileName} - ${new Date().toLocaleString()}`,
      sourceFile: fileName,
      sourceFileName: fileName,
      project: 'warmup',
      projectId: 'warmup',
      kind: WARMUP_MASTER_KIND,
      columns,
      leads,
      uploadedAt: new Date()
    });

    const setting = await getWarmupAutoReplySetting(userEmail);
    if (!setting.workspace) setting.workspace = {};
    setting.workspace.listId = list._id;
    setting.workspace.fileName = fileName;
    setting.workspace.updatedAt = new Date();
    setting.markModified('workspace');
    await setting.save();

    return NextResponse.json({
      success: true,
      message: 'Warmup sheet saved successfully.',
      list: serializeWarmupList(list)
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to save warmup sheet.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
