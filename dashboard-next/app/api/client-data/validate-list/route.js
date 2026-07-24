import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter } from '@/app/api/client-data/_retention';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const REQUIRED_FIELDS = ['Name', 'Email', 'Company Name', 'Country', 'Sector'];

function valueFrom(row = {}, keys = []) {
  for (const key of keys) {
    const value = row?.[key] ?? row?.data?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function rowToReviewData(lead = {}) {
  const data = lead?.data && typeof lead.data === 'object' ? lead.data : {};
  const company = valueFrom(lead, ['Company Name', 'companyName', 'cmpName', 'Company', 'company']);
  return {
    Name: valueFrom(lead, ['Name', 'name', 'First Name', 'firstName']),
    Surname: valueFrom(lead, ['Surname', 'surname', 'Last Name', 'lastName']),
    Designation: valueFrom(lead, ['Designation', 'designation', 'Title', 'title']),
    'Company Name': company,
    Email: valueFrom(lead, ['Email', 'email']).toLowerCase(),
    Country: valueFrom(lead, ['Country', 'country']),
    Sector: valueFrom(lead, ['Sector', 'sector', 'Industry', 'industry']),
    Source: valueFrom(lead, ['Source', 'source']),
    ...data
  };
}

function validateRows(rows = []) {
  const normalizedRows = rows.map((row) => rowToReviewData(row));
  const emailCounts = new Map();
  normalizedRows.forEach((row) => {
    const email = String(row.Email || '').trim().toLowerCase();
    if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
  });

  let validRecords = 0;
  let missingEmails = 0;
  let duplicates = 0;
  let invalidEmails = 0;
  let otherMissing = 0;
  const columnCounts = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, { valid: 0, missing: 0, invalid: 0, duplicate: 0 }]));

  const rowIssues = normalizedRows.map((row, index) => {
    const issues = [];
    const missingFields = [];
    REQUIRED_FIELDS.forEach((field) => {
      const value = String(row[field] || '').trim();
      if (!value) {
        missingFields.push(field);
        columnCounts[field].missing += 1;
      } else {
        columnCounts[field].valid += 1;
      }
    });

    const email = String(row.Email || '').trim().toLowerCase();
    if (!email) {
      missingEmails += 1;
      issues.push('missing-email');
    } else if (!EMAIL_RE.test(email)) {
      invalidEmails += 1;
      columnCounts.Email.invalid += 1;
      issues.push('invalid-email');
    }
    if (email && emailCounts.get(email) > 1) {
      duplicates += 1;
      columnCounts.Email.duplicate += 1;
      issues.push('duplicate');
    }
    const nonEmailMissing = missingFields.filter((field) => field !== 'Email');
    if (nonEmailMissing.length) {
      otherMissing += 1;
      issues.push('missing-required');
    }
    if (!issues.length) validRecords += 1;

    return {
      rowIndex: index,
      rowNumber: index + 1,
      email,
      issues,
      missingFields
    };
  });

  const totalRecords = normalizedRows.length;
  const processedPercent = totalRecords ? Math.round((totalRecords / totalRecords) * 100) : 0;
  return {
    totalRecords,
    validRecords,
    missingEmails,
    duplicates,
    invalidEmails,
    otherMissing,
    processedPercent,
    rowIssues,
    columnCounts,
    checks: {
      emailFormat: { valid: Math.max(0, totalRecords - missingEmails - invalidEmails), invalid: invalidEmails },
      duplicateEmail: { duplicates },
      requiredFields: { missing: otherMissing + missingEmails },
      dataConsistency: { ok: totalRecords === 0 || validRecords + missingEmails + invalidEmails + duplicates + otherMissing >= 0 }
    }
  };
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    let rows = Array.isArray(body.rows) ? body.rows : [];
    const listId = String(body.listId || '').trim();

    if (!rows.length && listId) {
      const list = await LeadList.findOne(activeListFilter(buildAuthOwnerFilter(auth, { _id: listId }))).lean();
      if (!list) return NextResponse.json({ ok: false, error: 'Selected list not found.' }, { status: 404 });
      rows = Array.isArray(list.leads) ? list.leads : [];
    }

    return NextResponse.json({ ok: true, ...validateRows(rows) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to validate list.' }, { status: 500 });
  }
}