import mongoose from 'mongoose';
import LeadList from '@/models/LeadList';
import ClientSheet from '@/models/ClientSheet';
import ClientRecord from '@/models/ClientRecord';
import ClientBinRecord from '@/models/ClientBinRecord';
import { buildAuthOwnerFilter } from '@/lib/apiAuth';
import { activeListFilter } from '@/app/api/client-data/_retention';

export const CLIENT_SHEET_COLUMNS = [
  'Name',
  'Surname',
  'Designation',
  'Company Name',
  'Sector',
  'Country',
  'Email',
  'List Added Date',
  'Source',
  'Lead Type',
  'Sourcer',
  'User ID',
  'Project Approach',
  'Sender ID'
];

export const GRID_FIELDS = [
  'name',
  'surname',
  'designation',
  'companyName',
  'sector',
  'country',
  'email',
  'listAddedDate',
  'source',
  'leadType',
  'sourcer',
  'userIdText',
  'projectApproach',
  'senderId'
];

export function normalizeText(value = '') {
  return String(value ?? '').trim();
}

export function normalizeEmail(raw = '') {
  return normalizeText(raw).replace(/^mailto:/i, '').split(/[;,/]/)[0].trim().toLowerCase();
}

export function isValidEmail(email = '') {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (normalized.includes(' ') || normalized.includes('..')) return false;
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalized);
}

export function invalidEmailReason(email = '') {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'Missing email';
  if (normalized.includes(' ')) return 'Email contains spaces';
  if (normalized.includes('..')) return 'Email contains double dots';
  if (!isValidEmail(normalized)) return 'Invalid email format';
  return '';
}

export function normalizeProject(value = '') {
  const raw = normalizeText(value).toLowerCase();
  if (raw.includes('tut') || raw.includes('unicorn') || raw.includes('theunicorntimes.com')) return 'tut';
  if (raw.includes('tec') || raw.includes('entrepreneurial') || raw.includes('theentrepreneurialchronicle.com')) return 'tec';
  return raw || 'unassigned';
}

export function ownerEmail(auth = {}) {
  return normalizeEmail(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '');
}

export function ownerUserId(auth = {}) {
  return auth.currentUser?._id || null;
}

export function parseSheetId(raw = '') {
  const value = normalizeText(raw);
  if (value.startsWith('legacy:')) return { legacy: true, id: value.slice(7) };
  return { legacy: false, id: value };
}

