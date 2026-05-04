'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardPlaceholderShell } from '@/shared-components/common-components/workspace-components/WorkspaceComponentExports';
import Button from '@/shared-components/ui-components/UiActionButton';
import RichTextEditor from '@/modules/draft-module/draft-components/RichTextDraftEditor';

const STATUS_VARIANTS = {
  approved: 'success',
  archived: 'neutral',
  review: 'warning',
  'in review': 'warning',
  draft: 'info'
};

const CATEGORY_OPTIONS = [
  { value: 'cover_story', label: 'Cover Story' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'updated_cost', label: 'Updated Cost' },
  { value: 'final_cost', label: 'Final Cost' }
];

function formatRelativeDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) {
    const mins = Math.floor(diffMs / minute);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diffMs < 2 * day) return 'Yesterday';
  if (diffMs < 7 * day) {
    const days = Math.floor(diffMs / day);
    return `${days} days ago`;
  }

  return date.toLocaleDateString();
}

function getDraftStatus(draft) {
  const raw = String(draft?.status || draft?.approvalStatus || draft?.stage || '').trim();
  if (raw) return raw;
  return 'Approved';
}

function getDraftOwner(draft) {
  return (
    draft?.owner ||
    draft?.updatedBy ||
    draft?.createdBy ||
    draft?.userEmail ||
    'Team'
  );
}

