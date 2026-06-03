import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';
import { activeListFilter, moveExpiredUploadsToBin } from '@/app/api/client-data/_retention';
import {
  CLIENT_DATA_COLUMNS,
  CUSTOM_LIST_KINDS,
  collectExistingEmails,
  makePastedSheetName,
  normalizeEmail,
  publicList,
  rowToLead,
  summarizeLeads
} from '../_dataCenterUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function getLeadValue(lead = {}, ...keys) {
  const data = lead?.data || {};
  for (const key of keys) {
    const direct = String(lead?.[key] ?? '').trim();
    if (direct) return direct;
    const nested = String(data?.[key] ?? '').trim();
    if (nested) return nested;
  }
  return '';
}

function mapLeadToExtractedRow(list = {}, lead = {}, index = 0) {
  return {
    _rowId: `existing-${String(list._id)}-${index}`,
    _sourceRowId: `${String(list._id)}__${index}`,
    extractedClientId: `${String(list._id)}__${index}`,
    sourceListId: String(list._id),
    sourceType: list.dataCenterMeta?.sourceType || list.kind || 'uploaded',
    fileId: list.sourceFileId || '',
    fileName: list.sourceFile || list.sourceFileName || '',
    projectId: list.projectId || '',
    projectName: list.projectName || list.project || '',
    validationStatus: lead.validationStatus || '',
    createdAt: list.createdAt || list.uploadedAt || null,
    updatedAt: list.updatedAt || null,
    name: getLeadValue(lead, 'Name', 'name'),
    surname: getLeadValue(lead, 'Surname', 'surname', 'Last Name'),
    designation: getLeadValue(lead, 'Designation', 'designation', 'Title'),
    cmpName: getLeadValue(lead, 'Company', 'company', 'Company Name', 'companyName'),
    sector: getLeadValue(lead, 'Sector', 'sector', 'Industry'),
    country: getLeadValue(lead, 'Country', 'country'),
    email: getLeadValue(lead, 'Email', 'email'),
    source: getLeadValue(lead, 'Source', 'source') || list.sourceFile || list.name || '',
    leadType: getLeadValue(lead, 'Lead Type', 'LeadType', 'leadType'),
    sourcer: getLeadValue(lead, 'Sourcer', 'sourcer'),
    userId: getLeadValue(lead, 'User ID', 'UserId', 'userId'),
    projectApproach: getLeadValue(lead, 'Project Approach', 'ProjectApproach', 'projectApproach'),
    senderId: getLeadValue(lead, 'Sender ID', 'SenderId', 'senderId')
  };
}

