'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import AppLayout from '@/app/components/layout/AppLayout';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import UploadSheetWorkflow from '@/app/client-data/components/UploadSheetWorkflow';

const TABLE_COLUMNS = ['Name', 'Email', 'Company', 'City', 'Status', 'Source'];

const badgeToneMap = {
  Verified: 'success',
  'Needs Review': 'warning',
  'Missing Email': 'danger'
};


function getLeadStatus(lead) {
  const email = String(lead?.Email || lead?.data?.Email || lead?.data?.email || '').trim();
  if (!email) return 'Missing Email';
  return 'Verified';
}

function getLeadCity(lead) {
  return (
    lead?.data?.City ||
    lead?.data?.city ||
    lead?.data?.Location ||
    lead?.data?.location ||
    '-'
  );
}

function getLeadSource(list) {
  const source = String(list?.sourceFile || list?.name || '').trim();
  return source || 'Uploaded List';
}

function formatUploadedAt(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function ClientDataPage() {
  const router = useRouter();
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedList, setSelectedList] = useState(null);
  const [customListName, setCustomListName] = useState('');
  const [customListCloneName, setCustomListCloneName] = useState('');
  const [blankCustomListName, setBlankCustomListName] = useState('');
  const [blankCustomRows, setBlankCustomRows] = useState([
    { Name: '', Email: '', Company: '', City: '', Phone: '' }
  ]);
  const [importingCustomRows, setImportingCustomRows] = useState(false);
  const [creatingCustomList, setCreatingCustomList] = useState(false);
  const [customListError, setCustomListError] = useState('');
  const [customListMessage, setCustomListMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState('');
  const workspaceRef = useRef(null);
  const customListImportRef = useRef(null);

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadLists = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const response = await fetch('/api/stats', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch client data');
        }

        if (!active) return;

        const nextLists = Array.isArray(data?.lists) ? data.lists : [];
        setError('');
        setLists(nextLists);

        const nextSelectedId =
          nextLists.some((item) => item._id === selectedListId)
            ? selectedListId
            : nextLists[0]?._id || '';

        setSelectedListId(nextSelectedId);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to fetch client data');
        if (!silent) {
          setLists([]);
          setSelectedListId('');
          setSelectedList(null);
        }
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadLists({ silent: true });
      }
    };

    void loadLists();
    intervalId = window.setInterval(() => {
      void loadLists({ silent: true });
    }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [selectedListId]);

  useEffect(() => {
    let active = true;
    if (!selectedListId) {
      setSelectedList(null);
      return () => {
        active = false;
      };
    }

    const loadSelectedList = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoadingList(true);
        const response = await fetch(`/api/lists/${selectedListId}`, { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch list data');
        }

        if (active) {
          setSelectedList(data);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to fetch list data');
          if (!silent) {
            setSelectedList(null);
          }
        }
      } finally {
        if (active && !silent) setLoadingList(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadSelectedList({ silent: true });
      }
    };

    void loadSelectedList();
    const intervalId = window.setInterval(() => {
      void loadSelectedList({ silent: true });
    }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [selectedListId]);

  const clientRows = useMemo(() => {
    if (!selectedList?.leads?.length) return [];
    return selectedList.leads.map((lead, index) => ({
      id: `${selectedList._id || 'list'}-${index}`,
      name: lead?.Name || lead?.data?.Name || lead?.data?.name || '-',
      email: lead?.Email || lead?.data?.Email || lead?.data?.email || '-',
      company: lead?.Company || lead?.data?.Company || lead?.data?.company || '-',
      city: getLeadCity(lead),
      status: getLeadStatus(lead),
      source: getLeadSource(selectedList)
    }));
  }, [selectedList]);

  const totalClients = useMemo(
    () => lists.reduce((sum, list) => sum + Number(list?.leadCount || 0), 0),
    [lists]
  );

  const verifiedCount = useMemo(
    () => clientRows.filter((row) => row.status === 'Verified').length,
    [clientRows]
  );

  const missingEmailCount = useMemo(
    () => clientRows.filter((row) => row.status === 'Missing Email').length,
    [clientRows]
  );

  const sourceCards = useMemo(
    () => [
      { label: 'Total Clients', value: loading ? '...' : String(totalClients) },
      { label: 'Active Lists', value: loading ? '...' : String(lists.length) },
      { label: 'Verified Contacts', value: loadingList ? '...' : String(verifiedCount) },
      { label: 'Pending Review', value: loadingList ? '...' : String(missingEmailCount) }
    ],
    [loading, totalClients, lists.length, loadingList, verifiedCount, missingEmailCount]
  );

  const sourceHealthItems = useMemo(
    () =>
      lists.slice(0, 6).map((list) => ({
        title: list.name,
        meta: `${list.leadCount || 0} contacts â€¢ uploaded ${formatUploadedAt(list.uploadedAt)}`
      })),
    [lists]
  );

  const recentActivityItems = useMemo(
    () =>
      lists.slice(0, 3).map((list) => ({
        title: list.sourceFile || list.name || 'Uploaded list',
        meta: `${list.leadCount || 0} contacts â€¢ ${formatUploadedAt(list.uploadedAt)}`
      })),
    [lists]
  );

  const uploadedFileCards = useMemo(
    () =>
      lists.map((list) => ({
        id: list._id,
        title: list.name || 'Uploaded file',
        fileName: list.sourceFile || list.fileName || list.name || 'Uploaded file',
        uploadedAt: formatUploadedAt(list.uploadedAt),
        leadCount: Number(list.leadCount || 0)
      })),
    [lists]
  );

  const visibleUploadedFileCards = useMemo(
    () =>
      uploadedFileCards.filter((item) => {
        const sourceList = lists.find((list) => String(list._id) === String(item.id));
        return String(sourceList?.kind || 'uploaded') !== 'custom';
      }),
    [lists, uploadedFileCards]
  );

  const visibleCustomFileCards = useMemo(
    () =>
      lists
        .filter((list) => String(list?.kind || 'uploaded') === 'custom')
        .map((list) => ({
          id: list._id,
          title: list.name || 'Custom file',
          fileName: list.sourceFile || list.fileName || list.name || 'Custom file',
          uploadedAt: formatUploadedAt(list.uploadedAt),
          leadCount: Number(list.leadCount || 0)
        })),
    [lists]
  );

  const visibleSourceHealthItems = useMemo(
    () =>
      lists
        .filter((list) => String(list?.kind || 'uploaded') !== 'custom')
        .slice(0, 6)
        .map((list) => ({
          title: list.name,
          meta: `${list.leadCount || 0} contacts â€¢ uploaded ${formatUploadedAt(list.uploadedAt)}`
        })),
    [lists]
  );

  const openUploadedFile = (listId) => {
    setSelectedListId(listId);
    requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleCreateCustomList = async () => {
    const source = lists.find((list) => String(list._id) === String(selectedListId));
    if (!selectedListId) {
      setCustomListError('Select a file in Client Workspace first.');
      return;
    }

    const nextName = String(customListCloneName || `${source?.name || 'Custom List'} Copy`).trim();
    if (!nextName) {
      setCustomListError('Please enter a custom list name.');
      return;
    }

    try {
      setCreatingCustomList(true);
      setCustomListError('');
      setCustomListMessage('');
      const response = await fetch('/api/lists/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nextName,
          sourceListId: selectedListId,
          sourceFile: source?.sourceFile || source?.name || `${nextName}.csv`
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create custom list');
      }

      setLists((current) => [
        {
          _id: data.listId,
          name: nextName,
          sourceFile: source?.sourceFile || source?.name || `${nextName}.csv`,
          kind: 'custom',
          leadCount: Number(data.count || 0),
          uploadedAt: new Date().toISOString()
        },
        ...current.filter((item) => String(item._id) !== String(data.listId))
      ]);
      setSelectedListId(String(data.listId));
      setCustomListCloneName('');
      setCustomListMessage(`Saved ${nextName} as a custom list.`);
    } catch (err) {
      setCustomListError(err.message || 'Failed to create custom list');
    } finally {
      setCreatingCustomList(false);
    }
  };

  const handleCreateBlankCustomList = async () => {
    const nextName = String(blankCustomListName || 'Custom List').trim();
    if (!nextName) {
      setCustomListError('Please enter a custom list name.');
      return;
    }

    const rows = (blankCustomRows || [])
      .map((row) => ({
        Name: String(row?.Name || '').trim(),
        Email: String(row?.Email || '').trim(),
        Company: String(row?.Company || '').trim(),
        City: String(row?.City || '').trim(),
        Phone: String(row?.Phone || '').trim()
      }))
      .filter((row) => row.Name || row.Email || row.Company);

    try {
      setCreatingCustomList(true);
      setCustomListError('');
      setCustomListMessage('');
      const response = await fetch('/api/lists/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nextName,
          sourceFile: `${nextName}.csv`,
          rows
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create custom list');
      }

      setLists((current) => [
        {
          _id: data.listId,
          name: nextName,
          sourceFile: data.sourceFile || `${nextName}.csv`,
          kind: 'custom',
          leadCount: Number(data.count || rows.length || 0),
          uploadedAt: data.uploadedAt || new Date().toISOString()
        },
        ...current.filter((item) => String(item._id) !== String(data.listId))
      ]);
      setSelectedListId(String(data.listId));
      setBlankCustomListName('');
      setBlankCustomRows([{ Name: '', Email: '', Company: '', City: '', Phone: '' }]);
      setCustomListMessage(`Created ${nextName} as a blank custom list.`);
    } catch (err) {
      setCustomListError(err.message || 'Failed to create custom list');
    } finally {
      setCreatingCustomList(false);
    }
  };

  const handleExportCustomRows = () => {
    const rows = (blankCustomRows || [])
      .map((row) => [
        String(row?.Name || '').trim(),
        String(row?.Email || '').trim(),
        String(row?.Company || '').trim(),
        String(row?.City || '').trim(),
        String(row?.Phone || '').trim()
      ])
      .filter((row) => row.some(Boolean));

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Email', 'Company', 'City', 'Phone'],
      ...rows
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Custom List');
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(blankCustomListName || 'custom-list').trim().replace(/\s+/g, '-').toLowerCase() || 'custom-list'}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCustomRows = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImportingCustomRows(true);
      setCustomListError('');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) {
        throw new Error('The selected file has no sheets.');
      }
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const rows = jsonRows.map((row) => ({
        Name: String(row.Name || row.name || '').trim(),
        Email: String(row.Email || row.email || '').trim(),
        Company: String(row.Company || row.company || '').trim(),
        City: String(row.City || row.city || '').trim(),
        Phone: String(row.Phone || row.phone || '').trim()
      }));
      const normalizedRows = rows.length
        ? rows
        : [{ Name: '', Email: '', Company: '', City: '', Phone: '' }];
      setBlankCustomRows(normalizedRows);
      setCustomListMessage(`Imported ${rows.length || 1} rows from ${file.name}.`);
    } catch (err) {
      setCustomListError(err.message || 'Failed to import file');
    } finally {
      setImportingCustomRows(false);
      event.target.value = '';
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
              className="client-data-section-switcher-button active"
              onClick={() => router.push('/client-data/uploaded-files')}
            >
              Uploaded Files
            </button>
            <button
              type="button"
              className="client-data-section-switcher-button"
              onClick={() => router.push('/client-data/client-list')}
            >
              Client List
            </button>
            <UploadSheetWorkflow buttonClassName="client-data-section-switcher-button" />
          </div>
        ),
        actions: (
          <>
            <Button variant="secondary">Create Sheet</Button>
            <Button>Upload File</Button>
          </>
        )
      }}
    >
      <div className="client-data-page">
        <section className="ui-page-section">
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Overview</h2>
              <p className="ui-page-section-description">
                Track uploaded files, source health, and current client records.
              </p>
            </div>
          </div>

          <div className="client-data-stats">
            {sourceCards.map((card) => (
              <article key={card.label} className="client-data-stat-card">
                <div className="ui-card-content">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ui-page-section">
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Uploaded Files</h2>
              <p className="ui-page-section-description">
                Every stored client file with its name, upload time, and contact count.
              </p>
            </div>
          </div>

          <div className="client-data-upload-grid">
            {visibleUploadedFileCards.length ? visibleUploadedFileCards.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`client-data-upload-card ${selectedListId === item.id ? 'active' : ''}`}
                onClick={() => openUploadedFile(item.id)}
              >
                <div className="client-data-upload-card-head">
                  <div className="client-data-upload-card-title">
                    <strong>{item.title}</strong>
                    <span className="client-data-upload-kind">Uploaded</span>
                  </div>
                  <span>{item.leadCount} contacts</span>
                </div>
                <p>{item.fileName}</p>
                <small>Uploaded {item.uploadedAt}</small>
              </button>
            )) : (
              <div className="client-data-upload-empty">
                <strong>No uploaded files yet.</strong>
                <p>Upload a CSV or XLSX file to store it here and review it later.</p>
              </div>
            )}
          </div>
        </section>

        <section className="ui-page-section">
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Custom Lists</h2>
              <p className="ui-page-section-description">
                Create a custom list from scratch or save the selected client file as a custom list.
              </p>
            </div>
          </div>

          <div className="client-data-custom-builder">
            <label className="client-data-custom-field">
              <span>Custom list name</span>
              <input
                className="input"
                type="text"
                value={customListCloneName}
                onChange={(event) => setCustomListCloneName(event.target.value)}
                placeholder={selectedList?.name ? `${selectedList.name} Copy` : 'Enter custom list name'}
              />
            </label>

            <div className="client-data-custom-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateCustomList}
                disabled={creatingCustomList}
              >
                {creatingCustomList ? 'Saving...' : 'Save Custom List'}
              </Button>
              <p>
                {selectedListId
                  ? `Saving from ${selectedList?.name || 'the selected file'} with ${selectedList?.leads?.length || 0} contacts.`
                  : 'Select a file in Client Workspace first, then save it as a custom list.'}
              </p>
            </div>
          </div>

          <div className="client-data-custom-builder client-data-custom-builder-blank">
            <label className="client-data-custom-field">
              <span>Blank list name</span>
              <input
                className="input"
                type="text"
                value={blankCustomListName}
                onChange={(event) => setBlankCustomListName(event.target.value)}
                placeholder="Create a new custom list"
              />
            </label>

            <div className="client-data-custom-table-wrap">
              <div className="client-data-custom-table-head">
                <span>Name</span>
                <span>Email</span>
                <span>Company</span>
                <span>City</span>
                <span>Phone</span>
                <span />
              </div>
              <div className="client-data-custom-table-body">
                {blankCustomRows.map((row, index) => (
                  <div key={`blank-row-${index}`} className="client-data-custom-table-row">
                    <input
                      className="input"
                      type="text"
                      value={row.Name}
                      onChange={(event) =>
                        setBlankCustomRows((current) =>
                          current.map((item, rowIndex) =>
                            rowIndex === index ? { ...item, Name: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Full name"
                    />
                    <input
                      className="input"
                      type="email"
                      value={row.Email}
                      onChange={(event) =>
                        setBlankCustomRows((current) =>
                          current.map((item, rowIndex) =>
                            rowIndex === index ? { ...item, Email: event.target.value } : item
                          )
                        )
                      }
                      placeholder="name@example.com"
                    />
                    <input
                      className="input"
                      type="text"
                      value={row.Company}
                      onChange={(event) =>
                        setBlankCustomRows((current) =>
                          current.map((item, rowIndex) =>
                            rowIndex === index ? { ...item, Company: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Company"
                    />
                    <input
                      className="input"
                      type="text"
                      value={row.City}
                      onChange={(event) =>
                        setBlankCustomRows((current) =>
                          current.map((item, rowIndex) =>
                            rowIndex === index ? { ...item, City: event.target.value } : item
                          )
                        )
                      }
                      placeholder="City"
                    />
                    <input
                      className="input"
                      type="tel"
                      value={row.Phone}
                      onChange={(event) =>
                        setBlankCustomRows((current) =>
                          current.map((item, rowIndex) =>
                            rowIndex === index ? { ...item, Phone: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Phone"
                    />
                    <button
                      type="button"
                      className="client-data-table-row-remove"
                      onClick={() =>
                        setBlankCustomRows((current) =>
                          current.length > 1
                            ? current.filter((_, rowIndex) => rowIndex !== index)
                            : [{ Name: '', Email: '', Company: '', City: '', Phone: '' }]
                        )
                      }
                    >
                      Ã—
                    </button>
                  </div>
                ))}
              </div>
            <div className="client-data-custom-row-actions">
                <input
                  ref={customListImportRef}
                  className="client-data-hidden-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleImportCustomRows}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBlankCustomRows((current) => [...current, { Name: '', Email: '', Company: '', City: '', Phone: '' }])}
                >
                  Add Row
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setBlankCustomRows([{ Name: '', Email: '', Company: '', City: '', Phone: '' }])}
                >
                  Clear Rows
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => customListImportRef.current?.click?.()}
                  disabled={importingCustomRows}
                >
                  {importingCustomRows ? 'Importing...' : 'Import XLSX'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleExportCustomRows}
                >
                  Export XLSX
                </Button>
              </div>
            </div>

            <div className="client-data-custom-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCreateBlankCustomList}
                disabled={creatingCustomList}
              >
                {creatingCustomList ? 'Creating...' : 'Create Blank Custom List'}
              </Button>
              <p>
                Add rows using the table above. Empty fields are allowed.
              </p>
            </div>
          </div>

          {customListError ? (
            <p className="client-data-custom-note error">{customListError}</p>
          ) : null}
          {customListMessage ? (
            <p className="client-data-custom-note success">{customListMessage}</p>
          ) : null}

          <div className="client-data-upload-grid client-data-custom-grid">
            {visibleCustomFileCards.length ? visibleCustomFileCards.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`client-data-upload-card ${selectedListId === item.id ? 'active' : ''}`}
                onClick={() => openUploadedFile(item.id)}
              >
                <div className="client-data-upload-card-head">
                  <div className="client-data-upload-card-title">
                    <strong>{item.title}</strong>
                    <span className="client-data-upload-kind">Custom</span>
                  </div>
                  <span>{item.leadCount} contacts</span>
                </div>
                <p>{item.fileName}</p>
                <small>Saved {item.uploadedAt}</small>
              </button>
            )) : (
              <div className="client-data-upload-empty">
                <strong>No custom lists yet.</strong>
                <p>Save the selected file as a custom list and it will appear here and in the popup.</p>
              </div>
            )}
          </div>
        </section>

        <section className="ui-page-section" ref={workspaceRef}>
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Client Workspace</h2>
              <p className="ui-page-section-description">
                Keep imported lists, client records, and validation status in one place before campaigns go live.
              </p>
            </div>
            <div className="ui-page-section-actions">
              <select
                className="input"
                value={selectedListId}
                onChange={(event) => setSelectedListId(event.target.value)}
                style={{ minWidth: 240 }}
              >
                {lists.length ? lists.map((list) => (
                  <option key={list._id} value={list._id}>
                    {list.name} ({list.leadCount || 0}){String(list?.kind || 'uploaded') === 'custom' ? ' [Custom]' : ''}
                  </option>
                )) : <option value="">No uploaded lists</option>}
              </select>
              <Button variant="secondary">Import List</Button>
            </div>
          </div>

          <div className="client-data-grid">
            <section className="client-data-panel client-data-panel-large">
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Client Directory</h2>
                  <p className="ui-card-description">
                    Live client rows from your selected uploaded list.
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  {selectedList ? `${clientRows.length} rows` : 'View All'}
                </Button>
              </div>

              <div className="ui-card-content">
                <div className="client-data-table client-data-table-scroll">
                  <div className="client-data-table-head">
                    {TABLE_COLUMNS.map((column) => (
                      <span key={column}>{column}</span>
                    ))}
                  </div>

                  {loading || loadingList ? (
                    <div className="client-data-table-row">
                      <span>Loading client data...</span>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !loadingList && error ? (
                    <div className="client-data-table-row">
                      <span>{error}</span>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !loadingList && !error && !clientRows.length ? (
                    <div className="client-data-table-row">
                      <span>No client data found.</span>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !loadingList && !error ? clientRows.map((row) => (
                    <div key={row.id} className="client-data-table-row">
                      <span>{row.name}</span>
                      <span>{row.email}</span>
                      <span>{row.company}</span>
                      <span>{row.city}</span>
                      <span>
                        <Badge variant={badgeToneMap[row.status] || 'default'}>
                          {row.status}
                        </Badge>
                      </span>
                      <span>{row.source}</span>
                    </div>
                  )) : null}
                </div>
              </div>
            </section>

            <section className="client-data-panel">
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Source Health</h2>
                  <p className="ui-card-description">Live overview of uploaded client lists.</p>
                </div>
              </div>
              <div className="ui-card-content">
                <div className="client-data-health-list">
                  {visibleSourceHealthItems.length ? visibleSourceHealthItems.map((item) => (
                    <div key={item.title}>
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </div>
                  )) : (
                    <div>
                      <strong>No uploaded lists</strong>
                      <span>Upload a list and it will appear here automatically.</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="client-data-panel">
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Recent Activity</h2>
                  <p className="ui-card-description">Latest uploaded lists and changes from the database.</p>
                </div>
              </div>
              <div className="ui-card-content">
                <div className="client-data-activity-list">
                  {recentActivityItems.length ? recentActivityItems.map((item) => (
                    <article key={`${item.title}-${item.meta}`}>
                      <strong>{item.title}</strong>
                      <p>{item.meta}</p>
                    </article>
                  )) : (
                    <article>
                      <strong>No recent activity</strong>
                      <p>When you upload client data, it will show here automatically.</p>
                    </article>
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}


