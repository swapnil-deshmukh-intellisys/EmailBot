import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';

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

function buildClientRow(list = {}, lead = {}, leadIndex = 0) {
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

    const query = buildAuthOwnerFilter(auth);

    const projection = [
      'name',
      'sourceFile',
      'kind',
      'uploadedAt',
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

    const lists = await LeadList.find(query).select(projection).sort({ createdAt: -1 }).lean();
    const rows = [];
    for (const list of lists) {
      const leads = Array.isArray(list?.leads) ? list.leads : [];
      leads.forEach((lead, index) => {
        if (hasMeaningfulLeadData(lead)) {
          rows.push(buildClientRow(list, lead, index));
        }
      });
    }

    return NextResponse.json({
      ok: true,
      rows,
      lists: lists.map((list) => ({
        _id: String(list._id),
        name: list.name,
        sourceFile: list.sourceFile,
        kind: list.kind || 'uploaded',
        uploadedAt: list.uploadedAt || null,
        createdAt: list.createdAt || null,
        leadCount: Array.isArray(list.leads) ? list.leads.filter(hasMeaningfulLeadData).length : 0
      }))
    });
  } catch (error) {
    return NextResponse.json({ ok: false, rows: [], lists: [], error: error.message || 'Failed to load client data' });
  }
}
