import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import Campaign from '@/models/Campaign';
import ClientSheet from '@/models/ClientSheet';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';
import { activeListFilter, moveExpiredUploadsToBin } from '@/app/api/client-data/_retention';

function normalizeText(value = '') {
  return String(value ?? '').trim();
}

function getLeadValue(lead = {}, ...keys) {
  const data = lead?.data || {};
  const rawData = lead?.rawData || {};
  for (const key of keys) {
    const direct = normalizeText(lead?.[key]);
    if (direct) return direct;
    const nested = normalizeText(data?.[key]);
    if (nested) return nested;
    const raw = normalizeText(rawData?.[key]);
    if (raw) return raw;
  }
  return '';
}

function formatDateOnly(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeProject(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('tut') || raw.includes('unicorn') || raw.includes('theunicorntimes.com')) return 'tut';
  if (raw.includes('tec') || raw.includes('entrepreneurial') || raw.includes('theentrepreneurialchronicle.com')) return 'tec';
  return raw || 'unassigned';
}

function campaignProjectKey(campaign = {}) {
  return normalizeProject([
    campaign.project,
    campaign.projectId,
    campaign.projectName,
    campaign.senderFrom,
    campaign.senderAccount?.from,
    campaign.senderAccount?.user
  ].filter(Boolean).join(' '));
}

