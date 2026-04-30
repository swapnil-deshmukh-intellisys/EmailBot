import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireAuth } from '@/lib/apiAuth';

function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const rowId = String(params?.id || '');
    const [listId, indexToken] = rowId.split('__');
    const leadIndex = Number(indexToken);
    if (!listId || !Number.isInteger(leadIndex) || leadIndex < 0) {
      return NextResponse.json({ error: 'Invalid row id' }, { status: 400 });
    }

    const role = String(auth.currentUser?.role || auth.session?.role || 'user').toLowerCase();
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || '').toLowerCase();
    const query = role === 'admin' ? { _id: listId } : { _id: listId, userEmail };

    const list = await LeadList.findOne(query);
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 });
    }

    const lead = Array.isArray(list.leads) ? list.leads[leadIndex] : null;
    if (!lead) {
      return NextResponse.json({ error: 'Row not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const next = {
      Name: String(body.name ?? lead.Name ?? '').trim(),
      Surname: String(body.surname ?? lead.Surname ?? '').trim(),
      Designation: String(body.designation ?? lead.Designation ?? '').trim(),
      Company: String(body.cmpName ?? lead.Company ?? '').trim(),
      Sector: String(body.sector ?? lead.Sector ?? '').trim(),
      Country: String(body.country ?? lead.Country ?? '').trim(),
      Email: normalizeEmail(body.email ?? lead.Email ?? ''),
      LeadType: String(body.leadType ?? lead?.data?.LeadType ?? lead?.data?.['Lead Type'] ?? '').trim(),
      Sourcer: String(body.sourcer ?? lead?.data?.Sourcer ?? '').trim(),
      UserId: String(body.userId ?? lead?.data?.UserId ?? lead?.data?.['User ID'] ?? '').trim(),
      ProjectApproach: String(body.projectApproach ?? lead?.data?.ProjectApproach ?? lead?.data?.['Project Approach'] ?? '').trim(),
      SenderId: String(body.senderId ?? lead?.data?.SenderId ?? lead?.data?.['Sender ID'] ?? '').trim()
    };

    lead.Name = next.Name;
    lead.Surname = next.Surname;
    lead.Designation = next.Designation;
    lead.Company = next.Company;
    lead.Sector = next.Sector;
    lead.Country = next.Country;
    lead.Email = next.Email;
    lead.data = {
      ...(lead.data || {}),
      Name: next.Name,
      Surname: next.Surname,
      Designation: next.Designation,
      Company: next.Company,
      Sector: next.Sector,
      Country: next.Country,
      Email: next.Email,
      'Lead Type': next.LeadType,
      LeadType: next.LeadType,
      Sourcer: next.Sourcer,
      'User ID': next.UserId,
      UserId: next.UserId,
      'Project Approach': next.ProjectApproach,
      ProjectApproach: next.ProjectApproach,
      'Sender ID': next.SenderId,
      SenderId: next.SenderId
    };

    await list.save();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update row' }, { status: 500 });
  }
}

