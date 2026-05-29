import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import ClientRecord from '@/models/ClientRecord';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter } from '@/app/api/client-data/_retention';
import {
  normalizeEmail,
  parseSheetId,
  refreshSheetCounts,
  toDateOrNull
} from '@/app/api/client-sheets/_sheetUtils';

function applyPatchToRecord(record, patch = {}) {
  if ('name' in patch) record.name = String(patch.name || '').trim();
  if ('surname' in patch) record.surname = String(patch.surname || '').trim();
  if ('designation' in patch) record.designation = String(patch.designation || '').trim();
  if ('companyName' in patch || 'cmpName' in patch) record.companyName = String(patch.companyName ?? patch.cmpName ?? '').trim();
  if ('sector' in patch) record.sector = String(patch.sector || '').trim();
  if ('country' in patch) record.country = String(patch.country || '').trim();
  if ('email' in patch) record.email = normalizeEmail(patch.email);
  if ('phone' in patch) record.phone = String(patch.phone || '').trim();
  if ('website' in patch) record.website = String(patch.website || '').trim();
  if ('linkedin' in patch) record.linkedin = String(patch.linkedin || '').trim();
  if ('source' in patch) record.source = String(patch.source || '').trim();
  if ('leadType' in patch) record.leadType = String(patch.leadType || '').trim();
  if ('sourcer' in patch) record.sourcer = String(patch.sourcer || '').trim();
  if ('userIdText' in patch || 'userId' in patch) record.userIdText = String(patch.userIdText ?? patch.userId ?? '').trim();
  if ('projectApproach' in patch) record.projectApproach = String(patch.projectApproach || '').trim();
  if ('senderId' in patch) record.senderId = String(patch.senderId || '').trim();
  if ('listAddedDate' in patch) record.listAddedDate = toDateOrNull(patch.listAddedDate);
  record.isInvalid = !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(record.email || '');
  record.invalidReason = record.isInvalid ? 'Invalid email format' : '';
  record.rawData = { ...(record.rawData || {}), ...patch };
}

function applyPatchToLead(lead, patch = {}) {
  const email = normalizeEmail(patch.email ?? lead.Email ?? lead.data?.Email ?? '');
  lead.Name = String(patch.name ?? lead.Name ?? '').trim();
  lead.Surname = String(patch.surname ?? lead.Surname ?? '').trim();
  lead.Designation = String(patch.designation ?? lead.Designation ?? '').trim();
  lead.Company = String(patch.companyName ?? patch.cmpName ?? lead.Company ?? '').trim();
  lead.Sector = String(patch.sector ?? lead.Sector ?? '').trim();
  lead.Country = String(patch.country ?? lead.Country ?? '').trim();
  lead.Email = email;
  lead.uploadDate = 'listAddedDate' in patch ? toDateOrNull(patch.listAddedDate) : lead.uploadDate || null;
  lead.data = {
    ...(lead.data || {}),
    Name: lead.Name,
    Surname: lead.Surname,
    Designation: lead.Designation,
    Company: lead.Company,
    'Company Name': lead.Company,
    Sector: lead.Sector,
    Country: lead.Country,
    Email: email,
    Source: String(patch.source ?? lead.data?.Source ?? '').trim(),
    'Lead Type': String(patch.leadType ?? lead.data?.['Lead Type'] ?? '').trim(),
    LeadType: String(patch.leadType ?? lead.data?.LeadType ?? '').trim(),
    Sourcer: String(patch.sourcer ?? lead.data?.Sourcer ?? '').trim(),
    'User ID': String(patch.userIdText ?? patch.userId ?? lead.data?.['User ID'] ?? '').trim(),
    UserId: String(patch.userIdText ?? patch.userId ?? lead.data?.UserId ?? '').trim(),
    'Project Approach': String(patch.projectApproach ?? lead.data?.['Project Approach'] ?? '').trim(),
    ProjectApproach: String(patch.projectApproach ?? lead.data?.ProjectApproach ?? '').trim(),
    'Sender ID': String(patch.senderId ?? lead.data?.['Sender ID'] ?? '').trim(),
    SenderId: String(patch.senderId ?? lead.data?.SenderId ?? '').trim(),
    listAddedDate: lead.uploadDate ? lead.uploadDate.toISOString() : ''
  };
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const updates = Array.isArray(body.updates) ? body.updates : [];
    if (!updates.length) return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });

    const touchedSheets = new Set();
    const legacyUpdates = new Map();
    const nativeUpdates = [];
    updates.forEach((item) => {
      const recordId = String(item.recordId || item.id || '').trim();
      const patch = item.changes || item.patch || item;
      if (recordId.startsWith('legacy:')) {
        const [, listId, indexToken] = recordId.split(':');
        if (!listId) return;
        if (!legacyUpdates.has(listId)) legacyUpdates.set(listId, []);
        legacyUpdates.get(listId).push({ index: Number(indexToken), patch });
      } else {
        nativeUpdates.push({ recordId, patch });
      }
    });

    for (const update of nativeUpdates) {
      const record = await ClientRecord.findOne(buildAuthOwnerFilter(auth, { _id: update.recordId, deletedAt: null }));
      if (!record) continue;
      applyPatchToRecord(record, update.patch);
      await record.save();
      touchedSheets.add(String(record.sheetId));
    }

    for (const [listId, items] of legacyUpdates.entries()) {
      const list = await LeadList.findOne(activeListFilter(buildAuthOwnerFilter(auth, { _id: listId })));
      if (!list) continue;
      items.forEach((item) => {
        if (!Number.isInteger(item.index) || item.index < 0 || !list.leads[item.index]) return;
        applyPatchToLead(list.leads[item.index], item.patch);
        list.markModified(`leads.${item.index}`);
      });
      await list.save();
      touchedSheets.add(`legacy:${listId}`);
    }

    for (const sheetId of touchedSheets) {
      const parsed = parseSheetId(sheetId);
      if (!parsed.legacy) await refreshSheetCounts(parsed.id);
    }

    return NextResponse.json({ ok: true, updatedSheets: Array.from(touchedSheets) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to update records' }, { status: 500 });
  }
}
