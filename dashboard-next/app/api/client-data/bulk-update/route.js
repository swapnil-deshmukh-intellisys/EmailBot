import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { refreshSheetCounts } from '@/app/api/client-sheets/_sheetUtils';

function normalizeEmail(raw) {
  return String(raw || '').split(/[;,/]/)[0].trim().toLowerCase();
}

function parseDateOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getListQuery(auth, listId) {
  return buildAuthOwnerFilter(auth, { _id: listId });
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

function applyRecordPatch(record, patch = {}) {
  if ('name' in patch) record.name = String(patch.name || '').trim();
  if ('surname' in patch) record.surname = String(patch.surname || '').trim();
  if ('designation' in patch) record.designation = String(patch.designation || '').trim();
  if ('cmpName' in patch || 'companyName' in patch) record.companyName = String(patch.cmpName ?? patch.companyName ?? '').trim();
  if ('sector' in patch) record.sector = String(patch.sector || '').trim();
  if ('country' in patch) record.country = String(patch.country || '').trim();
  if ('email' in patch) record.email = normalizeEmail(patch.email);
  if ('source' in patch) record.source = String(patch.source || '').trim();
  if ('leadType' in patch) record.leadType = String(patch.leadType || '').trim();
  if ('sourcer' in patch) record.sourcer = String(patch.sourcer || '').trim();
  if ('userId' in patch || 'userIdText' in patch) record.userIdText = String(patch.userId ?? patch.userIdText ?? '').trim();
  if ('projectApproach' in patch) record.projectApproach = String(patch.projectApproach || '').trim();
  if ('senderId' in patch) record.senderId = String(patch.senderId || '').trim();
  if ('listAddedDate' in patch) record.listAddedDate = parseDateOrNull(patch.listAddedDate);
  record.isInvalid = !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(record.email || '');
  record.invalidReason = record.isInvalid ? 'Invalid email format' : '';
  record.rawData = { ...(record.rawData || {}), ...patch };
}

export async function PATCH(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const updates = Array.isArray(body?.updates) ? body.updates : [];
    if (!updates.length) {
      return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
    }

    const byList = new Map();
    const recordUpdates = [];
    for (const item of updates) {
      const rowId = String(item?.rowId || item?.id || '').trim();
      const patch = item?.changes || item?.patch || item || {};
      if (rowId.startsWith('record:')) {
        const recordId = rowId.slice('record:'.length);
        if (recordId) recordUpdates.push({ recordId, patch });
        continue;
      }
      const [listId, indexToken] = rowId.split('__');
      const leadIndex = Number(indexToken);
      if (!listId || !Number.isInteger(leadIndex) || leadIndex < 0) continue;
      if (!byList.has(listId)) byList.set(listId, []);
      byList.get(listId).push({ leadIndex, patch });
    }

    const touched = [];
    const touchedSheets = new Set();
    for (const item of recordUpdates) {
      const record = await ClientRecord.findOne(buildAuthOwnerFilter(auth, { _id: item.recordId, deletedAt: null }));
      if (!record) continue;
      applyRecordPatch(record, item.patch);
      await record.save();
      if (record.sheetId) touchedSheets.add(String(record.sheetId));
    }

    for (const [listId, items] of byList.entries()) {
      const list = await LeadList.findOne(getListQuery(auth, listId));
      if (!list) continue;
      for (const item of items) {
        const lead = Array.isArray(list.leads) ? list.leads[item.leadIndex] : null;
        if (!lead) continue;
        applyLeadPatch(lead, item.patch);
      }
      await list.save();
      touched.push(listId);
    }

    for (const sheetId of touchedSheets) {
      await refreshSheetCounts(sheetId);
    }

    return NextResponse.json({ ok: true, updatedLists: touched, updatedSheets: Array.from(touchedSheets) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to bulk update rows' }, { status: 500 });
  }
}
