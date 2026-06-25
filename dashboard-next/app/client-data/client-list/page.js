'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/app/components/layout/AppLayout';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import ClientDataSectionNav from '@/app/client-data/components/ClientDataSectionNav';
import UploadSheetWorkflow from '@/app/client-data/components/UploadSheetWorkflow';
import ExcelGrid from '@/app/client-data/components/ExcelGrid';
import DirectoryExcelGrid from '@/app/client-data/components/DirectoryExcelGrid';
import SheetDetailsPanel from '@/app/client-data/components/SheetDetailsPanel';
import { UNIFIED_NAVBAR_TOPBAR_PROPS } from '@/shared-components/layout-components/UnifiedNavbarConfig';

const TABLE_COLUMNS = [
  '#',
  'Select',
  'Name',
  'Surname',
  'Designation',
  'CMP Name',
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

const PASTE_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'surname', label: 'Surname' },
  { key: 'designation', label: 'Designation' },
  { key: 'cmpName', label: 'CMP Name' },
  { key: 'sector', label: 'Sector' },
  { key: 'country', label: 'Country' },
  { key: 'email', label: 'Email' },
  { key: 'listAddedDate', label: 'List Added Date' },
  { key: 'source', label: 'Source' },
  { key: 'leadType', label: 'Lead Type' },
  { key: 'sourcer', label: 'Sourcer' },
  { key: 'userId', label: 'User ID' },
  { key: 'projectApproach', label: 'Project Approach' },
  { key: 'senderId', label: 'Sender ID' }
];

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const badgeToneMap = {
  Verified: 'success',
  Pending: 'default',
  Sent: 'success',
  Failed: 'danger',
  Bounced: 'warning',
  Spam: 'danger',
  'Missing Email': 'danger'
};

const EMPTY_FILTERS = {
  search: '',
  date: '',
  sector: '',
  country: '',
  name: '',
  designation: '',
  freshLead: '',
  mailStatus: ''
};

const MAIL_STATUS_BADGE = {
  Sent: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  Pending: { bg: '#fef9c3', color: '#854d0e', border: '#fef08a' },
  Failed: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
  Bounced: { bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' },
  Spam: { bg: '#fae8ff', color: '#86198f', border: '#f5d0fe' },
  'Missing Email': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  Verified: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
};

function MailStatusBadge({ status }) {
  const s = String(status || 'Pending');
  const style = MAIL_STATUS_BADGE[s] || MAIL_STATUS_BADGE.Pending;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 9px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.5,
        letterSpacing: '0.01em',
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap'
      }}
    >
      {s}
    </span>
  );
}

function CampaignNameChip({ name }) {
  if (!name || name === '-' || name === 'Not available') {
    return <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>—</span>;
  }
  return (
    <span
      style={{
        display: 'inline-block',
        maxWidth: 180,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        background: 'rgba(79,70,229,0.08)',
        color: '#4338ca',
        border: '1px solid rgba(79,70,229,0.18)',
        verticalAlign: 'middle'
      }}
      title={name}
    >
      {name}
    </span>
  );
}

const ALL_COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia',
  'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
  "Cote d'Ivoire", 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland',
  'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan',
  'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
  'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique',
  'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
  'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania',
  'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];

const ALL_SECTORS = [
  'Aerospace', 'Agriculture', 'Automotive', 'Banking', 'Biotechnology', 'Chemicals', 'Construction', 'Consulting',
  'Consumer Goods', 'Defense', 'Education', 'Energy', 'Engineering', 'Entertainment', 'Fashion', 'Finance', 'Food and Beverage',
  'Government', 'Healthcare', 'Hospitality', 'Human Resources', 'Information Technology', 'Insurance', 'Legal', 'Logistics',
  'Manufacturing', 'Marketing', 'Media', 'Mining', 'Nonprofit', 'Oil and Gas', 'Pharmaceuticals', 'Real Estate', 'Retail',
  'Sales', 'Software', 'Telecommunications', 'Textiles', 'Transportation', 'Travel', 'Utilities'
];

function normalizeText(value = '') {
  return String(value || '').trim();
}