export function toDateOrNull(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split('-');
    const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateOnly(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getRawValue(row = {}, ...keys) {
  for (const key of keys) {
    const direct = normalizeText(row?.[key]);
    if (direct) return direct;
    const nested = normalizeText(row?.data?.[key]);
    if (nested) return nested;
    const raw = normalizeText(row?.rawData?.[key]);
    if (raw) return raw;
  }
  return '';
}

export function rawRowToRecord(row = {}, context = {}) {
  const email = normalizeEmail(getRawValue(row, 'email', 'Email', 'E-mail', 'Mail ID'));
  const source = getRawValue(row, 'source', 'Source') || context.originalFileName || context.sheetName || '';
  const listAddedDate = toDateOrNull(getRawValue(row, 'listAddedDate', 'List Added Date', 'Date')) || context.uploadedAt || null;
  const record = {
    userId: context.userId || null,
    userEmail: context.userEmail || '',
    project: context.project || '',
    projectId: context.projectId || '',
    sheetId: context.sheetId,
    rowIndex: Number(context.rowIndex || 0),
    name: getRawValue(row, 'name', 'Name', 'First Name'),
    surname: getRawValue(row, 'surname', 'Surname', 'Last Name'),
    designation: getRawValue(row, 'designation', 'Designation', 'Title'),
    companyName: getRawValue(row, 'companyName', 'cmpName', 'Company', 'Company Name', 'Cmp Name'),
    sector: getRawValue(row, 'sector', 'Sector', 'Industry'),
    country: getRawValue(row, 'country', 'Country'),
    email,
    phone: getRawValue(row, 'phone', 'Phone', 'Mobile'),
    website: getRawValue(row, 'website', 'Website', 'Domain'),
    linkedin: getRawValue(row, 'linkedin', 'LinkedIn', 'LinkedInUrl', 'linkedinUrl'),
    source,
    leadType: getRawValue(row, 'leadType', 'Lead Type', 'LeadType'),
    sourcer: getRawValue(row, 'sourcer', 'Sourcer', 'Source By'),
    userIdText: getRawValue(row, 'userIdText', 'userId', 'User ID', 'UserId'),
    projectApproach: getRawValue(row, 'projectApproach', 'Project Approach', 'Approach', 'Used In Project'),
    senderId: getRawValue(row, 'senderId', 'Sender ID', 'SenderId'),
    listAddedDate,
    status: normalizeText(row.status) || 'Pending',
    contactedCount: Number(row.contactedCount || row.sentAt ? 1 : 0),
    lastContactedAt: row.lastContactedAt || row.sentAt || null,
    rawData: { ...(row.rawData || row.data || row) }
  };
  record.isInvalid = !isValidEmail(record.email);
  record.invalidReason = record.isInvalid ? invalidEmailReason(record.email) : '';
  return record;
}

export function recordToLead(record = {}) {
  const email = normalizeEmail(record.email);
  const data = {
    Name: normalizeText(record.name),
    Surname: normalizeText(record.surname),
    Designation: normalizeText(record.designation),
    Company: normalizeText(record.companyName),
    'Company Name': normalizeText(record.companyName),
    Sector: normalizeText(record.sector),
    Country: normalizeText(record.country),
    Email: email,
    Phone: normalizeText(record.phone),
    Domain: normalizeText(record.website),
    LinkedInUrl: normalizeText(record.linkedin),
    Source: normalizeText(record.source),
    'Lead Type': normalizeText(record.leadType),
    LeadType: normalizeText(record.leadType),
    Sourcer: normalizeText(record.sourcer),
    'User ID': normalizeText(record.userIdText),
    UserId: normalizeText(record.userIdText),
    'Project Approach': normalizeText(record.projectApproach),
    ProjectApproach: normalizeText(record.projectApproach),
    'Sender ID': normalizeText(record.senderId),
    SenderId: normalizeText(record.senderId),
    listAddedDate: record.listAddedDate ? new Date(record.listAddedDate).toISOString() : ''
  };
  return {
    Name: data.Name,
    Surname: data.Surname,
    Designation: data.Designation,
    Company: data.Company,
    companyName: data.Company,
    Email: email,
    Phone: data.Phone,
    Domain: data.Domain,
    Sector: data.Sector,
    Country: data.Country,
    uploadDate: record.listAddedDate || null,
    validationStatus: record.isInvalid ? 'Invalid' : record.isRepeated ? 'Duplicate' : 'Valid',
    data,
    status: normalizeText(record.status) || 'Pending',
    sentAt: record.lastContactedAt || null
  };
}

export function publicRecord(record = {}, sheet = {}) {
  const id = String(record._id || record.id || '');
  const isLegacy = Boolean(record.isLegacy);
  const email = normalizeEmail(record.email);
  return {
    id,
    recordId: id,
    sheetId: String(sheet._id || record.sheetId || ''),
    isLegacy,
    sourceListId: String(record.sourceListId || sheet.sourceListId || ''),
    legacyLeadIndex: record.legacyLeadIndex ?? null,
    rowIndex: Number(record.rowIndex || 0),
    name: normalizeText(record.name),
    surname: normalizeText(record.surname),
    designation: normalizeText(record.designation),
    companyName: normalizeText(record.companyName),
    sector: normalizeText(record.sector),
    country: normalizeText(record.country),
    email,
    phone: normalizeText(record.phone),
    website: normalizeText(record.website),
    linkedin: normalizeText(record.linkedin),
    source: normalizeText(record.source) || normalizeText(sheet.originalFileName || sheet.sheetName),
    leadType: normalizeText(record.leadType),
    sourcer: normalizeText(record.sourcer),
    userIdText: normalizeText(record.userIdText),
    projectApproach: normalizeText(record.projectApproach),
    senderId: normalizeText(record.senderId),
    listAddedDate: formatDateOnly(record.listAddedDate),
    status: normalizeText(record.status) || 'Pending',
    isRepeated: Boolean(record.isRepeated),
    duplicateReason: normalizeText(record.duplicateReason),
    isInvalid: Boolean(record.isInvalid) || !isValidEmail(email),
    invalidReason: normalizeText(record.invalidReason) || invalidEmailReason(email),
    contactedCount: Number(record.contactedCount || 0),
    lastContactedAt: record.lastContactedAt || null
  };
}

export function publicSheet(sheet = {}) {
  return {
    _id: String(sheet._id),
    sheetId: String(sheet._id),
    isLegacy: Boolean(sheet.isLegacy),
    sheetName: sheet.sheetName || sheet.name || 'Client Sheet',
    originalFileName: sheet.originalFileName || sheet.sourceFile || '',
    sourceListId: sheet.sourceListId ? String(sheet.sourceListId) : '',
    project: normalizeProject(sheet.project || sheet.projectId || ''),
    projectId: sheet.projectId || '',
    kind: sheet.kind || 'uploaded',
    totalRows: Number(sheet.totalRows || sheet.leadCount || 0),
    freshCount: Number(sheet.freshCount || 0),
    repeatedCount: Number(sheet.repeatedCount || 0),
    invalidCount: Number(sheet.invalidCount || 0),
    contactedCount: Number(sheet.contactedCount || 0),
    columns: Array.isArray(sheet.columns) && sheet.columns.length ? sheet.columns : CLIENT_SHEET_COLUMNS,
    columnWidths: sheet.columnWidths || {},
    createdAt: sheet.createdAt || sheet.uploadedAt || null,
    updatedAt: sheet.updatedAt || sheet.createdAt || null,
    createdBy: sheet.createdBy || sheet.userEmail || ''
  };
}

export function legacyLeadToRecord(list = {}, lead = {}, index = 0, duplicate = {}) {
  const record = rawRowToRecord(
    {
      ...(lead?.data || {}),
      ...lead,
      email: lead?.Email || lead?.data?.Email,
      companyName: lead?.Company || lead?.companyName || lead?.data?.Company
    },
    {
      sheetId: `legacy:${String(list._id)}`,
      rowIndex: index,
      userId: list.userId || null,
      userEmail: list.userEmail || '',
      project: normalizeProject(list.project || list.projectId || `${list.name || ''} ${list.sourceFile || ''}`),
      projectId: list.projectId || '',
      sheetName: list.name,
      originalFileName: list.sourceFile || list.sourceFileName || list.name,
      uploadedAt: lead.uploadDate || list.uploadDate || list.uploadedAt || list.createdAt || null
    }
  );
  record._id = `legacy:${String(list._id)}:${index}`;
  record.isLegacy = true;
  record.sourceListId = String(list._id);
  record.legacyLeadIndex = index;
  record.status = lead.status || record.status;
  record.lastContactedAt = lead.sentAt || lead.failedAt || null;
  record.contactedCount = lead.sentAt ? 1 : 0;
  record.isRepeated = Boolean(duplicate.isRepeated);
  record.duplicateReason = duplicate.reason || '';
  return record;
}

export async function collectProjectEmailCounts(auth, project = '') {
  const owner = buildAuthOwnerFilter(auth);
  const normalizedProject = normalizeProject(project);
  const [records, lists] = await Promise.all([
    ClientRecord.find({
      ...owner,
      deletedAt: null,
      ...(normalizedProject && normalizedProject !== 'unassigned' ? { project: normalizedProject } : {})
    }).select('email').lean(),
    LeadList.find(activeListFilter(owner)).select('leads.Email leads.data.Email project projectId sourceFile name').lean()
  ]);
  const counts = new Map();
  records.forEach((record) => {
    const email = normalizeEmail(record.email);
    if (email) counts.set(email, Number(counts.get(email) || 0) + 1);
  });
  lists.forEach((list) => {
    const listProject = normalizeProject(`${list.project || ''} ${list.projectId || ''} ${list.sourceFile || ''} ${list.name || ''}`);
    if (normalizedProject && normalizedProject !== 'unassigned' && listProject !== normalizedProject) return;
    (list.leads || []).forEach((lead) => {
      const email = normalizeEmail(lead.Email || lead.data?.Email);
      if (email) counts.set(email, Number(counts.get(email) || 0) + 1);
    });
  });
  return counts;
}

export function applyDuplicateFlags(records = [], globalCounts = new Map()) {
  const localCounts = new Map();
  records.forEach((record) => {
    const email = normalizeEmail(record.email);
    if (email) localCounts.set(email, Number(localCounts.get(email) || 0) + 1);
  });
  return records.map((record) => {
    const email = normalizeEmail(record.email);
    const localDuplicate = email && Number(localCounts.get(email) || 0) > 1;
    const globalDuplicate = email && Number(globalCounts.get(email) || 0) > Number(localCounts.get(email) || 0);
    const invalid = !isValidEmail(email);
    let duplicateReason = '';
    if (localDuplicate) duplicateReason = 'Duplicate in current sheet';
    else if (globalDuplicate) duplicateReason = 'Duplicate in previous sheet';
    return {
      ...record,
      isRepeated: Boolean(localDuplicate || globalDuplicate),
      duplicateReason,
      isInvalid: invalid,
      invalidReason: invalid ? invalidEmailReason(email) : ''
    };
  });
}

export function summarizeRecords(records = []) {
  let totalRows = records.length;
  let repeatedCount = 0;
  let invalidCount = 0;
  let contactedCount = 0;
  records.forEach((record) => {
    if (record.isRepeated) repeatedCount += 1;
    if (record.isInvalid) invalidCount += 1;
    if (record.contactedCount || record.lastContactedAt || ['Sent', 'Bounced', 'Spam', 'Failed'].includes(record.status)) contactedCount += 1;
  });
  return {
    totalRows,
    repeatedCount,
    invalidCount,
    contactedCount,
    freshCount: Math.max(0, totalRows - repeatedCount - invalidCount - contactedCount)
  };
}

export async function refreshSheetCounts(sheetId) {
  if (!mongoose.Types.ObjectId.isValid(String(sheetId))) return null;
  const records = await ClientRecord.find({ sheetId, deletedAt: null }).lean();
  const summary = summarizeRecords(records);
  return ClientSheet.findByIdAndUpdate(sheetId, { $set: summary }, { new: true });
}

export async function getLegacyListsAsSheets(auth, project = '') {
  const owner = buildAuthOwnerFilter(auth);
  const normalizedProject = normalizeProject(project);
  const lists = await LeadList.find(activeListFilter(owner))
    .select('name sourceFile sourceFileName project projectId kind columns uploadedAt createdAt updatedAt userEmail userId leads')
    .sort({ createdAt: -1 })
    .lean();
  return lists
    .map((list) => {
      const listProject = normalizeProject(`${list.project || ''} ${list.projectId || ''} ${list.sourceFile || ''} ${list.name || ''}`);
      const leads = Array.isArray(list.leads) ? list.leads : [];
      const emailCounts = new Map();
      leads.forEach((lead) => {
        const email = normalizeEmail(lead.Email || lead.data?.Email);
        if (email) emailCounts.set(email, Number(emailCounts.get(email) || 0) + 1);
      });
      const records = leads.map((lead, index) => {
        const email = normalizeEmail(lead.Email || lead.data?.Email);
        return legacyLeadToRecord(list, lead, index, {
          isRepeated: email && Number(emailCounts.get(email) || 0) > 1,
          reason: email && Number(emailCounts.get(email) || 0) > 1 ? 'Duplicate in current sheet' : ''
        });
      });
      const summary = summarizeRecords(records);
      return publicSheet({
        _id: `legacy:${String(list._id)}`,
        isLegacy: true,
        sheetName: list.name || list.sourceFile || 'Legacy Client Sheet',
        originalFileName: list.sourceFile || list.sourceFileName || list.name || '',
        sourceListId: String(list._id),
        project: listProject,
        projectId: list.projectId || '',
        kind: list.kind || 'legacy_lead_list',
        columns: list.columns || CLIENT_SHEET_COLUMNS,
        createdAt: list.createdAt || list.uploadedAt || null,
        updatedAt: list.updatedAt || list.createdAt || null,
        userEmail: list.userEmail || '',
        ...summary
      });
    })
    .filter((sheet) => !normalizedProject || normalizedProject === 'unassigned' || sheet.project === normalizedProject);
}

export async function moveRecordsToBin({ auth, records = [], reason = 'Moved to bin', legacyList = null }) {
  const userEmail = ownerEmail(auth);
  const userId = ownerUserId(auth);
  const now = new Date();
  const bins = records.map((record) => ({
    userId,
    userEmail,
    project: record.project || legacyList?.project || '',
    projectId: record.projectId || legacyList?.projectId || '',
    sheetId: mongoose.Types.ObjectId.isValid(String(record.sheetId)) ? record.sheetId : null,
    sourceRecordId: mongoose.Types.ObjectId.isValid(String(record._id)) ? record._id : null,
    sourceListId: record.sourceListId || legacyList?._id || null,
    legacyLeadIndex: record.legacyLeadIndex ?? null,
    sheetName: record.sheetName || legacyList?.name || '',
    deletedReason: reason,
    deletedAt: now,
    restorePayload: record
  }));
  if (bins.length) await ClientBinRecord.insertMany(bins);
}
