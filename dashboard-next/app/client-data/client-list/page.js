'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/app/components/layout/AppLayout';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import ClientDataSectionNav from '@/app/client-data/components/ClientDataSectionNav';
import UploadSheetWorkflow from '@/app/client-data/components/UploadSheetWorkflow';
import { UNIFIED_NAVBAR_TOPBAR_PROPS } from '@/shared-components/layout-components/UnifiedNavbarConfig';

const TABLE_COLUMNS = [
  '#',
  'Select',
  'Name',
  'Surname',
  'Designation',
  'Cmp Name',
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
  { key: 'cmpName', label: 'Company Name' },
  { key: 'sector', label: 'Sector' },
  { key: 'country', label: 'Country' },
  { key: 'email', label: 'Email' },
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
  freshLead: ''
};

const ALL_COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
  'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
  'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica',
  "Cote d'Ivoire",'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland',
  'France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan',
  'Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya',
  'Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands',
  'Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique',
  'Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea',
  'North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru',
  'Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia',
  'Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia',
  'Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea',
  'South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania',
  'Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City',
  'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
];

const ALL_SECTORS = [
  'Aerospace','Agriculture','Automotive','Banking','Biotechnology','Chemicals','Construction','Consulting',
  'Consumer Goods','Defense','Education','Energy','Engineering','Entertainment','Fashion','Finance','Food and Beverage',
  'Government','Healthcare','Hospitality','Human Resources','Information Technology','Insurance','Legal','Logistics',
  'Manufacturing','Marketing','Media','Mining','Nonprofit','Oil and Gas','Pharmaceuticals','Real Estate','Retail',
  'Sales','Software','Telecommunications','Textiles','Transportation','Travel','Utilities'
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
    row.senderId
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

function parsePastedRows(rawText = '') {
  const lines = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  if (!lines.length) return [];
  const parsed = lines.map(splitDelimitedLine);
  const headerMap = new Map(PASTE_COLUMNS.map((column) => [normalizeHeader(column.label), column.key]));
  const firstLineKeys = parsed[0].map((cell) => headerMap.get(normalizeHeader(cell)));
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
    return row;
  }).filter(hasVisibleClientData);
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
    cmpName: getLeadValue(lead, 'Company', 'company', 'Company Name', 'companyName') || '-',
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
    userId: getLeadValue(lead, 'User ID', 'UserId', 'userId') || '-',
    projectApproach: getLeadValue(lead, 'Project Approach', 'projectApproach', 'Approach', 'approach', 'Used In Project', 'UsedInProject', 'usedInProject') || '-',
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
      || localFilters.freshLead !== initialFilters.freshLead;
  }, [initialFilters, localFilters, searchInput]);

  const onEnterApply = useCallback((event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    applyNow();
  }, [applyNow]);

  return (
    <div className="client-data-directory-filters client-data-directory-filters-inline">
      <label className="client-data-filter-field">
        <span>Search</span>
        <input className="input" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={onEnterApply} placeholder="Name, email, company, source..." />
      </label>
      <label className="client-data-filter-field">
        <span>Date</span>
        <input className="input" type="date" value={localFilters.date} onChange={(event) => updateField('date', event.target.value)} />
      </label>
      <label className="client-data-filter-field">
        <span>Sector</span>
        <select className="input" value={localFilters.sector} onChange={(event) => updateField('sector', event.target.value)}>
          <option value="">All sectors</option>
          {filterOptions.sector.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="client-data-filter-field">
        <span>Country</span>
        <select className="input" value={localFilters.country} onChange={(event) => updateField('country', event.target.value)}>
          <option value="">All countries</option>
          {filterOptions.country.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="client-data-filter-field">
        <span>Name</span>
        <input className="input" value={localFilters.name} onChange={(event) => updateField('name', event.target.value)} onKeyDown={onEnterApply} placeholder="Client name" />
      </label>
      <label className="client-data-filter-field">
        <span>Designation</span>
        <input className="input" value={localFilters.designation} onChange={(event) => updateField('designation', event.target.value)} onKeyDown={onEnterApply} placeholder="Designation" />
      </label>
      <label className="client-data-filter-field">
        <span>Fresh Lead</span>
        <select className="input" value={localFilters.freshLead} onChange={(event) => updateField('freshLead', event.target.value)}>
          <option value="">All leads</option>
          <option value="fresh">Fresh leads</option>
          <option value="contacted">Contacted leads</option>
        </select>
      </label>
      <div className="client-data-filter-actions client-data-directory-filter-actions">
        <Button type="button" variant="secondary" onClick={applyNow} disabled={!hasLocalChanges || isApplyingFilters}>
          {isApplyingFilters ? 'Applying...' : 'Apply Filters'}
        </Button>
        <Button type="button" variant="ghost" onClick={onReset} disabled={(!hasAppliedFilters && !hasLocalChanges) || isApplyingFilters}>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [rowEdits, setRowEdits] = useState({});
  const [savingDirectory, setSavingDirectory] = useState(false);
  const [creatingRow, setCreatingRow] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const [showPastePanel, setShowPastePanel] = useState(false);
  const [pasteRawText, setPasteRawText] = useState('');
  const [pasteRows, setPasteRows] = useState([]);
  const [selectedPasteRowIds, setSelectedPasteRowIds] = useState([]);
  const [savingPastedData, setSavingPastedData] = useState(false);
  const [creatingPasteSheet, setCreatingPasteSheet] = useState(false);
  const [usingCampaignListId, setUsingCampaignListId] = useState('');
  const [binSheets, setBinSheets] = useState([]);
  const [loadingBin, setLoadingBin] = useState(false);
  const [historySheetId, setHistorySheetId] = useState('');
  const [historyClients, setHistoryClients] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const cellRefs = useRef({});
  const createdSheetsPickerRef = useRef(null);
  const clientListRef = useRef(null);
  const activeSection = activeTab;

  const switchClientDataTab = (tab) => {
    setActiveTab(tab);
    const nextUrl = tab === 'client-list' ? '/client-data/client-list' : `/client-data/client-list?tab=${tab}`;
    window.history.replaceState(null, '', nextUrl);
  };

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
  }, []);

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
        const endpoint = activeTab === 'client-list' ? '/api/client-data/list' : '/api/client-data/sheets';
        const response = await fetch(endpoint, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || 'Failed to load client lists');
        }

        if (!active) return;
        setLists(Array.isArray(data?.lists) ? data.lists : []);
        setClientRowsData(activeTab === 'client-list' && Array.isArray(data?.rows) ? data.rows : []);
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
    () => lists.filter((list) => ['custom', 'selected_client_sheet'].includes(String(list?.kind || 'uploaded'))),
    [lists]
  );

  const customizeSheets = useMemo(() => lists, [lists]);

  const clientRows = useMemo(
    () => clientRowsData.filter(hasVisibleClientData),
    [clientRowsData]
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

      return rowsWithEdits.filter((row) => {
        if (searchFilter && !row._searchBlob.includes(searchFilter)) return false;
        if (dateFilter && row._dateKey !== dateFilter) return false;
        if (sectorFilter && !row._sector.includes(sectorFilter)) return false;
        if (countryFilter && !row._country.includes(countryFilter)) return false;
        if (nameFilter && !row._name.includes(nameFilter)) return false;
        if (designationFilter && !row._designation.includes(designationFilter)) return false;
        if (appliedFilters.freshLead === 'fresh' && !row.freshLead) return false;
        if (appliedFilters.freshLead === 'contacted' && row.freshLead) return false;
        return true;
      });
    },
    [rowsWithEdits, appliedFilters]
  );

  const hasAppliedFilters = useMemo(
    () => Object.values(appliedFilters).some(Boolean),
    [appliedFilters]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredClientRows.length / CLIENT_ROWS_PER_PAGE)),
    [filteredClientRows.length]
  );

  const paginatedClientRows = useMemo(() => {
    const start = (currentPage - 1) * CLIENT_ROWS_PER_PAGE;
    return filteredClientRows.slice(start, start + CLIENT_ROWS_PER_PAGE);
  }, [currentPage, filteredClientRows]);

  const contactedCount = useMemo(
    () => filteredClientRows.filter((row) => row.campaignMailDate !== '-').length,
    [filteredClientRows]
  );

  const visibleClientIds = useMemo(() => paginatedClientRows.map((row) => row.id), [paginatedClientRows]);
  const selectedCount = selectedClientIds.length;
  const allVisibleSelected = visibleClientIds.length > 0 && visibleClientIds.every((id) => selectedClientIds.includes(id));
  const editedRowIds = useMemo(() => Object.keys(rowEdits), [rowEdits]);
  const hasEditedEmailErrors = useMemo(() => editedRowIds.some((rowId) => Boolean(rowEmailIssues[rowId])), [editedRowIds, rowEmailIssues]);
  const hasEditedDuplicateEmails = useMemo(() => editedRowIds.some((rowId) => duplicateEmailRowIds.has(rowId)), [editedRowIds, duplicateEmailRowIds]);
  const repeatedClientCount = duplicateEmailRowIds.size;

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

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
    setSelectedPasteRowIds([]);
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

  const togglePasteRowSelection = (rowId) => {
    setSelectedPasteRowIds((current) => (
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]
    ));
  };

  const toggleAllPasteRows = () => {
    const filledIds = filledPasteRows.map((row) => row._rowId);
    const allSelected = filledIds.length > 0 && filledIds.every((id) => selectedPasteRowIds.includes(id));
    setSelectedPasteRowIds(allSelected ? [] : filledIds);
  };

  const handlePasteGridPaste = (event, startRowIndex, startColumnIndex) => {
    const rawText = event.clipboardData?.getData('text/plain');
    if (!rawText || !rawText.trim()) return;
    event.preventDefault();
    const incoming = parsePastedRows(rawText);
    if (!incoming.length) return;
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
        PASTE_COLUMNS.slice(startColumnIndex).forEach((column, colOffset) => {
          const sourceColumn = PASTE_COLUMNS[colOffset];
          if (!sourceColumn) return;
          updated[column.key] = sourceRow[sourceColumn.key] || '';
        });
        next[targetIndex] = updated;
      });
      return next;
    });
    showToast('success', `${incoming.length} rows pasted successfully.`);
  };

  const handleAddPasteRows = () => {
    setPasteRows((current) => [...current, ...createEmptyPasteRows(1)]);
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
      const response = await fetch('/api/client-data/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: filledPasteRows })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to save pasted data');
      }
      setPasteRawText('');
      setPasteRows(createEmptyPasteRows(8));
      setSelectedPasteRowIds([]);
      setShowPastePanel(false);
      setRefreshNonce((value) => value + 1);
      setSelectionMessage(`${data.message || 'Pasted data saved.'} ${data.summary?.repeatedClients || 0} repeated, ${data.summary?.invalidClients || 0} invalid.`);
      showToast('success', data.message || 'Pasted data saved to Client Directory.');
    } catch (err) {
      setSelectionError(err.message || 'Failed to save pasted data');
      showToast('error', err.message || 'Failed to save pasted data');
    } finally {
      setSavingPastedData(false);
    }
  };

  const handleCreateSheetFromPastedRows = async () => {
    const selectedRows = filledPasteRows.filter((row) => selectedPasteRowIds.includes(row._rowId));
    if (!selectedRows.length) {
      setSelectionError('Select pasted table rows before creating a sheet.');
      showToast('error', 'Select pasted table rows before creating a sheet.');
      return;
    }
    const invalidSelected = selectedRows.some((row) => !validateEmailForSheet(row.email).ok);
    if (invalidSelected) {
      setSelectionError('Fix invalid email rows before creating a sheet.');
      showToast('error', 'Fix invalid email rows before creating a sheet.');
      return;
    }
    const defaultName = normalizeText(newSheetName) || `Selected Clients ${formatDisplayDate()}`;
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
          rows: selectedRows
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
        leadCount: selectedRows.length,
        leads: selectedRows
      };
      setLists((current) => [nextList, ...current.filter((item) => String(item._id) !== String(nextList._id))]);
      setRecentCreatedSheetId(String(nextList._id));
      setActiveTab('customize');
      setSelectedPasteRowIds([]);
      setSelectionMessage(data.message || `Created selected sheet with ${selectedRows.length} pasted clients.`);
      showToast('success', data.message || `Created selected sheet with ${selectedRows.length} pasted clients.`);
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

  const handleRowFieldChange = (rowId, field, value) => {
    setRowEdits((current) => ({
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

  const handleGridCellKeyDown = (event, rowIndex, fieldIndex) => {
    if (!paginatedClientRows.length) return;
    const maxRow = paginatedClientRows.length - 1;
    const maxCol = GRID_EDITABLE_FIELDS.length - 1;
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

    const rows = rawText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'));
    if (!rows.length) return;

    const overflowRows = [];
    setRowEdits((current) => {
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

    const defaultName = normalizeText(newSheetName) || `Selected Clients ${formatDisplayDate()}`;
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
      router.push(data.redirectUrl || `/dashboard/user?listId=${encodeURIComponent(data.listId)}`);
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
      const response = await fetch(`/api/lists/${encodeURIComponent(String(list._id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to rename sheet');
      }
      setLists((current) => current.map((item) => (
        String(item._id) === String(list._id) ? { ...item, name: trimmedName } : item
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
      const response = await fetch(`/api/lists/${encodeURIComponent(String(list._id))}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to delete sheet');
      }
      setLists((current) => current.filter((item) => String(item._id) !== String(list._id)));
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
                    <Button type="button" variant="secondary" onClick={handleCreateSheetFromPastedRows} disabled={creatingPasteSheet || !selectedPasteRowIds.length}>
                      {creatingPasteSheet ? 'Creating...' : 'Create Selected Client Sheet'}
                    </Button>
                    <span>{filledPasteRows.length} filled rows | {selectedPasteRowIds.length} selected | {pasteInvalidRowIndexes.size} invalid | {pasteDuplicateRowIndexes.size} repeated</span>
                  </div>
                  {pasteRows.length ? (
                    <div className="client-data-table client-data-table-scroll client-data-paste-preview-table client-data-paste-excel-table">
                      <div className="client-data-table-head">
                        <span>No.</span>
                        <span>
                          <input
                            type="checkbox"
                            checked={filledPasteRows.length > 0 && filledPasteRows.every((row) => selectedPasteRowIds.includes(row._rowId))}
                            onChange={toggleAllPasteRows}
                            aria-label="Select all pasted rows"
                          />
                        </span>
                        {PASTE_COLUMNS.map((column) => <span key={column.key}>{column.label}</span>)}
                      </div>
                      {pasteRows.map((row, rowIndex) => {
                        const invalid = pasteInvalidRowIndexes.has(rowIndex);
                        const duplicate = pasteDuplicateRowIndexes.has(rowIndex);
                        const hasData = hasVisibleClientData(row);
                        return (
                          <div key={row._rowId || rowIndex} className={`client-data-table-row ${invalid ? 'client-data-invalid-row' : ''} ${duplicate ? 'client-directory-duplicate-row' : ''}`}>
                            <span>{rowIndex + 1}</span>
                            <span>
                              <input
                                type="checkbox"
                                checked={selectedPasteRowIds.includes(row._rowId)}
                                disabled={!hasData}
                                onChange={() => togglePasteRowSelection(row._rowId)}
                                aria-label={`Select pasted row ${rowIndex + 1}`}
                              />
                            </span>
                            {PASTE_COLUMNS.map((column) => (
                              <span key={`${rowIndex}-${column.key}`} className="client-data-paste-cell">
                                <input
                                  className={`input ${column.key === 'email' && (invalid || duplicate) ? 'invalid' : ''}`}
                                  value={row[column.key] || ''}
                                  onChange={(event) => handlePasteRowChange(rowIndex, column.key, event.target.value)}
                                  onPaste={(event) => handlePasteGridPaste(event, rowIndex, PASTE_COLUMNS.findIndex((item) => item.key === column.key))}
                                />
                              </span>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
              </>
            ) : null}
            {activeTab === 'client-list' ? (
            <section className="client-data-panel" ref={clientListRef}>
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Client Directory</h2>
                  <p className="ui-card-description client-directory-summary">
                    {uploadedFiles.length} sheets | {filteredClientRows.length} clients | {repeatedClientCount} repeated | {contactedCount} contacted
                  </p>
                  {repeatedClientCount ? (
                    <p className="client-directory-duplicate-summary">
                      Repeated clients found: {repeatedClientCount}. Rows are highlighted in red.
                    </p>
                  ) : null}
                </div>
                  <div className="client-data-panel-head-actions client-data-panel-head-actions-wide">
                </div>
              </div>
              {selectionError ? <p className="client-data-custom-note error">{selectionError}</p> : null}
              {selectionMessage ? <p className="client-data-custom-note success">{selectionMessage}</p> : null}
              {showClientDirectory ? (
                <div className="ui-card-content">
                  <ClientDirectoryFilters
                    initialFilters={filters}
                    filterOptions={filterOptions}
                    hasAppliedFilters={hasAppliedFilters}
                    isApplyingFilters={isApplyingFilters}
                    onApply={handleApplyFilters}
                    onReset={handleClearFilters}
                  />
                  <p className="ui-card-description" style={{ marginBottom: 12 }}>
                    Showing {filteredClientRows.length} of {clientRows.length} clients.
                  </p>
                  {totalPages > 1 ? (
                    <div className="client-data-filter-actions" style={{ marginBottom: 12 }}>
                      <Button type="button" variant="ghost" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1}>
                        Previous
                      </Button>
                      <span className="ui-card-description">Page {currentPage} of {totalPages}</span>
                      <Button type="button" variant="ghost" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages}>
                        Next
                      </Button>
                    </div>
                  ) : null}
                  <div className="client-data-sheet-savebar" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                    <div className="client-data-filter-actions">
                      <div ref={createdSheetsPickerRef} style={{ position: 'relative' }}>
                        <Button
                          type="button"
                          variant="ghost"
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
                                    onClick={() => router.push(`/dashboard/user?listId=${encodeURIComponent(String(list._id))}&autoUpload=1`)}
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
                        variant="secondary"
                        onClick={handleCreateSheet}
                        disabled={creatingSheet || !selectedCount}
                      >
                        {creatingSheet ? 'Creating...' : 'Create Selected Client Sheet'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleSaveDirectoryEdits}
                        disabled={savingDirectory || !editedRowIds.length || hasEditedEmailErrors || hasEditedDuplicateEmails}
                      >
                        {savingDirectory ? 'Saving...' : 'Save Directory Changes'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancelDirectoryEdits}
                        disabled={savingDirectory || !editedRowIds.length}
                      >
                        Cancel Changes
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleAddNewRow}
                      disabled={creatingRow}
                    >
                      {creatingRow ? 'Adding...' : 'Add New Row'}
                    </Button>
                  </div>
                  <div className="client-data-table client-data-table-scroll client-data-table-desktop client-directory-table client-directory-excel-sheet">
                    <div className="client-data-table-head client-directory-excel-head" style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                      <span className="client-directory-excel-head-cell">#</span>
                      <span className="client-directory-excel-head-cell">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          aria-label="Select all visible clients"
                        />
                      </span>
                      {TABLE_COLUMNS.slice(2).map((column) => (
                        <span key={column} className="client-directory-excel-head-cell">{column}</span>
                      ))}
                    </div>
                    {loading ? (
                      <div className="client-data-table-row client-directory-excel-row">
                        <span className="client-directory-excel-cell" style={{ gridColumn: `1 / span ${TABLE_COLUMNS.length}` }}>Loading client data...</span>
                      </div>
                    ) : null}
                    {!loading && error ? (
                      <div className="client-data-table-row client-directory-excel-row">
                        <span className="client-directory-excel-cell" style={{ gridColumn: `1 / span ${TABLE_COLUMNS.length}` }}>{error}</span>
                      </div>
                    ) : null}
                    {!loading && !error && !filteredClientRows.length ? (
                      <div className="client-data-table-row client-directory-excel-row">
                        <span className="client-directory-excel-cell" style={{ gridColumn: `1 / span ${TABLE_COLUMNS.length}` }}>No client data found.</span>
                      </div>
                    ) : null}
                    {!loading && !error ? paginatedClientRows.map((row, rowIndex) => {
                      const rowHasDuplicateEmail = duplicateEmailRowIds.has(row.id);
                      return (
                      <div key={row.id} className={`client-data-table-row client-directory-excel-row ${rowHasDuplicateEmail ? 'client-directory-duplicate-row' : ''}`}>
                        <span className="client-directory-excel-cell">{(currentPage - 1) * CLIENT_ROWS_PER_PAGE + rowIndex + 1}</span>
                        <span className="client-directory-excel-cell">
                          <input
                            type="checkbox"
                            checked={selectedClientIds.includes(row.id)}
                            onChange={() => toggleClientSelection(row.id)}
                            aria-label={`Select ${row.name}`}
                          />
                        </span>
                        {GRID_EDITABLE_FIELDS.map((field, fieldIndex) => {
                          const value = rowEdits[row.id]?.[field] ?? (row[field] === '-' ? '' : row[field]);
                          const isEdited = typeof rowEdits[row.id]?.[field] === 'string';
                          const emailHasIssue = field === 'email' && Boolean(rowEmailIssues[row.id]);
                          const hasDuplicateEmail = field === 'email' && rowHasDuplicateEmail;
                          return (
                            <span key={`${row.id}-${field}`} className="client-directory-excel-cell client-list-sheet-cell-wrap">
                              <input
                                ref={(node) => {
                                  cellRefs.current[`${row.id}:${field}`] = node;
                                }}
                                type={field === 'listAddedDate' ? 'date' : 'text'}
                                className={`client-list-sheet-cell ${activeCell?.rowId === row.id && activeCell?.field === field ? 'active' : ''} ${isEdited ? 'edited' : ''} ${emailHasIssue || hasDuplicateEmail ? 'invalid' : ''}`}
                                value={value}
                                onFocus={() => setActiveCell({ rowId: row.id, field })}
                                onClick={() => setActiveCell({ rowId: row.id, field })}
                                onChange={(event) => handleRowFieldChange(row.id, field, event.target.value || '')}
                                onKeyDown={(event) => handleGridCellKeyDown(event, rowIndex, fieldIndex)}
                                onPaste={(event) => handleGridPaste(event, rowIndex, fieldIndex)}
                                aria-label={`${field} row ${rowIndex + 1}`}
                              />
                            </span>
                          );
                        })}
                      </div>
                      );
                    }) : null}
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
                          <Badge variant={badgeToneMap[row.status] || 'default'}>{row.status}</Badge>
                        </div>
                        <div className="client-data-mobile-grid">
                          <div><span>Cmp Name</span><strong>{row.cmpName}</strong></div>
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
                      <div key={list._id} className={String(list._id) === recentCreatedSheetId ? 'client-data-sheet-highlight' : ''}>
                        <strong>{list.name || 'Selected client sheet'}</strong>
                        <span>
                          {Number(list.leadCount || list.leads?.length || 0)} clients | {String(list.kind || 'uploaded')} | created {formatDateTime(list.uploadedAt || list.createdAt)} | source {list.sourceFile || '-'}
                          {list.autoDeleteAt ? ` | auto bin ${formatDateTime(list.autoDeleteAt)}` : ''}
                        </span>
                        <div style={{ marginTop: 8 }}>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleUseForCampaign(list._id)}
                            disabled={usingCampaignListId === String(list._id)}
                          >
                            {usingCampaignListId === String(list._id) ? 'Opening...' : 'Use For Campaign'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/dashboard/user?listId=${encodeURIComponent(String(list._id))}&autoUpload=1`)}
                            style={{ marginLeft: 8 }}
                          >
                            Upload This Sheet
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => loadSheetHistory(list._id)}
                            style={{ marginLeft: 8 }}
                          >
                            Client History
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
                                {client.responseReceived ? <span>Response: {client.replyType || 'received'}</span> : null}
                                {client.followUpStopped ? <span>{client.followUpStopReason || 'Follow-up stopped'}</span> : null}
                              </div>
                              {client.replyPreview ? <p className="client-data-history-reply">{client.replyPreview}</p> : null}
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
