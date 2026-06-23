import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import Campaign from '@/models/Campaign';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
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
  
  // Normalize lead keys for case-insensitive lookup
  const normalizedLead = {};
  for (const [k, v] of Object.entries(lead)) {
    if (k === 'data') continue;
    normalizedLead[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = v;
  }

  // Normalize nested data keys for case-insensitive lookup
  const normalizedData = {};
  for (const [k, v] of Object.entries(data)) {
    normalizedData[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = v;
  }

  for (const key of keys) {
    const searchKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Check direct properties first
    if (searchKey in normalizedLead) {
      const val = normalizeText(normalizedLead[searchKey]);
      if (val) return val;
    }
    
    // Check nested data properties
    if (searchKey in normalizedData) {
      const val = normalizeText(normalizedData[searchKey]);
      if (val) return val;
    }
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

function buildStoredClientRow(list = {}, lead = {}, leadIndex = 0, campaignByListId = {}, logMapByEmailAndList = {}) {
  const email = normalizeEmail(getLeadValue(lead, 'Email', 'email', 'Email Address', 'emailaddress'));
  const emailKey = email.toLowerCase().trim();
  const listIdStr = String(list?._id || '');

  // Find campaign and logs
  const campaign = campaignByListId[listIdStr];
  const log = emailKey ? logMapByEmailAndList[emailKey]?.[listIdStr] : null;

  let campaignName = '-';
  let mailStatus = 'Pending';
  let mailSentAt = '';

  if (log) {
    campaignName = log.campaignName || campaign?.name || '-';
    mailStatus = log.status || 'Pending';
    mailSentAt = log.lastSentAt ? new Date(log.lastSentAt).toISOString() : (log.updatedAt ? new Date(log.updatedAt).toISOString() : '');
  } else if (campaign) {
    campaignName = campaign.name || '-';
    mailStatus = campaign.status || 'Pending';
    mailSentAt = campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString() : '';
  } else {
    // Fallback
    campaignName = normalizeText(lead?.thread?.campaignName) || storedCampaignName(list);
    mailStatus = normalizeText(lead?.status) || 'Pending';
    const sentAt = lead?.sentAt || null;
    mailSentAt = sentAt ? new Date(sentAt).toISOString() : '';
  }

  const listAddedDateRaw =
    getLeadValue(lead, 'List Added Date', 'ListAddedDate', 'listAddedDate', 'Date', 'date') ||
    lead?.uploadDate ||
    list?.uploadedAt ||
    list?.uploadDate ||
    list?.createdAt ||
    null;

  return {
    id: `${listIdStr}__${leadIndex}`,
    sourceListId: listIdStr,
    leadIndex,
    name: getLeadValue(lead, 'Name', 'name', 'First Name', 'firstName', 'Client Name', 'clientName') || '-',
    surname: getLeadValue(lead, 'Surname', 'surname', 'Last Name', 'lastName') || '-',
    designation: getLeadValue(lead, 'Designation', 'designation', 'Title', 'title', 'Job Title', 'jobTitle') || '-',
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
    projectApproach: getLeadValue(lead, 'Project Approach', 'ProjectApproach', 'projectApproach', 'Approach', 'approach', 'Used In Project', 'UsedInProject', 'usedInProject', 'Project', 'project') || '-',
    senderId: getLeadValue(lead, 'Sender ID', 'SenderId', 'senderId') || '-',
    campaignName,
    mailStatus,
    mailSentAt,
    freshLead: !mailSentAt
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);

    // Fetch campaigns and logs to enrich client campaign info
    const [campaigns, logs] = await Promise.all([
      Campaign.find(ownerQuery).lean(),
      CampaignRecipientLog.find(ownerQuery).lean()
    ]);

    const campaignById = {};
    const campaignByListId = {};
    campaigns.forEach((c) => {
      campaignById[String(c._id)] = c;
      if (c.listId) {
        campaignByListId[String(c.listId)] = c;
      }
    });

    const logMapByEmailAndList = {};
    logs.forEach((log) => {
      const emailKey = String(log.email || '').toLowerCase().trim();
      if (!emailKey) return;
      const camp = campaignById[String(log.campaignId)];
      if (camp && camp.listId) {
        const listIdStr = String(camp.listId);
        if (!logMapByEmailAndList[emailKey]) {
          logMapByEmailAndList[emailKey] = {};
        }
        logMapByEmailAndList[emailKey][listIdStr] = log;
      }
    });

    // 2 Months ago threshold for filtering recent lists/leads
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const lists = await LeadList.find({
      $and: [
        ownerQuery,
        { kind: { $ne: 'paste_workspace' } },
        {
          $or: [
            { createdAt: { $gte: twoMonthsAgo } },
            { uploadedAt: { $gte: twoMonthsAgo } },
            { uploadDate: { $gte: twoMonthsAgo } }
          ]
        }
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
      .sort({ createdAt: -1, uploadedAt: -1 })
      .lean();

    const rows = [];
    lists.forEach((list) => {
      const leads = Array.isArray(list.leads) ? list.leads : [];
      leads.forEach((lead, index) => {
        if (hasMeaningfulLeadData(lead)) {
          const row = buildStoredClientRow(list, lead, index, campaignByListId, logMapByEmailAndList);
          
          // Verify listAddedDateRaw meets 2-month threshold too (if it exists)
          const rowTime = row.listAddedDateRaw ? new Date(row.listAddedDateRaw).getTime() : 0;
          if (rowTime >= twoMonthsAgo.getTime() || !row.listAddedDateRaw) {
            rows.push(row);
          }
        }
      });
    });

    // Sort final rows so latest listAddedDate is first
    rows.sort((a, b) => {
      const dateA = a.listAddedDateRaw ? new Date(a.listAddedDateRaw).getTime() : 0;
      const dateB = b.listAddedDateRaw ? new Date(b.listAddedDateRaw).getTime() : 0;
      return dateB - dateA;
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
