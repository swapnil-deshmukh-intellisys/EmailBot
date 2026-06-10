'use client';

import React, { useEffect, useMemo, useState } from 'react';

const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Pending', 'In Progress', 'Completed'];

const EMPTY_FORM = {
  title: '',
  description: '',
  project: '',
  priority: 'Medium',
  dueDate: '',
  status: 'Pending',
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

function isSameDay(value, reference = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = startOfDay(reference);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}

function formatDate(value) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isOverdue(task = {}) {
  if (task.status === 'Completed' || !task.dueDate) return false;
  return new Date(task.dueDate).getTime() < startOfDay().getTime();
}

function normalizeTask(task = {}) {
  return {
    ...task,
    id: String(task.id || task._id || ''),
    title: task.title || task.taskName || 'Untitled task',
    priority: PRIORITIES.includes(task.priority) ? task.priority : 'Medium',
    status: task.status === 'Overdue' || isOverdue(task) ? 'Overdue' : STATUSES.includes(task.status) ? task.status : 'Pending',
    project: task.project || task.projectName || '',
    dueDate: task.dueDate || '',
    notes: task.notes || '',
    description: task.description || '',
    attachments: Array.isArray(task.attachments) ? task.attachments : []
  };
}

function TaskMetric({ title, value, tone = '' }) {
  return (
    <span className={`sales-action-metric ${tone}`}>
      <strong>{value}</strong>
      <small>{title}</small>
    </span>
  );
}

function TaskCard({ task, onClick }) {
  return (
    <button type="button" className={`sales-work-item task-card priority-${task.priority.toLowerCase()} ${task.status.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => onClick(task)}>
      <div className="sales-priority-item">
        <span>
          <strong>{task.title}</strong>
          <small>{task.project || 'No project'}</small>
        </span>
      </div>
      <div className="sales-work-meta">
        <em className={`priority-pill ${task.priority.toLowerCase()}`}>{task.priority}</em>
        <em>{formatDate(task.dueDate)}</em>
        <em>{task.status}</em>
      </div>
    </button>
  );
}

export default function SalesActionCenter({ onShowMessage }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsTask, setDetailsTask] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({ ...EMPTY_FORM, dueDate: todayInputValue() });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tasks?range=all', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to load tasks.');
      setTasks(Array.isArray(data.tasks) ? data.tasks.map(normalizeTask) : []);
      setError('');
    } catch (loadError) {
      setTasks([]);
      setError(loadError.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const metrics = useMemo(() => ({
    today: tasks.filter((task) => isSameDay(task.dueDate)).length,
    pending: tasks.filter((task) => ['Pending', 'In Progress'].includes(task.status)).length,
    completed: tasks.filter((task) => task.status === 'Completed').length,
    overdue: tasks.filter((task) => task.status === 'Overdue' || isOverdue(task)).length
  }), [tasks]);

  const visibleTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const aDone = a.status === 'Completed' ? 1 : 0;
      const bDone = b.status === 'Completed' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
    });
    return showAll ? sorted : sorted.slice(0, 4);
  }, [showAll, tasks]);

  const openForm = (task = null) => {
    if (task) {
      setEditingId(task.id);
      setForm({
        title: task.title || '',
        description: task.description || '',
        project: task.project || '',
        priority: task.priority || 'Medium',
        dueDate: dateInputValue(task.dueDate),
        status: task.status === 'Overdue' ? 'Pending' : task.status || 'Pending',
        notes: task.notes || ''
      });
    } else {
      setEditingId('');
      setForm({ ...EMPTY_FORM, dueDate: todayInputValue() });
    }
    setFormOpen(true);
  };

  const closeForm = (force = false) => {
    if (saving && !force) return;
    setFormOpen(false);
    setEditingId('');
    setForm({ ...EMPTY_FORM, dueDate: todayInputValue() });
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim()) {
      setError('Task name is required.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/tasks/${editingId}` : '/api/tasks', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to save task.');
      await loadTasks();
      if (detailsTask?.id === editingId) setDetailsTask(normalizeTask(data.task));
      closeForm(true);
      onShowMessage?.(editingId ? 'Task updated.' : 'Task added.', 'success');
    } catch (saveError) {
      setError(saveError.message || 'Failed to save task.');
    } finally {
      setSaving(false);
    }
  };

  const patchTask = async (task, patch) => {
    if (!task?.id || busyId) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to update task.');
      const nextTask = normalizeTask(data.task);
      setTasks((items) => items.map((item) => item.id === task.id ? nextTask : item));
      setDetailsTask(nextTask);
      onShowMessage?.('Task updated.', 'success');
    } catch (patchError) {
      setError(patchError.message || 'Failed to update task.');
    } finally {
      setBusyId('');
    }
  };

  const deleteTask = async (task) => {
    if (!task?.id || busyId) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to delete task.');
      setTasks((items) => items.filter((item) => item.id !== task.id));
      setDetailsTask(null);
      onShowMessage?.('Task deleted.', 'success');
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete task.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="panel sales-action-card todo-widget">
      <div className="sales-action-head">
        <div>
          <span className="section-title">To Do List</span>
          <small>Tasks, follow-ups, and campaign work in one place</small>
        </div>
        <button type="button" className="sales-add-btn" onClick={() => openForm()}>Add Task</button>
      </div>

      <div className="sales-action-scroll">
        {error ? <p className="sales-error-state">{error}</p> : null}
        {loading ? <p className="sales-empty-state compact">Loading tasks...</p> : null}

        <div className="sales-action-block">
          <div className="sales-action-metrics">
            <TaskMetric title="Today's Tasks" value={metrics.today} />
            <TaskMetric title="Pending" value={metrics.pending} tone="pending" />
            <TaskMetric title="Completed" value={metrics.completed} tone="complete" />
            <TaskMetric title="Overdue" value={metrics.overdue} tone="danger" />
          </div>
        </div>

        <div className="sales-action-block">
          <div className="todo-widget-headline">
            <strong>Tasks</strong>
            <button type="button" onClick={() => setShowAll((current) => !current)}>
              {showAll ? 'Show Less' : 'View All Tasks'}
            </button>
          </div>
          <div className="sales-priority-list">
            {visibleTasks.length ? visibleTasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={setDetailsTask} />
            )) : (
              <p className="sales-empty-state">No tasks yet. Add your first task.</p>
            )}
          </div>
        </div>
      </div>

      {detailsTask ? (
        <div className="sales-work-modal-backdrop" onClick={() => setDetailsTask(null)}>
          <div className="sales-work-modal task-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="sales-work-modal-head">
              <strong>{detailsTask.title}</strong>
              <button type="button" onClick={() => setDetailsTask(null)}>Close</button>
            </div>
            <article><span>Description</span><p>{detailsTask.description || 'No description added.'}</p></article>
            <article><span>Assigned By</span><p>{detailsTask.assignedBy || detailsTask.createdBy || 'Self'}</p></article>
            <article><span>Created Date</span><p>{formatDateTime(detailsTask.createdAt)}</p></article>
            <article><span>Due Date</span><p>{formatDate(detailsTask.dueDate)}</p></article>
            <article><span>Priority</span><p>{detailsTask.priority}</p></article>
            <article><span>Status</span><p>{detailsTask.status}</p></article>
            <article><span>Project</span><p>{detailsTask.project || 'No project'}</p></article>
            <article className="wide"><span>Notes</span><p>{detailsTask.notes || 'No notes added.'}</p></article>
            <article className="wide"><span>Attachments</span><p>{detailsTask.attachments.length ? detailsTask.attachments.join(', ') : 'No attachments.'}</p></article>
            <div className="sales-work-modal-actions">
              <button type="button" onClick={() => openForm(detailsTask)}>Edit Task</button>
              {detailsTask.status !== 'Completed' ? (
                <button type="button" disabled={busyId === detailsTask.id} onClick={() => patchTask(detailsTask, { status: 'Completed' })}>Mark Complete</button>
              ) : null}
              <button type="button" className="danger" disabled={busyId === detailsTask.id} onClick={() => deleteTask(detailsTask)}>Delete</button>
              <button type="button" onClick={() => setDetailsTask(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="sales-work-modal-backdrop" onClick={() => closeForm()}>
          <form className="sales-work-modal" onSubmit={saveTask} onClick={(event) => event.stopPropagation()}>
            <div className="sales-work-modal-head">
              <strong>{editingId ? 'Edit Task' : 'Add Task'}</strong>
              <button type="button" onClick={() => closeForm()}>Close</button>
            </div>
            <label className="wide">
              <span>Task Name</span>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="wide">
              <span>Description</span>
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label>
              <span>Project</span>
              <input value={form.project} onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))} />
            </label>
            <label>
              <span>Priority</span>
              <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                {PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Due Date</span>
              <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="wide">
              <span>Notes</span>
              <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
            <div className="sales-work-modal-actions">
              <button type="button" onClick={() => closeForm()}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Task'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
