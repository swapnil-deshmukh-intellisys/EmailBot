import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';
import { activeListFilter } from '@/app/api/client-data/_retention';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

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

const REVIEW_FIELD_CANDIDATES = [
  ['Name', ['Name', 'name', 'First Name', 'firstName']],
  ['Surname', ['Surname', 'surname', 'Last Name', 'lastName']],
  ['Designation', ['Designation', 'designation', 'Title', 'title']],
  ['Company', ['Company', 'company', 'CMP Name', 'cmpName', 'Company Name', 'companyName']],
  ['Company Name', ['Company Name', 'companyName', 'CMP Name', 'cmpName', 'Company', 'company']],
  ['Email', ['Email', 'email']],
  ['Phone', ['Phone', 'phone', 'Mobile', 'mobile']],
  ['Domain', ['Domain', 'domain', 'Website', 'website']],
  ['Sector', ['Sector', 'sector', 'Industry', 'industry']],
  ['Country', ['Country', 'country']],
  ['List Added Date', ['List Added Date', 'listAddedDate', 'Added Date', 'Date', 'Upload Date']],
  ['Source', ['Source', 'source']],
  ['Lead Type', ['Lead Type', 'LeadType', 'leadType']],
  ['Sourcer', ['Sourcer', 'sourcer']],
  ['User ID', ['User ID', 'UserId', 'userId']],
  ['Project Approach', ['Project Approach', 'ProjectApproach', 'projectApproach']],
  ['Sender ID', ['Sender ID', 'SenderId', 'senderId']]
];

const INTERNAL_LEAD_KEYS = new Set([
  '_id',
  'id',
  'data',
  'status',
  'dedupe',
  'createdAt',
  'updatedAt',
  'sentAt',
  'openedAt',
  'clickedAt',
  'repliedAt',
  'failedAt',
  'messageId',
  'campaignId',
  'lastError',
  'error',
  'attempts'
]);

function firstPresent(source = {}, data = {}, keys = []) {
  for (const key of keys) {
    const value = source?.[key] ?? data?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
}

function normalizeLeadForReview(lead = {}, columns = []) {
  const source = lead && typeof lead === 'object' ? lead : {};
  const data = source.data && typeof source.data === 'object' && !Array.isArray(source.data) ? source.data : {};
  const reviewData = { ...data };

  columns.forEach((column) => {
    const key = String(column || '').trim();
    if (!key || String(reviewData[key] ?? '').trim()) return;
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim()) reviewData[key] = value;
  });

  Object.entries(source).forEach(([key, value]) => {
    if (INTERNAL_LEAD_KEYS.has(key) || String(reviewData[key] ?? '').trim()) return;
    if (value !== undefined && value !== null && typeof value !== 'object' && String(value).trim()) {
      reviewData[key] = value;
    }
  });

  REVIEW_FIELD_CANDIDATES.forEach(([target, keys]) => {
    if (String(reviewData[target] ?? '').trim()) return;
    const value = firstPresent(source, data, keys);
    if (value !== '') reviewData[target] = value;
  });

  return {
    ...source,
    data: reviewData
  };
}

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const query = activeListFilter(buildAuthOwnerFilter(auth, { _id: params.id }));
    const list = await LeadList.findOne(query).lean();
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404, headers: NO_STORE_HEADERS });
    }

    const leads = Array.isArray(list.leads)
      ? list.leads.filter(hasMeaningfulLeadData).map((lead) => normalizeLeadForReview(lead, list.columns || []))
      : [];

    return NextResponse.json({
      _id: String(list._id),
      name: list.name,
      sourceFile: list.sourceFile,
      uploadedAt: list.uploadedAt || null,
      uploadDate: list.uploadDate || null,
      createdAt: list.createdAt || null,
      columns: list.columns || [],
      sheetStyle: list.sheetStyle || {},
      leads
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (String(process.env.DEV_DEMO_DATA || '').trim().toLowerCase() === 'true' && String(params?.id || '') === 'demo-list-1') {
      return NextResponse.json({
        _id: 'demo-list-1',
        name: 'Demo Leads',
        sourceFile: 'demo.xlsx',
        columns: ['Name', 'Email', 'Company'],
        sheetStyle: {},
        leads: [
          { Name: 'John Doe', Email: 'john@example.com', Company: 'Acme', status: 'Sent', data: { Name: 'John Doe', Email: 'john@example.com', Company: 'Acme' } },
          { Name: 'Jane Smith', Email: 'jane@example.com', Company: 'Globex', status: 'Pending', data: { Name: 'Jane Smith', Email: 'jane@example.com', Company: 'Globex' } }
        ],
        error: error.message || 'Failed to load list'
      }, { headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: error.message || 'Failed to load list' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function PATCH(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  await connectDB();

  const query = activeListFilter(buildAuthOwnerFilter(auth, { _id: params.id }));
  const list = await LeadList.findOne(query);
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const body = await req.json();
  const nextName = String(body?.name || '').trim();
  const rows = Array.isArray(body.rows) ? body.rows : null;
  const columns = Array.isArray(body.columns) ? body.columns.map((c) => String(c || '').trim()).filter(Boolean) : null;
  const sheetStyle = body.sheetStyle && typeof body.sheetStyle === 'object' ? body.sheetStyle : null;
  const resetStatus = Boolean(body.resetStatus);

  // Metadata-only update: allow sheet renaming without requiring full rows payload.
  if (!rows && nextName) {
    list.name = nextName;
    await list.save();
    return NextResponse.json({ ok: true, name: list.name }, { headers: NO_STORE_HEADERS });
  }

  if (!rows) {
    return NextResponse.json({ error: 'rows are required (or provide a sheet name to rename)' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  if (nextName) {
    list.name = nextName;
  }

  list.columns = columns || list.columns || [];
  if (sheetStyle) {
    list.sheetStyle = {
      ...list.sheetStyle?.toObject?.(),
      ...sheetStyle,
      columnWidths: {
        ...(list.sheetStyle?.columnWidths || {}),
        ...(sheetStyle.columnWidths || {})
      }
    };
  }
  const seenEmails = new Set();
  list.leads = rows.filter(hasMeaningfulLeadData).reduce((acc, row, index) => {
    const data = Object.fromEntries(
      Object.entries(row || {}).map(([key, value]) => [String(key || '').trim(), value ?? ''])
    );
    const email = normalizeEmail(data.Email || data.email || '');
    if (!email || seenEmails.has(email)) {
      return acc;
    }
    seenEmails.add(email);

    const previousLead = list.leads[index] || {};
    acc.push({
      ...previousLead.toObject?.(),
      Name: data.Name || data.name || '',
      Email: email,
      Company: data.Company || data.company || '',
      data: {
        ...data,
        Email: email
      },
      status: resetStatus ? 'Pending' : (previousLead.status || 'Pending'),
      error: resetStatus ? '' : (previousLead.error || ''),
      sentAt: resetStatus ? null : (previousLead.sentAt || null),
      failedAt: resetStatus ? null : (previousLead.failedAt || null)
    });
    return acc;
  }, []);

  await list.save();

  return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

export async function DELETE(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  await connectDB();
  const query = activeListFilter(buildAuthOwnerFilter(auth, { _id: params.id }));
  const deleted = await LeadList.findOneAndUpdate(
    query,
    {
      $set: {
        deletedAt: new Date(),
        deleteReason: 'Deleted by user',
        originalKind: 'custom'
      }
    },
    { new: true }
  );
  if (!deleted) {
    return NextResponse.json({ error: 'List not found' }, { status: 404, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ ok: true, deletedId: String(params.id) }, { headers: NO_STORE_HEADERS });
}
