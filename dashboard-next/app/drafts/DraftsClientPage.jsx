'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DashboardPlaceholderShell } from '@/shared-components/common-components/workspace-components/WorkspaceComponentExports';
import Button from '@/shared-components/ui-components/UiActionButton';
import RichTextEditor from '@/modules/draft-module/draft-components/RichTextDraftEditor';
import { DRAFT_TYPE_ITEMS, inferDraftTypeFromDraft, normalizeDraftType } from '@/app/lib/draftTypes';

const CATEGORY_OPTIONS = DRAFT_TYPE_ITEMS;
const PROJECT_OPTIONS = [
  { value: 'tec', label: 'TEC' },
  { value: 'tut', label: 'TUT' }
];
const DRAFT_LIBRARY_SECTIONS = [
  { value: 'cover_story', label: 'Cover Story' },
  { value: 'reminder',    label: 'Reminder' },
  { value: 'followup',   label: 'Follow-up' },
  { value: 'updated_cost', label: 'Updated Cost' },
  { value: 'final_cost', label: 'Final Call' }
];
const DRAFT_LIBRARY_REFERENCE_SECTIONS = DRAFT_LIBRARY_SECTIONS.filter(section => section.value !== 'final_cost');
const DRAFT_LIBRARY_REFERENCE_TYPES = new Set(DRAFT_LIBRARY_REFERENCE_SECTIONS.map(section => section.value));

const SECTION_META = {
  cover_story:  { dotColor: '#3b82f6', badgeColor: '#eff6ff', badgeText: '#3b82f6', badgeBorder: '#bfdbfe' },
  reminder:     { dotColor: '#f59e0b', badgeColor: '#fffbeb', badgeText: '#d97706', badgeBorder: '#fde68a' },
  followup:     { dotColor: '#10b981', badgeColor: '#ecfdf5', badgeText: '#059669', badgeBorder: '#a7f3d0' },
  updated_cost: { dotColor: '#8b5cf6', badgeColor: '#f5f3ff', badgeText: '#7c3aed', badgeBorder: '#ddd6fe' },
  final_cost:   { dotColor: '#ef4444', badgeColor: '#fff1f2', badgeText: '#e11d48', badgeBorder: '#fecdd3' }
};

const STAT_META = {
  total:        { icon: 'ti-stack-2',         color: '#6366f1', bg: '#eef2ff' },
  cover_story:  { icon: 'ti-news',            color: '#3b82f6', bg: '#eff6ff' },
  reminder:     { icon: 'ti-bell-ringing',    color: '#f59e0b', bg: '#fffbeb' },
  followup:     { icon: 'ti-corner-up-right', color: '#10b981', bg: '#ecfdf5' },
  updated_cost: { icon: 'ti-receipt-2',       color: '#8b5cf6', bg: '#f5f3ff' },
  final_cost:   { icon: 'ti-flag-check',      color: '#ef4444', bg: '#fff1f2' }
};

/* ── helpers ── */
function formatRelativeDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const diffMs = Date.now() - date.getTime();
  const minute = 60000, hour = 3600000, day = 86400000;
  if (diffMs < minute) return 'Just now';
  if (diffMs < hour)   return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day)    return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 2*day)  return 'Yesterday';
  if (diffMs < 7*day)  return `${Math.floor(diffMs / day)} days ago`;
  return date.toLocaleDateString();
}

function getDraftStatus(draft) {
  return String(draft?.status || draft?.approvalStatus || draft?.stage || 'Approved').trim();
}

function draftTypeLabel(value = '') {
  const n = normalizeDraftType(value);
  return DRAFT_LIBRARY_SECTIONS.find(s => s.value === n)?.label || 'Cover Story';
}

function resolveDraftLibraryType(draft = {}) {
  const rawType = normalizeDraftType(draft?.draftType || draft?.category || draft?.type || '');
  if (rawType === 'open_followup')   return 'followup';
  if (rawType === 'final_followup')  return 'final_cost';
  if (rawType === 'initial_outreach') return 'cover_story';
  if (DRAFT_LIBRARY_SECTIONS.some(s => s.value === rawType)) return rawType;
  const text = `${draft?.draftType||''} ${draft?.category||''} ${draft?.type||''} ${draft?.title||''} ${draft?.subject||''} ${draft?.body||''}`.toLowerCase();
  if (text.includes('reminder'))                                        return 'reminder';
  if (text.match(/follow[\s-]?up|followup|open follow/))               return 'followup';
  if (text.match(/up cost|upcost|updated cost|upsell/))                return 'updated_cost';
  if (text.match(/final cost|final call|final follow/))                return 'final_cost';
  if (text.match(/cover story|coverstory/))                            return 'cover_story';
  const inferred = inferDraftTypeFromDraft(draft || {});
  if (inferred === 'open_followup')   return 'followup';
  if (inferred === 'final_followup')  return 'final_cost';
  if (inferred === 'initial_outreach') return 'cover_story';
  if (DRAFT_LIBRARY_SECTIONS.some(s => s.value === inferred)) return inferred;
  return 'cover_story';
}

