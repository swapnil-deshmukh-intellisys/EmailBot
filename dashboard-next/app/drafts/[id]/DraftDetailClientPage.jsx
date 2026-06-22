'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPlaceholderShell } from '@/shared-components/common-components/workspace-components/WorkspaceComponentExports';
import Button from '@/shared-components/ui-components/UiActionButton';
import RichTextEditor from '@/modules/draft-module/draft-components/RichTextDraftEditor';
import { DRAFT_TYPE_ITEMS, normalizeDraftType } from '@/app/lib/draftTypes';

const PROJECT_OPTIONS = [
  { value: 'tec', label: 'TEC' },
  { value: 'tut', label: 'TUT' }
];

export default function DraftDetailClientPage({ draftId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftCategory, setDraftCategory] = useState('cover_story');
  const [draftSector, setDraftSector] = useState('');
  const [draftCountry, setDraftCountry] = useState('');
  const [draftCampaignName, setDraftCampaignName] = useState('');
  const [draftProject, setDraftProject] = useState('tec');
  const [editorHtml, setEditorHtml] = useState('');

  useEffect(() => {
    let active = true;
    const loadDraft = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/drafts/${encodeURIComponent(String(draftId))}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Failed to load draft');
        const draft = data?.draft || {};
        if (!active) return;
        setDraftTitle(String(draft.title || ''));
        setDraftSubject(String(draft.subject || ''));
        setDraftCategory(normalizeDraftType(draft.draftType || draft.category || 'cover_story'));
        setDraftSector(String(draft.sector || ''));
        setDraftCountry(String(draft.country || draft.city || ''));
        setDraftCampaignName(String(draft.campaignName || draft.campaign || ''));
        setDraftProject(['tec', 'tut'].includes(String(draft.project || '').toLowerCase()) ? String(draft.project).toLowerCase() : 'tec');
        setEditorHtml(String(draft.bodyHtml || draft.html || draft.body || ''));
        setMessage('');
      } catch (error) {
        if (active) setMessage(error.message || 'Failed to load draft');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadDraft();
    return () => {
      active = false;
    };
  }, [draftId]);

  const saveDraft = async () => {
    if (!draftTitle.trim() || !draftSubject.trim() || !editorHtml.trim()) {
      setMessage('Draft title, subject, and body are required.');
      return;
    }
    try {
      setSaving(true);
      const response = await fetch(`/api/drafts/${encodeURIComponent(String(draftId))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftTitle.trim(),
          subject: draftSubject.trim(),
          category: normalizeDraftType(draftCategory),
          draftType: normalizeDraftType(draftCategory),
          sector: draftSector.trim(),
          country: draftCountry.trim(),
          city: draftCountry.trim(),
          campaignName: draftCampaignName.trim(),
          project: draftProject,
          body: editorHtml,
          bodyHtml: editorHtml
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to save draft');
      setMessage('Draft updated successfully.');
    } catch (error) {
      setMessage(error.message || 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardPlaceholderShell>
      <section className="workspace-page" style={{ '--workspace-accent': '#f97316' }}>
        <div className="workspace-hero">
          <button type="button" className="page-back-button draft-detail-page-back-button" onClick={() => router.back()} aria-label="Go back to previous page">
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <div>
            <span className="workspace-kicker">Drafts</span>
            <h1>{loading ? 'Loading Draft' : draftTitle || 'Edit Draft'}</h1>
          </div>
          <div className="workspace-hero-actions">
            <Button className="workspace-primary" onClick={saveDraft} disabled={saving || loading}>
              {saving ? 'Saving...' : 'Update Draft'}
            </Button>
          </div>
        </div>

        <section className="workspace-panel draft-workspace-panel draft-workspace-panel-full">
          <div className="draft-workspace-single">
            <section className="draft-workspace-pane">
              <div className="draft-workspace-meta-grid">
                <label className="draft-workspace-title-field">
                  <span>Draft Name</span>
                  <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Enter draft name" />
                </label>
                <label className="draft-workspace-title-field">
                  <span>Subject</span>
                  <input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} placeholder="Enter subject" />
                </label>
                <label className="draft-workspace-title-field">
                  <span>Draft Type</span>
                  <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>
                    {DRAFT_TYPE_ITEMS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="draft-workspace-title-field">
                  <span>Campaign Name</span>
                  <input value={draftCampaignName} onChange={(event) => setDraftCampaignName(event.target.value)} placeholder="Enter campaign name" />
                </label>
                <label className="draft-workspace-title-field">
                  <span>Project</span>
                  <select value={draftProject} onChange={(event) => setDraftProject(event.target.value)}>
                    {PROJECT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="draft-workspace-title-field">
                  <span>Sector</span>
                  <input value={draftSector} onChange={(event) => setDraftSector(event.target.value)} placeholder="Enter sector" />
                </label>
                <label className="draft-workspace-title-field">
                  <span>Country</span>
                  <input value={draftCountry} onChange={(event) => setDraftCountry(event.target.value)} placeholder="Enter country" />
                </label>
              </div>
              <div className="draft-body-label">Draft Body</div>
              <div className="premium-summary-message-editor">
                <RichTextEditor value={editorHtml} onChange={setEditorHtml} placeholder="Paste or write your draft here..." />
              </div>
              {message ? <p className="client-data-custom-note">{message}</p> : null}
            </section>
          </div>
        </section>
      </section>
    </DashboardPlaceholderShell>
  );
}
