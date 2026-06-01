'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';
import { Card, CardContent } from '@/app/components/ui/Card';
import PageSection from '@/app/components/ui/PageSection';
import { UNIFIED_NAVBAR_TOPBAR_PROPS } from '@/shared-components/layout-components/UnifiedNavbarConfig';

function formatDateTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

function normalizeCampaign(row = {}) {
  return {
    id: String(row.id || row._id || ''),
    name: row.name || 'Warmup campaign',
    status: row.status || row.displayStatus || 'Draft',
    senderFrom: row.senderFrom || row.senderAccount?.from || '',
    total: Number(row.total ?? row.totalRecipients ?? row.stats?.total ?? 0),
    sent: Number(row.sent ?? row.sentCount ?? row.stats?.sent ?? 0),
    pending: Number(row.pending ?? row.pendingCount ?? row.stats?.pending ?? 0),
    failed: Number(row.failed ?? row.failedCount ?? row.stats?.failed ?? 0),
    updatedAt: row.updatedAt || row.createdAt || null
  };
}

function htmlToPlainText(html = '') {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToEmailHtml(text = '') {
  const blocks = String(text || '').trim().split(/\n{2,}/);
  const body = blocks
    .map((block) => {
      const escaped = escapeHtml(block.trim()).replace(/\n/g, '<br/>');
      return escaped ? `<p style="margin:0 0 12px;">${escaped}</p>` : '';
    })
    .filter(Boolean)
    .join('');
  return `<div style="font-family:Inter, 'Segoe UI', Arial, sans-serif;font-size:15px;line-height:1.55;color:#111827;">${body}</div>`;
}

export default function EmailWarmupPage() {
  const [projects, setProjects] = useState([]);
  const [senderIds, setSenderIds] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [leadList, setLeadList] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingIds, setLoadingIds] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [activeCampaignId, setActiveCampaignId] = useState('');
  const toastTimeoutRef = useRef(null);

  // Add ID Modal states
  const [isAddIdModalOpen, setIsAddIdModalOpen] = useState(false);
  const [newIdName, setNewIdName] = useState('');
  const [newIdEmail, setNewIdEmail] = useState('');
  const [newIdPassword, setNewIdPassword] = useState('');
  const [newIdProvider, setNewIdProvider] = useState('Gmail');

  const selectedSender = useMemo(
    () => senderIds.find((sender) => String(sender._id || sender.id) === selectedSenderId) || null,
    [senderIds, selectedSenderId]
  );
  const selectedDraft = useMemo(
    () => drafts.find((draft) => String(draft._id) === selectedDraftId) || null,
    [drafts, selectedDraftId]
  );
  const latestCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === activeCampaignId) || campaigns[0] || null,
    [activeCampaignId, campaigns]
  );
  const leadRows = Array.isArray(leadList?.leads) ? leadList.leads : [];
  const leadColumns = useMemo(() => {
    const saved = Array.isArray(leadList?.columns) ? leadList.columns.filter(Boolean) : [];
    if (saved.length) return saved.slice(0, 8);
    const first = leadRows[0] || {};
    return Object.keys(first).filter((key) => !['data', 'thread', 'status', 'error'].includes(key)).slice(0, 8);
  }, [leadList?.columns, leadRows]);
  const getLeadCellValue = (row, column) => {
    const value = row?.[column] ?? row?.data?.[column] ?? '';
    return String(value || '').trim() || '-';
  };

  const showActionAlert = (tone, text) => {
    setToast({ tone, message: text });
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 5200);
  };

  const setActionError = (text) => {
    setError(text);
    showActionAlert('error', text);
  };

  const setActionMessage = (text) => {
    setMessage(text);
    showActionAlert('success', text);
  };

  const loadWarmupStatus = async ({ silent = false } = {}) => {
    try {
      const response = await fetch('/api/warmup-dashboard', { cache: 'no-store' });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || 'Failed to load warmup status');
      const rows = Array.isArray(next.campaigns) ? next.campaigns.map(normalizeCampaign) : [];
      setCampaigns(rows);
      if (!silent) setError('');
      return rows;
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load warmup status');
      return [];
    }
  };

  const loadWarmupLeads = async () => {
    setLoadingLeads(true);
    const response = await fetch(`/api/warmup/leads?t=${Date.now()}`, { cache: 'no-store' });
    const next = await response.json();
    if (!response.ok) throw new Error(next?.error || 'Failed to load warmup clients');
    setLeadList(next.list || null);
    if (next.reusedExisting) {
      setMessage('Your existing uploaded database sheet is now used as the warmup sheet.');
    }
    setError('');
    setLoadingLeads(false);
    return next.list || null;
  };

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try {
        setLoadingProjects(true);
        setLoadingLeads(true);
        const projectResponse = await fetch('/api/projects', { cache: 'no-store' });
        const projectData = await projectResponse.json();
        if (!active) return;
        if (!projectResponse.ok || !projectData.success) throw new Error(projectData?.message || 'Failed to load projects');
        const nextProjects = Array.isArray(projectData.projects) ? projectData.projects : [];
        setProjects(nextProjects);
        if (nextProjects.length) setSelectedProject(nextProjects[0]);
        await loadWarmupLeads();
        setError('');
      } catch (err) {
        if (active) setError(err.message || 'Failed to load warmup setup');
      } finally {
        if (active) {
          setLoadingProjects(false);
          setLoadingLeads(false);
        }
      }
    };

    void loadInitial();
    void loadWarmupStatus();
    const intervalId = window.setInterval(() => {
      void loadWarmupStatus({ silent: true });
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  const handleWarmupSheetUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingSheet(true);
      setMessage('');
      setError('');
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/warmup/upload', {
        method: 'POST',
        body: form
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || 'Failed to save warmup sheet');
      const savedList = await loadWarmupLeads();
      setLeadList(savedList || next.list || null);
      setActionMessage(`${next.message || 'Warmup sheet saved successfully.'} Table updated.`);
    } catch (err) {
      setActionError(err.message || 'Failed to save warmup sheet');
    } finally {
      setUploadingSheet(false);
      setLoadingLeads(false);
      event.target.value = '';
    }
  };

  const fetchSenderIdsByProject = async (projectId) => {
    setLoadingIds(true);

    try {
      const res = await fetch(`/api/sender-ids?projectId=${projectId}`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to fetch sender IDs");
      }

      setSenderIds(data.senderIds || []);
      setSelectedSenderId((current) => (data.senderIds.some((row) => String(row._id || row.id) === current) ? current : String(data.senderIds[0]?._id || '')));
    } catch (error) {
      console.error("Sender ID fetch error:", error);
      setSenderIds([]);
      setSelectedSenderId('');
      setActionError(error.message || "Failed to load sender IDs");
    } finally {
      setLoadingIds(false);
    }
  };

  useEffect(() => {
    if (!selectedProject?._id) {
      setSenderIds([]);
      return;
    }

    fetchSenderIdsByProject(selectedProject._id);
  }, [selectedProject?._id]);

  const closeAddIdModal = () => {
    setIsAddIdModalOpen(false);
    setNewIdName('');
    setNewIdEmail('');
    setNewIdPassword('');
    setNewIdProvider('Gmail');
  };

  const handleSaveNewId = async () => {
    if (!selectedProject?._id) {
      setActionError("Please select project first");
      return;
    }
    if (!newIdName || !newIdEmail || !newIdPassword) {
      setActionError("Please fill out all fields");
      return;
    }

    try {
      const response = await fetch('/api/sender-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newIdName,
          email: newIdEmail.toLowerCase().trim(),
          password: newIdPassword,
          provider: newIdProvider,
          projectId: selectedProject._id,
          projectName: selectedProject.name
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to add sender ID');
      }

      setSenderIds((prev) => [data.senderId, ...prev]);
      setSelectedSenderId(String(data.senderId._id));
      closeAddIdModal();
      setActionMessage("Sender ID added successfully");
    } catch (err) {
      setActionError(err.message || 'Failed to save sender ID');
    }
  };

  useEffect(() => {
    let active = true;
    const loadDrafts = async () => {
      const selectedProjectCode = selectedProject?.code || '';
      if (!selectedProjectCode || !selectedSenderId) {
        setDrafts([]);
        setSelectedDraftId('');
        return;
      }
      try {
        setLoadingDrafts(true);
        const params = new URLSearchParams({ project: selectedProjectCode, senderId: selectedSenderId });
        const response = await fetch(`/api/warmup/drafts?${params.toString()}`, { cache: 'no-store' });
        const next = await response.json();
        if (!response.ok) throw new Error(next?.error || 'Failed to load warmup drafts');
        if (!active) return;
        const rows = Array.isArray(next.drafts) ? next.drafts : [];
        setDrafts(rows);
        setSelectedDraftId((current) => (rows.some((row) => String(row._id) === current) ? current : String(rows[0]?._id || '')));
        setError('');
      } catch (err) {
        if (active) {
          setDrafts([]);
          setSelectedDraftId('');
          setError(err.message || 'Failed to load warmup drafts');
        }
      } finally {
        if (active) setLoadingDrafts(false);
      }
    };

    void loadDrafts();
    return () => {
      active = false;
    };
  }, [selectedProject?.code, selectedSenderId]);

  useEffect(() => {
    setDraftSubject(String(selectedDraft?.subject || ''));
    setDraftBody(htmlToPlainText(selectedDraft?.body || ''));
  }, [selectedDraftId, selectedDraft]);

  const handleStartWarmup = async () => {
    setMessage('');
    setError('');
    if (!selectedProject) return setActionError('Select a project first.');
    if (!selectedSenderId) return setActionError('Select a sender ID first.');
    if (!selectedDraftId) return setActionError('Select a warmup draft first.');
    if (!draftSubject.trim()) return setActionError('Draft subject is required.');
    if (!draftBody.trim()) return setActionError('Draft body is required.');
    if (!leadList || Number(leadList.total || 0) < 1) return setActionError('Upload a warmup sheet with at least one valid email client.');

    try {
      setStarting(true);
      const response = await fetch('/api/warmup/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: selectedProject?.code || '',
          senderId: selectedSenderId,
          draftId: selectedDraftId,
          subject: draftSubject,
          body: plainTextToEmailHtml(draftBody)
        })
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || 'Failed to start warmup campaign');
      setActiveCampaignId(next.campaign?.id || '');
      const rows = await loadWarmupStatus();
      const freshCampaign = rows.find((campaign) => campaign.id === next.campaign?.id) || next.campaign;
      const status = freshCampaign?.status ? ` Status: ${freshCampaign.status}.` : '';
      setActionMessage(`${next.message || 'Warmup campaign started.'}${status}`);
    } catch (err) {
      setActionError(err.message || 'Failed to start warmup campaign');
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
      {toast ? (
        <div className={`dashboard-toast dashboard-toast-${toast.tone}`} role="alert" aria-live="assertive">
          <div>
            <strong>{toast.tone === 'error' ? 'Action failed' : 'Action completed'}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="dashboard-toast-close" onClick={() => setToast(null)} aria-label="Close notification">
            x
          </button>
        </div>
      ) : null}
      <PageSection
        title="Email Warmup"
        description="Start a warmup campaign from a saved client list, project sender ID, and project draft."
      >
        <div className="workspace-page warmup-workspace-page" style={{ '--workspace-accent': '#14b8a6' }}>
          <div className="workspace-stats">
            <article className="workspace-stat-card">
              <span>Warmup Clients</span>
              <strong>{loadingLeads ? '...' : leadList?.total || 0}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Sender IDs</span>
              <strong>{loadingIds ? '...' : senderIds.length}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Warmup Drafts</span>
              <strong>{loadingDrafts ? '...' : drafts.length}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Latest Status</span>
              <strong>{latestCampaign?.status || 'Ready'}</strong>
            </article>
          </div>

          {error ? (
            <Card className="workspace-panel" style={{ marginBottom: 16 }}>
              <CardContent>
                <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>{error}</p>
              </CardContent>
            </Card>
          ) : null}
          {message ? (
            <Card className="workspace-panel" style={{ marginBottom: 16 }}>
              <CardContent>
                <p style={{ margin: 0, color: '#047857', fontWeight: 700 }}>{message}</p>
              </CardContent>
            </Card>
          ) : null}

          <div className="workspace-grid">
            <section className="workspace-panel workspace-panel-large" style={{ gridColumn: '1 / -1' }}>
              <div className="workspace-panel-head">
                <div>
                  <h2>Warmup Campaign Flow</h2>
                  <p>Project dropdown to Sender ID dropdown to Warmup draft to Saved clients to Start Warmup.</p>
                </div>
              </div>

              <div className="warmup-start-grid">
                <section className="workspace-panel">
                  <div className="warmup-inline-setup-grid">
                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Project</h2>
                          <p>Loaded from saved project data when available.</p>
                        </div>
                      </div>
                      <select
                        className="warmup-select"
                        value={selectedProject?._id || ''}
                        disabled={loadingProjects}
                        onChange={(event) => {
                          const proj = projects.find((p) => p._id === event.target.value);
                          setSelectedProject(proj || null);
                        }}
                      >
                        <option value="">{loadingProjects ? 'Loading projects...' : 'Select project'}</option>
                        {projects.map((project) => (
                          <option key={project._id} value={project._id}>{project.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Sender ID</h2>
                          <p>Only sender IDs for the selected project are listed.</p>
                        </div>
                      </div>
                      {!selectedProject?._id ? (
                        <div className="warmup-select-message" style={{ padding: '8px 12px', background: 'var(--card-bg-subtle, #f3f4f6)', borderRadius: 4, color: 'var(--text-muted, #4b5563)' }}>
                          Please select a project first to view sender IDs.
                        </div>
                      ) : loadingIds ? (
                        <select className="warmup-select" disabled>
                          <option>Loading sender IDs...</option>
                        </select>
                      ) : senderIds.length === 0 ? (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <div className="warmup-select-message" style={{ padding: '8px 12px', background: 'var(--card-bg-subtle, #f3f4f6)', borderRadius: 4, color: 'var(--text-muted, #4b5563)' }}>
                            No sender IDs found for {selectedProject.name}. Click Add ID to create one.
                          </div>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => setIsAddIdModalOpen(true)}
                          >
                            Add ID
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 8 }}>
                          <select
                            className="warmup-select"
                            value={selectedSenderId}
                            onChange={(event) => setSelectedSenderId(event.target.value)}
                          >
                            <option value="">Select sender ID</option>
                            {senderIds.map((sender) => (
                              <option key={sender._id} value={sender._id}>
                                {sender.name} ({sender.email})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="button secondary"
                            style={{ padding: '6px 12px', width: 'fit-content' }}
                            onClick={() => setIsAddIdModalOpen(true)}
                          >
                            Add ID
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Warmup Draft</h2>
                          <p>Only real saved database drafts for this project and sender ID are shown.</p>
                        </div>
                      </div>
                      <select
                        className="warmup-select"
                        value={selectedDraftId}
                        disabled={!selectedSenderId || loadingDrafts}
                        onChange={(event) => setSelectedDraftId(event.target.value)}
                      >
                        <option value="">{loadingDrafts ? 'Loading drafts...' : 'Select warmup draft'}</option>
                        {drafts.map((draft) => (
                          <option key={String(draft._id)} value={String(draft._id)}>
                            {draft.title || draft.label || 'Warmup Draft'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="workspace-list" style={{ marginTop: 16 }}>
                    <div>
                      <strong>Selected Project</strong>
                      <span>{selectedProject ? selectedProject.name : 'Not selected'}</span>
                    </div>
                    <div>
                      <strong>Selected Sender</strong>
                      <span>{selectedSender ? `${selectedSender.name} (${selectedSender.email})` : 'Not selected'}</span>
                    </div>
                    <div>
                      <strong>Selected Draft</strong>
                      <span>{selectedDraft?.title || selectedDraft?.label || 'Not selected'}</span>
                    </div>
                    <div>
                      <strong>Saved Clients</strong>
                      <span>{leadList?.total || 0} selected clients from {leadList?.sourceFile || leadList?.name || 'database sheet'}</span>
                    </div>
                  </div>

                  <div className="warmup-draft-editor">
                    <div className="workspace-panel-head">
                      <div>
                        <h2>Editable Selected Draft</h2>
                        <p>Review or change the draft before starting warmup. These edits are used for this campaign.</p>
                      </div>
                    </div>
                    <label className="warmup-editor-label" htmlFor="warmup-draft-subject">Subject</label>
                    <input
                      id="warmup-draft-subject"
                      className="warmup-editor-input"
                      value={draftSubject}
                      disabled={!selectedDraftId}
                      onChange={(event) => setDraftSubject(event.target.value)}
                      placeholder="Select a draft to load subject"
                    />
                    <label className="warmup-editor-label" htmlFor="warmup-draft-body">Body</label>
                    <textarea
                      id="warmup-draft-body"
                      className="warmup-editor-textarea"
                      value={draftBody}
                      disabled={!selectedDraftId}
                      onChange={(event) => setDraftBody(event.target.value)}
                      placeholder="Select a draft to load body"
                    />
                  </div>

                  <div className="warmup-guide-actions">
                    <Button loading={starting} disabled={starting || loadingProjects || loadingIds || loadingDrafts || loadingLeads || uploadingSheet} onClick={handleStartWarmup}>
                      Start Warmup
                    </Button>
                  </div>
                </section>

                <section className="workspace-panel workspace-panel-large warmup-sheet-panel">
                  <div className="workspace-panel-head">
                    <div>
                      <h2>Database Warmup Sheet</h2>
                      <p>Your uploaded sheet is reused here. Only 46 clients are used for warmup.</p>
                    </div>
                    <div className="warmup-panel-actions">
                      <Button variant="ghost" size="sm">{leadList?.total || 0} clients</Button>
                      <label className="warmup-upload-action">
                        {uploadingSheet ? 'Saving...' : 'Upload Sheet'}
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          disabled={uploadingSheet}
                          onChange={handleWarmupSheetUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="workspace-table warmup-preview-table">
                    {loadingLeads || uploadingSheet ? (
                      <div className="warmup-empty-preview">{uploadingSheet ? 'Saving uploaded sheet...' : 'Loading warmup sheet...'}</div>
                    ) : leadRows.length ? (
                      <>
                        <div className="workspace-table-head" style={{ gridTemplateColumns: `64px repeat(${leadColumns.length || 1}, minmax(140px, 1fr))` }}>
                          <span>No.</span>
                          {leadColumns.map((column) => (
                            <span key={column}>{column}</span>
                          ))}
                        </div>
                        {leadRows.slice(0, 12).map((row, index) => (
                          <div key={`${row.Email || row.email || row.data?.Email || index}`} className="workspace-table-row" style={{ gridTemplateColumns: `64px repeat(${leadColumns.length || 1}, minmax(140px, 1fr))` }}>
                            <span>{index + 1}</span>
                            {leadColumns.map((column) => (
                              <span key={`${index}-${column}`}>{getLeadCellValue(row, column)}</span>
                            ))}
                          </div>
                        ))}
                        {leadRows.length > 12 ? (
                          <div className="warmup-minimized-note">Showing first 12 saved clients. Full list is used when the campaign starts.</div>
                        ) : null}
                      </>
                    ) : (
                      <div className="warmup-empty-preview">Upload your warmup sheet to show clients here.</div>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <section className="workspace-panel workspace-panel-large" style={{ gridColumn: '1 / -1' }}>
              <div className="workspace-panel-head">
                <div>
                  <h2>Warmup Campaign Status</h2>
                  <p>Live status refreshes automatically without reloading the page.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => loadWarmupStatus()}>
                  Refresh
                </Button>
              </div>
              <div className="workspace-table">
                <div className="workspace-table-head" style={{ gridTemplateColumns: '2fr 1fr 1fr .7fr .7fr .7fr .7fr 1fr' }}>
                  <span>Campaign</span>
                  <span>Sender</span>
                  <span>Status</span>
                  <span>Total</span>
                  <span>Sent</span>
                  <span>Pending</span>
                  <span>Failed</span>
                  <span>Updated</span>
                </div>
                {campaigns.length ? campaigns.slice(0, 10).map((campaign) => (
                  <div key={campaign.id} className="workspace-table-row" style={{ gridTemplateColumns: '2fr 1fr 1fr .7fr .7fr .7fr .7fr 1fr' }}>
                    <span>{campaign.name}</span>
                    <span>{campaign.senderFrom || '-'}</span>
                    <span>{campaign.status}</span>
                    <span>{campaign.total}</span>
                    <span>{campaign.sent}</span>
                    <span>{campaign.pending}</span>
                    <span>{campaign.failed}</span>
                    <span>{formatDateTime(campaign.updatedAt)}</span>
                  </div>
                )) : (
                  <div className="warmup-empty-preview">No warmup campaigns yet.</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </PageSection>

      {isAddIdModalOpen ? (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ background: 'var(--card-bg, #fff)', padding: 24, borderRadius: 8, width: '100%', maxWidth: 450, display: 'grid', gap: 16 }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Add New Sender ID</h3>
            
            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Selected Project (Read-only)</label>
              <input className="input" type="text" readOnly value={selectedProject?.name || ''} style={{ background: 'var(--bg-subtle, #f9fafb)', cursor: 'not-allowed' }} />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Sender Name</label>
              <input className="input" type="text" value={newIdName} onChange={(e) => setNewIdName(e.target.value)} placeholder="e.g. John Doe" />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Email ID</label>
              <input className="input" type="email" value={newIdEmail} onChange={(e) => setNewIdEmail(e.target.value)} placeholder="e.g. john@example.com" />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Password / App Password</label>
              <input className="input" type="password" value={newIdPassword} onChange={(e) => setNewIdPassword(e.target.value)} placeholder="••••••••" />
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <label style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Provider</label>
              <select className="select" value={newIdProvider} onChange={(e) => setNewIdProvider(e.target.value)}>
                <option value="Gmail">Gmail</option>
                <option value="Outlook">Outlook</option>
                <option value="SMTP">SMTP</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'end', marginTop: 12 }}>
              <button className="button secondary" onClick={closeAddIdModal}>Cancel</button>
              <button className="button" onClick={handleSaveNewId}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppLayout>
  );
}
