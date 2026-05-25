'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';

export default function DraftTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCategories, setShowCategories] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', subject: '', body: '' });

  const categories = useMemo(() => {
    const names = templates.map((item) => String(item.category || item.type || 'General').trim() || 'General');
    return Array.from(new Set(names));
  }, [templates]);

  const loadTemplates = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/templates?t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to load templates');
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (err) {
      setError(err.message || 'Failed to load templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const saveTemplate = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      setError('Template name, subject, and body are required.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to save template');
      setTemplates((current) => [data.template, ...current].filter(Boolean));
      setForm({ name: '', subject: '', body: '' });
      setShowForm(false);
      setMessage('Template saved.');
    } catch (err) {
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <section className="workspace-page draft-templates-page">
        <div className="workspace-hero">
          <div>
            <span className="workspace-kicker">Draft & Templates</span>
            <h1>Reusable campaign templates</h1>
            <p>Browse saved template categories and create new reusable campaign copy.</p>
          </div>
          <div className="workspace-hero-actions">
            <Button variant="secondary" onClick={() => setShowCategories(true)}>Browse Categories</Button>
            <Button onClick={() => setShowForm(true)}>New Template</Button>
          </div>
        </div>

        {error ? <div className="dashboard-error-state">{error}</div> : null}
        {message ? <div className="dashboard-success-state">{message}</div> : null}

        <section className="workspace-panel">
          <div className="workspace-panel-head">
            <div>
              <h2>Template Catalog</h2>
              <p>{loading ? 'Loading templates...' : `${templates.length} templates available`}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={loadTemplates}>Refresh</Button>
          </div>
          <div className="workspace-table">
            <div className="workspace-table-head" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <span>Name</span>
              <span>Subject</span>
              <span>Category</span>
            </div>
            {loading ? <div className="workspace-table-row" style={{ gridTemplateColumns: '1fr' }}><span>Loading...</span></div> : templates.map((template) => (
              <div key={template._id || template.name} className="workspace-table-row" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <span>{template.name}</span>
                <span>{template.subject}</span>
                <span>{template.category || template.type || 'General'}</span>
              </div>
            ))}
          </div>
        </section>

        {showCategories ? (
          <div className="premium-calendar-modal-backdrop" onClick={() => setShowCategories(false)}>
            <div className="premium-calendar-modal" onClick={(event) => event.stopPropagation()}>
              <div className="premium-panel-head">
                <h3>Template Categories</h3>
                <button type="button" className="ghost subtle" onClick={() => setShowCategories(false)}>x</button>
              </div>
              <div className="workspace-list">
                {(categories.length ? categories : ['General']).map((category) => (
                  <div key={category}>
                    <strong>{category}</strong>
                    <span>{templates.filter((item) => String(item.category || item.type || 'General') === category).length} templates</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {showForm ? (
          <div className="premium-calendar-modal-backdrop" onClick={() => setShowForm(false)}>
            <div className="premium-calendar-modal" onClick={(event) => event.stopPropagation()}>
              <div className="premium-panel-head">
                <h3>New Template</h3>
                <button type="button" className="ghost subtle" onClick={() => setShowForm(false)}>x</button>
              </div>
              <div className="premium-template-body">
                <label className="premium-template-field"><span>Name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
                <label className="premium-template-field"><span>Subject</span><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} /></label>
                <label className="premium-template-field"><span>Body</span><textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} rows={8} /></label>
              </div>
              <div className="premium-template-actions">
                <button type="button" className="ghost subtle" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="button" className="premium-template-next" disabled={saving} onClick={saveTemplate}>{saving ? 'Saving...' : 'Save Template'}</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </AppLayout>
  );
}
