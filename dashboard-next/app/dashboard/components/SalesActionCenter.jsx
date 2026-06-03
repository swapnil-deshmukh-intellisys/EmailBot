'use client';

import React, { useEffect, useMemo, useState } from 'react';

const WORK_TYPES = ['Todo', 'Follow-up', 'Positive Reply', 'Negative Reply', 'Meeting', 'Proposal Sent', 'Call Done', 'Email Sent', 'Other'];
const STATUSES = ['Pending', 'Completed', 'Carried Forward'];
const PRIORITIES = ['High', 'Medium', 'Low'];
const RANGE_TABS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'week' },
  { label: 'Completed', value: 'completed' },
  { label: 'All', value: 'all' }
];

const EMPTY_FORM = {
  workTitle: '',
  workType: 'Todo',
  workDate: '',
  status: 'Pending',
  priority: 'Medium',
  relatedClientId: '',
  relatedClientName: '',
  projectId: '',
  projectName: '',
  campaignId: '',
  campaignName: '',
  notes: ''
};

function dateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function todayInputValue() {
  return dateInputValue(new Date());
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function isSameDay(value, reference = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= startOfDay(reference) && date <= endOfDay(reference);
}

function isYesterday(value) {
  const yesterday = startOfDay();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(value, yesterday);
}

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return 'No time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No time';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

function normalizeTask(task = {}) {
  return {
    ...task,
    id: String(task.id || task._id || ''),
    workTitle: task.workTitle || task.title || '',
    workType: task.workType || task.type || 'Todo',
    workDate: task.workDate || task.dueDate || '',
    status: STATUSES.includes(task.status) ? task.status : 'Pending',
    priority: PRIORITIES.includes(task.priority) ? task.priority : 'Medium'
  };
}

function WorkMetric({ title, value, tone = '' }) {
  return (
    <span className={`sales-action-metric ${tone}`}>
      <strong>{value}</strong>
      <small>{title}</small>
    </span>
  );
}

function WorkUpdateList({ updates, busyId, onComplete, onEdit, onDelete }) {
  if (!updates.length) {
    return <p className="sales-empty-state">No work updates yet. Add today's work update.</p>;
  }

  return (
    <div className="sales-priority-list">
      {updates.map((update) => (
        <article key={update.id} className={`sales-work-item ${update.status.toLowerCase().replace(/\s+/g, '-')}`}>
          <div className="sales-priority-item">
            <span>
              <strong>{update.workTitle}</strong>
              <small>{update.workType} - {update.status} - {update.priority}</small>
            </span>
          </div>
          <div className="sales-work-meta">
            <em>{formatDate(update.workDate)}</em>
            {update.relatedClientName ? <em>{update.relatedClientName}</em> : null}
            {update.projectName ? <em>{update.projectName}</em> : null}
            {update.campaignName ? <em>{update.campaignName}</em> : null}
            <small>Created {formatTime(update.createdAt)}</small>
          </div>
          {update.notes ? <p>{update.notes}</p> : null}
          <div className="sales-work-actions">
            {update.status !== 'Completed' ? (
              <button type="button" disabled={busyId === update.id} onClick={() => onComplete(update)}>Mark Complete</button>
            ) : null}
            <button type="button" onClick={() => onEdit(update)}>Edit</button>
            <button type="button" className="danger" disabled={busyId === update.id} onClick={() => onDelete(update)}>Delete</button>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function SalesActionCenter({ onShowMessage }) {
  const [updates, setUpdates] = useState([]);
  const [range, setRange] = useState('today');
  const [workTypeFilter, setWorkTypeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM, workDate: todayInputValue() });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  const loadUpdates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/work-updates?range=all', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to load work updates.');
      setUpdates(Array.isArray(data.updates) ? data.updates.map(normalizeTask) : []);
      setError('');
    } catch (loadError) {
      setUpdates([]);
      setError(loadError.message || 'Failed to load work updates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUpdates();
  }, []);

  const todayUpdates = useMemo(() => updates.filter((item) => isSameDay(item.workDate)), [updates]);
  const yesterdayUpdates = useMemo(() => updates.filter((item) => isYesterday(item.workDate)), [updates]);

  const todayCounts = useMemo(() => ({
    total: todayUpdates.length,
    pending: countBy(todayUpdates, (item) => item.status === 'Pending'),
    completed: countBy(todayUpdates, (item) => item.status === 'Completed'),
    carried: countBy(todayUpdates, (item) => item.status === 'Carried Forward')
  }), [todayUpdates]);

  const yesterdayCounts = useMemo(() => ({
    completed: countBy(yesterdayUpdates, (item) => item.status === 'Completed'),
    pending: countBy(yesterdayUpdates, (item) => item.status === 'Pending'),
    carried: countBy(yesterdayUpdates, (item) => item.status === 'Carried Forward')
  }), [yesterdayUpdates]);

  const visibleUpdates = useMemo(() => {
    const now = new Date();
    const weekStart = startOfDay();
    weekStart.setDate(weekStart.getDate() - 6);
    return updates
      .filter((item) => {
        if (range === 'today') return isSameDay(item.workDate, now);
        if (range === 'yesterday') return isYesterday(item.workDate);
        if (range === 'week') {
          const workDate = new Date(item.workDate);
          return !Number.isNaN(workDate.getTime()) && workDate >= weekStart && workDate <= endOfDay(now);
        }
        if (range === 'completed') return item.status === 'Completed';
        return true;
      })
      .filter((item) => !workTypeFilter || item.workType === workTypeFilter)
      .filter((item) => !priorityFilter || item.priority === priorityFilter)
      .sort((a, b) => new Date(b.workDate || b.createdAt || 0) - new Date(a.workDate || a.createdAt || 0));
  }, [priorityFilter, range, updates, workTypeFilter]);

  const openForm = (update = null) => {
    if (update) {
      setEditingId(update.id);
      setForm({
        workTitle: update.workTitle || '',
        workType: update.workType || 'Todo',
        workDate: dateInputValue(update.workDate),
        status: update.status || 'Pending',
        priority: update.priority || 'Medium',
        relatedClientId: update.relatedClientId || '',
        relatedClientName: update.relatedClientName || '',
        projectId: update.projectId || '',
        projectName: update.projectName || '',
        campaignId: update.campaignId || '',
        campaignName: update.campaignName || '',
        notes: update.notes || ''
      });
    } else {
      setEditingId('');
      setForm({ ...EMPTY_FORM, workDate: todayInputValue() });
    }
    setFormOpen(true);
  };

  const closeForm = (force = false) => {
    if (saving && !force) return;
    setFormOpen(false);
    setEditingId('');
    setForm({ ...EMPTY_FORM, workDate: todayInputValue() });
  };

  const saveUpdate = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.workTitle.trim()) {
      setError('Work title is required.');
      return;
    }
    if (!form.workDate) {
      setError('Work date is required.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/work-updates/${editingId}` : '/api/work-updates', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to save work update.');
      await loadUpdates();
      closeForm(true);
      onShowMessage?.(editingId ? 'Work update saved.' : 'Work update added.', 'success');
    } catch (saveError) {
      setError(saveError.message || 'Failed to save work update.');
    } finally {
      setSaving(false);
    }
  };

  const patchUpdate = async (update, patch) => {
    if (!update.id || busyId) return;
    setBusyId(update.id);
    try {
      const response = await fetch(`/api/work-updates/${update.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to update work update.');
      setUpdates((items) => items.map((item) => item.id === update.id ? normalizeTask(data.update) : item));
      onShowMessage?.('Work update changed.', 'success');
    } catch (patchError) {
      setError(patchError.message || 'Failed to update work update.');
    } finally {
      setBusyId('');
    }
  };

  const deleteUpdate = async (update) => {
    if (!update.id || busyId) return;
    setBusyId(update.id);
    try {
      const response = await fetch(`/api/work-updates/${update.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to delete work update.');
      setUpdates((items) => items.filter((item) => item.id !== update.id));
      onShowMessage?.('Work update deleted.', 'success');
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete work update.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="panel sales-action-card">
      <div className="sales-action-head">
        <div>
          <span className="section-title">Daily Work Report</span>
          <small>Manual daily work updates from your own reports</small>
        </div>
        <button type="button" className="sales-add-btn" onClick={() => openForm()}>Add Work Update</button>
      </div>

      <div className="sales-action-scroll">
        {error ? <p className="sales-error-state">{error}</p> : null}
        {loading ? <p className="sales-empty-state compact">Loading work updates...</p> : null}

        <div className="sales-action-block">
          <strong>Today</strong>
          <div className="sales-action-metrics">
            <WorkMetric title="Total updates" value={todayCounts.total} />
            <WorkMetric title="Pending today" value={todayCounts.pending} />
            <WorkMetric title="Completed today" value={todayCounts.completed} tone="complete" />
            <WorkMetric title="Carried forward" value={todayCounts.carried} tone="danger" />
          </div>
        </div>

        <div className="sales-action-block">
          <strong>Yesterday</strong>
          <div className="sales-action-metrics">
            <WorkMetric title="Completed yesterday" value={yesterdayCounts.completed} tone="complete" />
            <WorkMetric title="Pending yesterday" value={yesterdayCounts.pending} />
            <WorkMetric title="Carried from yesterday" value={yesterdayCounts.carried} tone="danger" />
          </div>
        </div>

        <div className="sales-action-block">
          <strong>Work Updates</strong>
          <div className="sales-filter-row">
            <div className="sales-range-tabs">
              {RANGE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={range === tab.value ? 'active' : ''}
                  onClick={() => setRange(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <select value={workTypeFilter} onChange={(event) => setWorkTypeFilter(event.target.value)}>
              <option value="">All Types</option>
              {WORK_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="">All Priority</option>
              {PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <WorkUpdateList
            updates={visibleUpdates}
            busyId={busyId}
            onComplete={(update) => patchUpdate(update, { status: 'Completed' })}
            onEdit={openForm}
            onDelete={deleteUpdate}
          />
        </div>
      </div>

      {formOpen ? (
        <div className="sales-work-modal-backdrop" onClick={() => closeForm()}>
          <form className="sales-work-modal" onSubmit={saveUpdate} onClick={(event) => event.stopPropagation()}>
            <div className="sales-work-modal-head">
              <strong>{editingId ? 'Edit Work Update' : 'Add Work Update'}</strong>
              <button type="button" onClick={() => closeForm()}>Close</button>
            </div>
            <label className="wide">
              <span>Work Title</span>
              <input value={form.workTitle} onChange={(event) => setForm((current) => ({ ...current, workTitle: event.target.value }))} />
            </label>
            <label>
              <span>Work Type</span>
              <select value={form.workType} onChange={(event) => setForm((current) => ({ ...current, workType: event.target.value }))}>
                {WORK_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Work Date</span>
              <input type="date" value={form.workDate} onChange={(event) => setForm((current) => ({ ...current, workDate: event.target.value }))} />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Priority</span>
              <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                {PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Related Client</span>
              <input value={form.relatedClientName} onChange={(event) => setForm((current) => ({ ...current, relatedClientName: event.target.value }))} />
            </label>
            <label>
              <span>Related Project</span>
              <input value={form.projectName} onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))} />
            </label>
            <label>
              <span>Related Campaign</span>
              <input value={form.campaignName} onChange={(event) => setForm((current) => ({ ...current, campaignName: event.target.value }))} />
            </label>
            <label className="wide">
              <span>Notes</span>
              <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            <div className="sales-work-modal-actions">
              <button type="button" onClick={() => closeForm()}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Work Update'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
