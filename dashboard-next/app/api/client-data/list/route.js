import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import Campaign from '@/models/Campaign';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';
import { activeListFilter, moveExpiredUploadsToBin } from '@/app/api/client-data/_retention';

function normalizeText(value = '') {
  return String(value ?? '').trim();
}

function getLeadValue(lead = {}, ...keys) {
  const data = lead?.data || {};
  for (const key of keys) {
    const direct = normalizeText(lead?.[key]);
    if (direct) return direct;
    const nested = normalizeText(data?.[key]);
    if (nested) return nested;
  }
  return '';
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

function buildClientRow(list = {}, lead = {}, leadIndex = 0, project = 'unassigned') {
  const email = getLeadValue(lead, 'Email', 'email');
  const leadSource = getLeadValue(lead, 'Source', 'source');
  const leadAddedDate = getLeadValue(lead, 'List Added Date', 'ListAddedDate', 'listAddedDate');
  return {
    id: `${String(list?._id || '')}__${leadIndex}`,
    sourceListId: String(list?._id || ''),
    leadIndex,
    sourceFile: String(list?.sourceFile || list?.name || ''),
    name: getLeadValue(lead, 'Name', 'name') || '-',
    surname: getLeadValue(lead, 'Surname', 'surname', 'Last Name', 'lastName') || '-',
    designation: getLeadValue(lead, 'Designation', 'designation', 'Title', 'title') || '-',
    cmpName: getLeadValue(lead, 'Company', 'company', 'Company Name', 'companyName') || '-',
    sector: getLeadValue(lead, 'Sector', 'sector', 'Industry', 'industry') || '-',
    country: getLeadValue(lead, 'Country', 'country') || '-',
    email: email || '-',
    listAddedDateRaw: leadAddedDate || lead?.uploadDate || list?.uploadedAt || list?.uploadDate || list?.createdAt || null,
    source: leadSource || String(list?.sourceFile || list?.name || 'Uploaded File'),
    project,
    leadType: getLeadValue(lead, 'Lead Type', 'LeadType', 'leadType') || '-',
    sourcer: getLeadValue(lead, 'Sourcer', 'sourcer', 'Source By', 'sourceBy') || '-',
    userId: getLeadValue(lead, 'User ID', 'UserId', 'userId') || '-',
    projectApproach: getLeadValue(lead, 'Project Approach', 'projectApproach', 'Approach', 'approach', 'Used In Project', 'UsedInProject', 'usedInProject') || '-',
    senderId: getLeadValue(lead, 'Sender ID', 'SenderId', 'senderId') || '-',
    status: normalizeText(lead?.status) || 'Pending'
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

    const [lists, campaignDocs] = await Promise.all([
      LeadList.find(query).select(projection).sort({ createdAt: -1 }).lean(),
      Campaign.find(buildAuthOwnerFilter(auth))
        .select('listId project projectId projectName senderFrom senderAccount.from senderAccount.user createdAt')
        .sort({ createdAt: -1 })
        .lean()
    ]);
    const campaignsByListId = campaignDocs.reduce((map, campaign) => {
      const listId = String(campaign?.listId || '');
      if (!listId) return map;
      if (!map.has(listId)) map.set(listId, []);
      map.get(listId).push(campaign);
      return map;
    }, new Map());
    const rows = [];
    const scopedLists = requestedProject ? lists.filter((list) => listProjectKey(list, campaignsByListId) === requestedProject) : lists;
    for (const list of scopedLists) {
      const leads = Array.isArray(list?.leads) ? list.leads : [];
      const project = listProjectKey(list, campaignsByListId);
      leads.forEach((lead, index) => {
        if (hasMeaningfulLeadData(lead)) {
          rows.push(buildClientRow(list, lead, index, project));
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
        leadCount: Array.isArray(list.leads) ? list.leads.filter(hasMeaningfulLeadData).length : 0
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, rows: [], lists: [], error: error.message || 'Failed to load client data' });
  }
}