function renderCell(cell, column) {
  const text = String(cell || '');
  if (column === 'Status') {
    const key = text.toLowerCase().trim();
    const badgeVariant = STATUS_VARIANTS[key] || 'info';
    return <span className={`workspace-status-badge workspace-status-${badgeVariant}`}>{text}</span>;
  }
  return <span>{text}</span>;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function textToEditorHtml(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  return text
    .split(/\r?\n\r?\n/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, '<br/>')}</p>`)
    .join('');
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadedText, setUploadedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftCategory, setDraftCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [draftSector, setDraftSector] = useState('');
  const [draftDomain, setDraftDomain] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [activeWorkspaceMode, setActiveWorkspaceMode] = useState('create');
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [librarySectorFilter, setLibrarySectorFilter] = useState('');
  const [libraryDomainFilter, setLibraryDomainFilter] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadDrafts = async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }
        const response = await fetch('/api/drafts?scope=all', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch drafts');
        }

        if (active) {
          setError('');
          setDrafts(Array.isArray(data?.drafts) ? data.drafts : []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to fetch drafts');
          if (!silent) {
            setDrafts([]);
          }
        }
      } finally {
        if (active && !silent) {
          setLoading(false);
        }
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadDrafts({ silent: true });
      }
    };

    void loadDrafts();
    intervalId = window.setInterval(() => {
      void loadDrafts({ silent: true });
    }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const approvedCount = useMemo(
    () => drafts.filter((draft) => getDraftStatus(draft).toLowerCase() === 'approved').length,
    [drafts]
  );
  const reviewCount = useMemo(
    () =>
      drafts.filter((draft) => {
        const status = getDraftStatus(draft).toLowerCase();
        return status === 'review' || status === 'in review';
      }).length,
    [drafts]
  );
  const archivedCount = useMemo(
    () => drafts.filter((draft) => getDraftStatus(draft).toLowerCase() === 'archived').length,
    [drafts]
  );

  const recentItems = useMemo(
    () =>
      drafts.slice(0, 3).map((draft) => ({
        title: draft?.title || 'Draft updated',
        meta: `${getDraftStatus(draft)} | ${formatRelativeDate(draft?.updatedAt || draft?.createdAt)}`
      })),
    [drafts]
  );

  const uploadedTextPreview = useMemo(
    () =>
      uploadedText
        ? uploadedText
            .split(/\r?\n/)
            .slice(0, 80)
            .join('\n')
        : '',
    [uploadedText]
  );

  const sectorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          drafts
            .map((draft) => String(draft?.sector || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [drafts]
  );

  const domainOptions = useMemo(
    () =>
      Array.from(
        new Set(
          drafts
            .map((draft) => String(draft?.domain || '').trim().toLowerCase())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [drafts]
  );

  const filteredDrafts = useMemo(
    () =>
      drafts.filter((draft) => {
        const sector = String(draft?.sector || '').trim().toLowerCase();
        const domain = String(draft?.domain || '').trim().toLowerCase();
        if (librarySectorFilter && sector !== librarySectorFilter.toLowerCase()) return false;
        if (libraryDomainFilter && domain !== libraryDomainFilter.toLowerCase()) return false;
        return true;
      }),
    [drafts, libraryDomainFilter, librarySectorFilter]
  );

  const handleUploadClick = () => {
    setActiveWorkspaceMode('upload');
    setShowWorkspace(true);
    setSaveMessage('');
    fileInputRef.current?.click();
  };

  const handleCreateDraft = () => {
    setActiveWorkspaceMode('create');
    setShowWorkspace(true);
    setEditingDraftId('');
    setDraftTitle('');
    setDraftSubject('');
    setDraftSector('');
    setDraftDomain('');
    setDraftCategory(CATEGORY_OPTIONS[0].value);
    setEditorHtml('');
    setSaveMessage('');
  };

  const handleCustomizeDraft = () => {
    setActiveWorkspaceMode('customize');
    setShowWorkspace(true);
    setSaveMessage('');
    if (uploadedText && !editorHtml) {
      setEditorHtml(textToEditorHtml(uploadedText));
    }
  };

  const handleCreateNew = () => {
    setActiveWorkspaceMode('create');
    setShowWorkspace(true);
    setUploadedText('');
    setUploadedFileName('');
    setEditingDraftId('');
    setDraftTitle('');
    setDraftSubject('');
    setDraftSector('');
    setDraftDomain('');
    setDraftCategory(CATEGORY_OPTIONS[0].value);
    setEditorHtml('');
    setSaveMessage('');
  };

  const handleEditDraft = (draft) => {
    setEditingDraftId(String(draft?._id || ''));
    setDraftTitle(String(draft?.title || ''));
    setDraftSubject(String(draft?.subject || ''));
    setDraftSector(String(draft?.sector || ''));
    setDraftDomain(String(draft?.domain || ''));
    setDraftCategory(String(draft?.category || CATEGORY_OPTIONS[0].value));
    setEditorHtml(String(draft?.body || ''));
    setShowWorkspace(true);
    setActiveWorkspaceMode('customize');
    setSaveMessage('');
  };

  const handleSaveDraft = async () => {
    if (!draftTitle.trim() || !draftSubject.trim() || !editorHtml.trim()) {
      setSaveMessage('Draft title, subject, and draft body are required.');
      return;
    }

    setSavingDraft(true);
    try {
      const payload = {
        category: draftCategory,
        title: draftTitle.trim(),
        sector: draftSector.trim(),
        domain: draftDomain.trim().toLowerCase(),
        subject: draftSubject.trim(),
        body: editorHtml
      };

      const response = await fetch(editingDraftId ? `/api/drafts/${editingDraftId}` : '/api/drafts', {
        method: editingDraftId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save draft');
      }

      setSaveMessage(editingDraftId ? 'Draft updated successfully.' : 'Draft created successfully.');
      setEditingDraftId(String(data?.draft?._id || editingDraftId || ''));
      setDrafts((prev) => {
        const nextDraft = data?.draft;
        if (!nextDraft) return prev;
        const currentId = String(nextDraft._id || '');
        const existingIndex = prev.findIndex((item) => String(item?._id || '') === currentId);
        if (existingIndex >= 0) {
          const copy = [...prev];
          copy[existingIndex] = nextDraft;
          return copy;
        }
        return [nextDraft, ...prev];
      });
    } catch (err) {
      setSaveMessage(err.message || 'Failed to save draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleTextFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setUploadedFileName(file.name);
      setUploadedText(text);
      setActiveWorkspaceMode('upload');
    } catch (readError) {
      console.error('Failed to read uploaded file', readError);
      setUploadedFileName('');
      setUploadedText('');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <DashboardPlaceholderShell>
      <section className="workspace-page" style={{ '--workspace-accent': '#f97316' }}>
        <div className="workspace-hero">
          <div>
            <span className="workspace-kicker">Drafts</span>
            <h1>Manage campaign messaging with a cleaner editorial workflow.</h1>
            <p>Keep approved copy, work-in-progress drafts, and archived variants visible to the whole team.</p>
          </div>
          <div className="workspace-hero-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.text,text/plain"
              className="draft-workspace-file-input"
              onChange={handleTextFileChange}
            />
            <Button variant="secondary" className="workspace-secondary" onClick={handleUploadClick}>Upload File</Button>
            <Button variant="secondary" className="workspace-secondary" onClick={handleCustomizeDraft}>Customize Draft</Button>
            <Button variant="secondary" className="workspace-secondary" onClick={handleCreateNew}>Create New</Button>
            <Button className="workspace-primary" onClick={handleCreateDraft}>Create Draft</Button>
          </div>
        </div>

        <div className="workspace-stats">
          <article className="workspace-stat-card">
            <span>Saved Drafts</span>
            <strong>{loading ? '...' : drafts.length}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>Approved</span>
            <strong>{loading ? '...' : approvedCount}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>In Review</span>
            <strong>{loading ? '...' : reviewCount}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>Archived</span>
            <strong>{loading ? '...' : archivedCount}</strong>
          </article>
        </div>

        {showWorkspace ? (
          <section className="workspace-panel draft-workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>Draft Workspace</h2>
                <p>Review uploaded text on one side and write or paste the final draft on the other side.</p>
              </div>
              <div className="draft-workspace-mode">
                <span className={`draft-workspace-pill${activeWorkspaceMode === 'upload' ? ' is-active' : ''}`}>Upload File</span>
                <span className={`draft-workspace-pill${activeWorkspaceMode === 'customize' ? ' is-active' : ''}`}>Customize Draft</span>
                <span className={`draft-workspace-pill${activeWorkspaceMode === 'create' ? ' is-active' : ''}`}>Create Draft</span>
              </div>
            </div>

            <div className="draft-workspace-split">
              <section className="draft-workspace-pane">
                <div className="draft-workspace-pane-head">
                  <div>
                    <h3>Uploaded Text File</h3>
                    <p>{uploadedFileName ? uploadedFileName : 'Upload a text file to review the source copy here.'}</p>
                  </div>
                  {uploadedText ? (
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(uploadedText)}>
                      Copy Text
                    </Button>
                  ) : null}
                </div>

                <div className="draft-workspace-document">
                  {uploadedTextPreview ? (
                    <pre>{uploadedTextPreview}</pre>
                  ) : (
                    <div className="draft-workspace-empty">
                      <strong>No text file uploaded</strong>
                      <p>Use Upload File to load text content into this preview area.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="draft-workspace-pane">
                <div className="draft-workspace-pane-head">
                  <div>
                    <h3>Draft Editor</h3>
                    <p>Paste, rewrite, and format the draft in a document-style editor.</p>
                  </div>
                  {uploadedText ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditorHtml(textToEditorHtml(uploadedText))}>
                      Load Source
                    </Button>
                  ) : null}
                </div>

                <label className="draft-workspace-title-field">
                  <span>Draft Title</span>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="Enter draft name"
                  />
                </label>

                <div className="draft-workspace-meta-grid">
                  <label className="draft-workspace-title-field">
                    <span>Subject</span>
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={(event) => setDraftSubject(event.target.value)}
                      placeholder="Enter subject"
                    />
                  </label>

                  <label className="draft-workspace-title-field">
                    <span>Category</span>
                    <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="draft-workspace-title-field">
                    <span>Sector</span>
                    <input
                      type="text"
                      value={draftSector}
                      onChange={(event) => setDraftSector(event.target.value)}
                      placeholder="Enter sector"
                    />
                  </label>

                  <label className="draft-workspace-title-field">
                    <span>Domain</span>
                    <input
                      type="text"
                      value={draftDomain}
                      onChange={(event) => setDraftDomain(event.target.value)}
                      placeholder="example.com"
                    />
                  </label>
                </div>

                <RichTextEditor
                  value={editorHtml}
                  onChange={setEditorHtml}
                  placeholder="Paste or write your draft here..."
                />

                <div className="draft-workspace-savebar">
                  <div>
                    <strong>{editingDraftId ? 'Editing saved draft' : 'Ready to create draft'}</strong>
                    {saveMessage ? <p>{saveMessage}</p> : null}
                  </div>
                  <Button onClick={handleSaveDraft} disabled={savingDraft}>
                    {savingDraft ? 'Saving...' : editingDraftId ? 'Update Draft' : 'Save Draft'}
                  </Button>
                </div>
              </section>
            </div>
          </section>
        ) : null}

        <div className="workspace-grid">
          <section className="workspace-panel workspace-panel-large">
            <div className="workspace-panel-head">
              <div>
                <h2>Draft Library</h2>
                <p>Saved drafts from your database, including subject, status, owner, and last update.</p>
              </div>
              <Button variant="ghost" size="sm">View All</Button>
            </div>

            <div className="draft-library-filters">
              <label className="draft-library-filter-field">
                <span>Sector</span>
                <select value={librarySectorFilter} onChange={(event) => setLibrarySectorFilter(event.target.value)}>
                  <option value="">All sectors</option>
                  {sectorOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="draft-library-filter-field">
                <span>Domain</span>
                <select value={libraryDomainFilter} onChange={(event) => setLibraryDomainFilter(event.target.value)}>
                  <option value="">All domains</option>
                  {domainOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="workspace-table workspace-table-scroll">
              <div className="workspace-table-head" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 1.4fr 0.9fr 0.8fr' }}>
                {['Draft', 'Sector', 'Domain', 'Subject', 'Updated', 'Action'].map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>

              {loading ? (
                <div className="workspace-table-row" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 1.4fr 0.9fr 0.8fr' }}>
                  <span>Loading drafts...</span>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}

              {!loading && error ? (
                <div className="workspace-table-row" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 1.4fr 0.9fr 0.8fr' }}>
                  <span>{error}</span>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}

              {!loading && !error && !filteredDrafts.length ? (
                <div className="workspace-table-row" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 1.4fr 0.9fr 0.8fr' }}>
                  <span>No drafts found in the database.</span>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}

              {!loading && !error
                ? filteredDrafts.map((draft, index) => (
                    <div key={draft?._id || index} className="workspace-table-row" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr 1.4fr 0.9fr 0.8fr' }}>
                      {[
                        draft?.title || 'Untitled Draft',
                        draft?.sector || '-',
                        draft?.domain || '-',
                        draft?.subject || '-',
                        formatRelativeDate(draft?.updatedAt || draft?.createdAt)
                      ].map((cell, cellIndex) => (
                        <span key={cellIndex}>{renderCell(cell, ['Draft', 'Sector', 'Domain', 'Subject', 'Updated'][cellIndex])}</span>
                      ))}
                      <span>
                        <Button variant="ghost" size="sm" onClick={() => handleEditDraft(draft)}>Edit</Button>
                      </span>
                    </div>
                  ))
                : null}
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>Editorial Status</h2>
                <p>Live counts pulled from your saved drafts.</p>
              </div>
            </div>
            <div className="workspace-list">
              <div>
                <strong>Ready to Send</strong>
                <span>{approvedCount} approved drafts are campaign-ready</span>
              </div>
              <div>
                <strong>Waiting for Review</strong>
                <span>{reviewCount} drafts need approval before launch</span>
              </div>
              <div>
                <strong>Archived</strong>
                <span>{archivedCount} drafts are stored as archived variants</span>
              </div>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>Editor Activity</h2>
                <p>Recently updated drafts from the database.</p>
              </div>
            </div>
            <div className="workspace-activity">
              {recentItems.length ? recentItems.map((item) => (
                <article key={`${item.title}-${item.meta}`}>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </article>
              )) : (
                <article>
                  <strong>No recent activity</strong>
                  <p>Saved draft updates will appear here once drafts are available.</p>
                </article>
              )}
            </div>
          </section>
        </div>
      </section>
    </DashboardPlaceholderShell>
  );
}
