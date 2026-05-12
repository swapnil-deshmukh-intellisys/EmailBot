const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function normalizeText(value = '') {
  return String(value ?? '').trim();
}

const MEANINGFUL_LEAD_FIELDS = [
  'Name',
  'name',
  'Surname',
  'surname',
  'Last Name',
  'lastName',
  'First Name',
  'firstName',
  'Full Name',
  'fullName',
  'Contact Name',
  'contactName',
  'Company',
  'company',
  'Company Name',
  'companyName',
  'Designation',
  'designation',
  'Title',
  'title',
  'Email',
  'email',
  'Phone',
  'phone',
  'Mobile',
  'mobile',
  'Domain',
  'domain',
  'Website',
  'website',
  'Sector',
  'sector',
  'Industry',
  'industry',
  'Country',
  'country',
  'City',
  'city',
  'Location',
  'location',
  'Lead Type',
  'LeadType',
  'leadType',
  'Sourcer',
  'sourcer',
  'Source By',
  'sourceBy',
  'User ID',
  'UserId',
  'userId',
  'Project Approach',
  'projectApproach',
  'Approach',
  'approach',
  'Used In Project',
  'UsedInProject',
  'usedInProject',
  'Sender ID',
  'SenderId',
  'senderId'
];

export function hasMeaningfulLeadData(row = {}) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};
  return MEANINGFUL_LEAD_FIELDS.some((field) => normalizeText(row?.[field] ?? data?.[field]));
}

