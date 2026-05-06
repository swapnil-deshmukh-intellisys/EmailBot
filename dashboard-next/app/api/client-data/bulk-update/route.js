import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireAuth } from '@/lib/apiAuth';

function normalizeEmail(raw) {
  return String(raw || '').split(/[;,/]/)[0].trim().toLowerCase();
}

function parseDateOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getListQuery({ role, listId, userEmail }) {
  return role === 'admin' ? { _id: listId } : { _id: listId, userEmail };
}

function applyLeadPatch(lead, patch = {}) {
  const next = {
    Name: String(patch.name ?? lead.Name ?? '').trim(),
    Surname: String(patch.surname ?? lead.Surname ?? '').trim(),
    Designation: String(patch.designation ?? lead.Designation ?? '').trim(),
    Company: String(patch.cmpName ?? lead.Company ?? '').trim(),
    Sector: String(patch.sector ?? lead.Sector ?? '').trim(),
    Country: String(patch.country ?? lead.Country ?? '').trim(),
    Email: normalizeEmail(patch.email ?? lead.Email ?? ''),
    LeadType: String(patch.leadType ?? lead?.data?.LeadType ?? lead?.data?.['Lead Type'] ?? '').trim(),
    Sourcer: String(patch.sourcer ?? lead?.data?.Sourcer ?? '').trim(),
    UserId: String(patch.userId ?? lead?.data?.UserId ?? lead?.data?.['User ID'] ?? '').trim(),
    ProjectApproach: String(patch.projectApproach ?? lead?.data?.ProjectApproach ?? lead?.data?.['Project Approach'] ?? '').trim(),
    SenderId: String(patch.senderId ?? lead?.data?.SenderId ?? lead?.data?.['Sender ID'] ?? '').trim(),
    Source: String(patch.source ?? lead?.data?.Source ?? '').trim()
  };

  const nextUploadDate =
    patch.listAddedDate !== undefined
      ? parseDateOrNull(patch.listAddedDate)
      : lead?.uploadDate || null;

  lead.Name = next.Name;
  lead.Surname = next.Surname;
  lead.Designation = next.Designation;
  lead.Company = next.Company;
  lead.Sector = next.Sector;
  lead.Country = next.Country;
  lead.Email = next.Email;
  lead.uploadDate = nextUploadDate;
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
    SenderId: next.SenderId,
    Source: next.Source,
    listAddedDate: nextUploadDate ? nextUploadDate.toISOString() : ''
  };
}

export async function PATCH(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const role = String(auth.currentUser?.role || auth.session?.role || 'user').toLowerCase();
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || '').toLowerCase();

    const body = await req.json().catch(() => ({}));
    const updates = Array.isArray(body?.updates) ? body.updates : [];
    if (!updates.length) {
      return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
    }

    const byList = new Map();
    for (const item of updates) {
      const rowId = String(item?.rowId || item?.id || '').trim();
      const [listId, indexToken] = rowId.split('__');
      const leadIndex = Number(indexToken);
      if (!listId || !Number.isInteger(leadIndex) || leadIndex < 0) continue;
      if (!byList.has(listId)) byList.set(listId, []);
      byList.get(listId).push({ leadIndex, patch: item?.changes || item?.patch || item || {} });
    }

    const touched = [];
    for (const [listId, items] of byList.entries()) {
      const list = await LeadList.findOne(getListQuery({ role, listId, userEmail }));
      if (!list) continue;
      for (const item of items) {
        const lead = Array.isArray(list.leads) ? list.leads[item.leadIndex] : null;
        if (!lead) continue;
        applyLeadPatch(lead, item.patch);
      }
      await list.save();
      touched.push(listId);
    }

    return NextResponse.json({ ok: true, updatedLists: touched });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to bulk update rows' }, { status: 500 });
  }
}
