'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';
import { Card, CardContent } from '@/app/components/ui/Card';
import PageSection from '@/app/components/ui/PageSection';
import draftTemplates from '@/app/dashboard/draftTemplates';

const WARMUP_WORKSPACE_KEY = 'warmup:workspace:v1';

function formatDateTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

export default function EmailWarmupPage() {
  const [data, setData] = useState({
    setting: null,
    accounts: [],
    campaigns: [],
    stats: {
      totalAccounts: 0,
      connected: 0,
      needsSetup: 0,
      providers: 0,
      totalReplies: 0,
      totalFailedReplies: 0,
      totalWarmupCampaigns: 0,
      runningWarmupCampaigns: 0
    },
    activity: []
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showWarmupSetup, setShowWarmupSetup] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [selectedDraftType, setSelectedDraftType] = useState('follow_up');
  const [selectedSenderAccountId, setSelectedSenderAccountId] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedListId, setUploadedListId] = useState('');
  const [previewColumns, setPreviewColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [setupMessage, setSetupMessage] = useState('');
  const [overviewMinimized, setOverviewMinimized] = useState(true);
  const [sheetMinimized, setSheetMinimized] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);

  const persistWorkspace = (next = {}) => {
    if (typeof window === 'undefined') return;
    const payload = {
      selectedDraftType,
      selectedSenderAccountId,
      uploadedFileName,
      uploadedListId,
      ...next
    };
    try {
      window.localStorage.setItem(WARMUP_WORKSPACE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage failures.
    }
  };

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadData = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const response = await fetch('/api/warmup-dashboard', { cache: 'no-store' });
        const next = await response.json();
        if (!active) return;
        if (!response.ok) {
          throw new Error(next?.error || 'Failed to load warmup dashboard');
        }
        setData({
          setting: next.setting || null,
          accounts: Array.isArray(next.accounts) ? next.accounts : [],
          campaigns: Array.isArray(next.campaigns) ? next.campaigns : [],
          stats: next.stats || data.stats,
          activity: Array.isArray(next.activity) ? next.activity : []
        });
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load warmup dashboard');
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    void loadData();
    intervalId = window.setInterval(() => {
      void loadData({ silent: true });
    }, 10000);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const restoreWorkspace = async () => {
      if (typeof window === 'undefined') return;
      try {
        const raw = window.localStorage.getItem(WARMUP_WORKSPACE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== 'object') return;

        if (!active) return;
        setSelectedDraftType(String(saved.selectedDraftType || 'follow_up'));
        setSelectedSenderAccountId(String(saved.selectedSenderAccountId || ''));
        setUploadedFileName(String(saved.uploadedFileName || ''));

        const savedListId = String(saved.uploadedListId || '');
        if (!savedListId) return;

        const response = await fetch(`/api/lists/${savedListId}`, { cache: 'no-store' });
        const next = await response.json();
        if (!response.ok) {
          throw new Error(next?.error || 'Failed to restore warmup sheet');
        }
        if (!active) return;

        setUploadedListId(savedListId);
        setPreviewColumns(Array.isArray(next.columns) ? next.columns : []);
        setPreviewRows(Array.isArray(next.leads) ? next.leads.map((lead) => lead?.data || {}) : []);
      } catch (error) {
        // Ignore bad restore state and start clean.
      }
    };

    void restoreWorkspace();
    return () => {
      active = false;
    };
  }, []);

  const statsCards = useMemo(
    () => [
      { label: 'Warmup Accounts', value: String(data.stats.totalAccounts || 0) },
      { label: 'Connected', value: String(data.stats.connected || 0) },
      { label: 'Needs Setup', value: String(data.stats.needsSetup || 0) },
      { label: 'Providers', value: String(data.stats.providers || 0) },
      { label: 'Auto Replies', value: String(data.stats.totalReplies || 0) },
      { label: 'Reply Failures', value: String(data.stats.totalFailedReplies || 0) }
    ],
    [data.stats]
  );

  const sideItems = useMemo(
    () => [
      { title: 'Ready for Warmup', meta: `${data.stats.connected || 0} accounts are connected and available` },
      { title: 'Needs Attention', meta: `${data.stats.needsSetup || 0} accounts still need configuration` },
      { title: 'Auto Reply Status', meta: data.setting?.enabled ? 'Warmup auto reply is active' : 'Warmup auto reply is currently off' }
    ],
    [data.setting?.enabled, data.stats.connected, data.stats.needsSetup]
  );

  const connectedAccounts = useMemo(
    () => data.accounts.filter((account) => String(account.status || '').toLowerCase() === 'connected'),
    [data.accounts]
  );

  useEffect(() => {
    if (!selectedSenderAccountId && connectedAccounts.length) {
      setSelectedSenderAccountId(connectedAccounts[0].id);
    }
  }, [connectedAccounts, selectedSenderAccountId]);

  useEffect(() => {
    persistWorkspace();
  }, [selectedDraftType, selectedSenderAccountId, uploadedFileName, uploadedListId]);

  const handleToggle = async (enabled) => {
    try {
      setBusy(true);
      const response = await fetch('/api/warmup-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const next = await response.json();
      if (!response.ok) {
        throw new Error(next?.error || 'Failed to update warmup status');
      }
      setData((current) => ({ ...current, setting: next.setting || current.setting }));
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to update warmup status');
    } finally {
      setBusy(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setBusy(true);
      const response = await fetch('/api/warmup-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runNow: true })
      });
      const next = await response.json();
      if (!response.ok) {
        throw new Error(next?.error || 'Failed to run warmup check');
      }
      const refreshed = await fetch('/api/warmup-dashboard', { cache: 'no-store' });
      const refreshedData = await refreshed.json();
      if (!refreshed.ok) {
        throw new Error(refreshedData?.error || 'Failed to refresh warmup data');
      }
      setData({
        setting: refreshedData.setting || null,
        accounts: Array.isArray(refreshedData.accounts) ? refreshedData.accounts : [],
        campaigns: Array.isArray(refreshedData.campaigns) ? refreshedData.campaigns : [],
        stats: refreshedData.stats || data.stats,
        activity: Array.isArray(refreshedData.activity) ? refreshedData.activity : []
      });
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to run warmup check');
    } finally {
      setBusy(false);
    }
  };

  const handleWarmupUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setSetupBusy(true);
      setSetupMessage('');
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: form
      });
      const next = await response.json();
      if (!response.ok) {
        throw new Error(next?.error || 'Failed to upload warmup sheet');
      }
      setUploadedFileName(file.name);
      setUploadedListId(next.listId || '');
      setPreviewColumns(Array.isArray(next.previewColumns) ? next.previewColumns : []);
      setPreviewRows(Array.isArray(next.previewRows) ? next.previewRows : []);
      persistWorkspace({
        uploadedFileName: file.name,
        uploadedListId: next.listId || ''
      });
      setSetupMessage(`Uploaded ${file.name}. Review the sheet data below, then start warmup mails.`);
    } catch (err) {
      setSetupMessage(err.message || 'Failed to upload warmup sheet');
    } finally {
      setSetupBusy(false);
      event.target.value = '';
    }
  };

  const handleStartWarmupMails = async () => {
    if (!uploadedListId) {
      setSetupMessage('Upload a sheet first.');
      return;
    }
    if (!selectedSenderAccountId) {
      setSetupMessage('Select a sender account first.');
      return;
    }

    const draft = draftTemplates[selectedDraftType];
    if (!draft?.subject || !draft?.body) {
      setSetupMessage('Selected draft type is not available.');
      return;
    }

    try {
      setSetupBusy(true);
      setSetupMessage('');
      if (uploadedListId && previewRows.length) {
        await fetch(`/api/lists/${uploadedListId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            columns: previewColumns,
            rows: previewRows
          })
        });
      }
      const campaignName = `Warmup ${draft.label || selectedDraftType} ${new Date().toLocaleString()}`;
      const createResponse = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          listId: uploadedListId,
          senderAccountId: selectedSenderAccountId,
          draftType: selectedDraftType,
          type: selectedDraftType,
          project: 'warmup',
          inlineTemplate: {
            subject: draft.subject,
            body: draft.body
          },
          options: {
            batchSize: 1,
            delaySeconds: 60,
            replyMode: false
          }
        })
      });
      const created = await createResponse.json();
      if (!createResponse.ok || !created?.campaign?._id) {
        throw new Error(created?.error || 'Failed to create warmup campaign');
      }

      const startResponse = await fetch(`/api/campaigns/${created.campaign._id}/start`, {
        method: 'POST'
      });
      const started = await startResponse.json();
      if (!startResponse.ok) {
        throw new Error(started?.error || 'Failed to start warmup campaign');
      }

      setSetupMessage('Warmup mails started successfully.');
      setShowWarmupSetup(false);
      setError('');
    } catch (err) {
      setSetupMessage(err.message || 'Failed to start warmup mails');
    } finally {
      setSetupBusy(false);
    }
  };

  const handlePreviewCellChange = (rowIndex, column, value) => {
    setPreviewRows((current) =>
      current.map((row, index) => (index === rowIndex ? { ...row, [column]: value } : row))
    );
  };

  const handleAddClientRow = () => {
    const nextColumns = previewColumns.length ? previewColumns : ['Name', 'Email', 'Company'];
    if (!previewColumns.length) {
      setPreviewColumns(nextColumns);
    }
    setPreviewRows((current) => [
      ...current,
      Object.fromEntries(nextColumns.map((column) => [column, '']))
    ]);
  };

  const handleSaveWarmupSheet = async () => {
    if (!uploadedListId) {
      setSetupMessage('Upload a sheet first.');
      return;
    }
    try {
      setSheetBusy(true);
      const response = await fetch(`/api/lists/${uploadedListId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: previewColumns,
          rows: previewRows
        })
      });
      const next = await response.json();
      if (!response.ok) {
        throw new Error(next?.error || 'Failed to save warmup sheet');
      }
      persistWorkspace();
      setSetupMessage('Warmup sheet saved successfully.');
    } catch (error) {
      setSetupMessage(error.message || 'Failed to save warmup sheet');
    } finally {
      setSheetBusy(false);
    }
  };

  const visiblePreviewRows = sheetMinimized ? previewRows.slice(0, 2) : previewRows;

  return (
    <AppLayout
      topbarProps={{
        title: 'Email Warmup',
        subtitle: 'Track all warm-up related sender accounts from one live page.',
        actions: (
          <>
            <Button variant="secondary" loading={setupBusy} onClick={() => setShowWarmupSetup(true)}>
              Start Warmup Mails
            </Button>
            <Button variant="secondary" loading={busy} onClick={handleRunNow}>
              Run Warmup Reply Now
            </Button>
            <Button loading={busy} onClick={() => handleToggle(!data.setting?.enabled)}>
              {data.setting?.enabled ? 'Turn Warmup Off' : 'Turn Warmup On'}
            </Button>
          </>
        )
      }}
    >
      <PageSection
        title="Overview"
        description="All connected sender accounts used for warm-up are shown here with live status."
      >
        <div className="workspace-page warmup-workspace-page" style={{ '--workspace-accent': '#14b8a6' }}>
          <div className="workspace-stats">
            {statsCards.map((card) => (
              <article key={card.label} className="workspace-stat-card">
                <span>{card.label}</span>
                <strong>{loading ? '...' : card.value}</strong>
              </article>
            ))}
          </div>

          {error ? (
            <Card className="workspace-panel" style={{ marginBottom: 16 }}>
              <CardContent>
                <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>{error}</p>
              </CardContent>
            </Card>
          ) : null}

          <div className="workspace-grid">
            <section className="workspace-panel workspace-panel-large">
              <div className="workspace-panel-head">
                <div>
                  <h2>Warmup Setup</h2>
                  <p>Select sender ID, keep an editable saved sheet, and start warmup sending from it.</p>
                </div>
              </div>
              <div className="warmup-start-grid">
                <section className="workspace-panel">
                  <div className="warmup-inline-setup-grid">
                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Select Mail ID</h2>
                          <p>Choose the mailbox that should send warmup emails.</p>
                        </div>
                      </div>
                      <select
                        className="warmup-select"
                        value={selectedSenderAccountId}
                        onChange={(event) => setSelectedSenderAccountId(event.target.value)}
                      >
                        <option value="">Select sender ID</option>
                        {connectedAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.from} ({account.provider})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Upload Warmup Sheet</h2>
                          <p>The uploaded sheet stays saved and can be edited anytime.</p>
                        </div>
                      </div>
                      <label className="warmup-upload-box" htmlFor="warmup-inline-upload-input">
                        <strong>{uploadedFileName || 'Choose CSV or XLSX file'}</strong>
                        <span>{uploadedFileName ? 'Click to replace the saved warmup sheet' : 'Click to upload a warmup sheet'}</span>
                      </label>
                      <input
                        id="warmup-inline-upload-input"
                        type="file"
                        accept=".xlsx,.csv"
                        style={{ display: 'none' }}
                        onChange={handleWarmupUpload}
                      />
                    </div>
                  </div>

                  <div className="workspace-panel-head">
                    <div>
                      <h2>Select Draft Type</h2>
                      <p>Choose which draft should be sent for warmup.</p>
                    </div>
                  </div>
                  <select
                    className="warmup-select"
                    value={selectedDraftType}
                    onChange={(event) => setSelectedDraftType(event.target.value)}
                  >
                    {Object.entries(draftTemplates).map(([key, draft]) => (
                      <option key={key} value={key}>
                        {draft.label}
                      </option>
                    ))}
                  </select>

                  {setupMessage ? (
                    <p className="warmup-setup-message">{setupMessage}</p>
                  ) : null}

                  <div className="warmup-guide-actions">
                    <Button variant="secondary" loading={sheetBusy} onClick={handleSaveWarmupSheet}>
                      Save Sheet
                    </Button>
                    <Button variant="secondary" onClick={() => setShowWarmupSetup(true)}>
                      Open Setup
                    </Button>
                    <Button loading={setupBusy} onClick={handleStartWarmupMails}>
                      Start Warmup
                    </Button>
                  </div>
                </section>

                <section className="workspace-panel workspace-panel-large warmup-sheet-panel">
                  <div className="workspace-panel-head">
                    <div>
                      <h2>Saved Warmup Sheet</h2>
                      <p>Edit client rows here. Added clients will be included in warmup sending.</p>
                    </div>
                    <div className="warmup-panel-actions">
                      <Button variant="ghost" size="sm">{previewRows.length} rows</Button>
                      <Button variant="ghost" size="sm" onClick={() => setSheetMinimized((current) => !current)}>
                        {sheetMinimized ? 'Expand Sheet' : 'Minimize Sheet'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleAddClientRow}>
                        Add Client
                      </Button>
                    </div>
                  </div>

                  <div className="workspace-table warmup-preview-table">
                    {previewColumns.length ? (
                      <>
                        <div className="workspace-table-head" style={{ gridTemplateColumns: `64px repeat(${previewColumns.length}, minmax(160px, 1fr))` }}>
                          <span>No.</span>
                          {previewColumns.map((column) => (
                            <span key={column}>{column}</span>
                          ))}
                        </div>
                        {visiblePreviewRows.map((row, index) => (
                          <div key={`editable-${index}-${uploadedListId || 'new'}`} className="workspace-table-row" style={{ gridTemplateColumns: `64px repeat(${previewColumns.length}, minmax(160px, 1fr))` }}>
                            <span>{index + 1}</span>
                            {previewColumns.map((column) => (
                              <input
                                key={`${index}-${column}`}
                                className="warmup-sheet-input"
                                value={String(row?.[column] ?? '')}
                                onChange={(event) => handlePreviewCellChange(index, column, event.target.value)}
                                placeholder={column}
                              />
                            ))}
                          </div>
                        ))}
                        {sheetMinimized && previewRows.length > 2 ? (
                          <div className="warmup-minimized-note">
                            Showing first 2 client rows. Click `Expand Sheet` to view and edit the full saved sheet.
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="warmup-empty-preview">Upload a warmup sheet to keep a saved editable client list here.</div>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <section className="workspace-panel">
              <div className="workspace-panel-head">
                <div>
                  <h2>Warmup Segments</h2>
                  <p>Live status summary across warm-up accounts.</p>
                </div>
              </div>
              <div className="workspace-list">
                {sideItems.map((item) => (
                  <div key={item.title}>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="workspace-panel workspace-panel-large">
              <div className="workspace-panel-head">
                <div>
                  <h2>Warmup Overview</h2>
                  <p>All live sender accounts currently available for warm-up.</p>
                </div>
                <div className="warmup-panel-actions">
                  <Button variant="ghost" size="sm">{loading ? 'Loading...' : `${data.accounts.length} accounts`}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setOverviewMinimized((current) => !current)}>
                    {overviewMinimized ? 'Expand' : 'Minimize'}
                  </Button>
                </div>
              </div>

              {!overviewMinimized ? (
                <div className="workspace-table">
                  <div className="workspace-table-head" style={{ gridTemplateColumns: '2.1fr .8fr .9fr 1.8fr .8fr 1fr' }}>
                    <span>Mailbox</span>
                    <span>Provider</span>
                    <span>Status</span>
                    <span>Label</span>
                    <span>Trend</span>
                    <span>Replies</span>
                  </div>
                  {data.accounts.map((row) => (
                    <div key={row.id} className="workspace-table-row" style={{ gridTemplateColumns: '2.1fr .8fr .9fr 1.8fr .8fr 1fr' }}>
                      <span>{row.from}</span>
                      <span>{row.provider}</span>
                      <span>{row.status}</span>
                      <span>{row.label}</span>
                      <span>{row.trend}</span>
                      <span>{row.repliedCount || 0}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="warmup-minimized-note">Warmup Overview table is minimized.</div>
              )}
            </section>

            <section className="workspace-panel">
              <div className="workspace-panel-head">
                <div>
                  <h2>Warmup Activity</h2>
                  <p>Latest warmup replies and auto-reply actions.</p>
                </div>
              </div>
              <div className="workspace-activity">
                {data.activity.length ? data.activity.slice(0, 12).map((item) => (
                  <article key={item.id}>
                    <strong>{item.mailboxEmail || 'Mailbox'}</strong>
                    <p>{item.subject || item.note || 'Warmup action recorded'}</p>
                    {item.replyBody ? (
                      <div
                        className="warmup-reply-preview"
                        dangerouslySetInnerHTML={{ __html: item.replyBody }}
                      />
                    ) : null}
                    <span style={{ display: 'block', color: '#64748b', fontSize: 12 }}>
                      {item.status} | {item.fromEmail || 'unknown sender'} | {formatDateTime(item.repliedAt)}
                    </span>
                  </article>
                )) : (
                  <article>
                    <strong>No warmup reply activity yet</strong>
                    <p>Turn Warmup On, then incoming warmup emails and replies will appear here.</p>
                  </article>
                )}
              </div>
            </section>
          </div>
        </div>
      </PageSection>

      {showWarmupSetup && typeof window !== 'undefined'
        ? createPortal(
            <div className="premium-calendar-modal-backdrop" onClick={() => setShowWarmupSetup(false)}>
              <div className="premium-calendar-modal warmup-start-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <div>
                <h3>Start Warmup Mails</h3>
                <p>Upload a sheet, review all rows, choose draft type, and start warmup sending.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowWarmupSetup(false)}>
                Close
              </Button>
            </div>

            <div className="warmup-start-grid">
              <section className="workspace-panel">
                <div className="workspace-panel-head">
                  <div>
                    <h2>Step 1: Upload Sheet</h2>
                    <p>Upload the client sheet you want to use for warmup mails.</p>
                  </div>
                </div>
                <label className="warmup-upload-box" htmlFor="warmup-upload-input">
                  <strong>{uploadedFileName || 'Choose CSV or XLSX file'}</strong>
                  <span>{uploadedFileName ? 'Click to replace the current file' : 'Click to upload your sheet'}</span>
                </label>
                <input
                  id="warmup-upload-input"
                  type="file"
                  accept=".xlsx,.csv"
                  style={{ display: 'none' }}
                  onChange={handleWarmupUpload}
                />

                <div className="workspace-panel-head">
                  <div>
                    <h2>Step 2: Choose Draft Type</h2>
                    <p>Select which warmup mail draft should be used.</p>
                  </div>
                </div>
                <select
                  className="warmup-select"
                  value={selectedDraftType}
                  onChange={(event) => setSelectedDraftType(event.target.value)}
                >
                  {Object.entries(draftTemplates).map(([key, draft]) => (
                    <option key={key} value={key}>
                      {draft.label}
                    </option>
                  ))}
                </select>

                <div className="workspace-panel-head">
                  <div>
                    <h2>Step 3: Choose Sender</h2>
                    <p>Select the connected mailbox that should send the warmup mails.</p>
                  </div>
                </div>
                <select
                  className="warmup-select"
                  value={selectedSenderAccountId}
                  onChange={(event) => setSelectedSenderAccountId(event.target.value)}
                >
                  {connectedAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.from} ({account.provider})
                    </option>
                  ))}
                </select>

                {setupMessage ? (
                  <p className="warmup-setup-message">{setupMessage}</p>
                ) : null}

                <div className="warmup-guide-actions">
                  <Button variant="secondary" onClick={() => setShowWarmupSetup(false)}>
                    Cancel
                  </Button>
                  <Button loading={setupBusy} onClick={handleStartWarmupMails}>
                    Start Warmup
                  </Button>
                </div>
              </section>

              <section className="workspace-panel workspace-panel-large">
                <div className="workspace-panel-head">
                  <div>
                    <h2>Sheet Preview</h2>
                    <p>All uploaded sheet rows are shown here before you start warmup mails.</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    {previewRows.length} rows
                  </Button>
                </div>

                <div className="workspace-table warmup-preview-table">
                  {previewColumns.length ? (
                    <>
                      <div className="workspace-table-head" style={{ gridTemplateColumns: `64px repeat(${previewColumns.length}, minmax(140px, 1fr))` }}>
                        <span>No.</span>
                        {previewColumns.map((column) => (
                          <span key={column}>{column}</span>
                        ))}
                      </div>
                      {previewRows.map((row, index) => (
                        <div key={`${index}-${uploadedListId}`} className="workspace-table-row" style={{ gridTemplateColumns: `64px repeat(${previewColumns.length}, minmax(140px, 1fr))` }}>
                          <span>{index + 1}</span>
                          {previewColumns.map((column) => (
                            <span key={`${index}-${column}`}>{String(row?.[column] ?? '') || '-'}</span>
                          ))}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="warmup-empty-preview">Upload a sheet to preview all client rows here.</div>
                  )}
                </div>
              </section>
            </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </AppLayout>
  );
}