function listProjectKey(list = {}, campaignsByListId = new Map()) {
  const explicit = normalizeProject([list.project, list.projectId, list.projectName].filter(Boolean).join(' '));
  if (explicit === 'tec' || explicit === 'tut') return explicit;

  const campaigns = campaignsByListId.get(String(list._id)) || [];
  const counts = campaigns.reduce((acc, campaign) => {
    const key = campaignProjectKey(campaign);
    if (key === 'tec' || key === 'tut') acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  if (counts.tec || counts.tut) {
    return Number(counts.tec || 0) >= Number(counts.tut || 0) ? 'tec' : 'tut';
  }

  const fromListText = normalizeProject(`${list.name || ''} ${list.sourceFile || ''} ${list.sourceFileName || ''}`);
  return fromListText === 'tec' || fromListText === 'tut' ? fromListText : 'unassigned';
}

function buildClientRow(list = {}, lead = {}, leadIndex = 0, project = 'unassigned', campaigns = []) {
  const email = getLeadValue(lead, 'Email', 'email');
  const leadSource = getLeadValue(lead, 'Source', 'source', 'Source File', 'sourceFile');
  const leadAddedDate = getLeadValue(lead, 'List Added Date', 'ListAddedDate', 'listAddedDate', 'Date', 'date');
  const listAddedDateRaw = leadAddedDate || lead?.uploadDate || list?.uploadedAt || list?.uploadDate || list?.createdAt || null;
  return {
    id: `${String(list?._id || '')}__${leadIndex}`,
    sourceListId: String(list?._id || ''),
    sheetName: String(list?.name || list?.sourceFile || 'Unknown Sheet'),
    leadIndex,
    sourceFile: String(list?.sourceFile || list?.name || ''),
    name: getLeadValue(lead, 'Name', 'name', 'First Name', 'firstName') || '-',
    surname: getLeadValue(lead, 'Surname', 'surname', 'Last Name', 'lastName') || '-',
    designation: getLeadValue(lead, 'Designation', 'designation', 'Title', 'title') || '-',
    cmpName: getLeadValue(lead, 'Company', 'company', 'Company Name', 'companyName', 'Cmp Name', 'CMP Name', 'cmpName') || '-',
    sector: getLeadValue(lead, 'Sector', 'sector', 'Industry', 'industry') || '-',
    country: getLeadValue(lead, 'Country', 'country') || '-',
    email: email || '-',
    listAddedDate: formatDateOnly(listAddedDateRaw),
    listAddedDateRaw,
    source: leadSource || String(list?.sourceFile || list?.name || 'Uploaded File'),
    project,
    leadType: getLeadValue(lead, 'Lead Type', 'LeadType', 'leadType') || '-',
    sourcer: getLeadValue(lead, 'Sourcer', 'sourcer', 'Source By', 'sourceBy') || '-',
    userId: getLeadValue(lead, 'User ID', 'UserId', 'userId', 'userIdText') || '-',
    projectApproach: getLeadValue(lead, 'Project Approach', 'ProjectApproach', 'projectApproach', 'Approach', 'approach', 'Used In Project', 'UsedInProject', 'usedInProject') || '-',
    senderId: getLeadValue(lead, 'Sender ID', 'SenderId', 'senderId') || '-',
    status: normalizeText(lead?.status) || 'Pending'
  };
}

function recordStatus(record = {}) {
  if (record.isInvalid) return 'Missing Email';
  if (normalizeText(record.status) && normalizeText(record.status) !== 'Pending') return normalizeText(record.status);
  return normalizeText(record.email) ? 'Verified' : 'Missing Email';
}

function buildRecordRow(sheet = {}, record = {}, project = 'unassigned', campaigns = []) {
  const sourceListId = String(sheet.sourceListId || '');
  const sheetId = String(sheet._id || '');
  const listAddedDateRaw = record.listAddedDate || record.createdAt || sheet.createdAt || null;
  return {
    id: `record:${String(record._id || record.id || '')}`,
    recordId: String(record._id || record.id || ''),
    sourceListId: sourceListId || `sheet:${sheetId}`,
    sheetId,
    sheetName: String(sheet.sheetName || sheet.name || sheet.originalFileName || 'Client Sheet'),
    leadIndex: Number(record.rowIndex || 0),
    sourceFile: String(sheet.originalFileName || record.source || sheet.sheetName || ''),
    name: normalizeText(record.name) || getLeadValue(record, 'Name', 'name', 'First Name', 'firstName') || '-',
    surname: normalizeText(record.surname) || getLeadValue(record, 'Surname', 'surname', 'Last Name', 'lastName') || '-',
    designation: normalizeText(record.designation) || getLeadValue(record, 'Designation', 'designation', 'Title', 'title') || '-',
    cmpName: normalizeText(record.companyName) || getLeadValue(record, 'Company', 'company', 'Company Name', 'companyName', 'Cmp Name', 'CMP Name', 'cmpName') || '-',
    sector: normalizeText(record.sector) || getLeadValue(record, 'Sector', 'sector', 'Industry', 'industry') || '-',
    country: normalizeText(record.country) || getLeadValue(record, 'Country', 'country') || '-',
    email: normalizeText(record.email).toLowerCase() || getLeadValue(record, 'Email', 'email') || '-',
    listAddedDate: formatDateOnly(listAddedDateRaw),
    listAddedDateRaw,
    source: normalizeText(record.source) || String(sheet.originalFileName || sheet.sheetName || 'Uploaded File'),
    project,
    leadType: normalizeText(record.leadType) || getLeadValue(record, 'Lead Type', 'LeadType', 'leadType') || '-',
    sourcer: normalizeText(record.sourcer) || getLeadValue(record, 'Sourcer', 'sourcer', 'Source By', 'sourceBy') || '-',
    userId: normalizeText(record.userIdText) || getLeadValue(record, 'User ID', 'UserId', 'userId', 'userIdText') || '-',
    projectApproach: normalizeText(record.projectApproach) || getLeadValue(record, 'Project Approach', 'ProjectApproach', 'projectApproach', 'Approach', 'approach', 'Used In Project', 'UsedInProject', 'usedInProject') || '-',
    senderId: normalizeText(record.senderId) || getLeadValue(record, 'Sender ID', 'SenderId', 'senderId') || '-',
    freshLead: !record.contactedCount && !record.lastContactedAt,
    status: recordStatus(record)
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
    await moveExpiredUploadsToBin(LeadList, ownerQuery);
    const url = new URL(req.url);
    const requestedProject = normalizeProject(url.searchParams.get('project') || '');
    const query = activeListFilter(ownerQuery);

    const projection = [
      'name',
      'sourceFile',
      'kind',
      'project',
      'projectId',
      'projectName',
      'uploadedAt',
      'autoDeleteAt',
      'createdAt',
      'uploadDate',
      'leads.Name',
      'leads.Surname',
      'leads.Email',
      'leads.Company',
      'leads.Designation',
      'leads.Sector',
      'leads.Country',
      'leads.uploadDate',
      'leads.status',
      'leads.sentAt',
      'leads.failedAt',
      'leads.data'
    ].join(' ');

    const [lists, campaignDocs, clientSheets] = await Promise.all([
      LeadList.find(query).select(projection).sort({ createdAt: -1 }).lean(),
      Campaign.find(buildAuthOwnerFilter(auth))
        .select('listId project projectId projectName senderFrom senderAccount.from senderAccount.user createdAt')
        .sort({ createdAt: -1 })
        .lean(),
      ClientSheet.find(buildAuthOwnerFilter(auth, { deletedAt: null }))
        .select('sheetName originalFileName sourceListId project projectId kind totalRows freshCount repeatedCount invalidCount createdAt updatedAt')
        .sort({ updatedAt: -1, createdAt: -1 })
        .lean()
    ]);
    const campaignsByListId = campaignDocs.reduce((map, campaign) => {
      const listId = String(campaign?.listId || '');
      if (!listId) return map;
      if (!map.has(listId)) map.set(listId, []);
      map.get(listId).push(campaign);
      return map;
    }, new Map());
    const scopedLists = requestedProject ? lists.filter((list) => listProjectKey(list, campaignsByListId) === requestedProject) : lists;
    const scopedSheets = requestedProject
      ? clientSheets.filter((sheet) => normalizeProject(sheet.project || sheet.projectId || '') === requestedProject)
      : clientSheets;
    const rows = [];
    const sheetIds = scopedSheets.map((sheet) => sheet._id).filter(Boolean);
    const records = sheetIds.length
      ? await ClientRecord.find({
        ...buildAuthOwnerFilter(auth),
        sheetId: { $in: sheetIds },
        deletedAt: null
      })
        .sort({ rowIndex: 1, createdAt: 1 })
        .lean()
      : [];
    const recordsBySheetId = records.reduce((map, record) => {
      const sheetId = String(record.sheetId || '');
      if (!sheetId) return map;
      if (!map.has(sheetId)) map.set(sheetId, []);
      map.get(sheetId).push(record);
      return map;
    }, new Map());
    const nativeSourceListIdsWithRecords = new Set();

    scopedSheets.forEach((sheet) => {
      const sheetRecords = recordsBySheetId.get(String(sheet._id)) || [];
      if (!sheetRecords.length) return;
      const sourceListId = String(sheet.sourceListId || '');
      if (sourceListId) nativeSourceListIdsWithRecords.add(sourceListId);
      const project = normalizeProject(sheet.project || sheet.projectId || '');
      const listCampaigns = sourceListId ? campaignsByListId.get(sourceListId) || [] : [];
      sheetRecords.forEach((record) => {
        rows.push(buildRecordRow(sheet, record, project || 'unassigned', listCampaigns));
      });
    });

    for (const list of scopedLists) {
      if (nativeSourceListIdsWithRecords.has(String(list._id))) continue;
      const leads = Array.isArray(list?.leads) ? list.leads : [];
      const project = listProjectKey(list, campaignsByListId);
      const listCampaigns = campaignsByListId.get(String(list._id)) || [];
      leads.forEach((lead, index) => {
        if (hasMeaningfulLeadData(lead)) {
          rows.push(buildClientRow(list, lead, index, project, listCampaigns));
        }
      });
    }

    return NextResponse.json({
      ok: true,
      rows,
      lists: scopedLists.map((list) => ({
        _id: String(list._id),
        name: list.name,
        sourceFile: list.sourceFile,
        kind: list.kind || 'uploaded',
        project: listProjectKey(list, campaignsByListId),
        uploadedAt: list.uploadedAt || null,
        createdAt: list.createdAt || null,
        autoDeleteAt: list.autoDeleteAt || null,
        leadCount: rows.filter((row) => String(row.sourceListId || '') === String(list._id)).length || (Array.isArray(list.leads) ? list.leads.filter(hasMeaningfulLeadData).length : 0)
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, rows: [], lists: [], error: error.message || 'Failed to load client data' });
  }
}
