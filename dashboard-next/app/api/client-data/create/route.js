import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireAuth } from '@/lib/apiAuth';

function normalizeText(value = '') {
  return String(value ?? '').trim();
}

function normalizeEmail(raw) {
  return String(raw || '').split(/[;,/]/)[0].trim().toLowerCase();
}

function parseDateOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const role = String(auth.currentUser?.role || auth.session?.role || 'user').toLowerCase();
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || '').toLowerCase();

    const body = await req.json().catch(() => ({}));
    const sourceListId = normalizeText(body?.sourceListId);
    if (!sourceListId) {
      return NextResponse.json({ ok: false, error: 'sourceListId is required' }, { status: 400 });
    }

    const query = role === 'admin' ? { _id: sourceListId } : { _id: sourceListId, userEmail };
    const list = await LeadList.findOne(query);
    if (!list) {
      return NextResponse.json({ ok: false, error: 'List not found' }, { status: 404 });
    }

    const row = body?.row || {};
    const name = normalizeText(row.name);
    const company = normalizeText(row.cmpName);
    const email = normalizeEmail(row.email);
    const uploadDate = parseDateOrNull(row.listAddedDate) || null;

    const lead = {
      Name: name,
      Surname: normalizeText(row.surname),
      Email: email,
      Company: company,
      Designation: normalizeText(row.designation),
      Sector: normalizeText(row.sector),
      Country: normalizeText(row.country),
      uploadDate,
      data: {
        Name: name,
        Surname: normalizeText(row.surname),
        Email: email,
        Company: company,
        Designation: normalizeText(row.designation),
        Sector: normalizeText(row.sector),
        Country: normalizeText(row.country),
        Source: normalizeText(row.source),
        'Lead Type': normalizeText(row.leadType),
        LeadType: normalizeText(row.leadType),
        Sourcer: normalizeText(row.sourcer),
        'User ID': normalizeText(row.userId),
        UserId: normalizeText(row.userId),
        'Project Approach': normalizeText(row.projectApproach),
        ProjectApproach: normalizeText(row.projectApproach),
        'Sender ID': normalizeText(row.senderId),
        SenderId: normalizeText(row.senderId),
        listAddedDate: uploadDate ? uploadDate.toISOString() : ''
      },
      status: 'Pending'
    };

    if (!Array.isArray(list.leads)) list.leads = [];
    list.leads.push(lead);
    await list.save();

    const leadIndex = list.leads.length - 1;
    return NextResponse.json({
      ok: true,
      rowId: `${String(list._id)}__${leadIndex}`,
      sourceListId: String(list._id)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to create row' }, { status: 500 });
  }
}
