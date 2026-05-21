'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPlaceholderShell } from '@/shared-components/common-components/workspace-components/WorkspaceComponentExports';
import Button from '@/shared-components/ui-components/UiActionButton';
import RichTextEditor from '@/modules/draft-module/draft-components/RichTextDraftEditor';
import { DRAFT_TYPE_ITEMS, inferDraftTypeFromDraft, normalizeDraftType } from '@/app/lib/draftTypes';

const STATUS_VARIANTS = {
  approved: 'success',
  archived: 'neutral',
  review: 'warning',
  'in review': 'warning',
  draft: 'info'
};

const CATEGORY_OPTIONS = DRAFT_TYPE_ITEMS;
const PROJECT_OPTIONS = [
  { value: 'tec', label: 'TEC' },
  { value: 'tut', label: 'TUT' }
];
const DRAFT_LIBRARY_SECTIONS = [
  { value: 'cover_story', label: 'Cover Story' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'followup', label: 'Follow-up' },
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

function draftTypeLabel(value = '') {
  const normalized = normalizeDraftType(value);
  return DRAFT_LIBRARY_SECTIONS.find((item) => item.value === normalized)?.label || 'Cover Story';
}

function resolveDraftLibraryType(draft = {}) {
  const rawType = normalizeDraftType(draft.draftType || draft.category || draft.type || '');
  const text = `${draft.draftType || ''} ${draft.category || ''} ${draft.type || ''} ${draft.title || ''} ${draft.subject || ''} ${draft.body || ''}`.toLowerCase();
  if (rawType === 'cover_story' || text.includes('cover story') || text.includes('coverstory')) return 'cover_story';
  if (rawType === 'reminder' || text.includes('reminder')) return 'reminder';
  if (rawType === 'followup' || rawType === 'open_followup' || text.includes('follow-up') || text.includes('follow up') || text.includes('followup') || text.includes('open follow')) return 'followup';
  if (rawType === 'updated_cost' || text.includes('up cost') || text.includes('upcost') || text.includes('updated cost') || text.includes('upsell')) return 'updated_cost';
  if (rawType === 'final_cost' || rawType === 'final_followup' || text.includes('final cost') || text.includes('final call') || text.includes('final follow')) return 'final_cost';
  if (text.includes('cover story') || text.includes('coverstory')) return 'cover_story';
  const inferred = inferDraftTypeFromDraft(draft);
  if (inferred === 'open_followup') return 'followup';
  if (inferred === 'final_followup') return 'final_cost';
  if (inferred === 'initial_outreach') return 'cover_story';
  if (DRAFT_LIBRARY_SECTIONS.some((section) => section.value === inferred)) return inferred;
  return 'cover_story';
}

function resolveDraftProject(draft = {}) {
  const text = `${draft.project || ''} ${draft.domain || ''} ${draft.senderFrom || ''} ${draft.title || ''} ${draft.subject || ''}`.toLowerCase();
  if (text.includes('tut') || text.includes('unicorn') || text.includes('theunicorntimes')) return 'tut';
  if (text.includes('tec') || text.includes('entrepreneurial') || text.includes('theentrepreneurialchronicle')) return 'tec';
  return '';
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
  const router = useRouter();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadedText, setUploadedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftCategory, setDraftCategory] = useState(CATEGORY_OPTIONS[0].value);
  const [draftSector, setDraftSector] = useState('');
  const [draftProject, setDraftProject] = useState('tec');
  const [draftTitle, setDraftTitle] = useState('');
  const [editorHtml, setEditorHtml] = useState('');
  const [activeWorkspaceMode, setActiveWorkspaceMode] = useState('create');
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [librarySectorFilter, setLibrarySectorFilter] = useState('');
  const [libraryProjectFilter, setLibraryProjectFilter] = useState('');
  const [libraryTypeFilter, setLibraryTypeFilter] = useState('');
  const [libraryCampaignFilter, setLibraryCampaignFilter] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const draftListRef = useRef(null);
  const activeSection = showWorkspace ? 'draft-workspace' : 'draft-list';

  useEffect(() => {
    let active = true;

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
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (showWorkspace) return undefined;

    const timer = setTimeout(() => {
      draftListRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [activeSection, showWorkspace]);

  const approvedCount = useMemo(
    () => drafts.filter((draft) => getDraftStatus(draft).toLowerCase() === 'approved').length,
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

  const campaignOptions = useMemo(
    () =>
      Array.from(
        new Set(
          drafts
            .map((draft) => String(draft?.campaignName || draft?.campaign || draft?.campaignId || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [drafts]
  );

  const filteredDrafts = useMemo(
    () =>
      drafts.filter((draft) => {
        const sector = String(draft?.sector || '').trim().toLowerCase();
        const project = resolveDraftProject(draft);
        const draftType = resolveDraftLibraryType(draft);
        const campaign = String(draft?.campaignName || draft?.campaign || draft?.campaignId || '').trim().toLowerCase();
        const searchBlob = `${draft?.title || ''} ${draft?.subject || ''} ${draft?.body || ''}`.toLowerCase();
        const typeFilter = normalizeDraftType(libraryTypeFilter);
        const sectorFilter = String(librarySectorFilter || '').trim().toLowerCase();
        const projectFilter = String(libraryProjectFilter || '').trim().toLowerCase();
        const campaignFilter = String(libraryCampaignFilter || '').trim().toLowerCase();
        const searchQuery = String(librarySearchQuery || '').trim().toLowerCase();
        if (libraryTypeFilter && draftType !== typeFilter) return false;
        if (sectorFilter && !sector.includes(sectorFilter)) return false;
        if (projectFilter && project !== projectFilter) return false;
        if (campaignFilter && campaign !== campaignFilter) return false;
        if (searchQuery && !searchBlob.includes(searchQuery)) return false;
        return true;
      }),
    [drafts, libraryCampaignFilter, libraryProjectFilter, librarySearchQuery, librarySectorFilter, libraryTypeFilter]
  );

  const activeFilters = Boolean(libraryTypeFilter || librarySectorFilter || libraryProjectFilter || libraryCampaignFilter || librarySearchQuery);

  const groupedDrafts = useMemo(() => {
    return DRAFT_LIBRARY_SECTIONS.map((section) => ({
      ...section,
      drafts: filteredDrafts.filter((draft) => resolveDraftLibraryType(draft) === section.value)
    })).filter((section) => section.drafts.length > 0);
  }, [filteredDrafts]);

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
    setDraftProject('tec');
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

  const handleEditDraft = (draft) => {
    const draftId = String(draft?._id || draft?.id || '');
    if (draftId) {
      router.push(`/drafts/${encodeURIComponent(draftId)}`);
      return;
    }
    setEditingDraftId(String(draft?._id || ''));
    setDraftTitle(String(draft?.title || ''));
    setDraftSubject(String(draft?.subject || ''));
    setDraftSector(String(draft?.sector || ''));
    setDraftProject(resolveDraftProject(draft) || 'tec');
    setDraftCategory(resolveDraftLibraryType(draft) || CATEGORY_OPTIONS[0].value);
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
        category: normalizeDraftType(draftCategory),
        draftType: normalizeDraftType(draftCategory),
        title: draftTitle.trim(),
        sector: draftSector.trim(),
        project: ['tec', 'tut'].includes(String(draftProject || '').trim().toLowerCase()) ? String(draftProject || '').trim().toLowerCase() : '',
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

  const isUploadWorkspace = showWorkspace && activeWorkspaceMode === 'upload';
  const isSingleEditorWorkspace = showWorkspace && activeWorkspaceMode !== 'upload';

  return (
    <DashboardPlaceholderShell>
      <section className="workspace-page" style={{ '--workspace-accent': '#f97316' }}>
        <div className="workspace-hero">
          <div>
            <span className="workspace-kicker">Drafts</span>
            <h1>Drafts</h1>
          </div>
          <div className="workspace-hero-actions">
            <Button variant="secondary" className="workspace-secondary" onClick={handleCustomizeDraft}>Customize Draft</Button>
            <Button className="workspace-primary" onClick={handleCreateDraft}>Create Draft</Button>
          </div>
        </div>

        {showWorkspace ? (
          <section className={`workspace-panel draft-workspace-panel ${isSingleEditorWorkspace ? 'draft-workspace-panel-full' : ''}`}>
            <div className="workspace-panel-head">
              <div>
                <h2>{editingDraftId ? 'Edit Draft' : 'Create Draft'}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowWorkspace(false)}>Back to Drafts</Button>
              <div className="draft-workspace-mode">
                <span className="draft-workspace-pill is-active">{activeWorkspaceMode === 'customize' ? 'Customize Draft' : 'Create Draft'}</span>
              </div>
            </div>

            <div className="draft-workspace-single">
              <section className="draft-workspace-pane">
                <div className="draft-workspace-pane-head">
                  <div>
                    <h3>Draft Editor</h3>
                  </div>
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
                    <span>Project</span>
                    <select value={draftProject} onChange={(event) => setDraftProject(event.target.value)}>
                      {PROJECT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
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

        {!showWorkspace ? (
        <div className="workspace-grid draft-library-grid" ref={draftListRef}>
          <section className="workspace-panel workspace-panel-large">
            <div className="workspace-panel-head">
              <div>
                <h2>Draft Library</h2>
              </div>
            </div>

            <div className="draft-library-filters">
              <label className="draft-library-filter-field">
                <span>Draft Type</span>
                <select value={libraryTypeFilter} onChange={(event) => setLibraryTypeFilter(event.target.value)}>
                  <option value="">All draft types</option>
                  {DRAFT_LIBRARY_SECTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

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
                <span>Project</span>
                <select value={libraryProjectFilter} onChange={(event) => setLibraryProjectFilter(event.target.value)}>
                  <option value="">All projects</option>
                  {PROJECT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="draft-library-filter-field">
                <span>Campaign</span>
                <select value={libraryCampaignFilter} onChange={(event) => setLibraryCampaignFilter(event.target.value)}>
                  <option value="">All campaigns</option>
                  {campaignOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="draft-library-filter-field">
                <span>Search</span>
                <input
                  type="search"
                  value={librarySearchQuery}
                  onChange={(event) => setLibrarySearchQuery(event.target.value)}
                  placeholder="Name or subject"
                />
              </label>
              <div className="draft-library-filter-actions">
                <span>{filteredDrafts.length} drafts</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLibraryTypeFilter('');
                    setLibrarySectorFilter('');
                    setLibraryProjectFilter('');
                    setLibraryCampaignFilter('');
                    setLibrarySearchQuery('');
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>

            <div className="draft-type-section-stack">
              {loading ? <div className="draft-type-empty">Loading drafts...</div> : null}
              {!loading && error ? <div className="draft-type-empty error">{error}</div> : null}
              {!loading && !error && !filteredDrafts.length ? (
                <div className="draft-type-empty">
                  {activeFilters ? 'No drafts match the selected filters.' : 'No drafts found in the database.'}
                </div>
              ) : null}
              {!loading && !error && groupedDrafts.length ? groupedDrafts.map((section) => (
                <section key={section.value} className="draft-type-section">
                  <div className="draft-type-section-head">
                    <h3>{section.label} ({section.drafts.length})</h3>
                  </div>
                  <div className="draft-card-grid">
                    {section.drafts.map((draft) => (
                      <article key={draft?._id || draft?.id} className="draft-type-card">
                        <div className="draft-type-card-head">
                          <strong>{draft?.title || 'Untitled Draft'}</strong>
                          <span>{draftTypeLabel(resolveDraftLibraryType(draft))} Draft</span>
                        </div>
                        <p>{draft?.subject || '-'}</p>
                        <div className="draft-type-card-meta">
                          <small>{draft?.sector || 'No sector'}</small>
                          <small>{resolveDraftProject(draft) ? resolveDraftProject(draft).toUpperCase() : 'No project'}</small>
                          <small>{formatRelativeDate(draft?.updatedAt || draft?.createdAt)}</small>
                          <small>{getDraftStatus(draft).toLowerCase() === 'approved' ? 'Approved by TL' : 'Not approved by TL'}</small>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleEditDraft(draft)}>Edit</Button>
                      </article>
                    ))}
                  </div>
                </section>
              )) : null}
            </div>
          </section>
        </div>
        ) : null}
      </section>
    </DashboardPlaceholderShell>
  );
}