function applyRowPatchToLead(lead = {}, row = {}) {
  const nextLead = { ...(lead.toObject?.() || lead) };
  const mapped = rowToLead(row);
  nextLead.Name = mapped.Name;
  nextLead.Surname = mapped.Surname || '';
  nextLead.Designation = mapped.Designation || '';
  nextLead.Company = mapped.Company;
  nextLead.Sector = mapped.Sector || '';
  nextLead.Country = mapped.Country || '';
  nextLead.Email = normalizeEmail(mapped.Email);
  nextLead.validationStatus = mapped.validationStatus;
  nextLead.data = {
    ...(nextLead.data || {}),
    ...(mapped.data || {}),
    Email: nextLead.Email
  };
  return nextLead;
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
    await moveExpiredUploadsToBin(LeadList, ownerQuery);
    const lists = await LeadList.find(activeListFilter({
      ...ownerQuery,
      kind: { $nin: CUSTOM_LIST_KINDS }
    }))
      .select('name project projectId projectName sourceFile sourceFileId sourceFileName kind validationStatus dataCenterMeta columns leads uploadedAt createdAt updatedAt')
      .sort({ createdAt: -1, uploadedAt: -1 })
      .lean();

    const rows = [];
    lists.forEach((list) => {
      (list.leads || []).forEach((lead, index) => {
        if (hasMeaningfulLeadData(lead)) rows.push(mapLeadToExtractedRow(list, lead, index));
      });
    });

    return NextResponse.json({
      ok: true,
      columns: CLIENT_DATA_COLUMNS,
      rows,
      lists: lists.map(publicList)
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, rows: [], error: error.message || 'Failed to load extracted client data.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ ok: false, error: 'No extracted rows provided.' }, { status: 400 });

    const leads = rows.map(rowToLead);
    const existingEmails = await collectExistingEmails(userEmail);
    const summary = summarizeLeads(leads, existingEmails);
    const name = String(body.name || '').trim() || makePastedSheetName();
    const sourceType = String(body.sourceType || 'manual').trim() || 'manual';
    const list = await LeadList.create({
      userId: auth.currentUser?._id || null,
      userEmail,
      name,
      project: String(body.projectName || body.project || '').trim(),
      projectId: String(body.projectId || '').trim(),
      projectName: String(body.projectName || body.project || '').trim(),
      sourceFile: String(body.fileName || `${name}.manual`).trim(),
      sourceFileName: String(body.fileName || `${name}.manual`).trim(),
      kind: sourceType === 'uploaded' ? 'uploaded' : 'pasted_data',
      columns: CLIENT_DATA_COLUMNS,
      leads,
      dataCenterMeta: {
        sourceType,
        createdBy: auth.currentUser?._id || null,
        createdByEmail: userEmail,
        createdDate: new Date(),
        ...summary
      }
    });

    return NextResponse.json({ ok: true, list: publicList(list), summary });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to save extracted data.' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows.filter(hasMeaningfulLeadData) : [];
    if (!rows.length) return NextResponse.json({ ok: false, error: 'No extracted rows provided.' }, { status: 400 });

    const byList = new Map();
    const newRows = [];
    rows.forEach((row) => {
      const sourceRowId = String(row._sourceRowId || row.extractedClientId || '').trim();
      const [listId, indexToken] = sourceRowId.split('__');
      const leadIndex = Number(indexToken);
      if (mongoose.Types.ObjectId.isValid(listId) && Number.isInteger(leadIndex) && leadIndex >= 0) {
        if (!byList.has(listId)) byList.set(listId, []);
        byList.get(listId).push({ leadIndex, row });
      } else {
        newRows.push(row);
      }
    });

    let updatedRows = 0;
    for (const [listId, patches] of byList.entries()) {
      const list = await LeadList.findOne(activeListFilter(buildAuthOwnerFilter(auth, { _id: listId, kind: { $nin: CUSTOM_LIST_KINDS } })));
      if (!list) continue;
      patches.forEach(({ leadIndex, row }) => {
        if (!list.leads[leadIndex]) return;
        list.leads[leadIndex] = applyRowPatchToLead(list.leads[leadIndex], row);
        updatedRows += 1;
      });
      list.markModified('leads');
      await list.save();
    }

    let createdList = null;
    if (newRows.length) {
      const leads = newRows.map(rowToLead);
      const summary = summarizeLeads(leads, await collectExistingEmails(userEmail));
      const name = String(body.name || '').trim() || makePastedSheetName();
      createdList = await LeadList.create({
        userId: auth.currentUser?._id || null,
        userEmail,
        name,
        sourceFile: `${name}.manual`,
        sourceFileName: `${name}.manual`,
        kind: 'pasted_data',
        columns: CLIENT_DATA_COLUMNS,
        leads,
        dataCenterMeta: {
          sourceType: 'manual',
          createdBy: auth.currentUser?._id || null,
          createdByEmail: userEmail,
          createdDate: new Date(),
          ...summary
        }
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Saved ${updatedRows + newRows.length} extracted data row${updatedRows + newRows.length === 1 ? '' : 's'}.`,
      updatedRows,
      createdRows: newRows.length,
      list: createdList ? publicList(createdList) : null
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to update extracted data.' }, { status: 500 });
  }
}