function toTitleCase(value = '') {
  return normalizeText(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function humanizeDomainLabel(domain = '') {
  const clean = normalizeDomain(domain);
  if (!clean) return '';
  const base = clean.split('.')[0] || '';
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\d+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function splitNameParts(value = '') {
  const clean = normalizeText(value).replace(/[._-]+/g, ' ');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', surname: '' };
  return {
    firstName: toTitleCase(parts[0]),
    surname: toTitleCase(parts.slice(1).join(' '))
  };
}

function normalizeEmail(value = '') {
  let email = normalizeText(value).toLowerCase();
  const mdMailto = email.match(/\]\(mailto:([^)]+)\)/i);
  if (mdMailto?.[1]) email = normalizeText(mdMailto[1]).toLowerCase();
  email = email.replace(/^mailto:/i, '').trim();
  email = email.replace(/^[<[\("'`\s]+/, '').replace(/[>\])"'`\s]+$/, '');
  if (email.includes(',')) email = email.split(',')[0].trim();
  if (email.includes(';')) email = email.split(';')[0].trim();
  if (email.includes('/')) email = email.split('/')[0].trim();
  return email;
}

function validateEmailFormat(emailValue = '') {
  const email = String(emailValue || '').trim().toLowerCase();
  if (!email) return { valid: false, detail: 'Missing required data: email' };
  if (email.includes(' ')) return { valid: false, detail: 'Invalid email format: contains spaces' };
  if (email.includes('..')) return { valid: false, detail: 'Invalid email format: double dots' };
  if (email.startsWith('.') || email.endsWith('.')) return { valid: false, detail: 'Invalid email format: starts or ends with dot' };
  if (email.split('@').length !== 2) return { valid: false, detail: 'Invalid email format: must contain exactly one @' };
  if (!email.includes('@')) return { valid: false, detail: 'Invalid email format: missing @' };

  const [localPart, domainPart] = email.split('@');
  if (!localPart) return { valid: false, detail: 'Invalid email format: missing local part' };
  if (!domainPart) return { valid: false, detail: 'Invalid email format: missing domain' };
  if (!domainPart.includes('.')) return { valid: false, detail: 'Invalid email format: missing dot' };

  const localAllowed = /^[A-Za-z0-9._%+-]+$/;
  const domainAllowed = /^[A-Za-z0-9.-]+$/;
  if (!localAllowed.test(localPart) || !domainAllowed.test(domainPart)) {
    return { valid: false, detail: 'Invalid email format: invalid special character' };
  }

  if (!EMAIL_REGEX.test(email)) return { valid: false, detail: 'Invalid email format' };
  return { valid: true, detail: '' };
}

function normalizePhone(value = '') {
  return normalizeText(value).replace(/[^\d+]/g, '');
}

function normalizeLinkedInUrl(value = '') {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

function normalizeDomain(value = '') {
  return normalizeText(value).toLowerCase().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
}

function getFirstPresent(source = {}, keys = []) {
  for (const key of keys) {
    const value = normalizeText(source?.[key]);
    if (value) return value;
  }
  return '';
}

function inferDomainFromEmail(email = '') {
  const normalizedEmail = normalizeEmail(email);
  if (!EMAIL_REGEX.test(normalizedEmail)) return '';
  return normalizeDomain(normalizedEmail.split('@')[1] || '');
}

function inferNameFromEmail(email = '') {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail.includes('@')) return { firstName: '', surname: '' };
  const localPart = normalizedEmail.split('@')[0] || '';
  return splitNameParts(localPart);
}

function autoCorrectLeadFields(mapped) {
  const corrected = {
    ...mapped,
    data: { ...(mapped?.data || {}) }
  };

  corrected.Email = normalizeEmail(corrected.Email || corrected.data.Email || corrected.data.email || '');

  if (!corrected.Domain) {
    corrected.Domain = inferDomainFromEmail(corrected.Email);
  }
  corrected.Domain = normalizeDomain(corrected.Domain);

  if (!corrected.Name || !corrected.Surname) {
    const fullNameValue =
      corrected.data?.FullName ||
      corrected.data?.['Full Name'] ||
      corrected.data?.fullName ||
      corrected.data?.Contact ||
      corrected.data?.contact ||
      `${corrected.Name || ''} ${corrected.Surname || ''}`.trim();
    const split = splitNameParts(fullNameValue);
    if (!corrected.Name) corrected.Name = split.firstName;
    if (!corrected.Surname) corrected.Surname = split.surname;
  }

  if (!corrected.Name) {
    const inferred = inferNameFromEmail(corrected.Email);
    corrected.Name = inferred.firstName;
    if (!corrected.Surname) corrected.Surname = inferred.surname;
  }

  corrected.Name = toTitleCase(corrected.Name);
  corrected.Surname = toTitleCase(corrected.Surname);

  if (!corrected.Company) {
    corrected.Company =
      getFirstPresent(corrected.data, ['Organization', 'organization', 'Account', 'account']) ||
      humanizeDomainLabel(corrected.Domain || inferDomainFromEmail(corrected.Email));
  }
  corrected.Company = toTitleCase(corrected.Company);
  corrected.Designation = toTitleCase(corrected.Designation);
  corrected.Sector = toTitleCase(corrected.Sector);
  corrected.Country = toTitleCase(corrected.Country);
  corrected.Phone = normalizePhone(corrected.Phone);

  corrected.dedupe = {
    email: corrected.Email,
    phone: corrected.Phone,
    fullNameCompany:
      corrected.Name && corrected.Company
        ? `${`${corrected.Name} ${corrected.Surname}`.trim().toLowerCase()}::${corrected.Company.toLowerCase()}`
        : ''
  };

  corrected.data = {
    ...corrected.data,
    Name: corrected.Name,
    Surname: corrected.Surname,
    Company: corrected.Company,
    Designation: corrected.Designation,
    Email: corrected.Email,
    Phone: corrected.Phone,
    Domain: corrected.Domain,
    Sector: corrected.Sector,
    Country: corrected.Country
  };

  return corrected;
}

export function mapRawRowToLead(rawRow = {}) {
  const row = Object.fromEntries(
    Object.entries(rawRow || {}).map(([key, value]) => [String(key || '').trim(), value ?? ''])
  );

  const fullName = getFirstPresent(row, ['Full Name', 'fullName', 'Contact Name', 'contactName']);
  const splitFullName = splitNameParts(fullName);
  const name = getFirstPresent(row, ['Name', 'name', 'First Name', 'firstName']) || splitFullName.firstName;
  const surname = getFirstPresent(row, ['Surname', 'surname', 'Last Name', 'lastName']) || splitFullName.surname;
  const company = getFirstPresent(row, ['Company', 'company', 'Company Name', 'companyName']);
  const designation = getFirstPresent(row, ['Designation', 'designation', 'Title', 'title']);
  const email = normalizeEmail(row.Email || row.email || '');
  const phone = normalizePhone(row.Phone || row.phone || row.Mobile || row.mobile || '');
  const linkedinUrl = normalizeLinkedInUrl(row.LinkedIn || row.linkedin || row.LinkedInUrl || row.linkedinUrl || row['LinkedIn URL'] || row['Linkedin URL'] || '');
  const domain = normalizeDomain(row.Domain || row.domain || row.Website || row.website || '');
  const sector = getFirstPresent(row, ['Sector', 'sector', 'Industry', 'industry']);
  const country = getFirstPresent(row, ['Country', 'country']);
  const source = getFirstPresent(row, ['Source', 'source']);
  const sourcer = getFirstPresent(row, ['Sourcer', 'sourcer']);
  const leadType = getFirstPresent(row, ['Lead Type', 'LeadType', 'leadType']);
  const userId = getFirstPresent(row, ['User ID', 'UserId', 'userId']);
  const approach = getFirstPresent(row, ['Project Approach', 'projectApproach', 'Approach', 'approach', 'Used In Project', 'usedInProject']);
  const senderId = getFirstPresent(row, ['Sender ID', 'SenderId', 'senderId']);

  const fullNameKey = `${name} ${surname}`.trim().toLowerCase();
  const companyNameKey = company.toLowerCase();

  return autoCorrectLeadFields({
    Name: name,
    Surname: surname,
    Company: company,
    Designation: designation,
    Email: email,
    Phone: phone,
    LinkedInUrl: linkedinUrl,
    Domain: domain,
    Sector: sector,
    Country: country,
    Source: source,
    Sourcer: sourcer,
    LeadType: leadType,
    UserId: userId,
    ProjectApproach: approach,
    SenderId: senderId,
    data: {
      ...row,
      Name: name,
      Surname: surname,
      Company: company,
      Designation: designation,
      Email: email,
      Phone: phone,
      LinkedInUrl: linkedinUrl,
      linkedinUrl,
      Domain: domain,
      Sector: sector,
      Country: country,
      Source: source,
      Sourcer: sourcer,
      LeadType: leadType,
      UserId: userId,
      ProjectApproach: approach,
      SenderId: senderId
    },
    dedupe: {
      email,
      phone,
      linkedinUrl,
      companyName: companyNameKey,
      fullNameCompany: fullNameKey && companyNameKey ? `${fullNameKey}::${companyNameKey}` : ''
    }
  });
}

export function collectExistingLeadKeys(lists = []) {
  const existing = {
    emails: new Set(),
    phones: new Set(),
    linkedinUrls: new Set(),
    companyNames: new Set(),
    fullNameCompany: new Set()
  };

  for (const list of lists || []) {
    for (const lead of list?.leads || []) {
      const mapped = mapRawRowToLead({ ...(lead?.data || {}), ...lead });
      if (mapped.dedupe.email) existing.emails.add(mapped.dedupe.email);
      if (mapped.dedupe.phone) existing.phones.add(mapped.dedupe.phone);
      if (mapped.dedupe.linkedinUrl) existing.linkedinUrls.add(mapped.dedupe.linkedinUrl);
      if (mapped.dedupe.companyName) existing.companyNames.add(mapped.dedupe.companyName);
      if (mapped.dedupe.fullNameCompany) existing.fullNameCompany.add(mapped.dedupe.fullNameCompany);
    }
  }

  return existing;
}

export function analyzeRows(rawRows = [], existingKeys = { emails: new Set(), phones: new Set(), linkedinUrls: new Set(), companyNames: new Set(), fullNameCompany: new Set() }) {
  const seenEmails = new Set();
  const seenEmailRows = new Map();

  const mappedRows = (rawRows || [])
    .map((rawRow) => mapRawRowToLead(rawRow))
    .filter(hasMeaningfulLeadData);

  const previewRows = mappedRows.map((mapped, index) => {
    const duplicateReasons = [];
    if (mapped.dedupe.email && seenEmails.has(mapped.dedupe.email)) {
      const firstRowNumber = seenEmailRows.get(mapped.dedupe.email);
      duplicateReasons.push(`Repeated client email from row ${firstRowNumber}`);
    }
    if (mapped.dedupe.email && existingKeys.emails?.has(mapped.dedupe.email)) {
      duplicateReasons.push('Matched existing client by email');
    }
    if (mapped.dedupe.phone && existingKeys.phones?.has(mapped.dedupe.phone)) {
      duplicateReasons.push('Matched existing client by phone');
    }
    if (mapped.dedupe.linkedinUrl && existingKeys.linkedinUrls?.has(mapped.dedupe.linkedinUrl)) {
      duplicateReasons.push('Matched existing client by LinkedIn URL');
    }
    if (mapped.dedupe.companyName && existingKeys.companyNames?.has(mapped.dedupe.companyName)) {
      duplicateReasons.push('Matched existing client by company name');
    }

    if (mapped.dedupe.email) {
      seenEmails.add(mapped.dedupe.email);
      if (!seenEmailRows.has(mapped.dedupe.email)) {
        seenEmailRows.set(mapped.dedupe.email, index + 1);
      }
    }

    const validationStatus = duplicateReasons.length ? 'Duplicate' : 'Valid';
    const reasons = duplicateReasons;

    return {
      rowId: `${index + 1}`,
      rowNumber: index + 1,
      ...mapped,
      status: validationStatus,
      validationStatus,
      reasons
    };
  });

  const totalRecords = previewRows.length;
  const validRecords = previewRows.filter((row) => row.validationStatus === 'Valid').length;
  const duplicateRecords = previewRows.filter((row) => row.validationStatus === 'Duplicate').length;

  return {
    rows: previewRows,
    summary: {
      totalRecords,
      validRecords,
      duplicateRecords,
      repeatedRecords: duplicateRecords,
      repeatedClientCount: duplicateRecords,
      invalidRecords: 0
    }
  };
}
