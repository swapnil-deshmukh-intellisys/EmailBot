'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/app/components/layout/AppLayout';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import UploadSheetWorkflow from '@/app/client-data/components/UploadSheetWorkflow';

const TABLE_COLUMNS = [
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
  date: '',
  sector: '',
  country: '',
  name: '',
  designation: '',
  freshLead: ''
};

function normalizeText(value = '') {
  return String(value || '').trim();
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
    listAddedDate: formatDateTime(listAddedDateRaw),
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
  'leadType',
  'sourcer',
  'userId',
  'projectApproach',
  'senderId'
];
const GRID_EDITABLE_FIELDS = [...EDITABLE_ROW_FIELDS];

function mergeRowWithEdits(row, edits = {}) {
  return {
    ...row,
    ...Object.fromEntries(
      EDITABLE_ROW_FIELDS.map((field) => [field, typeof edits[field] === 'string' ? edits[field] : row[field]])
    )
  };
}

export default function ClientListPage() {
  const router = useRouter();
  const [lists, setLists] = useState([]);
  const [clientRowsData, setClientRowsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showClientDirectory, setShowClientDirectory] = useState(true);
  const [showSelectedSheets, setShowSelectedSheets] = useState(true);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [newSheetName, setNewSheetName] = useState('');
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [recentCreatedSheetId, setRecentCreatedSheetId] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [rowEdits, setRowEdits] = useState({});
  const [savingDirectory, setSavingDirectory] = useState(false);
  const [activeCell, setActiveCell] = useState(null);
  const cellRefs = useRef({});
  const selectedSheetsSectionRef = useRef(null);

  useEffect(() => {
    let active = true;

    const loadLists = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/client-data/list', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || 'Failed to load client lists');
        }

        if (!active) return;
        setLists(Array.isArray(data?.lists) ? data.lists : []);
        setClientRowsData(Array.isArray(data?.rows) ? data.rows : []);
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
  }, [refreshNonce]);

  const uploadedFiles = useMemo(
    () => lists.filter((list) => String(list?.kind || 'uploaded') !== 'custom'),
    [lists]
  );

  const selectedClientSheets = useMemo(
    () => lists.filter((list) => String(list?.kind || 'uploaded') === 'custom'),
    [lists]
  );

  const clientRows = useMemo(() => clientRowsData, [clientRowsData]);

  const filterOptions = useMemo(() => ({
    sector: extractOptionValues(clientRows, 'sector'),
    country: extractOptionValues(clientRows, 'country')
  }), [clientRows]);

  const filteredClientRows = useMemo(
    () =>
      clientRows.filter((baseRow) => {
        const row = mergeRowWithEdits(baseRow, rowEdits[baseRow.id]);
        if (appliedFilters.date && formatDateOnly(row.listAddedDateRaw) !== appliedFilters.date) return false;
        if (!matchesTextFilter(row.sector, appliedFilters.sector)) return false;
        if (!matchesTextFilter(row.country, appliedFilters.country)) return false;
        if (!matchesTextFilter(row.name, appliedFilters.name)) return false;
        if (!matchesTextFilter(row.designation, appliedFilters.designation)) return false;
        if (appliedFilters.freshLead === 'fresh' && !row.freshLead) return false;
        if (appliedFilters.freshLead === 'contacted' && row.freshLead) return false;
        return true;
      }),
    [clientRows, rowEdits, appliedFilters]
  );

  const contactedCount = useMemo(
    () => filteredClientRows.filter((row) => row.campaignMailDate !== '-').length,
    [filteredClientRows]
  );

  const visibleClientIds = useMemo(() => filteredClientRows.map((row) => row.id), [filteredClientRows]);
  const selectedCount = selectedClientIds.length;
  const allVisibleSelected = visibleClientIds.length > 0 && visibleClientIds.every((id) => selectedClientIds.includes(id));

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
    if (!filteredClientRows.length) return;
    const maxRow = filteredClientRows.length - 1;
    const maxCol = GRID_EDITABLE_FIELDS.length - 1;
    if (event.key === 'ArrowRight' || event.key === 'Tab') {
      event.preventDefault();
      const nextCol = event.shiftKey ? Math.max(0, fieldIndex - 1) : Math.min(maxCol, fieldIndex + 1);
      focusGridCell(filteredClientRows[rowIndex].id, GRID_EDITABLE_FIELDS[nextCol]);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusGridCell(filteredClientRows[rowIndex].id, GRID_EDITABLE_FIELDS[Math.max(0, fieldIndex - 1)]);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      const nextRow = Math.min(maxRow, rowIndex + 1);
      focusGridCell(filteredClientRows[nextRow].id, GRID_EDITABLE_FIELDS[fieldIndex]);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextRow = Math.max(0, rowIndex - 1);
      focusGridCell(filteredClientRows[nextRow].id, GRID_EDITABLE_FIELDS[fieldIndex]);
    }
  };

  const handleGridPaste = (event, startRowIndex, startFieldIndex) => {
    const rawText = event.clipboardData?.getData('text/plain');
    if (!rawText || !rawText.trim()) return;
    event.preventDefault();

    const rows = rawText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'));
    if (!rows.length) return;

    setRowEdits((current) => {
      const next = { ...current };
      rows.forEach((pastedRow, rowOffset) => {
        const targetRowIndex = startRowIndex + rowOffset;
        const targetRow = filteredClientRows[targetRowIndex];
        if (!targetRow) return;
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
  };

  const handleSaveDirectoryEdits = async () => {
    const editedRowIds = Object.keys(rowEdits);
    if (!editedRowIds.length) {
      setSelectionMessage('No changes to save.');
      setSelectionError('');
      return;
    }

    try {
      setSavingDirectory(true);
      setSelectionError('');
      setSelectionMessage('');
      for (const rowId of editedRowIds) {
        const response = await fetch(`/api/client-data/${encodeURIComponent(rowId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rowEdits[rowId] || {})
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || `Failed saving row ${rowId}`);
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

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
  };

  const handleClearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const handleCreateSheet = async () => {
    const selectedRows = clientRows.filter((row) => selectedClientIds.includes(row.id));
    if (!selectedRows.length) {
      setSelectionError('Select at least one client first.');
      setSelectionMessage('');
      return;
    }

    const trimmedName = normalizeText(newSheetName) || `Selected Clients ${new Date().toLocaleDateString()}`;
    const parentListIds = Array.from(new Set(selectedRows.map((row) => row.sourceListId).filter(Boolean)));
    const parentFiles = Array.from(new Set(selectedRows.map((row) => row.sourceFile).filter(Boolean)));

    try {
      setCreatingSheet(true);
      setSelectionError('');
      setSelectionMessage('');

      const response = await fetch('/api/lists/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          sourceListId: parentListIds.length === 1 ? parentListIds[0] : '',
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

      const nextList = {
        _id: data.listId,
        name: data.name || trimmedName,
        sourceFile: data.sourceFile || `${trimmedName}.csv`,
        kind: data.kind || 'custom',
        clonedFrom: data.clonedFrom || parentListIds[0] || '',
        uploadedAt: data.uploadedAt || new Date().toISOString(),
        createdAt: data.uploadedAt || new Date().toISOString(),
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
      setSelectionMessage(`Created ${trimmedName} with ${selectedRows.length} selected clients.`);
      setSelectedClientIds([]);
      setNewSheetName('');
      setShowSelectedSheets(true);
      setRecentCreatedSheetId(String(nextList._id));
      requestAnimationFrame(() => {
        selectedSheetsSectionRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      setSelectionError(err.message || 'Failed to create selected client sheet');
    } finally {
      setCreatingSheet(false);
    }
  };

  return (
    <AppLayout
      topbarProps={{
        title: 'Client Data',
        subtitle: 'Upload, manage, and review client files and records.',
        copyFooter: (
          <div className="client-data-section-switcher client-data-section-switcher-top" aria-label="Client data section controls">
            <button
              type="button"
              className="client-data-section-switcher-button"
              onClick={() => router.push('/client-data/uploaded-files')}
            >
              Uploaded Files
            </button>
            <button
              type="button"
              className="client-data-section-switcher-button active"
              onClick={() => router.push('/client-data/client-list')}
            >
              Client List
            </button>
            <UploadSheetWorkflow
              buttonClassName="client-data-section-switcher-button"
              onUploadSaved={() => setRefreshNonce((value) => value + 1)}
            />
          </div>
        )
      }}
    >
      <div className="client-data-page">
        <section className="ui-page-section">
          <div className="client-data-clientlist-stack">
            <section className="client-data-panel">
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Client Directory</h2>
                  <p className="ui-card-description">Live client rows from your stored sheets.</p>
                  <p className="ui-card-description client-directory-summary">
                    {uploadedFiles.length} sheets | {filteredClientRows.length} clients | {contactedCount} contacted
                  </p>
                </div>
                  <div className="client-data-panel-head-actions client-data-panel-head-actions-wide">
                    <div className="client-data-header-create">
                    <label className="client-data-selection-name client-data-selection-name-compact">
                      <span>New Sheet Name</span>
                      <input
                        className="input"
                        type="text"
                        value={newSheetName}
                        onChange={(event) => setNewSheetName(event.target.value)}
                        placeholder="April Leads"
                      />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleCreateSheet}
                      disabled={creatingSheet || !selectedCount}
                    >
                    {creatingSheet ? 'Creating...' : 'Create Sheet'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleSaveDirectoryEdits}
                      disabled={savingDirectory || !Object.keys(rowEdits).length}
                    >
                      {savingDirectory ? 'Saving...' : 'Save Directory Changes'}
                    </Button>
                  </div>
                  <button type="button" onClick={() => setShowClientDirectory((value) => !value)}>
                    {showClientDirectory ? 'x Close' : '+ Show More'}
                  </button>
                </div>
              </div>
              {selectionError ? <p className="client-data-custom-note error">{selectionError}</p> : null}
              {selectionMessage ? <p className="client-data-custom-note success">{selectionMessage}</p> : null}
              {showClientDirectory ? (
                <div className="ui-card-content">
                  <div className="client-data-directory-filters client-data-directory-filters-inline">
                    <label className="client-data-filter-field">
                      <span>Date</span>
                      <input
                        className="input"
                        type="date"
                        value={draftFilters.date}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, date: event.target.value }))}
                      />
                    </label>
                    <label className="client-data-filter-field">
                      <span>Sector</span>
                      <select
                        className="input"
                        value={draftFilters.sector}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, sector: event.target.value }))}
                      >
                        <option value="">All sectors</option>
                        {filterOptions.sector.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label className="client-data-filter-field">
                      <span>Country</span>
                      <select
                        className="input"
                        value={draftFilters.country}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, country: event.target.value }))}
                      >
                        <option value="">All countries</option>
                        {filterOptions.country.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label className="client-data-filter-field">
                      <span>Name</span>
                      <input
                        className="input"
                        value={draftFilters.name}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Client name"
                      />
                    </label>
                    <label className="client-data-filter-field">
                      <span>Designation</span>
                      <input
                        className="input"
                        value={draftFilters.designation}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, designation: event.target.value }))}
                        placeholder="Designation"
                      />
                    </label>
                    <label className="client-data-filter-field">
                      <span>Fresh Lead</span>
                      <select
                        className="input"
                        value={draftFilters.freshLead}
                        onChange={(event) => setDraftFilters((current) => ({ ...current, freshLead: event.target.value }))}
                      >
                        <option value="">All leads</option>
                        <option value="fresh">Fresh leads</option>
                        <option value="contacted">Contacted leads</option>
                      </select>
                    </label>
                    <div className="client-data-filter-actions client-data-directory-filter-actions">
                      <Button type="button" variant="secondary" onClick={handleApplyFilters}>
                        Apply Filter
                      </Button>
                      <Button type="button" variant="ghost" onClick={handleClearFilters}>
                        Clear Filter
                      </Button>
                    </div>
                  </div>
                  <div className="client-data-table client-data-table-scroll client-data-table-desktop client-directory-table client-directory-excel-sheet">
                    <div className="client-data-table-head client-directory-excel-head">
                      <span className="client-directory-excel-head-cell">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          aria-label="Select all visible clients"
                        />
                      </span>
                      {TABLE_COLUMNS.slice(1).map((column) => (
                        <span key={column} className="client-directory-excel-head-cell">{column}</span>
                      ))}
                    </div>
                    {loading ? (
                      <div className="client-data-table-row client-directory-excel-row"><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell">Loading client data...</span><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /></div>
                    ) : null}
                    {!loading && error ? (
                      <div className="client-data-table-row client-directory-excel-row"><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell">{error}</span><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /></div>
                    ) : null}
                    {!loading && !error && !filteredClientRows.length ? (
                      <div className="client-data-table-row client-directory-excel-row"><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell">No client data found.</span><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /><span className="client-directory-excel-cell" /></div>
                    ) : null}
                    {!loading && !error ? filteredClientRows.map((row, rowIndex) => (
                      <div key={row.id} className="client-data-table-row client-directory-excel-row">
                        <span className="client-directory-excel-cell">
                          <input
                            type="checkbox"
                            checked={selectedClientIds.includes(row.id)}
                            onChange={() => toggleClientSelection(row.id)}
                            aria-label={`Select ${row.name}`}
                          />
                        </span>
                        {GRID_EDITABLE_FIELDS.slice(0, 7).map((field, fieldIndex) => {
                          const value = rowEdits[row.id]?.[field] ?? (row[field] === '-' ? '' : row[field]);
                          return (
                            <span key={`${row.id}-${field}`} className="client-directory-excel-cell client-list-sheet-cell-wrap">
                              <div
                                ref={(node) => {
                                  cellRefs.current[`${row.id}:${field}`] = node;
                                }}
                                className={`client-list-sheet-cell ${activeCell?.rowId === row.id && activeCell?.field === field ? 'active' : ''}`}
                                contentEditable
                                suppressContentEditableWarning
                                onFocus={() => setActiveCell({ rowId: row.id, field })}
                                onInput={(event) => handleRowFieldChange(row.id, field, event.currentTarget.textContent || '')}
                                onKeyDown={(event) => handleGridCellKeyDown(event, rowIndex, fieldIndex)}
                                onPaste={(event) => handleGridPaste(event, rowIndex, fieldIndex)}
                              >
                                {value}
                              </div>
                            </span>
                          );
                        })}
                        <span className="client-directory-excel-cell">{row.listAddedDate}</span>
                        <span className="client-directory-excel-cell">{row.source}</span>
                        {GRID_EDITABLE_FIELDS.slice(7).map((field, idx) => {
                          const value = rowEdits[row.id]?.[field] ?? (row[field] === '-' ? '' : row[field]);
                          const fieldIndex = idx + 7;
                          return (
                            <span key={`${row.id}-${field}`} className="client-directory-excel-cell client-list-sheet-cell-wrap">
                              <div
                                ref={(node) => {
                                  cellRefs.current[`${row.id}:${field}`] = node;
                                }}
                                className={`client-list-sheet-cell ${activeCell?.rowId === row.id && activeCell?.field === field ? 'active' : ''}`}
                                contentEditable
                                suppressContentEditableWarning
                                onFocus={() => setActiveCell({ rowId: row.id, field })}
                                onInput={(event) => handleRowFieldChange(row.id, field, event.currentTarget.textContent || '')}
                                onKeyDown={(event) => handleGridCellKeyDown(event, rowIndex, fieldIndex)}
                                onPaste={(event) => handleGridPaste(event, rowIndex, fieldIndex)}
                              >
                                {value}
                              </div>
                            </span>
                          );
                        })}
                      </div>
                    )) : null}
                  </div>
                  <div className="client-data-sheet-savebar">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSaveDirectoryEdits}
                      disabled={savingDirectory || !Object.keys(rowEdits).length}
                    >
                      {savingDirectory ? 'Saving...' : 'Save Sheet Changes'}
                    </Button>
                  </div>

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
                    {!loading && !error ? filteredClientRows.map((row) => (
                      <article key={`${row.id}-mobile`} className="client-data-mobile-card">
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

            <section className="client-data-panel client-data-clientlist-secondary client-data-panel-compact" ref={selectedSheetsSectionRef}>
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Selected Client Sheets</h2>
                  <p className="ui-card-description">Newly created selected-client sheets appear here.</p>
                </div>
                <div className="client-data-panel-head-actions">
                  <button type="button" onClick={() => setShowSelectedSheets((value) => !value)}>
                    {showSelectedSheets ? 'x Close' : '+ Show More'}
                  </button>
                </div>
              </div>
              {showSelectedSheets ? (
                <div className="ui-card-content">
                  <div className="client-data-health-list">
                    {selectedClientSheets.length ? selectedClientSheets.map((list) => (
                      <div key={list._id} className={String(list._id) === recentCreatedSheetId ? 'client-data-sheet-highlight' : ''}>
                        <strong>{list.name || 'Selected client sheet'}</strong>
                        <span>{Number(list.leadCount || list.leads?.length || 0)} clients | created {formatDateTime(list.uploadedAt || list.createdAt)} | source {list.sourceFile || '-'}</span>
                      </div>
                    )) : (
                      <div>
                        <strong>No selected-client sheets yet.</strong>
                        <span>Select clients from the directory and create a sheet to store them here.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
