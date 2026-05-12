import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { mapRawRowToLead } from '@/core-lib/client-data-config/UploadSheetValidation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value = '') {
  return String(value || '').replace(/[^\d+]/g, '');
}

function normalizeLinkedIn(value = '') {
  return normalize(value).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function leadValue(lead = {}, key = '') {
  return lead?.[key] || lead?.data?.[key] || lead?.data?.[key.charAt(0).toLowerCase() + key.slice(1)] || '';
}

function buildExistingRow(list, lead, index) {
  return {
    sourceListId: String(list._id),
    sourceListName: list.name || '',
    sourceFile: list.sourceFile || list.name || '',
    uploadedAt: list.uploadedAt || list.createdAt || null,
    leadIndex: index,
    name: leadValue(lead, 'Name'),
    email: leadValue(lead, 'Email'),
    phone: leadValue(lead, 'Phone'),
    linkedinUrl: leadValue(lead, 'LinkedInUrl') || leadValue(lead, 'linkedinUrl'),
    companyName: leadValue(lead, 'Company')
  };
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : [];

    await connectDB();
    const lists = await LeadList.find(buildAuthOwnerFilter(auth))
      .select('name sourceFile uploadedAt createdAt leads.Name leads.Email leads.Phone leads.Company leads.linkedinUrl leads.data')
      .sort({ createdAt: -1 })
      .lean();

    const existing = [];
    lists.forEach((list) => {
      (list.leads || []).forEach((lead, index) => existing.push(buildExistingRow(list, lead, index)));
    });

    const matches = rows.map((row, rowIndex) => {
      const mapped = mapRawRowToLead(row);
      const email = normalize(mapped.Email);
      const phone = normalizePhone(mapped.Phone);
      const linkedinUrl = normalizeLinkedIn(mapped.LinkedInUrl || mapped.linkedinUrl || row.linkedinUrl || row.LinkedInUrl || row.LinkedIn);
      const companyName = normalize(mapped.Company);
      const rowMatches = existing
        .map((oldRow) => {
          const reasons = [];
          if (email && normalize(oldRow.email) === email) reasons.push('email');
          if (phone && normalizePhone(oldRow.phone) === phone) reasons.push('phone');
          if (linkedinUrl && normalizeLinkedIn(oldRow.linkedinUrl) === linkedinUrl) reasons.push('linkedinUrl');
          if (companyName && normalize(oldRow.companyName) === companyName) reasons.push('companyName');
          return reasons.length ? { reasons, existing: oldRow } : null;
        })
        .filter(Boolean);
      return {
        rowNumber: Number(row.rowNumber || rowIndex + 1),
        incoming: {
          name: mapped.Name,
          email: mapped.Email,
          phone: mapped.Phone,
          linkedinUrl: mapped.LinkedInUrl || mapped.linkedinUrl || '',
          companyName: mapped.Company
        },
        matches: rowMatches
      };
    }).filter((item) => item.matches.length);

    return NextResponse.json({ ok: true, matches, duplicateCount: matches.length }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, matches: [], duplicateCount: 0, error: error.message || 'Failed to check duplicates' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
