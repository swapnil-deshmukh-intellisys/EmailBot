import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function normalizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizeEmail(value = '') {
  return normalizeText(value).split(/[;,/]/)[0].toLowerCase();
}

function getLeadValue(lead = {}, ...keys) {
  const data = lead?.data && typeof lead.data === 'object' ? lead.data : {};
  for (const key of keys) {
    const direct = normalizeText(lead?.[key]);
    if (direct) return direct;
    const nested = normalizeText(data?.[key]);
    if (nested) return nested;
  }
  return '';
}

function formatDateOnly(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function storedCampaignName(list = {}) {
  const meta = list.dataCenterMeta && typeof list.dataCenterMeta === 'object' ? list.dataCenterMeta : {};
  const rawHistory = Array.isArray(meta.campaignHistory) ? meta.campaignHistory : [];
  const latest = rawHistory[rawHistory.length - 1];
  if (typeof latest === 'string') return normalizeText(latest);
  return normalizeText(latest?.name || latest?.campaignName || meta.campaignName || list.campaignPurpose) || '-';
}

function buildStoredClientRow(list = {}, lead = {}, leadIndex = 0) {
  const email = normalizeEmail(getLeadValue(lead, 'Email', 'email'));
  const listAddedDateRaw =
    getLeadValue(lead, 'List Added Date', 'ListAddedDate', 'listAddedDate', 'Date', 'date') ||
    lead?.uploadDate ||
    list?.uploadedAt ||
    list?.uploadDate ||
    list?.createdAt ||
    null;
  const sentAt = lead?.sentAt || null;

  return {
    id: `${String(list?._id || '')}__${leadIndex}`,
    sourceListId: String(list?._id || ''),
    leadIndex,
    name: getLeadValue(lead, 'Name', 'name', 'First Name', 'firstName') || '-',
    surname: getLeadValue(lead, 'Surname', 'surname', 'Last Name', 'lastName') || '-',
    designation: getLeadValue(lead, 'Designation', 'designation', 'Title', 'title') || '-',
    cmpName: getLeadValue(lead, 'Company', 'company', 'Company Name', 'companyName', 'Cmp Name', 'CMP Name', 'cmpName') || '-',
    sector: getLeadValue(lead, 'Sector', 'sector', 'Industry', 'industry') || '-',
    country: getLeadValue(lead, 'Country', 'country') || '-',
    email: email || '-',
    listAddedDate: formatDateOnly(listAddedDateRaw),
    listAddedDateRaw,
    source: getLeadValue(lead, 'Source', 'source') || normalizeText(list.sourceFile || list.name) || '-',
    leadType: getLeadValue(lead, 'Lead Type', 'LeadType', 'leadType') || '-',
    sourcer: getLeadValue(lead, 'Sourcer', 'sourcer', 'Source By', 'sourceBy') || '-',
    userId: getLeadValue(lead, 'User ID', 'UserId', 'userId', 'userIdText') || normalizeText(list.createdBy || list.userEmail) || '-',
    projectApproach: getLeadValue(lead, 'Project Approach', 'ProjectApproach', 'projectApproach', 'Approach', 'approach', 'Used In Project', 'UsedInProject', 'usedInProject') || '-',
    senderId: getLeadValue(lead, 'Sender ID', 'SenderId', 'senderId') || '-',
    campaignName: normalizeText(lead?.thread?.campaignName) || storedCampaignName(list),
    mailStatus: normalizeText(lead?.status) || 'Pending',
    mailSentAt: sentAt ? new Date(sentAt).toISOString() : '',
    freshLead: !sentAt
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
    const lists = await LeadList.find({
      $and: [
        ownerQuery,
        { kind: { $nin: ['paste_workspace', 'custom', 'selected_client_sheet', 'custom_client_list'] } }
      ]
    })
      .select([
        'name',
        'sourceFile',
        'sourceFileName',
        'userEmail',
        'createdBy',
        'kind',
        'campaignPurpose',
        'dataCenterMeta',
        'uploadedAt',
        'createdAt',
        'uploadDate',
        'deletedAt',
        'leads'
      ].join(' '))
      .sort({ createdAt: 1, uploadedAt: 1 })
      .lean();

    const rows = [];
    lists.forEach((list) => {
      const leads = Array.isArray(list.leads) ? list.leads : [];
      leads.forEach((lead, index) => {
        if (hasMeaningfulLeadData(lead)) rows.push(buildStoredClientRow(list, lead, index));
      });
    });

    return NextResponse.json({
      ok: true,
      rows,
      lists: lists.map((list) => ({
        _id: String(list._id),
        name: list.name,
        sourceFile: list.sourceFile,
        kind: list.kind || 'uploaded',
        uploadedAt: list.uploadedAt || list.createdAt || null,
        createdAt: list.createdAt || null,
        leadCount: rows.filter((row) => row.sourceListId === String(list._id)).length
      }))
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, rows: [], lists: [], error: error.message || 'Failed to load permanent client list' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