function resolveDraftProject(draft = {}) {
  const text = `${draft?.project||''} ${draft?.domain||''} ${draft?.senderFrom||''} ${draft?.title||''} ${draft?.subject||''}`.toLowerCase();
  if (text.match(/tut|unicorn|theunicorntimes/))               return 'tut';
  if (text.match(/tec|entrepreneurial|theentrepreneurialchronicle/)) return 'tec';
  return '';
}

function resolveDraftCampaign(draft = {}) {
  return String(draft?.campaignName || draft?.campaign || draft?.campaignId || '').trim();
}

function resolveDraftCity(draft = {}) {
  return String(draft?.city || draft?.City || draft?.location || '').trim();
}

function escapeHtml(v) {
  return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function textToEditorHtml(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.split(/\r?\n\r?\n/).map(p => `<p>${escapeHtml(p).replace(/\r?\n/g,'<br/>')}</p>`).join('');
}

/* ── Three-dot dropdown hook ── */
function useMenuState() {
  const [openMenu, setOpenMenu] = useState(null);
  useEffect(() => {
    const close = () => setOpenMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  return { openMenu, setOpenMenu };
}

export default function DraftsPage() {
  /* ── state ── */
  const [drafts, setDrafts]                     = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState('');
  const [uploadedText, setUploadedText]         = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [draftSubject, setDraftSubject]         = useState('');
  const [draftCategory, setDraftCategory]       = useState(CATEGORY_OPTIONS[0].value);
  const [draftSector, setDraftSector]           = useState('');
  const [draftCity, setDraftCity]               = useState('');
  const [draftCampaignName, setDraftCampaignName] = useState('');
  const [draftProject, setDraftProject]         = useState('tec');
  const [draftTitle, setDraftTitle]             = useState('');
  const [editorHtml, setEditorHtml]             = useState('');
  const [activeWorkspaceMode, setActiveWorkspaceMode] = useState('create');
  const [showWorkspace, setShowWorkspace]       = useState(false);
  const [editingDraftId, setEditingDraftId]     = useState('');
  const [savingDraft, setSavingDraft]           = useState(false);
  const [saveMessage, setSaveMessage]           = useState('');
  const [librarySectorFilter, setLibrarySectorFilter]   = useState('');
  const [libraryProjectFilter, setLibraryProjectFilter] = useState('');
  const [libraryTypeFilter, setLibraryTypeFilter]       = useState('');
  const [libraryCampaignFilter, setLibraryCampaignFilter] = useState('');
  const [librarySearchQuery, setLibrarySearchQuery]     = useState('');
  const [previewDraft, setPreviewDraft]         = useState(null);
  const [previewTab, setPreviewTab]             = useState('formatted');
  const [draftActionMessage, setDraftActionMessage] = useState('');
  const [draftActionError, setDraftActionError]     = useState('');
  const [busyDraftAction, setBusyDraftAction]       = useState('');
  const { openMenu, setOpenMenu }               = useMenuState();
  const fileInputRef  = useRef(null);
  const draftListRef  = useRef(null);

  /* ── data ── */
  const loadDrafts = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res  = await fetch('/api/drafts?scope=all', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch drafts');
      setError('');
      setDrafts(Array.isArray(data?.drafts) ? data.drafts : []);
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to fetch drafts');
        setDrafts([]);
      } else {
        console.warn('Silent background refresh failed:', err);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => { if (active && document.visibilityState === 'visible') void loadDrafts({ silent: true }); };
    void loadDrafts();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [loadDrafts]);

  useEffect(() => {
    if (showWorkspace) return undefined;
    const t = setTimeout(() => draftListRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 250);
    return () => clearTimeout(t);
  }, [showWorkspace]);

  /* ── derived ── */
  const sectorOptions = useMemo(() =>
    [...new Set(drafts.map(d => String(d?.sector||'').trim()).filter(Boolean))].sort(),
    [drafts]
  );
  const campaignOptions = useMemo(() =>
    [...new Set(drafts.map(d => resolveDraftCampaign(d)).filter(Boolean))].sort(),
    [drafts]
  );

  const libraryBaseFilteredDrafts = useMemo(() => drafts.filter(draft => {
    const sector   = String(draft?.sector||'').trim().toLowerCase();
    const project  = resolveDraftProject(draft);
    const draftType = resolveDraftLibraryType(draft);
    const campaign = resolveDraftCampaign(draft).toLowerCase();
    const blob     = `${draft?.title||''} ${draft?.subject||''} ${draft?.body||''} ${draftTypeLabel(draftType)} ${sector} ${project} ${campaign}`.toLowerCase();
    if (!DRAFT_LIBRARY_REFERENCE_TYPES.has(draftType))                                          return false;
    if (librarySectorFilter   && !sector.includes(librarySectorFilter.toLowerCase()))           return false;
    if (libraryProjectFilter  && project !== libraryProjectFilter.toLowerCase())                return false;
    if (libraryCampaignFilter && campaign !== libraryCampaignFilter.toLowerCase())              return false;
    if (librarySearchQuery    && !blob.includes(librarySearchQuery.trim().toLowerCase()))       return false;
    return true;
  }), [drafts, libraryCampaignFilter, libraryProjectFilter, librarySearchQuery, librarySectorFilter]);

  const activeFilters = Boolean(libraryTypeFilter || librarySectorFilter || libraryProjectFilter || libraryCampaignFilter || librarySearchQuery);
  const referenceFilteredDrafts = useMemo(() => {
    const tf = libraryTypeFilter ? normalizeDraftType(libraryTypeFilter) : '';
    return libraryBaseFilteredDrafts.filter(draft => !tf || resolveDraftLibraryType(draft) === tf);
  }, [libraryBaseFilteredDrafts, libraryTypeFilter]);

  const draftTypeCounts = useMemo(() =>
    DRAFT_LIBRARY_SECTIONS.reduce((acc, s) => { acc[s.value] = drafts.filter(d => resolveDraftLibraryType(d) === s.value).length; return acc; }, {}),
    [drafts]
  );
  const filteredDraftTypeCounts = useMemo(() =>
    DRAFT_LIBRARY_REFERENCE_SECTIONS.reduce((acc, s) => {
      acc[s.value] = libraryBaseFilteredDrafts.filter(d => resolveDraftLibraryType(d) === s.value).length;
      return acc;
    }, {}),
    [libraryBaseFilteredDrafts]
  );

  const statCards = useMemo(() => {
    const total = drafts.filter(draft => DRAFT_LIBRARY_REFERENCE_TYPES.has(resolveDraftLibraryType(draft))).length;
    const pct   = n => total ? `${Math.round((n/total)*100)}% of total drafts` : '0% of total drafts';
    return [
      { key:'total',        label:'TOTAL DRAFTS',  icon: STAT_META.total.icon,        color: STAT_META.total.color,        bg: STAT_META.total.bg,        number: total,                         subtitle:'Across all types' },
      { key:'cover_story',  label:'COVER STORY',   icon: STAT_META.cover_story.icon,  color: STAT_META.cover_story.color,  bg: STAT_META.cover_story.bg,  number: draftTypeCounts.cover_story||0,  subtitle: pct(draftTypeCounts.cover_story||0) },
      { key:'reminder',     label:'REMINDER',      icon: STAT_META.reminder.icon,     color: STAT_META.reminder.color,     bg: STAT_META.reminder.bg,     number: draftTypeCounts.reminder||0,     subtitle: pct(draftTypeCounts.reminder||0) },
      { key:'followup',     label:'FOLLOW-UP',     icon: STAT_META.followup.icon,     color: STAT_META.followup.color,     bg: STAT_META.followup.bg,     number: draftTypeCounts.followup||0,     subtitle: pct(draftTypeCounts.followup||0) }
    ];
  }, [draftTypeCounts, drafts.length]);

  const groupedDrafts = useMemo(() => {
    const tf = libraryTypeFilter ? normalizeDraftType(libraryTypeFilter) : '';
    return DRAFT_LIBRARY_REFERENCE_SECTIONS
      .filter(s => !tf || s.value === tf)
      .map(s => ({ ...s, drafts: referenceFilteredDrafts.filter(d => resolveDraftLibraryType(d) === s.value) }));
  }, [libraryTypeFilter, referenceFilteredDrafts]);

  /* ── handlers ── */
  const handleCreateDraft = () => {
    setActiveWorkspaceMode('create');
    setShowWorkspace(true);
    setEditingDraftId('');
    setDraftTitle(''); setDraftSubject(''); setDraftSector('');
    setDraftCity(''); setDraftCampaignName(''); setDraftProject('tec');
    setDraftCategory(CATEGORY_OPTIONS[0].value); setEditorHtml(''); setSaveMessage('');
  };

  const handleCustomizeDraft = () => {
    setActiveWorkspaceMode('customize');
    setShowWorkspace(true);
    setSaveMessage('');
    if (uploadedText && !editorHtml) setEditorHtml(textToEditorHtml(uploadedText));
  };

  const handleEditDraft = draft => {
    setEditingDraftId(String(draft?._id || draft?.id || ''));
    setDraftTitle(String(draft?.title || ''));
    setDraftSubject(String(draft?.subject || ''));
    setDraftSector(String(draft?.sector || ''));
    setDraftCity(resolveDraftCity(draft));
    setDraftCampaignName(resolveDraftCampaign(draft));
    setDraftProject(resolveDraftProject(draft) || 'tec');
    setDraftCategory(resolveDraftLibraryType(draft) || CATEGORY_OPTIONS[0].value);
    setEditorHtml(String(draft?.body || ''));
    setShowWorkspace(true);
    setActiveWorkspaceMode('customize');
    setSaveMessage('');
    setPreviewDraft(null);
  };

  const handlePreviewDraft = draft => {
    setPreviewDraft(draft);
    setPreviewTab('formatted');
  };

  const handleDuplicateDraft = async draft => {
    const draftId  = String(draft?._id || draft?.id || '');
    const actionKey = `duplicate:${draftId}`;
    setBusyDraftAction(actionKey);
    setDraftActionMessage(''); setDraftActionError('');
    try {
      const draftType = resolveDraftLibraryType(draft);
      const res  = await fetch('/api/drafts', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ category:draftType, draftType, title:`${draft?.title||draft?.subject||'Untitled'} Copy`, sector:String(draft?.sector||'').trim(), city:resolveDraftCity(draft), campaignName:resolveDraftCampaign(draft), project:resolveDraftProject(draft), subject:String(draft?.subject||'').trim()||`${draft?.title||'Untitled'} Copy`, body:String(draft?.body||draft?.bodyHtml||draft?.html||'').trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to duplicate');
      if (data?.draft) setDrafts(prev => [data.draft, ...prev]);
      setDraftActionMessage('Draft duplicated successfully.');
    } catch(err) { setDraftActionError(err.message || 'Failed to duplicate.'); }
    finally { setBusyDraftAction(''); }
  };

  const handleDeleteDraft = async draft => {
    const draftId = String(draft?._id || draft?.id || '');
    if (!draftId || !window.confirm('Delete this draft? This cannot be undone.')) return;
    const actionKey = `delete:${draftId}`;
    setBusyDraftAction(actionKey);
    setDraftActionMessage(''); setDraftActionError('');
    try {
      const res  = await fetch(`/api/drafts/${encodeURIComponent(draftId)}`, { method:'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete');
      setDrafts(prev => prev.filter(i => String(i?._id||i?.id||'') !== draftId));
      setPreviewDraft(cur => (String(cur?._id||cur?.id||'') === draftId ? null : cur));
      setDraftActionMessage('Draft deleted successfully.');
    } catch(err) { setDraftActionError(err.message || 'Failed to delete.'); }
    finally { setBusyDraftAction(''); }
  };

  const handleSaveDraft = async () => {
    if (!draftTitle.trim() || !draftSubject.trim() || !editorHtml.trim()) {
      setSaveMessage('Title, subject, and body are required.');
      return;
    }
    setSavingDraft(true);
    try {
      const payload = { category: normalizeDraftType(draftCategory), draftType: normalizeDraftType(draftCategory), title: draftTitle.trim(), sector: draftSector.trim(), city: draftCity.trim(), campaignName: draftCampaignName.trim(), project: ['tec','tut'].includes(draftProject?.toLowerCase()) ? draftProject.toLowerCase() : '', subject: draftSubject.trim(), body: editorHtml };
      const res  = await fetch(editingDraftId ? `/api/drafts/${editingDraftId}` : '/api/drafts', { method: editingDraftId ? 'PATCH' : 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save');
      setSaveMessage(editingDraftId ? 'Updated successfully.' : 'Created successfully.');
      setEditingDraftId(String(data?.draft?._id || editingDraftId || ''));
      setDrafts(prev => {
        const nd = data?.draft;
        if (!nd) return prev;
        const id = String(nd._id || '');
        const idx = prev.findIndex(i => String(i?._id||'') === id);
        if (idx >= 0) { const c = [...prev]; c[idx] = nd; return c; }
        return [nd, ...prev];
      });
    } catch(err) { setSaveMessage(err.message || 'Failed to save.'); }
    finally { setSavingDraft(false); }
  };

  const handleTextFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const text = await file.text(); setUploadedFileName(file.name); setUploadedText(text); setActiveWorkspaceMode('upload'); }
    catch { setUploadedFileName(''); setUploadedText(''); }
    finally { e.target.value = ''; }
  };

  const clearAllFilters = () => { setLibraryTypeFilter(''); setLibrarySectorFilter(''); setLibraryProjectFilter(''); setLibraryCampaignFilter(''); setLibrarySearchQuery(''); };

  /* ── render ── */
  return (
    <DashboardPlaceholderShell>
      <input ref={fileInputRef} type="file" accept=".txt,.html,.htm,.doc,.docx" style={{ display:'none' }} onChange={handleTextFileChange} />
      <section className="dl-page">

        {/* PAGE HEADER */}
        <div className="dl-header">
          <div className="dl-header-title-area">
            <span className="dl-eyebrow">DRAFT LIBRARY</span>
            <h1 className="dl-h1">Drafts</h1>
          </div>
          <div className="dl-header-btns">
            <button type="button" className="dl-btn-ghost" onClick={handleCustomizeDraft}>
              <i className="ti ti-adjustments-horizontal" /> Customize Draft
            </button>
            <button type="button" className="dl-btn-primary" onClick={handleCreateDraft}>
              <i className="ti ti-plus" /> Create Draft
            </button>
          </div>
        </div>

        {/* STAT CARDS */}
        {!showWorkspace && (
          <div className="dl-stat-grid">
            {statCards.map(card => (
              <article key={card.key} className="dl-stat-card">
                <div className="dl-stat-top">
                  <span className="dl-stat-label">{card.label}</span>
                  <span className="dl-stat-icon" style={{ background: card.bg, color: card.color }}>
                    <i className={`ti ${card.icon}`} />
                  </span>
                </div>
                <strong className="dl-stat-number">{card.number}</strong>
                <span className="dl-stat-sub">{card.subtitle}</span>
              </article>
            ))}
          </div>
        )}

        {/* WORKSPACE (create / edit) */}
        {showWorkspace && (
          <section className={`workspace-panel draft-workspace-panel draft-workspace-panel-full`}>
            <div className="workspace-panel-head">
              <button type="button" className="dl-back-btn" onClick={() => setShowWorkspace(false)}>
                <i className="ti ti-arrow-left" /> Back to Library
              </button>
              <div><h2>{editingDraftId ? 'Edit Draft' : 'Create Draft'}</h2></div>
              <div className="draft-workspace-mode">
                <span className="draft-workspace-pill is-active">{activeWorkspaceMode === 'customize' ? 'Customize Draft' : 'Create Draft'}</span>
              </div>
            </div>
            <div className="draft-workspace-single">
              <section className="draft-workspace-pane">
                <div className="draft-workspace-pane-head"><div><h3>Draft Editor</h3></div></div>
                <label className="draft-workspace-title-field"><span>Draft Name</span><input type="text" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="Enter draft name" /></label>
                <div className="draft-workspace-meta-grid">
                  <label className="draft-workspace-title-field"><span>Subject</span><input type="text" value={draftSubject} onChange={e => setDraftSubject(e.target.value)} placeholder="Enter subject" /></label>
                  <label className="draft-workspace-title-field"><span>Draft Type</span><select value={draftCategory} onChange={e => setDraftCategory(e.target.value)}>{CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                  <label className="draft-workspace-title-field"><span>Campaign Name</span><input type="text" value={draftCampaignName} onChange={e => setDraftCampaignName(e.target.value)} placeholder="Enter campaign name" /></label>
                  <label className="draft-workspace-title-field"><span>Sector</span><input type="text" value={draftSector} onChange={e => setDraftSector(e.target.value)} placeholder="Enter sector" /></label>
                  <label className="draft-workspace-title-field"><span>City</span><input type="text" value={draftCity} onChange={e => setDraftCity(e.target.value)} placeholder="Enter city" /></label>
                  <label className="draft-workspace-title-field"><span>Project</span><select value={draftProject} onChange={e => setDraftProject(e.target.value)}>{PROJECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
                </div>
                <div className="draft-body-label">Draft Body</div>
                <RichTextEditor value={editorHtml} onChange={setEditorHtml} placeholder="Paste or write your draft here..." />
                <div className="draft-workspace-savebar">
                  <div><strong>{editingDraftId ? 'Editing saved draft' : 'Ready to create draft'}</strong>{saveMessage && <p>{saveMessage}</p>}</div>
                  <Button onClick={handleSaveDraft} disabled={savingDraft}>{savingDraft ? 'Saving...' : editingDraftId ? 'Update Draft' : 'Save Draft'}</Button>
                </div>
              </section>
            </div>
          </section>
        )}

        {/* LIBRARY PANEL */}
        {!showWorkspace && (
          <section className="dl-library" ref={draftListRef}>

            {/* Library header */}
            <div className="dl-lib-header">
              <div className="dl-lib-title-row">
                <div>
                  <span className="dl-eyebrow">DRAFT LIBRARY</span>
                  <h2 className="dl-lib-h2">All Drafts</h2>
                </div>
                <span className="dl-lib-showing">Showing {referenceFilteredDrafts.length} drafts</span>
              </div>

              {/* Search + dropdowns */}
              <div className="dl-controls">
                <label className="dl-search" htmlFor="dl-search-input">
                  <i className="ti ti-search dl-search-ico" />
                  <input
                    id="dl-search-input"
                    type="search"
                    value={librarySearchQuery}
                    onChange={e => setLibrarySearchQuery(e.target.value)}
                    placeholder="Name or subject..."
                    className="dl-search-input"
                  />
                </label>

                <div className="dl-select-wrap">
                  <select value={libraryTypeFilter} onChange={e => setLibraryTypeFilter(e.target.value)} className="dl-select">
                    <option value="">All draft types</option>
                    {DRAFT_LIBRARY_REFERENCE_SECTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <i className="ti ti-chevron-down dl-chev" />
                </div>

                <div className="dl-select-wrap">
                  <select value={librarySectorFilter} onChange={e => setLibrarySectorFilter(e.target.value)} className="dl-select">
                    <option value="">All sectors</option>
                    {sectorOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <i className="ti ti-chevron-down dl-chev" />
                </div>

                <div className="dl-select-wrap">
                  <select value={libraryProjectFilter} onChange={e => setLibraryProjectFilter(e.target.value)} className="dl-select">
                    <option value="">All projects</option>
                    {PROJECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <i className="ti ti-chevron-down dl-chev" />
                </div>

                <div className="dl-select-wrap">
                  <select value={libraryCampaignFilter} onChange={e => setLibraryCampaignFilter(e.target.value)} className="dl-select">
                    <option value="">All campaigns</option>
                    {campaignOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <i className="ti ti-chevron-down dl-chev" />
                </div>

                <button type="button" className="dl-refresh-btn" onClick={() => loadDrafts({ silent:true })} aria-label="Refresh">
                  <i className="ti ti-refresh" />
                </button>
              </div>

              {/* Tabs */}
              <div className="dl-tabs" role="tablist">
                <button type="button" role="tab" className={`dl-tab ${!libraryTypeFilter ? 'dl-tab--active' : ''}`} onClick={() => setLibraryTypeFilter('')}>
                  All <span className="dl-tab-pill">{libraryBaseFilteredDrafts.length}</span>
                </button>
                {DRAFT_LIBRARY_REFERENCE_SECTIONS.map(s => (
                  <button type="button" role="tab" key={s.value}
                    className={`dl-tab ${libraryTypeFilter === s.value ? 'dl-tab--active' : ''}`}
                    onClick={() => setLibraryTypeFilter(s.value)}
                  >
                    {s.label} <span className="dl-tab-pill">{filteredDraftTypeCounts[s.value] || 0}</span>
                  </button>
                ))}
              </div>

              {/* Filter bar */}
              <div className="dl-filterbar">
                <span className="dl-filterbar-label">FILTER</span>

                <div className="dl-select-wrap dl-select-wrap--sm">
                  <select value={librarySectorFilter} onChange={e => setLibrarySectorFilter(e.target.value)} className="dl-select dl-select--sm">
                    <option value="">All sectors</option>
                    {sectorOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <i className="ti ti-chevron-down dl-chev" />
                </div>

                <div className="dl-select-wrap dl-select-wrap--sm">
                  <select value={libraryProjectFilter} onChange={e => setLibraryProjectFilter(e.target.value)} className="dl-select dl-select--sm">
                    <option value="">No project</option>
                    {PROJECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <i className="ti ti-chevron-down dl-chev" />
                </div>

                <div className="dl-select-wrap dl-select-wrap--sm">
                  <select disabled className="dl-select dl-select--sm">
                    <option>Approved by TL</option>
                  </select>
                  <i className="ti ti-chevron-down dl-chev" />
                </div>

                <span className="dl-filterbar-count">{referenceFilteredDrafts.length} drafts</span>
                <button type="button" className="dl-clear-btn" onClick={clearAllFilters}>
                  × Clear
                </button>
              </div>
            </div>

            {/* Notices */}
            {draftActionMessage && <div className="dl-notice dl-notice--ok"><i className="ti ti-circle-check" />{draftActionMessage}</div>}
            {draftActionError   && <div className="dl-notice dl-notice--err"><i className="ti ti-alert-circle" />{draftActionError}</div>}

            {/* Draft sections */}
            <div className="dl-sections">
              {loading && (
                <div className="dl-state-loading">
                  <div className="dl-spinner" />
                  Loading drafts…
                </div>
              )}
               {!loading && error && !drafts.length && (
                <div className="dl-state-error">
                  <i className="ti ti-alert-triangle" />
                  <strong>Error loading drafts</strong>
                  <p>{error}</p>
                </div>
              )}

              {!loading && (!error || drafts.length > 0) && groupedDrafts.map((section, si) => {
                const sm = SECTION_META[section.value] || SECTION_META.cover_story;
                return (
                  <motion.div key={section.value}
                    initial={{ opacity:0, y:16 }}
                    animate={{ opacity:1, y:0 }}
                    transition={{ delay: si * 0.05, duration:0.24, ease:'easeOut' }}
                  >
                    {/* Section heading */}
                    <div className="dl-sec-head">
                      <span className="dl-sec-dot" style={{ background: sm.dotColor }} />
                      <span className="dl-sec-label">{section.label}</span>
                      <span className="dl-sec-count">{section.drafts.length}</span>
                    </div>

                    {/* Cards */}
                    {section.drafts.length ? (
                        <div className="dl-card-grid">
                          {section.drafts.map((draft, ci) => {
                            const dtype  = resolveDraftLibraryType(draft);
                            const dsm    = SECTION_META[dtype] || SECTION_META.cover_story;
                            const projectValue = resolveDraftProject(draft);
                            const cleanSubject = (draft?.subject || '').replace(/\{\{Name\}\}/gi, '').replace(/\{\{Company\}\}/gi, '').replace(/\s+/g, ' ').trim();
                            const displayTitle = cleanSubject || String(draft?.title || '').trim() || 'Untitled draft';
                            const draftId = String(draft?._id || draft?.id || '');
                            const isApproved = getDraftStatus(draft).toLowerCase() === 'approved';
                            const menuKey = draftId || `${section.value}-${ci}`;

                            return (
                              <motion.article key={draftId || ci}
                                className="dl-card"
                                onClick={() => handlePreviewDraft(draft)}
                                style={{
                                  '--card-accent': dsm.badgeText,
                                  '--card-accent-soft': dsm.badgeColor,
                                  '--card-accent-border': dsm.badgeBorder
                                }}
                                initial={{ opacity:0, y:12 }}
                                animate={{ opacity:1, y:0 }}
                                transition={{ delay: ci * 0.03, duration:0.2, ease:'easeOut' }}
                              >
                                {/* Card top row */}
                                <div className="dl-card-top">
                                  <div className="dl-card-badges">
                                    <span className="dl-badge" style={{ background: dsm.badgeColor, color: dsm.badgeText, borderColor: dsm.badgeBorder }}>
                                      {draftTypeLabel(dtype)}
                                    </span>
                                    <span className="dl-badge dl-badge--draft">Draft</span>
                                  </div>
                                  <div className="dl-menu-wrap" onClick={e => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="dl-menu-btn"
                                      aria-label="Draft actions"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setOpenMenu(openMenu === menuKey ? null : menuKey);
                                      }}
                                    >
                                      <i className="ti ti-dots-vertical" />
                                    </button>
                                    {openMenu === menuKey && (
                                      <div className="dl-menu" role="menu">
                                        <button type="button" onClick={() => { setOpenMenu(null); handlePreviewDraft(draft); }}>
                                          <i className="ti ti-eye" /> Preview
                                        </button>
                                        <button type="button" onClick={() => { setOpenMenu(null); handleEditDraft(draft); }}>
                                          <i className="ti ti-pencil" /> Edit
                                        </button>
                                        <button type="button" onClick={() => { setOpenMenu(null); handleDuplicateDraft(draft); }} disabled={busyDraftAction === `duplicate:${draftId}`}>
                                          <i className="ti ti-copy" /> Duplicate
                                        </button>
                                        <button type="button" className="dl-menu-del" onClick={() => { setOpenMenu(null); handleDeleteDraft(draft); }} disabled={busyDraftAction === `delete:${draftId}`}>
                                          <i className="ti ti-trash" /> Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Title */}
                                <div className="dl-card-header-group">
                                  <p className="dl-card-title">{displayTitle}</p>
                                </div>

                                {/* Meta */}
                                <div className="dl-card-meta">
                                  <span><i className="ti ti-building" />{draft?.sector || 'No sector'}</span>
                                  <span><i className="ti ti-folder" />{projectValue ? projectValue.toUpperCase() : 'No project'}</span>
                                  <span><i className="ti ti-clock" />{formatRelativeDate(draft?.updatedAt || draft?.createdAt)}</span>
                                </div>

                                {/* Bottom row */}
                                <div className="dl-card-foot">
                                  <div className="dl-approval">
                                    <span className="dl-tl-avatar" style={{ background: dsm.badgeText }}>TL</span>
                                    <span className="dl-approval-text">{isApproved ? 'Approved by TL' : 'Pending approval'}</span>
                                  </div>
                                  <button type="button" className="dl-edit-btn"
                                    onClick={e => { e.stopPropagation(); handleEditDraft(draft); }}>
                                    Edit
                                  </button>
                                </div>
                              </motion.article>
                            );
                          })}
                        </div>
                    ) : (
                      <div className="dl-section-empty">
                        <strong>No Drafts Found</strong>
                        <button type="button" onClick={handleCreateDraft}>Create Draft</button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* PREVIEW MODAL */}
        <AnimatePresence>
          {previewDraft && (() => {
            const ptype = resolveDraftLibraryType(previewDraft);
            const pm    = SECTION_META[ptype] || SECTION_META.cover_story;
            const isApproved = getDraftStatus(previewDraft).toLowerCase() === 'approved';
            return (
              <motion.div className="dl-modal-backdrop"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                onClick={() => setPreviewDraft(null)}>
                <motion.section className="dl-modal"
                  initial={{ opacity:0, y:32, scale:0.96 }}
                  animate={{ opacity:1, y:0,  scale:1 }}
                  exit={{    opacity:0, y:20, scale:0.97 }}
                  transition={{ duration:0.24, ease:[0.22,0.87,0.49,0.97] }}
                  onClick={e => e.stopPropagation()}
                  role="dialog" aria-modal="true" aria-label="Draft preview"
                >
                  {/* Modal head */}
                  <div className="dl-modal-head">
                    <button type="button" className="dl-modal-back-btn" onClick={() => setPreviewDraft(null)}>
                      <i className="ti ti-arrow-left" /> Back
                    </button>
                    <div>
                      <span className="dl-badge" style={{ background: pm.badgeColor, color: pm.badgeText, borderColor: pm.badgeBorder }}>
                        {draftTypeLabel(ptype)}
                      </span>
                      <h2 className="dl-modal-title">{previewDraft?.subject || previewDraft?.title || 'Draft Preview'}</h2>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="dl-modal-meta">
                    {[
                      { l:'Project',    v: resolveDraftProject(previewDraft)?.toUpperCase() || '—' },
                      { l:'Sector',     v: previewDraft?.sector || '—' },
                      { l:'Draft Type', v: draftTypeLabel(ptype) },
                      { l:'Updated',    v: formatRelativeDate(previewDraft?.updatedAt || previewDraft?.createdAt) },
                      { l:'Status',     v: isApproved ? '✓ Approved by TL' : 'Pending', ok: isApproved }
                    ].map(m => (
                      <div key={m.l} className={`dl-modal-meta-item${m.ok ? ' dl-modal-meta-item--ok' : ''}`}>
                        <span>{m.l}</span>
                        <strong>{m.v}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Inside Page Tabs */}
                  <div className="dl-modal-tabs">
                    <button type="button" className={`dl-modal-tab-btn ${previewTab === 'formatted' ? 'dl-modal-tab-btn--active' : ''}`} onClick={() => setPreviewTab('formatted')}>
                      <i className="ti ti-layout" /> Formatted Output
                    </button>
                    <button type="button" className={`dl-modal-tab-btn ${previewTab === 'raw' ? 'dl-modal-tab-btn--active' : ''}`} onClick={() => setPreviewTab('raw')}>
                      <i className="ti ti-code" /> Plain Text Body
                    </button>
                    <button type="button" className={`dl-modal-tab-btn ${previewTab === 'stats' ? 'dl-modal-tab-btn--active' : ''}`} onClick={() => setPreviewTab('stats')}>
                      <i className="ti ti-info-circle" /> Draft Details & Stats
                    </button>
                  </div>

                  {/* Body */}
                  <div className="dl-modal-body">
                    {previewTab === 'formatted' && (
                      <div className="dl-modal-content-wrapper">
                        <div className="dl-modal-subject-box">
                          <span className="dl-modal-subject-label">Subject:</span>
                          <span className="dl-modal-subject-value">{previewDraft?.subject || '(No Subject)'}</span>
                        </div>
                        <div className="dl-modal-content"
                          dangerouslySetInnerHTML={{ __html: previewDraft?.body || previewDraft?.bodyHtml || previewDraft?.html || '<p>No content available.</p>' }} />
                      </div>
                    )}

                    {previewTab === 'raw' && (
                      <div className="dl-modal-raw-container">
                        <div className="dl-modal-subject-box">
                          <span className="dl-modal-subject-label">Subject:</span>
                          <span className="dl-modal-subject-value">{previewDraft?.subject || '(No Subject)'}</span>
                        </div>
                        <textarea
                          className="dl-modal-raw-textarea"
                          readOnly
                          value={String(previewDraft?.body || previewDraft?.bodyHtml || previewDraft?.html || '').replace(/<[^>]*>/g, '')}
                          placeholder="No body text available."
                        />
                      </div>
                    )}

                    {previewTab === 'stats' && (
                      <div className="dl-modal-stats-grid">
                        <div className="dl-stats-section-title">Draft Metadata Summary</div>
                        <div className="dl-stats-table">
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Title</span>
                            <span className="dl-stats-val">{previewDraft?.title || '—'}</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Subject</span>
                            <span className="dl-stats-val">{previewDraft?.subject || '—'}</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Category / Category Value</span>
                            <span className="dl-stats-val">{draftTypeLabel(ptype)} ({ptype})</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Sector</span>
                            <span className="dl-stats-val">{previewDraft?.sector || '—'}</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Project</span>
                            <span className="dl-stats-val">{resolveDraftProject(previewDraft)?.toUpperCase() || '—'}</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">City / Location</span>
                            <span className="dl-stats-val">{resolveDraftCity(previewDraft) || '—'}</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Campaign Name</span>
                            <span className="dl-stats-val">{resolveDraftCampaign(previewDraft) || '—'}</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Database Status</span>
                            <span className="dl-stats-val">{getDraftStatus(previewDraft)}</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Created At</span>
                            <span className="dl-stats-val">{previewDraft?.createdAt ? new Date(previewDraft.createdAt).toLocaleString() : '—'}</span>
                          </div>
                          <div className="dl-stats-row">
                            <span className="dl-stats-lbl">Last Updated At</span>
                            <span className="dl-stats-val">{previewDraft?.updatedAt ? new Date(previewDraft.updatedAt).toLocaleString() : '—'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="dl-modal-foot">
                    <button type="button" className="dl-modal-action" onClick={() => handleDuplicateDraft(previewDraft)}>
                      <i className="ti ti-copy" /> Duplicate
                    </button>
                    <button type="button" className="dl-modal-action dl-modal-action--primary" style={{ background: pm.badgeText }} onClick={() => handleEditDraft(previewDraft)}>
                      <i className="ti ti-edit" /> Edit Draft
                    </button>
                  </div>
                </motion.section>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </section>
    </DashboardPlaceholderShell>
  );
}