function hasVisibleClientData(row = {}) {
  return [
    row.name,
    row.surname,
    row.designation,
    row.cmpName,
    row.sector,
    row.country,
    row.email,
    row.leadType,
    row.sourcer,
    row.userId,
    row.projectApproach,
    row.senderId
  ].some((value) => {
    const text = normalizeText(value);
    return text && text !== '-';
  });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

function formatDateOnly(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimeOnly(value) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleTimeString();
}

function matchesTextFilter(value, filterValue) {
  if (!filterValue) return true;
  return normalizeText(value).toLowerCase().includes(normalizeText(filterValue).toLowerCase());
}

function extractOptionValues(rows, key) {
  return Array.from(
    new Set(
      rows
        .map((row) => normalizeText(row[key]))
        .filter((value) => value && value !== '-')
    )
  ).sort((a, b) => a.localeCompare(b));
}

function formatDisplayDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function uniqueSorted(values = []) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function buildRowSearchBlob(row = {}) {
  return [
    row.name,
    row.surname,
    row.email,
    row.cmpName,
    row.designation,
    row.country,
    row.sector,
    row.source,
    row.city,
    row.leadType,
    row.sourcer,
    row.userId,
    row.projectApproach,
    row.senderId,
    row.campaignName,
    row.mailStatus,
    row.mailSentDate,
    row.mailSentTime
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .join(' ');
}

function normalizeDateInput(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
    const [day, month, year] = text.split('-');
    return `${year}-${month}-${day}`;
  }
  return text;
}

function validateEmailForSheet(raw = '') {
  const email = normalizeText(raw).toLowerCase();
  if (!email) return { ok: false, reason: 'Missing required data' };
  if (email.includes(' ')) return { ok: false, reason: 'Invalid email format: contains spaces' };
  if (email.includes('..')) return { ok: false, reason: 'Invalid email format: double dots' };
  if (email.startsWith('.') || email.endsWith('.')) return { ok: false, reason: 'Invalid email format: starts or ends with dot' };
  if (email.split('@').length !== 2) return { ok: false, reason: 'Invalid email format: must contain exactly one @' };
  if (!EMAIL_REGEX.test(email)) return { ok: false, reason: 'Invalid email format' };
  return { ok: true, reason: '' };
}

function splitDelimitedLine(line = '') {
  if (line.includes('\t')) return line.split('\t');
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function normalizeHeader(value = '') {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const PASTE_COLUMN_ALIASES = {
  name: ['name', 'firstname', 'first name', 'contact name', 'contact'],
  surname: ['surname', 'lastname', 'last name'],
  designation: ['designation', 'title', 'job title', 'position'],
  cmpName: ['cmp name', 'cmpname', 'company', 'company name', 'companyname', 'organization', 'organisation', 'account'],
  sector: ['sector', 'industry'],
  country: ['country'],
  email: ['email', 'e-mail', 'mail', 'mail id', 'email address'],
  listAddedDate: ['list added date', 'date', 'added date', 'upload date'],
  source: ['source'],
  leadType: ['lead type', 'leadtype'],
  sourcer: ['sourcer', 'source by', 'sourceby'],
  userId: ['user id', 'userid'],
  projectApproach: ['project approach', 'projectapproach', 'approach', 'used in project', 'usedinproject'],
  senderId: ['sender id', 'senderid']
};

function resolvePasteColumnKey(header = '') {
  const normalized = normalizeHeader(header);
  if (!normalized) return '';
  for (const column of PASTE_COLUMNS) {
    if (normalizeHeader(column.label) === normalized || normalizeHeader(column.key) === normalized) return column.key;
  }
  for (const [key, aliases] of Object.entries(PASTE_COLUMN_ALIASES)) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) return key;
  }
  return '';
}

function isCountry(text) {
  const t = text.trim().toLowerCase();
  if (t === 'uk' || t === 'us' || t === 'usa' || t === 'uae' || t === 'in' || t === 'netherlands' || t === 'canada') return true;
  return ALL_COUNTRIES.some((c) => c.toLowerCase() === t);
}

function autoDetectSector(row) {
  const text = `${row.cmpName || ''} ${row.designation || ''} ${row.email || ''}`.toLowerCase();
  if (text.includes('learning') || text.includes('education') || text.includes('design') || text.includes('training') || text.includes('school') || text.includes('course') || text.includes('teach')) {
    return 'Education';
  }
  if (text.includes('medical') || text.includes('hospital') || text.includes('healthcare') || text.includes('neurology') || text.includes('clinical') || text.includes('clinic')) {
    return 'Healthcare';
  }
  if (text.includes('consultant') || text.includes('consulting') || text.includes('foresight') || text.includes('advisor')) {
    return 'Consulting';
  }
  if (text.includes('pwc') || text.includes('bank') || text.includes('finance') || text.includes('invest') || text.includes('spglobal') || text.includes('s&p') || text.includes('strategist')) {
    return 'Consulting';
  }
  if (text.includes('software') || text.includes('developer') || text.includes('tech') || text.includes('data') || text.includes('information technology')) {
    return 'Software';
  }
  if (text.includes('marketing') || text.includes('media') || text.includes('speaker') || text.includes('pr') || text.includes('conference')) {
    return 'Marketing';
  }
  return 'Consulting';
}

function parseSingleClientBlock(blockLines) {
  let country = '';
  let email = '';
  let linkedin = '';
  let date = '';
  let sector = '';
  let designation = '';
  const rest = [];

  blockLines.forEach((line) => {
    const clean = line.trim();
    if (!clean) return;

    // 1. Detect Email
    if (clean.includes('@') && !clean.includes(' ') && !email) {
      email = clean.replace(/"/g, '');
      return;
    }
    // Handle multi-email or slashed/quoted emails like "clara7pfeffer@aol.com/clara.pfeffer@rtl.de"
    if (clean.includes('@') && (clean.includes('/') || clean.includes('"')) && !email) {
      email = clean.replace(/"/g, '');
      return;
    }

    // 2. Detect LinkedIn
    if ((clean.startsWith('http') || clean.includes('linkedin.com')) && !linkedin) {
      linkedin = clean;
      return;
    }

    // 3. Detect Date
    if ((/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean) || /^\d{4}-\d{2}-\d{2}$/.test(clean)) && !date) {
      date = clean;
      return;
    }

    // 4. Detect Country
    if (isCountry(clean) && !country) {
      country = clean;
      return;
    }

    // 5. Detect Sector
    const lower = clean.toLowerCase();
    if (['consulting', 'education', 'marketing', 'software', 'healthcare'].includes(lower) && !sector) {
      sector = clean.charAt(0).toUpperCase() + clean.slice(1);
      return;
    }

    rest.push(clean);
  });

  // Dynamic Company & Name assignment
  let cmpName = '';
  let fullName = '';

  if (rest.length >= 2) {
    // Standard sequence: Company name is typically followed by Full Name
    cmpName = rest[0];
    fullName = rest[1];
    if (rest.length > 2) {
      designation = rest.slice(2).join(' | ');
    }
  } else if (rest.length === 1) {
    fullName = rest[0];
  }

  // Split name and surname
  let name = '';
  let surname = '';
  if (fullName) {
    const nameParts = fullName.split(/\s+/);
    name = nameParts[0] || '';
    surname = nameParts.slice(1).join(' ') || '';
  }

  return {
    name,
    surname,
    designation: designation || '',
    cmpName,
    sector: sector || '',
    country,
    email: email.toLowerCase(),
    source: 'Pasted Block',
    leadType: '',
    sourcer: linkedin || '', // Map LinkedIn to Sourcer
    userId: '',
    projectApproach: '',
    senderId: ''
  };
}

function parsePastedRows(rawText = '') {
  const lines = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  if (!lines.length) return [];

  // Check if it's a vertical/block paste
  const hasTabsOrCommasPerLine = lines.slice(0, 5).some(line => line.includes('\t') || line.split(',').length >= 3);
  const hasEmails = lines.some(line => line.includes('@'));

  if (!hasTabsOrCommasPerLine && hasEmails) {
    const emailIndices = [];
    lines.forEach((line, idx) => {
      if (line.includes('@')) {
        emailIndices.push(idx);
      }
    });

    const blocks = [];
    let startIdx = 0;

    emailIndices.forEach((emailIdx, loopIdx) => {
      const nextEmailIdx = emailIndices[loopIdx + 1] ?? lines.length;
      
      let endIdx = emailIdx + 1;
      while (endIdx < nextEmailIdx) {
        const nextLine = lines[endIdx];
        if (isCountry(nextLine)) {
          break;
        }
        endIdx++;
      }

      const blockLines = lines.slice(startIdx, endIdx);
      const row = parseSingleClientBlock(blockLines);
      row._rowId = `paste-${Date.now()}-${loopIdx}`;
      blocks.push(row);

      startIdx = endIdx;
    });

    return blocks;
  } else {
    // Normal horizontal spreadsheet row parsing
    const parsed = lines.map(splitDelimitedLine);
    const firstLineKeys = parsed[0].map((cell) => resolvePasteColumnKey(cell));
    const hasHeader = firstLineKeys.filter(Boolean).length >= 2;
    const rows = hasHeader ? parsed.slice(1) : parsed;
    return rows.map((cells, rowIndex) => {
      const row = { _rowId: `paste-${Date.now()}-${rowIndex}` };
      cells.forEach((cell, index) => {
        const field = hasHeader ? firstLineKeys[index] : PASTE_COLUMNS[index]?.key;
        if (!field) return;
        row[field] = normalizeText(cell);
      });
      PASTE_COLUMNS.forEach((column) => {
        if (typeof row[column.key] !== 'string') row[column.key] = '';
      });
      row.email = normalizeText(row.email).toLowerCase();
      if (!normalizeText(row.sector)) row.sector = '';
      return row;
    }).filter(hasVisibleClientData);
  }
}

function createEmptyPasteRows(count = 8) {
  return Array.from({ length: count }, (_, index) => ({
    _rowId: `paste-empty-${Date.now()}-${index}`,
    ...Object.fromEntries(PASTE_COLUMNS.map((column) => [column.key, '']))
  }));
}

function getLeadValue(lead, ...keys) {
  const data = lead?.data || {};
  for (const key of keys) {
    const direct = normalizeText(lead?.[key]);
    if (direct) return direct;
    const nested = normalizeText(data?.[key]);
    if (nested) return nested;
  }
  return '';
}

function getLeadStatus(lead) {
  const explicitStatus = normalizeText(lead?.status);
  if (explicitStatus && explicitStatus !== 'Pending') return explicitStatus;
  const email = getLeadValue(lead, 'Email', 'email');
  return email ? 'Verified' : 'Missing Email';
}

function buildLeadRow(list, lead, listIndex, leadIndex) {
  const email = getLeadValue(lead, 'Email', 'email');
  const listAddedDateRaw =
    list?.uploadedAt ||
    list?.uploadDate ||
    list?.createdAt ||
    lead?.uploadDate ||
    getLeadValue(lead, 'List Added Date', 'ListAddedDate', 'listAddedDate') ||
    null;
  const designation = getLeadValue(lead, 'Designation', 'designation', 'Title', 'title') || '-';
  const freshLead = !lead?.sentAt && !lead?.failedAt;
  return {
    id: `${list?._id || listIndex}-${leadIndex}-${email || 'client'}`,
    sourceListId: String(list?._id || ''),
    sourceFile: String(list?.sourceFile || list?.name || ''),
    leadIndex,
    name: getLeadValue(lead, 'Name', 'name') || '-',
    surname: getLeadValue(lead, 'Surname', 'surname', 'Last Name', 'lastName') || '-',
    cmpName: getLeadValue(lead, 'CMP Name', 'cmpName', 'Company', 'company', 'Company Name', 'companyName') || '-',
    sector: getLeadValue(lead, 'Sector', 'sector', 'Industry', 'industry') || '-',
    country: getLeadValue(lead, 'Country', 'country') || '-',
    email: email || '-',
    designation,
    listAddedDate: formatDateOnly(listAddedDateRaw),
    listAddedDateRaw,
    campaignMailDate: formatDateTime(lead?.sentAt),
    city: getLeadValue(lead, 'City', 'city', 'Location', 'location') || '-',
    status: getLeadStatus(lead),
    source: String(list?.sourceFile || list?.name || 'Uploaded File'),
    leadType: getLeadValue(lead, 'Lead Type', 'LeadType', 'leadType') || '-',
    sourcer: getLeadValue(lead, 'Sourcer', 'sourcer', 'Source By', 'sourceBy') || '-',
    userId: getLeadValue(lead, 'User ID', 'UserId', 'userId', 'userIdText') || '-',
    projectApproach: getLeadValue(lead, 'Project Approach', 'ProjectApproach', 'projectApproach', 'Approach', 'approach', 'Used In Project', 'UsedInProject', 'usedInProject') || '-',
    senderId: getLeadValue(lead, 'Sender ID', 'SenderId', 'senderId') || '-',
    freshLead,
    rawLead: lead
  };
}

const EDITABLE_ROW_FIELDS = [
  'name',
  'surname',
  'designation',
  'cmpName',
  'sector',
  'country',
  'email',
  'listAddedDate',
  'source',
  'leadType',
  'sourcer',
  'userId',
  'projectApproach',
  'senderId'
];
const GRID_EDITABLE_FIELDS = [...EDITABLE_ROW_FIELDS];
const REFERENCE_TABLE_COLUMNS = [
  { field: 'name', label: 'Name' },
  { field: 'surname', label: 'Surname' },
  { field: 'designation', label: 'Designation' },
  { field: 'cmpName', label: 'CMP Name' },
  { field: 'sector', label: 'Sector' },
  { field: 'country', label: 'Country' },
  { field: 'email', label: 'Email' },
  { field: 'listAddedDate', label: 'List Added Date' },
  { field: 'source', label: 'Source' },
  { field: 'leadType', label: 'Lead Type' },
  { field: 'sourcer', label: 'Sourcer' },
  { field: 'userId', label: 'User ID' },
  { field: 'projectApproach', label: 'Project Approach' },
  { field: 'senderId', label: 'Sender ID' },
  { field: 'campaignName', label: 'Campaign Name' },
  { field: 'mailStatus', label: 'Mail Status' },
  { field: 'mailSentDate', label: 'Mail Sent Date' },
  { field: 'mailSentTime', label: 'Mail Sent Time' }
];
const CLIENT_ROWS_PER_PAGE = 100;

function mergeRowWithEdits(row, edits = {}) {
  return {
    ...row,
    ...Object.fromEntries(
      EDITABLE_ROW_FIELDS.map((field) => [field, typeof edits[field] === 'string' ? edits[field] : row[field]])
    )
  };
}

const ClientDirectoryFilters = memo(function ClientDirectoryFilters({
  initialFilters,
  filterOptions,
  hasAppliedFilters,
  isApplyingFilters,
  onApply,
  onReset
}) {
  const [localFilters, setLocalFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search || '');

  useEffect(() => {
    setLocalFilters(initialFilters);
    setSearchInput(initialFilters.search || '');
  }, [initialFilters]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setLocalFilters((current) => (current.search === searchInput ? current : { ...current, search: searchInput }));
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const updateField = useCallback((field, value) => {
    setLocalFilters((current) => ({ ...current, [field]: value }));
  }, []);

  const applyNow = useCallback(() => {
    onApply({ ...localFilters, search: searchInput });
  }, [localFilters, onApply, searchInput]);

  const hasLocalChanges = useMemo(() => {
    const normalizedSearch = normalizeText(searchInput);
    return normalizedSearch !== normalizeText(initialFilters.search)
      || localFilters.date !== initialFilters.date
      || localFilters.sector !== initialFilters.sector
      || localFilters.country !== initialFilters.country
      || localFilters.name !== initialFilters.name
      || localFilters.designation !== initialFilters.designation
      || localFilters.freshLead !== initialFilters.freshLead
      || localFilters.mailStatus !== initialFilters.mailStatus;
  }, [initialFilters, localFilters, searchInput]);

  const onEnterApply = useCallback((event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyNow();
  }, [applyNow]);

  return (
    <div className="client-data-directory-filters client-data-directory-filters-inline filter-section">
      <div className="filter-grid">
        <label className="client-data-filter-field">
          <span className="field-label">Search</span>
          <input className="input filter-input" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={onEnterApply} placeholder="Name, email, company, source..." />
        </label>
        <label className="client-data-filter-field">
          <span className="field-label">Date</span>
          <input className="input filter-input" type="date" value={localFilters.date} onChange={(event) => updateField('date', event.target.value)} />
        </label>
        <label className="client-data-filter-field">
          <span className="field-label">Sector</span>
          <select className="input filter-select" value={localFilters.sector} onChange={(event) => updateField('sector', event.target.value)}>
            <option value="">All sectors</option>
            {filterOptions.sector.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="client-data-filter-field">
          <span className="field-label">Country</span>
          <select className="input filter-select" value={localFilters.country} onChange={(event) => updateField('country', event.target.value)}>
            <option value="">All countries</option>
            {filterOptions.country.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="filter-grid-2">
        <label className="client-data-filter-field">
          <span className="field-label">Name</span>
          <input className="input filter-input" value={localFilters.name} onChange={(event) => updateField('name', event.target.value)} onKeyDown={onEnterApply} placeholder="Client name" />
        </label>
        <label className="client-data-filter-field">
          <span className="field-label">Designation</span>
          <input className="input filter-input" value={localFilters.designation} onChange={(event) => updateField('designation', event.target.value)} onKeyDown={onEnterApply} placeholder="Designation" />
        </label>
        <label className="client-data-filter-field">
          <span className="field-label">Fresh Lead</span>
          <select className="input filter-select" value={localFilters.freshLead} onChange={(event) => updateField('freshLead', event.target.value)}>
            <option value="">All leads</option>
            <option value="fresh">Fresh leads</option>
            <option value="contacted">Contacted leads</option>
          </select>
        </label>
        <label className="client-data-filter-field">
          <span className="field-label">Mail Status</span>
          <select className="input filter-select" value={localFilters.mailStatus} onChange={(event) => updateField('mailStatus', event.target.value)}>
            <option value="">All statuses</option>
            <option value="Sent">Sent</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
            <option value="Bounced">Bounced</option>
            <option value="Spam">Spam</option>
            <option value="Missing Email">Missing Email</option>
            <option value="Verified">Verified</option>
          </select>
        </label>
        <Button type="button" className="client-data-filter-apply" variant="secondary" onClick={applyNow} disabled={!hasLocalChanges || isApplyingFilters}>
          {isApplyingFilters ? 'Applying...' : 'Apply Filters'}
        </Button>
        <Button type="button" className="client-data-filter-reset" variant="ghost" onClick={onReset} disabled={(!hasAppliedFilters && !hasLocalChanges) || isApplyingFilters}>
          Reset Filters
        </Button>
      </div>
    </div>
  );
});

export default function ClientListPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'client-list';
    const tab = new URLSearchParams(window.location.search).get('tab');
    return ['upload', 'customize', 'bin', 'client-list'].includes(tab) ? tab : 'client-list';
  });
  const [lists, setLists] = useState([]);
  const [clientRowsData, setClientRowsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showClientDirectory] = useState(true);
  const [showCreatedSheetsPicker, setShowCreatedSheetsPicker] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [newSheetName, setNewSheetName] = useState('');
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [recentCreatedSheetId, setRecentCreatedSheetId] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [activeSourceSheetId, setActiveSourceSheetId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState('100');
  const [rowEdits, setRowEdits] = useState({});
  const [savingDirectory, setSavingDirectory] = useState(false);
  const [creatingRow, setCreatingRow] = useState(false);
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const [directorySelectedCells, setDirectorySelectedCells] = useState(new Set());
  const [directorySelectionAnchor, setDirectorySelectionAnchor] = useState(null);
  const [isSelectingDirectoryCells, setIsSelectingDirectoryCells] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [clipboardData, setClipboardData] = useState(null);
  const [showPastePanel, setShowPastePanel] = useState(true);
  const [pasteRawText, setPasteRawText] = useState('');
  const [pasteRows, setPasteRows] = useState([]);
  const [pasteColumns, setPasteColumns] = useState(PASTE_COLUMNS);
  const [savingPastedData, setSavingPastedData] = useState(false);
  const [creatingPasteSheet, setCreatingPasteSheet] = useState(false);
  const [customListModalOpen, setCustomListModalOpen] = useState(false);
  const [customListSource, setCustomListSource] = useState('directory');
  const [customListDraft, setCustomListDraft] = useState({
    name: '',
    description: '',
    project: '',
    campaignPurpose: '',
    tags: ''
  });
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const workspaceSaveTimerRef = useRef(null);
  const [usingCampaignListId, setUsingCampaignListId] = useState('');
  const [binSheets, setBinSheets] = useState([]);
  const [loadingBin, setLoadingBin] = useState(false);
  const [historySheetId, setHistorySheetId] = useState('');
  const [historyClients, setHistoryClients] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const toastTimeoutRef = useRef(null);
  const cellRefs = useRef({});
  const editUndoStackRef = useRef([]);
  const editRedoStackRef = useRef([]);
  const createdSheetsPickerRef = useRef(null);
  const clientListRef = useRef(null);
  const activeSection = activeTab;

  const switchClientDataTab = (tab) => {
    setActiveTab(tab);
    const nextUrl = tab === 'client-list' ? '/client-data/client-list' : `/client-data/client-list?tab=${tab}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
    }
  };

  const openClientDataList = (sheetId = '') => {
    setActiveTab('client-list');
    setShowCreatedSheetsPicker(false);
    if (sheetId) setActiveSourceSheetId(String(sheetId));
    const nextUrl = '/client-data/client-list';
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
    }
    requestAnimationFrame(() => clientListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  useEffect(() => {
    const syncTabFromLocation = () => {
      const tab = new URLSearchParams(window.location.search).get('tab');
      setActiveTab(['upload', 'customize', 'bin', 'client-list'].includes(tab) ? tab : 'client-list');
    };
    window.addEventListener('popstate', syncTabFromLocation);
    return () => window.removeEventListener('popstate', syncTabFromLocation);
  }, []);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!showCreatedSheetsPicker) return;
      if (!createdSheetsPickerRef.current) return;
      if (!createdSheetsPickerRef.current.contains(event.target)) {
        setShowCreatedSheetsPicker(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showCreatedSheetsPicker]);

  useEffect(() => () => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    if (workspaceSaveTimerRef.current) window.clearTimeout(workspaceSaveTimerRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    const loadWorkspace = async () => {
      try {
        const response = await fetch('/api/client-data/paste-workspace', { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        if (data?.ok && Array.isArray(data.rows) && data.rows.length > 0) {
          setPasteRows(data.rows);
        } else {
          setPasteRows(createEmptyPasteRows(6));
        }
      } catch {
        if (active) setPasteRows(createEmptyPasteRows(6));
      } finally {
        if (active) setWorkspaceLoaded(true);
      }
    };
    loadWorkspace();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) return;
    if (workspaceSaveTimerRef.current) window.clearTimeout(workspaceSaveTimerRef.current);
    workspaceSaveTimerRef.current = window.setTimeout(async () => {
      const filled = pasteRows.filter((row) => hasVisibleClientData(row) && !row._sourceRowId);
      try {
        setWorkspaceSaving(true);
        await fetch('/api/client-data/paste-workspace', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: filled })
        });
      } catch { /* silent */ } finally {
        setWorkspaceSaving(false);
      }
    }, 1500);
  }, [pasteRows, workspaceLoaded]);

  useEffect(() => {
    if (activeSection !== 'client-list') return undefined;

    const timer = setTimeout(() => {
      clientListRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [activeSection]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (!showCreatedSheetsPicker) return;
      if (!createdSheetsPickerRef.current) return;
      if (!createdSheetsPickerRef.current.contains(event.target)) {
        setShowCreatedSheetsPicker(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [showCreatedSheetsPicker]);

  useEffect(() => () => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    if (workspaceSaveTimerRef.current) window.clearTimeout(workspaceSaveTimerRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    const loadWorkspace = async () => {
      try {
        const response = await fetch('/api/client-data/paste-workspace', { cache: 'no-store' });
        const data = await response.json();
        if (!active) return;
        if (data?.ok && Array.isArray(data.rows) && data.rows.length > 0) {
          setPasteRows(data.rows);
        } else {
          setPasteRows(createEmptyPasteRows(6));
        }
      } catch {
        if (active) setPasteRows(createEmptyPasteRows(6));
      } finally {
        if (active) setWorkspaceLoaded(true);
      }
    };
    loadWorkspace();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) return;
    if (workspaceSaveTimerRef.current) window.clearTimeout(workspaceSaveTimerRef.current);
    workspaceSaveTimerRef.current = window.setTimeout(async () => {
      const filled = pasteRows.filter((row) => hasVisibleClientData(row) && !row._sourceRowId);
      try {
        setWorkspaceSaving(true);
        await fetch('/api/client-data/paste-workspace', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: filled })
        });
      } catch { /* silent */ } finally {
        setWorkspaceSaving(false);
      }
    }, 1500);
  }, [pasteRows, workspaceLoaded]);

  useEffect(() => {
    if (activeSection !== 'client-list') return undefined;

    const timer = setTimeout(() => {
      clientListRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [activeSection]);

  useEffect(() => {
    let active = true;

    const loadLists = async () => {
      try {
        setLoading(true);
        if (activeTab === 'upload' || activeTab === 'bin') {
          setLists([]);
          setClientRowsData([]);
          setError('');
          return;
        }
        const endpoint = activeTab === 'client-list' ? '/api/client-data/list' : '/api/client-data/custom-lists';
        const [resList, resExtracted, resCampaigns] = await Promise.all([
          fetch(endpoint, { cache: 'no-store' }),
          fetch('/api/client-data/extracted', { cache: 'no-store' }).catch(() => null),
          fetch('/api/campaigns?limit=200', { cache: 'no-store' }).catch(() => null)
        ]);

        const data = await resList.json();
        
        let extractedLists = [];
        if (resExtracted) {
          const extData = await resExtracted.json().catch(() => null);
          if (extData?.ok) {
            extractedLists = extData.lists || [];
          }
        }

        if (resCampaigns) {
          const campData = await resCampaigns.json().catch(() => null);
          if (campData?.ok || campData?.success) {
            setCampaigns(campData.campaigns || campData.data || []);
          }
        }

        if (!resList.ok || data?.ok === false) {
          throw new Error(data?.error || 'Failed to load client lists');
        }

        if (!active) return;

        const enrichedLists = (data.lists || []).map((list) => {
          const ext = extractedLists.find((el) => String(el._id) === String(list._id));
          return {
            ...list,
            metadata: ext?.metadata || ext?.dataCenterMeta || list.metadata || null,
            project: ext?.project || list.project || '',
            projectName: ext?.projectName || list.projectName || '',
            createdBy: ext?.createdBy || list.createdBy || '',
            description: ext?.description || list.description || '',
            campaignPurpose: ext?.campaignPurpose || list.campaignPurpose || '',
            tags: ext?.tags || list.tags || []
          };
        });

        setLists(enrichedLists);
        setClientRowsData(
          activeTab === 'client-list' && Array.isArray(data?.rows)
            ? data.rows.map((row) => ({
                ...row,
                mailSentDate: row.mailSentAt ? formatDateOnly(row.mailSentAt) : '',
                mailSentTime: row.mailSentAt ? formatTimeOnly(row.mailSentAt) : ''
              }))
            : []
        );
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load client lists');
        setLists([]);
        setClientRowsData([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadLists();
    return () => {
      active = false;
    };
  }, [activeTab, refreshNonce]);

  const uploadedFiles = useMemo(
    () => lists.filter((list) => !['custom', 'selected_client_sheet'].includes(String(list?.kind || 'uploaded'))),
    [lists]
  );

  const selectedClientSheets = useMemo(
    () => lists.filter((list) => ['custom', 'selected_client_sheet', 'custom_client_list'].includes(String(list?.kind || 'uploaded'))),
    [lists]
  );

  const customizeSheets = useMemo(
    () => lists.filter((list) => ['custom', 'selected_client_sheet', 'custom_client_list'].includes(String(list?.kind || ''))),
    [lists]
  );

  const allClientRows = useMemo(
    () => clientRowsData.filter(hasVisibleClientData),
    [clientRowsData]
  );

  const clientRows = useMemo(
    () => (
      activeSourceSheetId
        ? allClientRows.filter((row) => String(row.sourceListId || '') === String(activeSourceSheetId))
        : allClientRows
    ),
    [activeSourceSheetId, allClientRows]
  );

  const sheetTabs = useMemo(
    () => uploadedFiles.map((list) => ({
      id: String(list._id || ''),
      name: normalizeText(list.name) || normalizeText(list.sourceFile) || 'Client Sheet',
      sourceFile: normalizeText(list.sourceFile),
      count: Number(list.leadCount || 0)
    })),
    [uploadedFiles]
  );

  const filterOptions = useMemo(() => ({
    sector: uniqueSorted([
      ...ALL_SECTORS,
      ...extractOptionValues(clientRows, 'sector')
    ]),
    country: uniqueSorted([
      ...ALL_COUNTRIES,
      ...extractOptionValues(clientRows, 'country')
    ])
  }), [clientRows]);

  const rowsWithEdits = useMemo(
    () =>
      clientRows.map((baseRow) => {
        const row = mergeRowWithEdits(baseRow, rowEdits[baseRow.id]);
        return {
          ...row,
          _searchBlob: buildRowSearchBlob(row),
          _dateKey: normalizeDateInput(formatDateOnly(row.listAddedDateRaw) || formatDateOnly(row.listAddedDate)),
          _sector: normalizeText(row.sector).toLowerCase(),
          _country: normalizeText(row.country).toLowerCase(),
          _name: normalizeText(row.name).toLowerCase(),
          _designation: normalizeText(row.designation).toLowerCase()
        };
      }),
    [clientRows, rowEdits]
  );

  const duplicateEmailRowIds = useMemo(() => {
    const emailBuckets = new Map();
    for (const row of rowsWithEdits) {
      const email = normalizeText(row.email).toLowerCase();
      if (!email || email === '-') continue;
      if (!emailBuckets.has(email)) emailBuckets.set(email, []);
      emailBuckets.get(email).push(row.id);
    }
    const duplicateIds = new Set();
    for (const ids of emailBuckets.values()) {
      if (ids.length > 1) ids.forEach((id) => duplicateIds.add(id));
    }
    return duplicateIds;
  }, [rowsWithEdits]);

  const rowEmailIssues = useMemo(() => {
    const issues = {};
    for (const row of rowsWithEdits) {
      const result = validateEmailForSheet(row.email === '-' ? '' : row.email);
      if (!result.ok) {
        issues[row.id] = result.reason;
      }
    }
    return issues;
  }, [rowsWithEdits]);

  const filteredClientRows = useMemo(
    () => {
      const searchFilter = normalizeText(appliedFilters.search).toLowerCase();
      const dateFilter = normalizeDateInput(appliedFilters.date);
      const sectorFilter = normalizeText(appliedFilters.sector).toLowerCase();
      const countryFilter = normalizeText(appliedFilters.country).toLowerCase();
      const nameFilter = normalizeText(appliedFilters.name).toLowerCase();
      const designationFilter = normalizeText(appliedFilters.designation).toLowerCase();
      const mailStatusFilter = normalizeText(appliedFilters.mailStatus).toLowerCase();

      return rowsWithEdits.filter((row) => {
        if (searchFilter && !row._searchBlob.includes(searchFilter)) return false;
        if (dateFilter && row._dateKey !== dateFilter) return false;
        if (sectorFilter && !row._sector.includes(sectorFilter)) return false;
        if (countryFilter && !row._country.includes(countryFilter)) return false;
        if (nameFilter && !row._name.includes(nameFilter)) return false;
        if (designationFilter && !row._designation.includes(designationFilter)) return false;
        if (appliedFilters.freshLead === 'fresh' && !row.freshLead) return false;
        if (appliedFilters.freshLead === 'contacted' && row.freshLead) return false;
        if (mailStatusFilter && normalizeText(row.mailStatus).toLowerCase() !== mailStatusFilter) return false;
        return true;
      });
    },
    [rowsWithEdits, appliedFilters]
  );

  const campaignStats = useMemo(() => {
    const stats = { Sent: 0, Pending: 0, Failed: 0, Bounced: 0, Spam: 0, Verified: 0, 'Missing Email': 0 };
    for (const row of filteredClientRows) {
      const s = String(row.mailStatus || 'Pending');
      if (s in stats) stats[s] += 1;
      else stats.Pending += 1;
    }
    return stats;
  }, [filteredClientRows]);

  const hasAppliedFilters = useMemo(
    () => Object.values(appliedFilters).some(Boolean),
    [appliedFilters]
  );

  const pageSizeNumeric = useMemo(() => {
    if (pageSize === 'all') return filteredClientRows.length || 100;
    return parseInt(pageSize, 10) || 100;
  }, [pageSize, filteredClientRows.length]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredClientRows.length / pageSizeNumeric)),
    [filteredClientRows.length, pageSizeNumeric]
  );

  const paginatedClientRows = useMemo(() => {
    if (pageSize === 'all') return filteredClientRows;
    const start = (currentPage - 1) * pageSizeNumeric;
    return filteredClientRows.slice(start, start + pageSizeNumeric);
  }, [currentPage, filteredClientRows, pageSizeNumeric, pageSize]);

  const contactedCount = useMemo(
    () => filteredClientRows.filter((row) => Boolean(row.mailSentAt)).length,
    [filteredClientRows]
  );

  const visibleClientIds = useMemo(() => paginatedClientRows.map((row) => row.id), [paginatedClientRows]);
  useEffect(() => {
    if (!isSelectingDirectoryCells) return undefined;
    const stopSelecting = () => setIsSelectingDirectoryCells(false);
    window.addEventListener('mouseup', stopSelecting);
    return () => window.removeEventListener('mouseup', stopSelecting);
  }, [isSelectingDirectoryCells]);
  const selectedCount = selectedClientIds.length;
  const allVisibleSelected = visibleClientIds.length > 0 && visibleClientIds.every((id) => selectedClientIds.includes(id));
  const editedRowIds = useMemo(() => Object.keys(rowEdits), [rowEdits]);
  const hasEditedEmailErrors = useMemo(() => editedRowIds.some((rowId) => Boolean(rowEmailIssues[rowId])), [editedRowIds, rowEmailIssues]);
  const hasEditedDuplicateEmails = useMemo(() => editedRowIds.some((rowId) => duplicateEmailRowIds.has(rowId)), [editedRowIds, duplicateEmailRowIds]);
  const repeatedClientCount = duplicateEmailRowIds.size;

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (!activeSourceSheetId) return;
    if (!sheetTabs.some((sheet) => sheet.id === activeSourceSheetId)) {
      setActiveSourceSheetId('');
    }
  }, [activeSourceSheetId, sheetTabs]);

  const showToast = (tone, text) => {
    setToast({ tone, message: text });
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 5200);
  };

  const handleParsePastedData = () => {
    const rows = parsePastedRows(pasteRawText);
    setPasteRows(rows.length ? rows : createEmptyPasteRows(8));
    setSelectedRows(new Set());
    setShowPastePanel(true);
    if (rows.length) {
      showToast('success', `${rows.length} rows pasted successfully.`);
    } else {
      showToast('error', 'No usable pasted rows found.');
    }
  };

  const handlePasteRowChange = (rowIndex, field, value) => {
    setPasteRows((current) => current.map((row, index) => (
      index === rowIndex ? { ...row, [field]: value } : row
    )));
  };

  const filledPasteRows = useMemo(
    () => pasteRows.filter(hasVisibleClientData),
    [pasteRows]
  );

  const getDefaultCustomListName = (rows = []) => {
    const sectorCounts = {};
    rows.forEach((row) => {
      const sector = normalizeText(row.sector);
      if (sector && sector !== '-') sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });
    const [topSector] = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0] || [];
    return normalizeText(newSheetName) || `${topSector || 'Selected'} Clients ${formatDisplayDate()}`;
  };

  const selectedPasteRowsData = useMemo(
    () => filledPasteRows.filter((row) => selectedRows.has(row._rowId)),
    [filledPasteRows, selectedRows]
  );

  const selectedDirectoryRowsData = useMemo(
    () => rowsWithEdits.filter((row) => selectedClientIds.includes(row.id)),
    [rowsWithEdits, selectedClientIds]
  );

  const openCreateCustomListModal = (source) => {
    const rows = source === 'paste' ? selectedPasteRowsData : selectedDirectoryRowsData;
    if (!rows.length) {
      setSelectionError('Select client rows before creating a custom list.');
      showToast('error', 'Select client rows before creating a custom list.');
      return;
    }
    const invalidSelected = rows.some((row) => !validateEmailForSheet(row.email === '-' ? '' : row.email).ok);
    if (invalidSelected) {
      setSelectionError('Fix invalid email rows before creating a custom list.');
      showToast('error', 'Fix invalid email rows before creating a custom list.');
      return;
    }
    setCustomListSource(source);
    setCustomListDraft({
      name: getDefaultCustomListName(rows),
      description: '',
      project: normalizeText(rows[0]?.projectName || rows[0]?.project || ''),
      campaignPurpose: '',
      tags: ''
    });
    setCustomListModalOpen(true);
  };

  const handleCustomListDraftChange = (field, value) => {
    setCustomListDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmitCustomList = async (event) => {
    event?.preventDefault?.();
    const rows = customListSource === 'paste' ? selectedPasteRowsData : selectedDirectoryRowsData;
    const name = normalizeText(customListDraft.name);
    if (!name) {
      setSelectionError('Custom Sheet/List Name is required.');
      showToast('error', 'Custom Sheet/List Name is required.');
      return;
    }
    if (!rows.length) {
      setSelectionError('Select at least one client before creating a custom list.');
      showToast('error', 'Select at least one client before creating a custom list.');
      return;
    }
    try {
      setCreatingSheet(true);
      setCreatingPasteSheet(true);
      setSelectionError('');
      const parentListIds = Array.from(new Set(rows.map((row) => row.sourceListId).filter(Boolean)));
      const response = await fetch('/api/client-data/custom-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: customListDraft.description,
          project: customListDraft.project,
          projectName: customListDraft.project,
          campaignPurpose: customListDraft.campaignPurpose,
          tags: customListDraft.tags,
          parentListIds,
          clientIds: rows.map((row) => row.id || row._sourceRowId || row._rowId).filter(Boolean),
          rows
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to create custom list');
      }
      const nextList = data.list || {};
      setLists((current) => [nextList, ...current.filter((item) => String(item._id || item.id) !== String(nextList._id || nextList.id))]);
      setRecentCreatedSheetId(String(nextList._id || nextList.id || ''));
      setSelectedRows(new Set());
      setSelectedClientIds([]);
      setNewSheetName('');
      setCustomListModalOpen(false);
      setSelectionMessage(data.message || `Created ${name} with ${rows.length} selected clients.`);
      showToast('success', data.message || `Created ${name} with ${rows.length} selected clients.`);
      setActiveTab('customize');
      if (window.location.pathname + window.location.search !== '/client-data/client-list?tab=customize') {
        window.history.pushState(null, '', '/client-data/client-list?tab=customize');
      }
    } catch (err) {
      setSelectionError(err.message || 'Failed to create custom list');
      showToast('error', err.message || 'Failed to create custom list');
    } finally {
      setCreatingSheet(false);
      setCreatingPasteSheet(false);
    }
  };

  const togglePasteRowSelection = (rowId) => {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const toggleAllPasteRows = () => {
    const filledIds = filledPasteRows.map((row) => row._rowId);
    const allSelected = filledIds.length > 0 && filledIds.every((id) => selectedRows.has(id));
    setSelectedRows(allSelected ? new Set() : new Set(filledIds));
  };

  const focusPasteCell = (r, c) => {
    const el = document.querySelector(`.paste-input[data-row="${r}"][data-col="${c}"]`);
    if (el) {
      el.focus();
      el.select?.();
      return true;
    }
    return false;
  };

  const handleDeleteSelectedPasteRows = () => {
    if (!selectedRows.size) return;
    if (window.confirm(`Are you sure you want to delete the ${selectedRows.size} selected row(s) from the workspace?`)) {
      setPasteRows((current) => {
        const remaining = current.filter((row) => !selectedRows.has(row._rowId));
        return remaining.length ? remaining : createEmptyPasteRows(6);
      });
      setSelectedRows(new Set());
      showToast('success', 'Selected rows deleted from workspace.');
    }
  };

  const handlePasteGridKeyDown = (event, r, c) => {
    const input = event.target;
    const val = input.value;
    const cursorPosition = input.selectionStart;

    if (event.ctrlKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      toggleAllPasteRows();
      showToast('info', 'Workspace selection toggled.');
    } else if (event.ctrlKey && event.key === 'Delete') {
      event.preventDefault();
      if (window.confirm(`Delete row ${r + 1} from workspace?`)) {
        setPasteRows((current) => {
          const remaining = current.filter((_, idx) => idx !== r);
          return remaining.length ? remaining : createEmptyPasteRows(6);
        });
        showToast('success', `Row ${r + 1} deleted.`);
      }
    } else if (event.shiftKey && event.key === 'Delete') {
      event.preventDefault();
      handleDeleteSelectedPasteRows();
    } else if (event.shiftKey && event.key === ' ') {
      const currentRow = pasteRows[r];
      if (currentRow && hasVisibleClientData(currentRow)) {
        event.preventDefault();
        togglePasteRowSelection(currentRow._rowId);
      }
    } else if (event.key === 'ArrowUp') {
      if (focusPasteCell(r - 1, c)) {
        event.preventDefault();
      }
    } else if (event.key === 'ArrowDown') {
      if (focusPasteCell(r + 1, c)) {
        event.preventDefault();
      }
    } else if (event.key === 'ArrowLeft') {
      if (cursorPosition === 0) {
        if (focusPasteCell(r, c - 1)) {
          event.preventDefault();
        }
      }
    } else if (event.key === 'ArrowRight') {
      if (cursorPosition === val.length) {
        if (focusPasteCell(r, c + 1)) {
          event.preventDefault();
        }
      }
    } else if (event.key === 'Enter') {
      if (focusPasteCell(r + 1, c)) {
        event.preventDefault();
      }
    }
  };

  const handlePasteGridPaste = (event, startRowIndex, startColumnIndex) => {
    const rawText = event.clipboardData?.getData('text/plain');
    if (!rawText || !rawText.trim()) return;
    event.preventDefault();
    const incoming = parsePastedRows(rawText);
    if (!incoming.length) return;

    // Check if the pasted incoming rows are structured data
    const isStructured = incoming.some((row) => {
      const populatedKeys = Object.keys(row).filter((key) => key !== '_rowId' && row[key]);
      return row.email || row.country || row.sourcer || populatedKeys.length > 1;
    });

    setPasteRows((current) => {
      const next = [...current];
      incoming.forEach((sourceRow, rowOffset) => {
        const targetIndex = startRowIndex + rowOffset;
        while (!next[targetIndex]) {
          next.push({
            _rowId: `paste-extra-${Date.now()}-${next.length}`,
            ...Object.fromEntries(PASTE_COLUMNS.map((column) => [column.key, '']))
          });
        }
        const updated = { ...next[targetIndex] };

        if (isStructured) {
          // Smart mapping: align source keys directly into matching columns
          PASTE_COLUMNS.forEach((column) => {
            if (sourceRow[column.key] !== undefined && sourceRow[column.key] !== '') {
              updated[column.key] = sourceRow[column.key];
            }
          });
        } else {
          // Unstructured: shift and paste into active clicked column
          PASTE_COLUMNS.slice(startColumnIndex).forEach((column, colOffset) => {
            const sourceColumn = PASTE_COLUMNS[colOffset];
            if (!sourceColumn) return;
            updated[column.key] = sourceRow[sourceColumn.key] || '';
          });
        }

        next[targetIndex] = updated;
      });
      return next;
    });
    showToast('success', `${incoming.length} rows parsed and pasted successfully.`);
  };

  const handleAddPasteRows = () => {
    setPasteRows((current) => [...current, ...createEmptyPasteRows(1)]);
  };

  const handleAddPasteColumn = () => {
    const label = window.prompt('New column name', `Column ${pasteColumns.length + 1}`);
    const trimmedLabel = normalizeText(label);
    if (!trimmedLabel) return;
    const baseKey = normalizeHeader(trimmedLabel) || `column${pasteColumns.length + 1}`;
    let key = baseKey;
    let suffix = 2;
    while (pasteColumns.some((column) => column.key === key)) {
      key = `${baseKey}${suffix}`;
      suffix += 1;
    }
    setPasteColumns((current) => [...current, { key, label: trimmedLabel }]);
    setPasteRows((current) => current.map((row) => ({ ...row, [key]: '' })));
    showToast('success', `Column "${trimmedLabel}" added.`);
  };

  const handleRenamePasteColumn = () => {
    const current = pasteColumns[activeCell?.col || 0];
    if (!current) return;
    const label = window.prompt('Rename selected column', current.label);
    const trimmedLabel = normalizeText(label);
    if (!trimmedLabel || trimmedLabel === current.label) return;
    setPasteColumns((columns) => columns.map((column) => (
      column.key === current.key ? { ...column, label: trimmedLabel } : column
    )));
    showToast('success', `Column renamed to "${trimmedLabel}".`);
  };

  const handleDeletePasteColumn = () => {
    const current = pasteColumns[activeCell?.col || 0];
    if (!current || pasteColumns.length <= 1) return;
    if (!window.confirm(`Delete column "${current.label}" from the extracted table?`)) return;
    setPasteColumns((columns) => columns.filter((column) => column.key !== current.key));
    setPasteRows((rows) => rows.map((row) => {
      const next = { ...row };
      delete next[current.key];
      return next;
    }));
    setActiveCell({ row: 0, col: 0 });
    showToast('success', `Column "${current.label}" deleted.`);
  };

  const openPastePanel = () => {
    setShowPastePanel(true);
    setPasteRows((current) => (current.length ? current : createEmptyPasteRows(6)));
  };

  const pasteDuplicateRowIndexes = useMemo(() => {
    const existingEmails = new Set(rowsWithEdits.map((row) => normalizeText(row.email).toLowerCase()).filter((email) => email && email !== '-'));
    const seen = new Map();
    const duplicates = new Set();
    pasteRows.forEach((row, index) => {
      const email = normalizeText(row.email).toLowerCase();
      if (!email) return;
      if (existingEmails.has(email)) duplicates.add(index);
      if (seen.has(email)) {
        duplicates.add(index);
        duplicates.add(seen.get(email));
      }
      seen.set(email, index);
    });
    return duplicates;
  }, [pasteRows, rowsWithEdits]);

  const pasteInvalidRowIndexes = useMemo(() => {
    const invalid = new Set();
    pasteRows.forEach((row, index) => {
      if (!validateEmailForSheet(row.email).ok) invalid.add(index);
    });
    return invalid;
  }, [pasteRows]);

  const handleSavePastedData = async () => {
    if (!filledPasteRows.length) {
      setSelectionError('Paste and preview client rows before saving.');
      return;
    }
    try {
      setSavingPastedData(true);
      setSelectionError('');
      setSelectionMessage('');
      const response = await fetch('/api/client-data/extracted', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: filledPasteRows })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to save pasted data');
      }
      setSelectedRows(new Set());
      setRefreshNonce((value) => value + 1);
      setSelectionMessage(data.message || 'Extracted data saved.');
      showToast('success', data.message || 'Extracted data saved.');
    } catch (err) {
      setSelectionError(err.message || 'Failed to save pasted data');
      showToast('error', err.message || 'Failed to save pasted data');
    } finally {
      setSavingPastedData(false);
    }
  };

  const handleCreateSheetFromPastedRows = async () => {
    const selectedRowsData = filledPasteRows.filter((row) => selectedRows.has(row._rowId));
    if (!selectedRowsData.length) {
      setSelectionError('Select pasted table rows before creating a sheet.');
      showToast('error', 'Select pasted table rows before creating a sheet.');
      return;
    }
    const invalidSelected = selectedRowsData.some((row) => !validateEmailForSheet(row.email).ok);
    if (invalidSelected) {
      setSelectionError('Fix invalid email rows before creating a sheet.');
      showToast('error', 'Fix invalid email rows before creating a sheet.');
      return;
    }
    const sectorCounts = {};
    selectedRowsData.forEach((row) => {
      const s = String(row.sector || '').trim();
      if (s && s !== '-') {
        sectorCounts[s] = (sectorCounts[s] || 0) + 1;
      }
    });
    let mostCommonSector = '';
    let maxCount = 0;
    Object.entries(sectorCounts).forEach(([s, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonSector = s;
      }
    });
    const defaultName = normalizeText(newSheetName) || `${mostCommonSector || 'Selected'} Clients ${formatDisplayDate()}`;
    const promptedName = window.prompt('Rename selected client sheet', defaultName);
    if (promptedName === null) return;
    const trimmedName = normalizeText(promptedName) || defaultName;
    try {
      setCreatingPasteSheet(true);
      setSelectionError('');
      const response = await fetch('/api/client-data/selected-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          sourceFile: `${trimmedName}.pasted-selected`,
          rows: selectedRowsData
        })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to create selected pasted sheet');
      }
      const savedList = data.list || data;
      const nextList = {
        _id: savedList.listId || savedList._id,
        name: savedList.name || trimmedName,
        sourceFile: savedList.sourceFile || `${trimmedName}.pasted-selected`,
        kind: savedList.kind || 'selected_client_sheet',
        uploadedAt: savedList.uploadedAt || new Date().toISOString(),
        createdAt: savedList.createdAt || savedList.uploadedAt || new Date().toISOString(),
        leadCount: selectedRowsData.length,
        leads: selectedRowsData
      };
      setLists((current) => [nextList, ...current.filter((item) => String(item._id) !== String(nextList._id))]);
      setRecentCreatedSheetId(String(nextList._id));
      setActiveTab('customize');
      const createdRowIds = new Set(selectedRowsData.map((r) => r._rowId));
      setPasteRows((current) => {
        const remaining = current.filter((r) => !createdRowIds.has(r._rowId));
        return remaining.length ? remaining : createEmptyPasteRows(6);
      });
      setSelectedRows(new Set());
      setSelectionMessage(data.message || `Created selected sheet with ${selectedRowsData.length} pasted clients.`);
      showToast('success', data.message || `Created selected sheet with ${selectedRowsData.length} pasted clients.`);
    } catch (err) {
      setSelectionError(err.message || 'Failed to create selected pasted sheet');
      showToast('error', err.message || 'Failed to create selected pasted sheet');
    } finally {
      setCreatingPasteSheet(false);
    }
  };

  const toggleClientSelection = (clientId) => {
    setSelectedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((item) => item !== clientId)
        : [...current, clientId]
    );
    setSelectionMessage('');
    setSelectionError('');
  };

  const updateDirectoryEdits = (updater) => {
    setRowEdits((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      editUndoStackRef.current.push(current);
      if (editUndoStackRef.current.length > 50) editUndoStackRef.current.shift();
      editRedoStackRef.current = [];
      return next;
    });
  };

  const undoDirectoryEdit = () => {
    const previous = editUndoStackRef.current.pop();
    if (!previous) return;
    setRowEdits((current) => {
      editRedoStackRef.current.push(current);
      return previous;
    });
    showToast('info', 'Last table edit undone.');
  };

  const redoDirectoryEdit = () => {
    const next = editRedoStackRef.current.pop();
    if (!next) return;
    setRowEdits((current) => {
      editUndoStackRef.current.push(current);
      return next;
    });
    showToast('info', 'Table edit restored.');
  };

  const handleRowFieldChange = (rowId, field, value) => {
    updateDirectoryEdits((current) => ({
      ...current,
      [rowId]: {
        ...(current[rowId] || {}),
        [field]: value
      }
    }));
  };

  const focusGridCell = (rowId, field) => {
    const key = `${rowId}:${field}`;
    const input = cellRefs.current[key];
    if (input) {
      input.focus();
      input.select();
    }
    setActiveCell({ rowId, field });
  };

  const getDirectoryCellKey = (rowId, field) => `${rowId}:${field}`;

  const getDirectoryFieldIndex = (field) => REFERENCE_TABLE_COLUMNS.findIndex((column) => column.field === field);

  const getDirectoryCellValue = (row, field) => {
    const value = rowEdits[row.id]?.[field] ?? row[field] ?? '';
    return value === '-' ? '' : String(value);
  };

  const getDirectorySelectionEntries = () => {
    const entries = [];
    directorySelectedCells.forEach((key) => {
      const separatorIndex = key.lastIndexOf(':');
      if (separatorIndex < 0) return;
      const rowId = key.slice(0, separatorIndex);
      const field = key.slice(separatorIndex + 1);
      const rowIndex = paginatedClientRows.findIndex((row) => String(row.id) === rowId);
      const fieldIndex = getDirectoryFieldIndex(field);
      if (rowIndex >= 0 && fieldIndex >= 0) entries.push({ rowId, field, rowIndex, fieldIndex });
    });
    return entries;
  };

  const selectDirectoryCellRange = (start, end) => {
    if (!start || !end || !paginatedClientRows.length) return;
    const startCol = getDirectoryFieldIndex(start.field);
    const endCol = getDirectoryFieldIndex(end.field);
    if (startCol < 0 || endCol < 0) return;
    const minRow = Math.max(0, Math.min(start.rowIndex, end.rowIndex));
    const maxRow = Math.min(paginatedClientRows.length - 1, Math.max(start.rowIndex, end.rowIndex));
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const nextSelection = new Set();
    for (let currentRowIndex = minRow; currentRowIndex <= maxRow; currentRowIndex += 1) {
      const row = paginatedClientRows[currentRowIndex];
      if (!row) continue;
      for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
        const field = REFERENCE_TABLE_COLUMNS[colIndex]?.field;
        if (field) nextSelection.add(getDirectoryCellKey(row.id, field));
      }
    }
    setDirectorySelectedCells(nextSelection);
  };

  const selectDirectoryRow = (rowIndex) => {
    const row = paginatedClientRows[rowIndex];
    if (!row) return;
    const nextSelection = new Set(REFERENCE_TABLE_COLUMNS.map((column) => getDirectoryCellKey(row.id, column.field)));
    setDirectorySelectionAnchor({ rowIndex, field: REFERENCE_TABLE_COLUMNS[0]?.field || 'name' });
    setDirectorySelectedCells(nextSelection);
    focusGridCell(row.id, GRID_EDITABLE_FIELDS[0]);
  };

  const selectDirectoryColumn = (field) => {
    const fieldIndex = getDirectoryFieldIndex(field);
    if (fieldIndex < 0) return;
    const nextSelection = new Set(paginatedClientRows.map((row) => getDirectoryCellKey(row.id, field)));
    setDirectorySelectionAnchor({ rowIndex: 0, field });
    setDirectorySelectedCells(nextSelection);
    const firstRow = paginatedClientRows[0];
    if (firstRow) focusGridCell(firstRow.id, EDITABLE_ROW_FIELDS.includes(field) ? field : GRID_EDITABLE_FIELDS[0]);
  };

  const selectAllDirectoryCells = () => {
    const nextSelection = new Set();
    paginatedClientRows.forEach((row) => {
      REFERENCE_TABLE_COLUMNS.forEach((column) => nextSelection.add(getDirectoryCellKey(row.id, column.field)));
    });
    setDirectorySelectionAnchor({ rowIndex: 0, field: REFERENCE_TABLE_COLUMNS[0]?.field || 'name' });
    setDirectorySelectedCells(nextSelection);
  };

  const clearDirectorySelectedCells = (fallbackRowIndex, fallbackFieldIndex) => {
    const selectedEntries = getDirectorySelectionEntries();
    const fallbackField = GRID_EDITABLE_FIELDS[fallbackFieldIndex];
    const entries = selectedEntries.length
      ? selectedEntries
      : [{ rowIndex: fallbackRowIndex, fieldIndex: getDirectoryFieldIndex(fallbackField), field: fallbackField }];
    const editableEntries = entries.filter((entry) => EDITABLE_ROW_FIELDS.includes(entry.field));
    if (!editableEntries.length) {
      showToast('info', 'Only editable client information cells can be cleared.');
      return;
    }
    updateDirectoryEdits((current) => {
      const next = { ...current };
      editableEntries.forEach(({ rowIndex, field }) => {
        const row = paginatedClientRows[rowIndex];
        if (!row) return;
        next[row.id] = { ...(next[row.id] || {}), [field]: '' };
      });
      return next;
    });
    showToast('success', `${editableEntries.length} cell${editableEntries.length === 1 ? '' : 's'} cleared.`);
  };

  const handleDirectoryCellMouseDown = (event, rowIndex, field) => {
    const row = paginatedClientRows[rowIndex];
    if (!row) return;
    const point = { rowIndex, field };
    if (event.shiftKey && directorySelectionAnchor) {
      selectDirectoryCellRange(directorySelectionAnchor, point);
    } else {
      setDirectorySelectionAnchor(point);
      setDirectorySelectedCells(new Set([getDirectoryCellKey(row.id, field)]));
      setIsSelectingDirectoryCells(true);
    }
    if (!EDITABLE_ROW_FIELDS.includes(field)) focusGridCell(row.id, GRID_EDITABLE_FIELDS[0]);
  };

  const handleDirectoryCellMouseEnter = (rowIndex, field) => {
    if (!isSelectingDirectoryCells || !directorySelectionAnchor) return;
    selectDirectoryCellRange(directorySelectionAnchor, { rowIndex, field });
  };
  const copyDirectoryCells = async (rowIndex, fieldIndex, cut = false) => {
    const currentRow = paginatedClientRows[rowIndex];
    if (!currentRow) return;

    const selectedEntries = getDirectorySelectionEntries();
    let text = '';
    let clearEntries = [];

    if (selectedEntries.length) {
      let minRow = Infinity;
      let maxRow = -Infinity;
      let minCol = Infinity;
      let maxCol = -Infinity;
      selectedEntries.forEach(({ rowIndex: selectedRowIndex, fieldIndex: selectedFieldIndex }) => {
        minRow = Math.min(minRow, selectedRowIndex);
        maxRow = Math.max(maxRow, selectedRowIndex);
        minCol = Math.min(minCol, selectedFieldIndex);
        maxCol = Math.max(maxCol, selectedFieldIndex);
      });

      const selectedKeys = new Set(selectedEntries.map(({ rowId, field }) => getDirectoryCellKey(rowId, field)));
      const lines = [];
      for (let currentRowIndex = minRow; currentRowIndex <= maxRow; currentRowIndex += 1) {
        const row = paginatedClientRows[currentRowIndex];
        if (!row) continue;
        const values = [];
        for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
          const field = REFERENCE_TABLE_COLUMNS[colIndex]?.field;
          values.push(field && selectedKeys.has(getDirectoryCellKey(row.id, field)) ? getDirectoryCellValue(row, field) : '');
        }
        lines.push(values.join('\t'));
      }
      text = lines.join('\n');
      clearEntries = selectedEntries;
    } else {
      const selectedRowsForCopy = selectedClientIds.length
        ? paginatedClientRows.filter((row) => selectedClientIds.includes(row.id))
        : [currentRow];
      const fields = selectedClientIds.length
        ? REFERENCE_TABLE_COLUMNS.map((column) => column.field)
        : [GRID_EDITABLE_FIELDS[fieldIndex]];
      text = selectedRowsForCopy
        .map((row) => fields.map((field) => getDirectoryCellValue(row, field)).join('\t'))
        .join('\n');
      clearEntries = selectedRowsForCopy.flatMap((row) => fields.map((field) => ({
        rowIndex: paginatedClientRows.findIndex((item) => item.id === row.id),
        field
      })));
    }

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable');
      await navigator.clipboard.writeText(text);
      if (cut) {
        const editableEntries = clearEntries.filter((entry) => EDITABLE_ROW_FIELDS.includes(entry.field));
        updateDirectoryEdits((current) => {
          const next = { ...current };
          editableEntries.forEach(({ rowIndex: selectedRowIndex, field }) => {
            const row = paginatedClientRows[selectedRowIndex];
            if (!row) return;
            next[row.id] = { ...(next[row.id] || {}), [field]: '' };
          });
          return next;
        });
      }
      showToast('success', cut ? 'Selected cells cut to clipboard.' : 'Selected cells copied to clipboard.');
    } catch (error) {
      showToast('error', error.message || 'Unable to access clipboard.');
    }
  };
  const handleGridCellKeyDown = (event, rowIndex, fieldIndex) => {
    if (!paginatedClientRows.length) return;
    const maxRow = paginatedClientRows.length - 1;
    const maxCol = GRID_EDITABLE_FIELDS.length - 1;
    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === 'c') {
      event.preventDefault();
      void copyDirectoryCells(rowIndex, fieldIndex, false);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'x') {
      event.preventDefault();
      void copyDirectoryCells(rowIndex, fieldIndex, true);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redoDirectoryEdit();
      else undoDirectoryEdit();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'y') {
      event.preventDefault();
      redoDirectoryEdit();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault();
      void handleSaveDirectoryEdits();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'a') {
      event.preventDefault();
      selectAllDirectoryCells();
      showToast('info', 'Visible table cells selected.');
      return;
    }
    if (event.ctrlKey && event.key === 'Delete') {
      event.preventDefault();
      const currentRow = paginatedClientRows[rowIndex];
      if (currentRow) {
        if (window.confirm(`Permanently delete client "${currentRow.name}" from directory?`)) {
          void (async () => {
            try {
              const response = await fetch('/api/client-data/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowIds: [currentRow.id] })
              });
              const data = await response.json().catch(() => ({}));
              if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to delete client');
              setRefreshNonce((v) => v + 1);
              showToast('success', `Client "${currentRow.name}" deleted.`);
            } catch (err) {
              showToast('error', err.message || 'Failed to delete client');
            }
          })();
        }
      }
      return;
    }
    if (event.shiftKey && event.key === 'Delete') {
      event.preventDefault();
      void handleDeleteSelectedClients();
      return;
    }
    if (event.shiftKey && event.key === ' ') {
      event.preventDefault();
      const currentRow = paginatedClientRows[rowIndex];
      if (currentRow) {
        toggleClientSelection(currentRow.id);
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      clearDirectorySelectedCells(rowIndex, fieldIndex);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusGridCell(paginatedClientRows[rowIndex].id, GRID_EDITABLE_FIELDS[0]);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusGridCell(paginatedClientRows[rowIndex].id, GRID_EDITABLE_FIELDS[maxCol]);
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'Tab') {
      event.preventDefault();
      const nextCol = event.shiftKey ? Math.max(0, fieldIndex - 1) : Math.min(maxCol, fieldIndex + 1);
      focusGridCell(paginatedClientRows[rowIndex].id, GRID_EDITABLE_FIELDS[nextCol]);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusGridCell(paginatedClientRows[rowIndex].id, GRID_EDITABLE_FIELDS[Math.max(0, fieldIndex - 1)]);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      const nextRow = Math.min(maxRow, rowIndex + 1);
      focusGridCell(paginatedClientRows[nextRow].id, GRID_EDITABLE_FIELDS[fieldIndex]);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextRow = Math.max(0, rowIndex - 1);
      focusGridCell(paginatedClientRows[nextRow].id, GRID_EDITABLE_FIELDS[fieldIndex]);
    }
  };

  const handleGridPaste = async (event, startRowIndex, startFieldIndex) => {
    const rawText = event.clipboardData?.getData('text/plain');
    if (!rawText || !rawText.trim()) return;
    event.preventDefault();

    const selectedEditableEntries = getDirectorySelectionEntries()
      .filter((entry) => EDITABLE_ROW_FIELDS.includes(entry.field));
    if (selectedEditableEntries.length) {
      const topLeft = selectedEditableEntries.reduce((best, entry) => {
        const editableColIndex = GRID_EDITABLE_FIELDS.indexOf(entry.field);
        const bestEditableColIndex = GRID_EDITABLE_FIELDS.indexOf(best.field);
        if (entry.rowIndex < best.rowIndex) return entry;
        if (entry.rowIndex === best.rowIndex && editableColIndex < bestEditableColIndex) return entry;
        return best;
      }, selectedEditableEntries[0]);
      startRowIndex = topLeft.rowIndex;
      startFieldIndex = GRID_EDITABLE_FIELDS.indexOf(topLeft.field);
    }
    const rows = rawText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'));
    if (!rows.length) return;

    const overflowRows = [];
    updateDirectoryEdits((current) => {
      const next = { ...current };
      rows.forEach((pastedRow, rowOffset) => {
        const targetRowIndex = startRowIndex + rowOffset;
        const targetRow = paginatedClientRows[targetRowIndex];
        if (!targetRow) {
          const overflow = {};
          pastedRow.forEach((value, colOffset) => {
            const field = GRID_EDITABLE_FIELDS[startFieldIndex + colOffset];
            if (!field) return;
            overflow[field] = value;
          });
          overflowRows.push(overflow);
          return;
        }
        const rowPatch = { ...(next[targetRow.id] || {}) };
        pastedRow.forEach((value, colOffset) => {
          const field = GRID_EDITABLE_FIELDS[startFieldIndex + colOffset];
          if (!field) return;
          rowPatch[field] = value;
        });
        next[targetRow.id] = rowPatch;
      });
      return next;
    });
    showToast('success', `${rows.length} rows pasted successfully.`);
    if (overflowRows.length) {
      try {
        const response = await fetch('/api/client-data/paste', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: overflowRows, name: `Direct Table Paste ${new Date().toLocaleDateString()}` })
        });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to save overflow pasted rows');
        setRefreshNonce((value) => value + 1);
        showToast('success', `${overflowRows.length} extra rows added to Client Directory.`);
      } catch (err) {
        setSelectionError(err.message || 'Failed to add pasted overflow rows.');
        showToast('error', err.message || 'Failed to add pasted overflow rows.');
      }
    }
  };

  const handleSaveDirectoryEdits = async () => {
    const editedRowIds = Object.keys(rowEdits);
    if (!editedRowIds.length) {
      setSelectionMessage('No changes to save.');
      setSelectionError('');
      return;
    }

    const invalidEdited = editedRowIds.filter((rowId) => rowEmailIssues[rowId]);
    if (invalidEdited.length) {
      setSelectionError('Fix invalid email format rows before saving.');
      setSelectionMessage('');
      return;
    }

    const duplicateEdited = editedRowIds.filter((rowId) => duplicateEmailRowIds.has(rowId));
    if (duplicateEdited.length) {
      setSelectionError('Duplicate email rows found. Resolve duplicates before saving.');
      setSelectionMessage('');
      return;
    }

    try {
      setSavingDirectory(true);
      setSelectionError('');
      setSelectionMessage('');
      const updates = editedRowIds.map((rowId) => ({
        rowId,
        changes: rowEdits[rowId] || {}
      }));
      const response = await fetch('/api/client-data/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to save directory changes');
      }

      setRowEdits({});
      editUndoStackRef.current = [];
      editRedoStackRef.current = [];
      setSelectionMessage('Client Directory updates saved successfully.');
      setRefreshNonce((value) => value + 1);
    } catch (err) {
      setSelectionError(err.message || 'Failed to save client updates');
      setSelectionMessage('');
    } finally {
      setSavingDirectory(false);
    }
  };

  const handleCancelDirectoryEdits = () => {
    setRowEdits({});
    editUndoStackRef.current = [];
    editRedoStackRef.current = [];
    setSelectionError('');
    setSelectionMessage('Pending changes discarded.');
  };

  const toggleSelectAllVisible = () => {
    setSelectedClientIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleClientIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleClientIds]));
    });
    setSelectionMessage('');
    setSelectionError('');
  };

  const handleDeleteSelectedClients = async () => {
    if (!selectedClientIds.length) return;
    if (window.confirm(`Are you sure you want to permanently delete the ${selectedClientIds.length} selected client(s) from the directory?`)) {
      try {
        setSavingDirectory(true);
        setSelectionError('');
        setSelectionMessage('');
        const response = await fetch('/api/client-data/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowIds: selectedClientIds })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || 'Failed to delete selected clients');
        }
        setSelectedClientIds([]);
        setRefreshNonce((value) => value + 1);
        showToast('success', `${selectedClientIds.length} clients deleted from directory.`);
      } catch (err) {
        setSelectionError(err.message || 'Failed to delete selected clients.');
        showToast('error', err.message || 'Failed to delete selected clients.');
      } finally {
        setSavingDirectory(false);
      }
    }
  };

  const handleApplyFilters = useCallback((nextFilters) => {
    const normalized = {
      search: normalizeText(nextFilters.search),
      date: normalizeText(nextFilters.date),
      sector: normalizeText(nextFilters.sector),
      country: normalizeText(nextFilters.country),
      name: normalizeText(nextFilters.name),
      designation: normalizeText(nextFilters.designation),
      freshLead: normalizeText(nextFilters.freshLead)
    };
    setFilters(normalized);
    setIsApplyingFilters(true);
    requestAnimationFrame(() => {
      setAppliedFilters(normalized);
      setCurrentPage(1);
      setIsApplyingFilters(false);
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setCurrentPage(1);
  }, []);

  const handleSheetTabChange = (sheetId = '') => {
    setActiveSourceSheetId(String(sheetId || ''));
    setSelectedClientIds([]);
    setRowEdits({});
    setSelectionError('');
    setSelectionMessage('');
    setCurrentPage(1);
  };

  const handleRenameSourceSheet = async (sheet) => {
    const currentName = normalizeText(sheet?.name) || normalizeText(sheet?.sourceFile) || 'Client Sheet';
    const nextName = window.prompt('Rename Excel sheet', currentName);
    if (nextName === null) return;
    const trimmedName = normalizeText(nextName);
    if (!trimmedName || trimmedName === currentName) return;
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(String(sheet.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to rename sheet');
      }
      setLists((current) => current.map((item) => (
        String(item._id) === String(sheet.id) ? { ...item, name: trimmedName } : item
      )));
      showToast('success', 'Excel sheet renamed.');
    } catch (err) {
      setSelectionError(err.message || 'Failed to rename sheet');
      showToast('error', err.message || 'Failed to rename sheet');
    }
  };

  const handleAddNewRow = async () => {
    const sourceListId =
      (uploadedFiles.find((list) => String(list?.kind || 'uploaded') !== 'custom')?._id)
      || uploadedFiles[0]?._id
      || lists[0]?._id;
    if (!sourceListId) {
      setSelectionError('No list available to add a new row.');
      setSelectionMessage('');
      return;
    }

    try {
      setCreatingRow(true);
      setSelectionError('');
      setSelectionMessage('');
      const response = await fetch('/api/client-data/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceListId: String(sourceListId),
          row: {
            name: '',
            surname: '',
            designation: '',
            cmpName: '',
            sector: '',
            country: '',
            email: '',
            listAddedDate: '',
            source: '',
            leadType: '',
            sourcer: '',
            userId: '',
            projectApproach: '',
            senderId: ''
          }
        })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to add row');
      }
      setSelectionMessage('New empty row added.');
      setRefreshNonce((value) => value + 1);
    } catch (err) {
      setSelectionError(err.message || 'Failed to add row');
      setSelectionMessage('');
    } finally {
      setCreatingRow(false);
    }
  };

  const handleCreateSheet = async () => {
    const selectedRows = rowsWithEdits.filter((row) => selectedClientIds.includes(row.id));
    if (!selectedRows.length) {
      setSelectionError('Select at least one client first.');
      setSelectionMessage('');
      return;
    }

    const sectorCounts = {};
    selectedRows.forEach((row) => {
      const s = String(row.sector || '').trim();
      if (s && s !== '-') {
        sectorCounts[s] = (sectorCounts[s] || 0) + 1;
      }
    });
    let mostCommonSector = '';
    let maxCount = 0;
    Object.entries(sectorCounts).forEach(([s, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonSector = s;
      }
    });
    const defaultName = normalizeText(newSheetName) || `${mostCommonSector || 'Selected'} Clients ${formatDisplayDate()}`;
    const promptedName = window.prompt('Rename selected client sheet', defaultName);
    if (promptedName === null) return;
    const trimmedName = normalizeText(promptedName) || defaultName;
    const parentListIds = Array.from(new Set(selectedRows.map((row) => row.sourceListId).filter(Boolean)));
    const parentFiles = Array.from(new Set(selectedRows.map((row) => row.sourceFile).filter(Boolean)));

    try {
      setCreatingSheet(true);
      setSelectionError('');
      setSelectionMessage('');

      const response = await fetch('/api/client-data/selected-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          parentListIds,
          sourceFile: parentFiles.join(', ') || `${trimmedName}.csv`,
          rows: selectedRows.map((row) => ({
            Name: row.name === '-' ? '' : row.name,
            Email: row.email === '-' ? '' : row.email,
            Company: row.cmpName === '-' ? '' : row.cmpName,
            Designation: row.designation === '-' ? '' : row.designation,
            Country: row.country === '-' ? '' : row.country,
            Sector: row.sector === '-' ? '' : row.sector,
            City: row.city === '-' ? '' : row.city,
            Source: row.source === '-' ? '' : row.source,
            'Lead Type': row.leadType === '-' ? '' : row.leadType,
            Sourcer: row.sourcer === '-' ? '' : row.sourcer,
            'User ID': row.userId === '-' ? '' : row.userId,
            'Project Approach': row.projectApproach === '-' ? '' : row.projectApproach,
            'Sender ID': row.senderId === '-' ? '' : row.senderId
          }))
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create selected client sheet');
      }

      const savedList = data.list || data;
      const nextList = {
        _id: savedList.listId || savedList._id,
        name: savedList.name || trimmedName,
        sourceFile: savedList.sourceFile || `${trimmedName}.csv`,
        kind: savedList.kind || 'selected_client_sheet',
        clonedFrom: savedList.clonedFrom || parentListIds.join(','),
        uploadedAt: savedList.uploadedAt || new Date().toISOString(),
        createdAt: savedList.createdAt || savedList.uploadedAt || new Date().toISOString(),
        leadCount: selectedRows.length,
        leads: selectedRows.map((row) => ({
          Name: row.name === '-' ? '' : row.name,
          Surname: row.surname === '-' ? '' : row.surname,
          Designation: row.designation === '-' ? '' : row.designation,
          Company: row.cmpName === '-' ? '' : row.cmpName,
          Sector: row.sector === '-' ? '' : row.sector,
          Country: row.country === '-' ? '' : row.country,
          Email: row.email === '-' ? '' : row.email
        }))
      };

      setLists((current) => [nextList, ...current.filter((item) => String(item._id) !== String(nextList._id))]);
      setSelectionMessage(data.message || `Created ${trimmedName} with ${selectedRows.length} selected clients.`);
      showToast('success', data.message || `Created selected-client sheet with ${selectedRows.length} clients.`);
      setSelectedClientIds([]);
      setNewSheetName('');
      setRecentCreatedSheetId(String(nextList._id));
      setActiveTab('customize');
    } catch (err) {
      setSelectionError(err.message || 'Failed to create selected client sheet');
    } finally {
      setCreatingSheet(false);
    }
  };

  const handleUseForCampaign = async (listId) => {
    const normalizedListId = String(listId || '').trim();
    if (!normalizedListId) return;
    try {
      setUsingCampaignListId(normalizedListId);
      setSelectionError('');
      const response = await fetch('/api/client-data/use-for-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: normalizedListId })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to use sheet for campaign');
      }
      window.localStorage?.setItem?.('campaign:selectedClientListId', data.listId);
      window.localStorage?.setItem?.('campaign:selectedClientListName', data.name || '');
      showToast('success', `${data.name || 'Selected sheet'} attached to Campaign Workflow.`);
      router.push('/campaigns');
    } catch (err) {
      setSelectionError(err.message || 'Failed to use sheet for campaign');
      showToast('error', err.message || 'Failed to use sheet for campaign');
    } finally {
      setUsingCampaignListId('');
    }
  };

  const handleRenameCustomSheet = async (list) => {
    const currentName = normalizeText(list?.name) || 'Selected Clients';
    const nextName = window.prompt('Rename selected client sheet', currentName);
    if (nextName === null) return;
    const trimmedName = normalizeText(nextName);
    if (!trimmedName || trimmedName === currentName) return;
    try {
      const listId = String(list._id || list.id || '');
      const response = await fetch(`/api/client-data/custom-lists/${encodeURIComponent(listId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to rename sheet');
      }
      setLists((current) => current.map((item) => (
        String(item._id || item.id) === listId ? { ...item, name: trimmedName } : item
      )));
      showToast('success', 'Sheet renamed.');
    } catch (err) {
      setSelectionError(err.message || 'Failed to rename sheet');
      showToast('error', err.message || 'Failed to rename sheet');
    }
  };

  const handleDeleteCustomSheet = async (list) => {
    if (!window.confirm(`Delete "${list?.name || 'this sheet'}"?`)) return;
    try {
      const listId = String(list._id || list.id || '');
      const response = await fetch(`/api/client-data/custom-lists/${encodeURIComponent(listId)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to delete sheet');
      }
      setLists((current) => current.filter((item) => String(item._id || item.id) !== listId));
      showToast('success', 'Sheet deleted.');
    } catch (err) {
      setSelectionError(err.message || 'Failed to delete sheet');
      showToast('error', err.message || 'Failed to delete sheet');
    }
  };

  const loadBinSheets = async () => {
    try {
      setLoadingBin(true);
      const response = await fetch('/api/client-data/bin', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to load bin storage');
      setBinSheets(Array.isArray(data?.lists) ? data.lists : []);
    } catch (err) {
      showToast('error', err.message || 'Failed to load bin storage');
    } finally {
      setLoadingBin(false);
    }
  };

  const restoreBinSheet = async (listId) => {
    try {
      const response = await fetch('/api/client-data/bin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to restore sheet');
      showToast('success', 'Sheet restored.');
      setRefreshNonce((value) => value + 1);
      await loadBinSheets();
    } catch (err) {
      showToast('error', err.message || 'Failed to restore sheet');
    }
  };

  useEffect(() => {
    if (activeTab === 'bin') {
      void loadBinSheets();
    }
  }, [activeTab]);

  const loadSheetHistory = async (listId) => {
    try {
      setHistorySheetId(String(listId));
      setLoadingHistory(true);
      setHistoryClients([]);
      const response = await fetch(`/api/client-data/history?listId=${encodeURIComponent(String(listId))}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to load client history');
      setHistoryClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (err) {
      showToast('error', err.message || 'Failed to load client history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const openHistoryReply = (client, mode = 'reply') => {
    const campaignId = String(client?.campaignId || '').trim();
    const recipientEmail = String(client?.email || '').trim();
    const recipientLogId = String(client?.recipientLogId || '').trim();
    if (!campaignId || !recipientEmail) {
      showToast('error', 'No sent campaign thread is available for this client yet.');
      return;
    }
    const params = new URLSearchParams({ campaignId, recipientEmail, replyMode: mode });
    if (recipientLogId) params.set('recipientLogId', recipientLogId);
    router.push(`/campaigns?${params.toString()}`);
  };

  const renderPaginationRow = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    const startRow = (currentPage - 1) * pageSizeNumeric + 1;
    const endRow = Math.min(filteredClientRows.length, currentPage * pageSizeNumeric);

    return (
      <div className="client-data-pagination-row pagination-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '10px 20px', background: 'var(--cd-surface, #f8fafc)', borderBottom: '1px solid var(--cd-border-subtle, #e2e8f0)' }}>
        <div className="pagination-info" style={{ fontSize: '13px', color: 'var(--cd-text-3, #64748b)' }}>
          {filteredClientRows.length > 0 ? (
            <span>Showing <strong>{startRow}</strong>-<strong>{endRow}</strong> of <strong>{filteredClientRows.length}</strong> clients</span>
          ) : (
            <span>Showing 0 clients</span>
          )}
        </div>
        
        {pageSize !== 'all' && totalPages > 1 && (
          <div className="pagination-nav-buttons" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Button
              type="button"
              className="page-btn"
              variant="ghost"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
              title="First Page"
              style={{ padding: '0 6px', minWidth: '28px', height: '28px' }}
            >
              <i className="ti ti-chevrons-left" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              className="page-btn"
              variant="ghost"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              style={{ minWidth: '28px', height: '28px' }}
            >
              <i className="ti ti-chevron-left" aria-hidden="true" /> Previous
            </Button>
            
            {startPage > 1 && (
              <>
                <Button
                  type="button"
                  className={`page-btn ${currentPage === 1 ? 'active-page' : ''}`}
                  variant={currentPage === 1 ? 'secondary' : 'ghost'}
                  onClick={() => setCurrentPage(1)}
                  style={currentPage === 1 ? { background: 'var(--cd-accent, #4f46e5)', color: '#fff', fontWeight: 'bold', minWidth: '28px', height: '28px' } : { minWidth: '28px', height: '28px' }}
                >
                  1
                </Button>
                {startPage > 2 && <span style={{ color: 'var(--cd-text-3, #64748b)', padding: '0 4px', fontSize: '12px' }}>...</span>}
              </>
            )}

            {pages.map((p) => (
              <Button
                key={p}
                type="button"
                className={`page-btn ${currentPage === p ? 'active-page' : ''}`}
                variant={currentPage === p ? 'secondary' : 'ghost'}
                onClick={() => setCurrentPage(p)}
                style={currentPage === p ? { background: 'var(--cd-accent, #4f46e5)', color: '#fff', fontWeight: 'bold', minWidth: '28px', height: '28px' } : { minWidth: '28px', height: '28px' }}
              >
                {p}
              </Button>
            ))}

            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && <span style={{ color: 'var(--cd-text-3, #64748b)', padding: '0 4px', fontSize: '12px' }}>...</span>}
                <Button
                  type="button"
                  className={`page-btn ${currentPage === totalPages ? 'active-page' : ''}`}
                  variant={currentPage === totalPages ? 'secondary' : 'ghost'}
                  onClick={() => setCurrentPage(totalPages)}
                  style={currentPage === totalPages ? { background: 'var(--cd-accent, #4f46e5)', color: '#fff', fontWeight: 'bold', minWidth: '28px', height: '28px' } : { minWidth: '28px', height: '28px' }}
                >
                  {totalPages}
                </Button>
              </>
            )}

            <Button
              type="button"
              className="page-btn"
              variant="ghost"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
              style={{ minWidth: '28px', height: '28px' }}
            >
              Next <i className="ti ti-chevron-right" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              className="page-btn"
              variant="ghost"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Last Page"
              style={{ padding: '0 6px', minWidth: '28px', height: '28px' }}
            >
              <i className="ti ti-chevrons-right" aria-hidden="true" />
            </Button>
          </div>
        )}

        <div className="pagination-page-size-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--cd-text-3, #64748b)' }}>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const val = e.target.value;
              setPageSize(val);
              setCurrentPage(1);
            }}
            className="input"
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid var(--cd-border-subtle, #e2e8f0)',
              background: 'var(--cd-surface-2, #f1f5f9)',
              color: 'var(--cd-text, #0f172a)',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
              width: 'auto',
              height: 'auto'
            }}
          >
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="500">500</option>
            <option value="1000">1000</option>
            <option value="all">All</option>
          </select>
          {pageSize === 'all' && filteredClientRows.length > 500 && (
            <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: '600' }} className="all-rows-warning">
              ⚠️ Rendering {filteredClientRows.length} rows may cause lag
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
      {toast ? (
        <div className={`dashboard-toast dashboard-toast-${toast.tone}`} role="status" aria-live="polite">
          <div>
            <strong>{toast.tone === 'error' ? 'Action failed' : 'Action completed'}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="dashboard-toast-close" onClick={() => setToast(null)} aria-label="Close notification">x</button>
        </div>
      ) : null}
      {customListModalOpen ? (
        <div className="client-data-modal-backdrop" role="presentation" onMouseDown={() => setCustomListModalOpen(false)}>
          <form className="client-data-modal" onSubmit={handleSubmitCustomList} onMouseDown={(event) => event.stopPropagation()}>
            <div className="client-data-panel-head">
              <div>
                <h2 className="ui-card-title">Create Custom List/Sheet</h2>
                <p className="ui-card-description">
                  {(customListSource === 'paste' ? selectedPasteRowsData.length : selectedDirectoryRowsData.length)} selected clients will be saved as a named custom list.
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={() => setCustomListModalOpen(false)}>
                Close
              </Button>
            </div>
            <div className="client-data-modal-grid">
              <label className="client-data-custom-field">
                <span>Custom Sheet/List Name</span>
                <input
                  className="input"
                  value={customListDraft.name}
                  onChange={(event) => handleCustomListDraftChange('name', event.target.value)}
                  placeholder="Example: TEC founders June"
                  required
                />
              </label>
              <label className="client-data-custom-field">
                <span>Project</span>
                <input
                  className="input"
                  value={customListDraft.project}
                  onChange={(event) => handleCustomListDraftChange('project', event.target.value)}
                  placeholder="TEC, TUT, or project name"
                />
              </label>
              <label className="client-data-custom-field client-data-modal-span">
                <span>Description</span>
                <textarea
                  className="input client-data-custom-textarea"
                  value={customListDraft.description}
                  onChange={(event) => handleCustomListDraftChange('description', event.target.value)}
                  placeholder="Short identification note"
                />
              </label>
              <label className="client-data-custom-field">
                <span>Campaign Purpose</span>
                <input
                  className="input"
                  value={customListDraft.campaignPurpose}
                  onChange={(event) => handleCustomListDraftChange('campaignPurpose', event.target.value)}
                  placeholder="Outreach, follow-up, nurture"
                />
              </label>
              <label className="client-data-custom-field">
                <span>Tags</span>
                <input
                  className="input"
                  value={customListDraft.tags}
                  onChange={(event) => handleCustomListDraftChange('tags', event.target.value)}
                  placeholder="comma, separated, tags"
                />
              </label>
            </div>
            <div className="client-data-custom-actions">
              <p>Selected clients stay in the master extracted table.</p>
              <Button type="button" variant="ghost" onClick={() => setCustomListModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingSheet || creatingPasteSheet}>
                {creatingSheet || creatingPasteSheet ? 'Creating...' : 'Save Custom List'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      <div className="client-data-page">
        <ClientDataSectionNav activeTab={activeTab} onTabChange={switchClientDataTab} />
        <section className="ui-page-section">
          <div className="client-data-clientlist-stack">
            {activeTab === 'upload' ? (
              <>
                <section className="client-data-panel client-data-upload-compact-panel">
                  <div className="ui-card-content client-data-upload-compact">
                    <UploadSheetWorkflow
                      buttonClassName="client-data-section-switcher-button client-data-upload-sheet-button active"
                      inline
                      onUploadSaved={() => setRefreshNonce((value) => value + 1)}
                    />
                  </div>
                </section>
                <section className={`client-data-panel client-data-paste-panel ${showPastePanel ? '' : 'client-data-paste-panel-closed'}`}>
                  <div className="client-data-panel-head">
                    <div>
                      <h2 className="ui-card-title">Paste Extracted Data</h2>
                    </div>
                    <div className="client-data-panel-head-actions">
                      {showPastePanel ? (
                        <Button type="button" variant="ghost" onClick={() => setShowPastePanel(false)}>
                          Close
                        </Button>
                      ) : (
                        <Button type="button" onClick={openPastePanel}>
                          Open Sheet
                        </Button>
                      )}
                    </div>
                  </div>
                  {showPastePanel ? (
                    <div className="ui-card-content client-data-paste-workspace">
                      <div className="client-data-paste-actions">
                        <Button type="button" onClick={handleSavePastedData} disabled={savingPastedData || !pasteRows.length}>
                          {savingPastedData ? 'Saving...' : 'Save Pasted Data'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={handleAddPasteRows}>
                          Create Row
                        </Button>
                        <Button type="button" variant="ghost" onClick={handleAddPasteColumn}>
                          Add Column
                        </Button>
                        <Button type="button" variant="ghost" onClick={handleRenamePasteColumn}>
                          Rename Column
                        </Button>
                        <Button type="button" variant="ghost" onClick={handleDeletePasteColumn} disabled={pasteColumns.length <= 1} style={{ color: '#ef4444' }}>
                          Delete Column
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => openCreateCustomListModal('paste')} disabled={creatingPasteSheet || !selectedRows.size}>
                          {creatingPasteSheet ? 'Creating...' : 'Create Custom List/Sheet'}
                        </Button>
                        <Button type="button" variant="ghost" onClick={handleDeleteSelectedPasteRows} disabled={!selectedRows.size} style={{ color: '#ef4444' }}>
                          Delete Selected Rows
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => { setPasteRows(createEmptyPasteRows(6)); setSelectedRows(new Set()); showToast('success', 'Workspace cleared.'); }} style={{ color: '#ef4444', marginLeft: 4 }}>
                          Clear All
                        </Button>
                        <span>{filledPasteRows.length} filled rows | {selectedRows.size} selected | {pasteInvalidRowIndexes.size} invalid | {pasteDuplicateRowIndexes.size} repeated{workspaceSaving ? ' | saving...' : ''}</span>
                      </div>
                      {pasteRows.length ? (
                        <ExcelGrid
                          pasteRows={pasteRows}
                          setPasteRows={setPasteRows}
                          activeCell={activeCell}
                          setActiveCell={setActiveCell}
                          selectedRows={selectedRows}
                          setSelectedRows={setSelectedRows}
                          selectedCells={selectedCells}
                          setSelectedCells={setSelectedCells}
                          clipboardData={clipboardData}
                          setClipboardData={setClipboardData}
                          pasteInvalidRowIndexes={pasteInvalidRowIndexes}
                          pasteDuplicateRowIndexes={pasteDuplicateRowIndexes}
                          columns={pasteColumns}
                          hasVisibleClientData={hasVisibleClientData}
                          showToast={showToast}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}
            {activeTab === 'client-list' ? (
              <section className="client-data-panel client-data-directory-card directory-card" ref={clientListRef}>
                <div className="client-data-panel-head directory-header">
                  <div>
                    <div className="dir-title-row">
                      <h2 className="ui-card-title dir-title">Client Directory</h2>
                    </div>
                    <div className="ui-card-description client-directory-summary dir-meta">
                      <span className="dir-meta-item"><i className="ti ti-table" aria-hidden="true" /> {uploadedFiles.length} sheets</span>
                      <span className="dir-meta-item"><i className="ti ti-users" aria-hidden="true" /> {filteredClientRows.length} clients</span>
                      <span className="dir-meta-item"><span className="dir-meta-dot" aria-hidden="true" /> {repeatedClientCount} repeated</span>
                      <span className="dir-meta-item"><i className="ti ti-mail-check" aria-hidden="true" /> {contactedCount} contacted</span>
                    </div>
                    <div className="client-campaign-stats-bar">
                      {campaignStats.Sent > 0 && <span className="camp-stat camp-stat-sent"><i className="ti ti-circle-check" aria-hidden="true" /> {campaignStats.Sent} Sent</span>}
                      {campaignStats.Pending > 0 && <span className="camp-stat camp-stat-pending"><i className="ti ti-clock" aria-hidden="true" /> {campaignStats.Pending} Pending</span>}
                      {campaignStats.Failed > 0 && <span className="camp-stat camp-stat-failed"><i className="ti ti-circle-x" aria-hidden="true" /> {campaignStats.Failed} Failed</span>}
                      {campaignStats.Bounced > 0 && <span className="camp-stat camp-stat-bounced"><i className="ti ti-arrow-back" aria-hidden="true" /> {campaignStats.Bounced} Bounced</span>}
                      {campaignStats.Spam > 0 && <span className="camp-stat camp-stat-spam"><i className="ti ti-alert-triangle" aria-hidden="true" /> {campaignStats.Spam} Spam</span>}
                      {campaignStats.Verified > 0 && <span className="camp-stat camp-stat-verified"><i className="ti ti-shield-check" aria-hidden="true" /> {campaignStats.Verified} Verified</span>}
                      {campaignStats['Missing Email'] > 0 && <span className="camp-stat camp-stat-missing"><i className="ti ti-mail-off" aria-hidden="true" /> {campaignStats['Missing Email']} Missing Email</span>}
                    </div>
                    {repeatedClientCount ? (
                      <div className="client-directory-duplicate-summary warning-banner">
                        <i className="ti ti-alert-triangle" aria-hidden="true" />
                        <span>Repeated clients found: {repeatedClientCount}. Rows are highlighted in red.</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="client-data-panel-head-actions client-data-panel-head-actions-wide">
                  </div>
                </div>
                {selectionError ? <p className="client-data-custom-note error">{selectionError}</p> : null}
                {selectionMessage ? <p className="client-data-custom-note success">{selectionMessage}</p> : null}
                {showClientDirectory ? (
                  <div className="ui-card-content client-data-directory-content">
                    <ClientDirectoryFilters
                      initialFilters={filters}
                      filterOptions={filterOptions}
                      hasAppliedFilters={hasAppliedFilters}
                      isApplyingFilters={isApplyingFilters}
                      onApply={handleApplyFilters}
                      onReset={handleClearFilters}
                    />
                    <div className="client-data-source-sheet-tabs sheet-tabs-wrap" aria-label="Uploaded Excel sheet tabs">
                      <button
                        type="button"
                        className={`client-data-source-sheet-tab sheet-tab ${!activeSourceSheetId ? 'active' : ''}`}
                        onClick={() => handleSheetTabChange('')}
                      >
                        <strong>All Clients</strong>
                        <span className="sheet-tab-count">{allClientRows.length}</span>
                      </button>
                      {sheetTabs.map((sheet) => (
                        <button
                          key={sheet.id}
                          type="button"
                          className={`client-data-source-sheet-tab sheet-tab ${activeSourceSheetId === sheet.id ? 'active' : ''}`}
                          onClick={() => handleSheetTabChange(sheet.id)}
                          onDoubleClick={() => handleRenameSourceSheet(sheet)}
                          title={`${sheet.name}${sheet.sourceFile ? ` | ${sheet.sourceFile}` : ''}. Double click to rename.`}
                        >
                          <strong>{sheet.name}</strong>
                          <span className="sheet-tab-count">{sheet.count || allClientRows.filter((row) => String(row.sourceListId || '') === sheet.id).length}</span>
                        </button>
                      ))}
                    </div>
                    <div className="client-data-sheet-savebar client-data-table-toolbar table-toolbar">
                      <span className="ui-card-description showing-count">
                        Showing {filteredClientRows.length} of {clientRows.length} clients{activeSourceSheetId ? ' in selected sheet' : ''}.
                      </span>
                      <div className="client-data-filter-actions client-data-toolbar-actions">
                        <div ref={createdSheetsPickerRef} style={{ position: 'relative' }}>
                          <Button
                            type="button"
                            className="toolbar-btn success"
                            variant="ghost"
                            leftIcon={<i className="ti ti-table-options" aria-hidden="true" />}
                            onClick={() => setShowCreatedSheetsPicker((prev) => !prev)}
                          >
                            Created Sheets
                          </Button>
                          {showCreatedSheetsPicker ? (
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                left: 0,
                                zIndex: 50,
                                minWidth: 360,
                                maxHeight: 320,
                                overflowY: 'auto',
                                border: '1px solid var(--button-border)',
                                borderRadius: 10,
                                background: 'var(--panel-strong)',
                                padding: 10,
                                boxShadow: '0 12px 30px var(--shadow-color)'
                              }}
                            >
                              {selectedClientSheets.length ? selectedClientSheets.map((list) => (
                                <div key={`picker-${list._id}`} style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)' }}>
                                  <strong style={{ display: 'block' }}>{list.name || 'Selected client sheet'}</strong>
                                  <small style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: 6 }}>
                                    {Number(list.leadCount || list.leads?.length || 0)} clients
                                  </small>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => openClientDataList(list._id)}
                                    >
                                      Upload This Sheet
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleUseForCampaign(list._id)}
                                      disabled={usingCampaignListId === String(list._id)}
                                    >
                                      {usingCampaignListId === String(list._id) ? 'Opening...' : 'Use For Campaign'}
                                    </Button>
                                  </div>
                                </div>
                              )) : (
                                <p style={{ margin: 0 }}>No created sheets yet.</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          className="toolbar-btn"
                          variant="secondary"
                          leftIcon={<i className="ti ti-file-spreadsheet" aria-hidden="true" />}
                          onClick={() => openCreateCustomListModal('directory')}
                          disabled={creatingSheet || !selectedCount}
                        >
                          {creatingSheet ? 'Creating...' : 'Create Custom List/Sheet'}
                        </Button>
                        <Button
                          type="button"
                          className="toolbar-btn danger"
                          variant="ghost"
                          leftIcon={<i className="ti ti-trash" aria-hidden="true" />}
                          onClick={handleDeleteSelectedClients}
                          disabled={savingDirectory || !selectedCount}
                        >
                          Delete Selected Clients
                        </Button>
                        <Button
                          type="button"
                          className="toolbar-btn"
                          variant="secondary"
                          leftIcon={<i className="ti ti-device-floppy" aria-hidden="true" />}
                          onClick={handleSaveDirectoryEdits}
                          disabled={savingDirectory || !editedRowIds.length || hasEditedEmailErrors || hasEditedDuplicateEmails}
                        >
                          {savingDirectory ? 'Saving...' : 'Save Directory Changes'}
                        </Button>
                        <Button
                          type="button"
                          className="toolbar-btn add"
                          variant="secondary"
                          leftIcon={<i className="ti ti-plus" aria-hidden="true" />}
                          onClick={handleAddNewRow}
                          disabled={creatingRow}
                        >
                          {creatingRow ? 'Adding...' : 'Add New Row'}
                        </Button>
                        <Button
                          type="button"
                          className="toolbar-btn danger"
                          variant="ghost"
                          leftIcon={<i className="ti ti-x" aria-hidden="true" />}
                          onClick={handleCancelDirectoryEdits}
                          disabled={savingDirectory || !editedRowIds.length}
                        >
                          Cancel Changes
                        </Button>
                      </div>
                    </div>
                    {renderPaginationRow()}
                    <div className="client-data-table client-data-table-scroll client-data-table-desktop client-directory-table client-directory-excel-sheet client-data-reference-table-wrap">
                      <table className="client-data-reference-table data-table">
                        <thead>
                          <tr className="col-group-row">
                            <th colSpan={2} className="col-group-spacer" />
                            <th colSpan={14} className="col-group-label col-group-client">Client Information</th>
                            <th colSpan={4} className="col-group-label col-group-campaign">📧 Campaign Info</th>
                          </tr>
                          <tr>
                            <th>
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleSelectAllVisible}
                                aria-label="Select all visible clients"
                              />
                            </th>
                            <th>#</th>
                            {REFERENCE_TABLE_COLUMNS.map((column) => (
                              <th
                                key={column.field}
                                className={`${['campaignName','mailStatus','mailSentDate','mailSentTime'].includes(column.field) ? 'campaign-col-header' : ''} ${directorySelectedCells.size && paginatedClientRows.every((tableRow) => directorySelectedCells.has(getDirectoryCellKey(tableRow.id, column.field))) ? 'directory-column-selected' : ''}`}
                                onClick={() => selectDirectoryColumn(column.field)}
                                title="Click to select this column"
                              >
                                {column.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={REFERENCE_TABLE_COLUMNS.length + 2}>Loading client data...</td>
                            </tr>
                          ) : null}
                          {!loading && error ? (
                            <tr>
                              <td colSpan={REFERENCE_TABLE_COLUMNS.length + 2}>{error}</td>
                            </tr>
                          ) : null}
                          {!loading && !error && !filteredClientRows.length ? (
                            <tr>
                              <td colSpan={REFERENCE_TABLE_COLUMNS.length + 2}>No client data found.</td>
                            </tr>
                          ) : null}
                          {!loading && !error ? paginatedClientRows.map((row, rowIndex) => {
                            const rowHasDuplicateEmail = duplicateEmailRowIds.has(row.id);
                            const rowFullySelected = REFERENCE_TABLE_COLUMNS.every((column) => directorySelectedCells.has(getDirectoryCellKey(row.id, column.field)));
                            return (
                              <tr key={row.id} className={`${rowHasDuplicateEmail ? 'repeated client-directory-duplicate-row' : ''} ${rowFullySelected ? 'directory-row-selected' : ''}`.trim()}>
                                <td>
                                  <input
                                    type="checkbox"
                                    checked={selectedClientIds.includes(row.id)}
                                    onChange={() => toggleClientSelection(row.id)}
                                    aria-label={`Select ${row.name}`}
                                  />
                                </td>
                                <td className="client-row-number directory-row-selector" onClick={() => selectDirectoryRow(rowIndex)} title="Click to select this row">{(currentPage - 1) * pageSizeNumeric + rowIndex + 1}</td>
                                {REFERENCE_TABLE_COLUMNS.map(({ field }) => {
                                  const rawValue = rowEdits[row.id]?.[field] ?? row[field] ?? '';
                                  const value = rawValue === '-' ? '' : rawValue;
                                  const isEdited = typeof rowEdits[row.id]?.[field] === 'string';
                                  const emailHasIssue = field === 'email' && Boolean(rowEmailIssues[row.id]);
                                  const hasDuplicateEmail = field === 'email' && rowHasDuplicateEmail;
                                  const isEditable = EDITABLE_ROW_FIELDS.includes(field);
                                  const displayValue = value === 0 ? '0' : String(value || '').trim() || 'Not available';
                                  const isCampaignCol = ['campaignName','mailStatus','mailSentDate','mailSentTime'].includes(field);
                                  const cellKey = getDirectoryCellKey(row.id, field);
                                  const isDirectoryCellSelected = directorySelectedCells.has(cellKey);
                                  return (
                                    <td
                                      key={`${row.id}-${field}`}
                                      className={`client-list-sheet-cell-wrap${isCampaignCol ? ' campaign-info-cell' : ''}${isDirectoryCellSelected ? ' directory-cell-selected' : ''}`}
                                      onMouseDown={(event) => handleDirectoryCellMouseDown(event, rowIndex, field)}
                                      onMouseEnter={() => handleDirectoryCellMouseEnter(rowIndex, field)}
                                    >
                                      {isEditable ? (
                                        <input
                                          ref={(node) => {
                                            cellRefs.current[`${row.id}:${field}`] = node;
                                          }}
                                          type={field === 'listAddedDate' ? 'date' : 'text'}
                                          className={`client-list-sheet-cell ${field === 'name' ? 'name-cell' : ''} ${activeCell?.rowId === row.id && activeCell?.field === field ? 'active' : ''} ${isDirectoryCellSelected ? 'selected' : ''} ${isEdited ? 'edited' : ''} ${emailHasIssue || hasDuplicateEmail ? 'invalid' : ''}`}
                                          value={value}
                                          placeholder="Not provided"
                                          onFocus={() => setActiveCell({ rowId: row.id, field })}
                                          onClick={() => setActiveCell({ rowId: row.id, field })}
                                          onChange={(event) => handleRowFieldChange(row.id, field, event.target.value || '')}
                                          onKeyDown={(event) => handleGridCellKeyDown(event, rowIndex, GRID_EDITABLE_FIELDS.indexOf(field))}
                                          onPaste={(event) => handleGridPaste(event, rowIndex, GRID_EDITABLE_FIELDS.indexOf(field))}
                                          aria-label={`${field} row ${rowIndex + 1}`}
                                        />
                                      ) : field === 'mailStatus' ? (
                                        <MailStatusBadge status={value || 'Pending'} />
                                      ) : field === 'campaignName' ? (
                                        <CampaignNameChip name={value} />
                                      ) : field === 'mailSentDate' ? (
                                        <span className="client-list-history-cell campaign-date-cell" title={displayValue}>
                                          {value ? <><i className="ti ti-calendar" aria-hidden="true" style={{ marginRight: 4 }} />{value}</> : <span style={{ color: 'var(--text-muted,#94a3b8)' }}>—</span>}
                                        </span>
                                      ) : field === 'mailSentTime' ? (
                                        <span className="client-list-history-cell campaign-date-cell" title={displayValue}>
                                          {value ? <><i className="ti ti-clock" aria-hidden="true" style={{ marginRight: 4 }} />{value}</> : <span style={{ color: 'var(--text-muted,#94a3b8)' }}>—</span>}
                                        </span>
                                      ) : (
                                        <span
                                          className="client-list-history-cell"
                                          title={displayValue}
                                        >
                                          {displayValue}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          }) : null}
                        </tbody>
                      </table>
                    </div>
                    {renderPaginationRow()}
                    <div className="client-data-directory-legend legend">
                      <div className="legend-item">
                        <span className="legend-dot repeated" aria-hidden="true" />
                        <span>Repeated client (row highlighted in red)</span>
                      </div>
                    </div>
                    {hasEditedEmailErrors ? (
                      <div className="client-data-custom-note error">Invalid email format detected in edited rows. Fix before saving.</div>
                    ) : null}
                    {hasEditedDuplicateEmails ? (
                      <div className="client-data-custom-note error">Duplicate email rows detected. Resolve duplicates before saving.</div>
                    ) : null}
                    <div className="client-data-mobile-list">
                      {loading ? (
                        <article className="client-data-mobile-card">
                          <strong>Loading client data...</strong>
                        </article>
                      ) : null}
                      {!loading && error ? (
                        <article className="client-data-mobile-card">
                          <strong>{error}</strong>
                        </article>
                      ) : null}
                      {!loading && !error && !filteredClientRows.length ? (
                        <article className="client-data-mobile-card">
                          <strong>No client data found.</strong>
                        </article>
                      ) : null}
                      {!loading && !error ? paginatedClientRows.map((row) => (
                        <article key={`${row.id}-mobile`} className={`client-data-mobile-card ${duplicateEmailRowIds.has(row.id) ? 'client-directory-duplicate-card' : ''}`}>
                          <label className="client-data-mobile-select">
                            <input
                              type="checkbox"
                              checked={selectedClientIds.includes(row.id)}
                              onChange={() => toggleClientSelection(row.id)}
                              aria-label={`Select ${row.name}`}
                            />
                            <span>Select client</span>
                          </label>
                          <div className="client-data-mobile-head">
                            <strong>{row.name} {row.surname !== '-' ? row.surname : ''}</strong>
                            <Badge variant={badgeToneMap[row.mailStatus] || 'default'}>{row.mailStatus}</Badge>
                          </div>
                          <div className="client-data-mobile-grid">
                            <div><span>CMP Name</span><strong>{row.cmpName}</strong></div>
                            <div><span>Designation</span><strong>{row.designation}</strong></div>
                            <div><span>Sector</span><strong>{row.sector}</strong></div>
                            <div><span>Country</span><strong>{row.country}</strong></div>
                            <div><span>Email</span><strong>{row.email}</strong></div>
                            <div><span>List Added</span><strong>{row.listAddedDate}</strong></div>
                            <div><span>Source</span><strong>{row.source}</strong></div>
                            <div><span>Lead Type</span><strong>{row.leadType}</strong></div>
                            <div><span>Sourcer</span><strong>{row.sourcer}</strong></div>
                            <div><span>User ID</span><strong>{row.userId}</strong></div>
                            <div><span>Project Approach</span><strong>{row.projectApproach}</strong></div>
                            <div><span>Sender ID</span><strong>{row.senderId}</strong></div>
                            <div><span>Campaign Name</span><strong>{row.campaignName || '-'}</strong></div>
                            <div><span>Mail Status</span><strong>{row.mailStatus || 'Pending'}</strong></div>
                            <div><span>Mail Sent Date</span><strong>{row.mailSentDate || '-'}</strong></div>
                            <div><span>Mail Sent Time</span><strong>{row.mailSentTime || '-'}</strong></div>
                          </div>
                        </article>
                      )) : null}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
            {activeTab === 'customize' ? (
              <section className="client-data-panel client-data-clientlist-secondary client-data-panel-compact">
                <div className="client-data-panel-head">
                  <div>
                    <h2 className="ui-card-title">Customize List</h2>
                  </div>
                </div>
                <div className="ui-card-content">
                  <div className="client-data-health-list">
                    {customizeSheets.length ? customizeSheets.map((list) => (
                      <div key={list._id || list.id} className={String(list._id || list.id) === recentCreatedSheetId ? 'client-data-sheet-highlight' : ''}>
                        <strong>{list.name || 'Custom client list'}</strong>
                        <span>Description: {list.description || list.metadata?.description || '-'}</span>
                        <span>Project: {list.projectName || list.project || '-'} | Total Clients: {Number(list.totalClients || list.leadCount || list.leads?.length || 0)}</span>
                        <span>Created Date: {formatDateOnly(list.createdAt || list.uploadedAt) || '-'} | Created Time: {formatTimeOnly(list.createdAt || list.uploadedAt)} | Created By: {list.createdBy || list.metadata?.createdByEmail || '-'}</span>
                        <span>Tags: {Array.isArray(list.tags) && list.tags.length ? list.tags.join(', ') : '-'}</span>
                        <div style={{ marginTop: 8 }}>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openClientDataList(list._id || list.id)}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRenameCustomSheet(list)}
                            style={{ marginLeft: 8 }}
                          >
                            Rename
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUseForCampaign(list._id || list.id)}
                            disabled={usingCampaignListId === String(list._id || list.id)}
                            style={{ marginLeft: 8 }}
                          >
                            {usingCampaignListId === String(list._id || list.id) ? 'Opening...' : 'Use for Campaign'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => openClientDataList(list._id || list.id)}
                            style={{ marginLeft: 8 }}
                          >
                            Edit Clients
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => loadSheetHistory(list._id || list.id)}
                            style={{ marginLeft: 8 }}
                          >
                            History
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteCustomSheet(list)}
                            style={{ marginLeft: 8 }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <div>
                        <strong>No custom sheets yet.</strong>
                      </div>
                    )}
                  </div>
                  {historySheetId ? (
                    <div className="client-data-history-panel">
                      <div className="client-data-panel-head">
                        <div>
                          <h3 className="ui-card-title">Client Mail History</h3>
                          <p className="ui-card-description">Cover Story, Reminder, Follow-up, Up Cost, and Final Cost status for every client.</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setHistorySheetId(''); setHistoryClients([]); }}>
                          Close
                        </Button>
                      </div>
                      {loadingHistory ? <p className="ui-card-description">Loading history...</p> : null}
                      {!loadingHistory && historyClients.length ? (
                        <div className="client-data-history-list">
                          {historyClients.slice(0, 80).map((client) => (
                            <article key={`${historySheetId}-${client.email}`} className="client-data-history-card">
                              <div className="client-data-history-card-head">
                                <div>
                                  <strong>{client.name}</strong>
                                  <span>{client.email}</span>
                                </div>
                                <Badge variant={client.responseReceived ? 'success' : client.stage === 'Failed' ? 'danger' : 'default'}>{client.stage}</Badge>
                              </div>
                              <div className="client-data-history-meta">
                                <span>{client.company}</span>
                                <span>Sent {client.sentCount}</span>
                                <span>Replies {client.replyCount}</span>
                                {client.threadStatus ? <span>Thread {client.threadStatus}</span> : null}
                                {client.lastFollowUpAt ? <span>Last follow-up {formatDateTime(client.lastFollowUpAt)}</span> : null}
                                {client.responseReceived ? <span>Response: {client.replyType || 'received'}</span> : null}
                                {client.followUpStopped ? <span>{client.followUpStopReason || 'Follow-up stopped'}</span> : null}
                              </div>
                              {client.replyPreview ? <p className="client-data-history-reply">{client.replyPreview}</p> : null}
                              <div className="client-data-history-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                                <Button type="button" variant="secondary" size="sm" disabled={!client.campaignId || client.sentCount < 1} onClick={() => openHistoryReply(client, 'reply')}>Reply</Button>
                                <Button type="button" variant="secondary" size="sm" disabled={!client.campaignId || client.sentCount < 1} onClick={() => openHistoryReply(client, 'reply_all')}>Reply All</Button>
                              </div>
                              <div className="client-data-history-steps">
                                {client.steps.map((step) => (
                                  <div key={`${client.email}-${step.stepNumber}`} className={`client-data-history-step client-data-history-step-${String(step.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                                    <strong>{step.label}</strong>
                                    <span>{step.status || 'Pending'}</span>
                                    <small>{formatDateTime(step.sentAt || step.repliedAt || step.skippedAt || step.failedAt)}</small>
                                  </div>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : null}
                      {!loadingHistory && !historyClients.length ? <p className="ui-card-description">No campaign history found for this sheet yet.</p> : null}
                    </div>
                  ) : null}
                  <div className="client-data-bin-panel">
                    <div className="client-data-panel-head">
                      <div>
                        <h3 className="ui-card-title">Bin Storage</h3>
                        <p className="ui-card-description">Uploaded files auto move here after 7 days. Deleted sheets also appear here.</p>
                      </div>
                      <Button type="button" variant="secondary" size="sm" onClick={loadBinSheets} disabled={loadingBin}>
                        {loadingBin ? 'Loading...' : 'Show Bin'}
                      </Button>
                    </div>
                    {binSheets.length ? (
                      <div className="client-data-bin-list">
                        {binSheets.map((sheet) => (
                          <article key={`bin-${sheet._id}`} className="client-data-bin-card">
                            <strong>{sheet.name || sheet.sourceFile || 'Deleted sheet'}</strong>
                            <span>{Number(sheet.leadCount || 0)} clients | deleted {formatDateTime(sheet.deletedAt)}</span>
                            <small>{sheet.deleteReason || 'Deleted'}</small>
                            <Button type="button" variant="ghost" size="sm" onClick={() => restoreBinSheet(sheet._id)}>
                              Restore
                            </Button>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
            {activeTab === 'bin' ? (
              <section className="client-data-panel client-data-clientlist-secondary client-data-panel-compact">
                <div className="client-data-panel-head">
                  <div>
                    <h2 className="ui-card-title">Bin Storage</h2>
                    <p className="ui-card-description">Deleted sheets and files auto-moved after their 7-day timer appear here.</p>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={loadBinSheets} disabled={loadingBin}>
                    {loadingBin ? 'Loading...' : 'Refresh Bin'}
                  </Button>
                </div>
                <div className="ui-card-content">
                  {loadingBin ? <p className="ui-card-description">Loading bin storage...</p> : null}
                  {!loadingBin && !binSheets.length ? (
                    <div className="client-data-bin-empty">
                      <strong>No deleted sheets in bin.</strong>
                      <span>Your active sheets are still available in Client List and Customize List.</span>
                    </div>
                  ) : null}
                  {binSheets.length ? (
                    <div className="client-data-bin-list">
                      {binSheets.map((sheet) => (
                        <article key={`bin-page-${sheet._id}`} className="client-data-bin-card">
                          <strong>{sheet.name || sheet.sourceFile || 'Deleted sheet'}</strong>
                          <span>{Number(sheet.leadCount || 0)} clients | deleted {formatDateTime(sheet.deletedAt)}</span>
                          <small>{sheet.deleteReason || 'Deleted'}</small>
                          <Button type="button" variant="ghost" size="sm" onClick={() => restoreBinSheet(sheet._id)}>
                            Restore
                          </Button>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
