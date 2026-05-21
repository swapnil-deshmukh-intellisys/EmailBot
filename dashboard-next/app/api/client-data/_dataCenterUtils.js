import LeadList from '@/models/LeadList';

export const CLIENT_DATA_COLUMNS = [
  'Name',
  'Surname',
  'Designation',
  'Company Name',
  'Sector',
  'Country',
  'Email',
  'Source',
  'Lead Type',
  'Sourcer',
  'User ID',
  'Project Approach',
  'Sender ID'
];

export const SELECTED_SHEET_KINDS = ['custom', 'selected_client_sheet'];

export function normalizeText(value = '') {
  return String(value ?? '').trim();
}

export function normalizeEmail(raw = '') {
  return normalizeText(raw).split(/[;,/]/)[0].toLowerCase();
}

export function isValidEmail(email = '') {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizeEmail(email));
}

export function makePastedSheetName() {
  const now = new Date();
  return `Pasted Extracted Data - ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export function rowToLead(row = {}) {
  const email = normalizeEmail(row.email || row.Email);
  const company = normalizeText(row.cmpName || row.companyName || row.Company || row['Company Name']);
  const data = {
    Name: normalizeText(row.name || row.Name),
    Surname: normalizeText(row.surname || row.Surname),
    Designation: normalizeText(row.designation || row.Designation || row.Title),
    Company: company,
    'Company Name': company,
    Sector: normalizeText(row.sector || row.Sector),
    Country: normalizeText(row.country || row.Country),
    Email: email,
    Source: normalizeText(row.source || row.Source),
    'Lead Type': normalizeText(row.leadType || row.LeadType || row['Lead Type']),
    LeadType: normalizeText(row.leadType || row.LeadType || row['Lead Type']),
    Sourcer: normalizeText(row.sourcer || row.Sourcer),
    'User ID': normalizeText(row.userId || row.UserId || row['User ID']),
    UserId: normalizeText(row.userId || row.UserId || row['User ID']),
    'Project Approach': normalizeText(row.projectApproach || row.ProjectApproach || row['Project Approach']),
    ProjectApproach: normalizeText(row.projectApproach || row.ProjectApproach || row['Project Approach']),
    'Sender ID': normalizeText(row.senderId || row.SenderId || row['Sender ID']),
    SenderId: normalizeText(row.senderId || row.SenderId || row['Sender ID'])
  };

  return {
    Name: data.Name,
    Surname: data.Surname,
    Designation: data.Designation,
    Company: company,
    Sector: data.Sector,
    Country: data.Country,
    Email: email,
    data,
    validationStatus: isValidEmail(email) ? 'Valid' : 'Invalid',
    status: 'Pending'
  };
}

export function summarizeLeads(leads = [], existingEmails = new Set()) {
  const seen = new Set();
  let validClients = 0;
  let invalidClients = 0;
  let repeatedClients = 0;

  leads.forEach((lead) => {
    const email = normalizeEmail(lead.Email || lead.data?.Email);
    if (!isValidEmail(email)) {
      invalidClients += 1;
      return;
    }
    validClients += 1;
    if (seen.has(email) || existingEmails.has(email)) repeatedClients += 1;
    seen.add(email);
  });

  return {
    totalClients: leads.length,
    validClients,
    invalidClients,
    repeatedClients
  };
}

export async function collectExistingEmails(userEmail = '') {
  const lists = await LeadList.find({ userEmail }).select('leads.Email leads.data').lean();
  const emails = new Set();
  lists.forEach((list) => {
    (list.leads || []).forEach((lead) => {
      const email = normalizeEmail(lead.Email || lead.data?.Email || lead.data?.email);
      if (email) emails.add(email);
    });
  });
  return emails;
}

export function publicList(list) {
  const leads = Array.isArray(list?.leads) ? list.leads : [];
  return {
    _id: String(list._id),
    listId: String(list._id),
    name: list.name,
    sourceFile: list.sourceFile,
    kind: list.kind || 'uploaded',
    uploadedAt: list.uploadedAt || list.createdAt || null,
    createdAt: list.createdAt || null,
    leadCount: leads.length,
    totalClients: leads.length,
    metadata: list.dataCenterMeta || null
  };
}
