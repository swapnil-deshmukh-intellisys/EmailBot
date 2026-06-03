'use client';

import React, { useEffect, useMemo, useState } from 'react';

const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];
const CATEGORIES = ['Sales', 'Outreach', 'Follow-Up', 'Research', 'Management', 'Campaign', 'Custom'];
const FILTERS = [
  ['Today', 'today'],
  ['Tomorrow', 'tomorrow'],
  ['This Week', 'week'],
  ['Overdue', 'overdue'],
  ['Completed', 'completed'],
  ['My Tasks', 'my'],
  ['Assigned By Me', 'assigned-by-me']
];

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'Medium',
  status: 'Pending',
  dueDate: '',
  dueTime: '',
  assignedToName: '',
  assignedToEmail: '',
  projectName: '',
  category: 'Custom',
  notes: '',
  reminderAt: ''
};

function dateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function todayInput() {
  return dateInput(new Date());
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

function isToday(value) {
  const date = new Date(value || 0);
  return date >= startOfDay() && date <= endOfDay();
}

function isTomorrow(value) {
  const tomorrow = startOfDay();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowEnd = endOfDay(tomorrow);
  const date = new Date(value || 0);
  return date >= tomorrow && date <= tomorrowEnd;
}

function isOverdue(task) {
  return task.status !== 'Completed' && new Date(task.dueDate || 0) < startOfDay();
}

function formatDate(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return 'All day';
  return value;
}

function formatCreated(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'No time';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function normalizeTask(task = {}) {
  return {
    ...task,
    id: String(task.id || task._id || ''),
    status: isOverdue(task) ? 'Overdue' : task.status || 'Pending',
    priority: PRIORITIES.includes(task.priority) ? task.priority : 'Medium',
    category: CATEGORIES.includes(task.category) ? task.category : 'Custom'
  };
}

function TimelineStat({ label, value, tone = '' }) {
  return (
    <span className={`planning-stat ${tone}`}>
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function PlanningTask({ task, busyId, onEdit, onComplete, onDelete, onReassign, onNote, onReminder }) {
  return (
    <article className={`planning-task status-${task.status.toLowerCase().replace(/\s+/g, '-')}`}>
      <time>{formatTime(task.dueTime)}</time>
      <div className="planning-task-body">
        <div className="planning-task-head">
          <strong>{task.title}</strong>
          <span className={`planning-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
          <span className={`planning-status status-${task.status.toLowerCase().replace(/\s+/g, '-')}`}>{task.status}</span>
        </div>
        <p>{task.description || 'No description added.'}</p>
        <div className="planning-meta">
          <em>Due {formatDate(task.dueDate)}</em>
          <em>Created {formatCreated(task.createdAt)}</em>
          <em>Updated {formatCreated(task.updatedAt)}</em>
          <em>Assigned by: {task.assignedByName || 'Self'}</em>
          <em>Assigned to: {task.assignedToName || task.assignedToEmail || 'Self'}</em>
          <em>Project: {task.projectName || 'No project'}</em>
          <em>{task.category}</em>
        </div>
        {task.notes ? <p className="planning-note">{task.notes}</p> : null}
        <div className="planning-actions">
          {task.status !== 'Completed' ? <button type="button" disabled={busyId === task.id} onClick={() => onComplete(task)}>Complete</button> : null}
          <button type="button" onClick={() => onEdit(task)}>Edit</button>
          <button type="button" onClick={() => onReassign(task)}>Reassign</button>
          <button type="button" onClick={() => onNote(task)}>Add Note</button>
          <button type="button" onClick={() => onReminder(task)}>Add Reminder</button>
          <button type="button" className="danger" disabled={busyId === task.id} onClick={() => onDelete(task)}>Delete</button>
        </div>
      </div>
    </article>
  );
}

export default function DailyTimelinePlanningCenter({ onShowMessage }) {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [filter, setFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, dueDate: todayInput() });

  const loadTasks = async (nextFilter = filter) => {
    try {
      setLoading(true);
      const [allResponse, rangeResponse] = await Promise.all([
        fetch('/api/timeline-tasks?range=all', { cache: 'no-store' }),
        fetch(`/api/timeline-tasks?range=${encodeURIComponent(nextFilter)}`, { cache: 'no-store' })
      ]);
      const allData = await allResponse.json().catch(() => ({}));
      const rangeData = await rangeResponse.json().catch(() => ({}));
      if (!allResponse.ok) throw new Error(allData?.error || 'Failed to load timeline tasks.');
      if (!rangeResponse.ok) throw new Error(rangeData?.error || 'Failed to load timeline tasks.');
      setTasks(Array.isArray(allData.tasks) ? allData.tasks.map(normalizeTask) : []);
      setFilteredTasks(Array.isArray(rangeData.tasks) ? rangeData.tasks.map(normalizeTask) : []);
      setError('');
    } catch (loadError) {
      setTasks([]);
      setError(loadError.message || 'Failed to load timeline tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks(filter);
  }, [filter]);

  const visibleTasks = useMemo(() => {
    return filteredTasks
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0) || String(a.dueTime || '').localeCompare(String(b.dueTime || '')));
  }, [filteredTasks]);

  const stats = useMemo(() => ({
    today: tasks.filter((task) => isToday(task.dueDate)).length,
    pending: tasks.filter((task) => task.status === 'Pending').length,
    completed: tasks.filter((task) => task.status === 'Completed').length,
    overdue: tasks.filter((task) => task.status === 'Overdue').length,
    upcoming: tasks.filter((task) => task.status !== 'Completed' && new Date(task.dueDate || 0) > endOfDay()).length
  }), [tasks]);

  const reminders = useMemo(() => {
    return tasks
      .filter((task) => task.status !== 'Completed' && (isToday(task.dueDate) || task.status === 'Overdue'))
      .slice(0, 2);
  }, [tasks]);

  const openForm = (task = null, patch = {}) => {
    if (task) {
      setEditingId(task.id);
      setForm({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'Medium',
        status: task.status === 'Overdue' ? 'Pending' : task.status || 'Pending',
        dueDate: dateInput(task.dueDate),
        dueTime: task.dueTime || '',
        assignedToName: task.assignedToName || '',
        assignedToEmail: task.assignedToEmail || '',
        projectName: task.projectName || '',
        category: task.category || 'Custom',
        notes: task.notes || '',
        reminderAt: task.reminderAt ? new Date(task.reminderAt).toISOString().slice(0, 16) : '',
        ...patch
      });
    } else {
      setEditingId('');
      setForm({ ...EMPTY_FORM, dueDate: todayInput(), ...patch });
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditingId('');
    setForm({ ...EMPTY_FORM, dueDate: todayInput() });
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim()) {
      setError('Task title is required.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/timeline-tasks/${editingId}` : '/api/timeline-tasks', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to save timeline task.');
      await loadTasks(filter);
      setFormOpen(false);
      onShowMessage?.(editingId ? 'Timeline task saved.' : 'Timeline task added.', 'success');
    } catch (saveError) {
      setError(saveError.message || 'Failed to save timeline task.');
    } finally {
      setSaving(false);
    }
  };

  const patchTask = async (task, patch) => {
    if (!task.id || busyId) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`/api/timeline-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to update timeline task.');
      const nextTask = normalizeTask(data.task);
      setTasks((items) => items.map((item) => item.id === task.id ? nextTask : item));
      setFilteredTasks((items) => items.map((item) => item.id === task.id ? nextTask : item));
    } catch (patchError) {
      setError(patchError.message || 'Failed to update timeline task.');
    } finally {
      setBusyId('');
    }
  };

  const deleteTask = async (task) => {
    if (!task.id || busyId) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`/api/timeline-tasks/${task.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to delete timeline task.');
      setTasks((items) => items.filter((item) => item.id !== task.id));
      setFilteredTasks((items) => items.filter((item) => item.id !== task.id));
    } catch (deleteError) {
      setError(deleteError.message || 'Failed to delete timeline task.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="panel planning-center-card">
      <div className="planning-head">
        <div>
          <span className="section-title">Daily Timeline & Planning Center</span>
          <small>Human work planning, assignments, reminders, and management tasks.</small>
        </div>
        <button type="button" className="sales-add-btn" onClick={() => openForm()}>Add Task</button>
      </div>

      <div className="planning-stats">
        <TimelineStat label="Today's Tasks" value={stats.today} />
        <TimelineStat label="Pending Tasks" value={stats.pending} />
        <TimelineStat label="Completed Tasks" value={stats.completed} tone="complete" />
        <TimelineStat label="Overdue Tasks" value={stats.overdue} tone="danger" />
        <TimelineStat label="Upcoming Tasks" value={stats.upcoming} />
      </div>

      {reminders.length ? (
        <div className="planning-reminders">
          {reminders.map((task) => (
            <span key={task.id}>{task.status === 'Overdue' ? 'Overdue' : 'Due today'}: {task.title}</span>
          ))}
        </div>
      ) : null}

      <div className="planning-filters">
        {FILTERS.map(([label, value]) => (
          <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="sales-error-state">{error}</p> : null}
      {loading ? <p className="sales-empty-state compact">Loading planning timeline...</p> : null}

      <div className="planning-list">
        {!loading && !visibleTasks.length ? <p className="sales-empty-state">No planning tasks yet. Add your first daily task.</p> : null}
        {visibleTasks.map((task) => (
          <PlanningTask
            key={task.id}
            task={task}
            busyId={busyId}
            onEdit={openForm}
            onComplete={(item) => patchTask(item, { status: 'Completed' })}
            onDelete={deleteTask}
            onReassign={(item) => openForm(item)}
            onNote={(item) => openForm(item)}
            onReminder={(item) => openForm(item, { reminderAt: item.reminderAt || new Date().toISOString().slice(0, 16) })}
          />
        ))}
      </div>

      {formOpen ? (
        <div className="sales-work-modal-backdrop" onClick={closeForm}>
          <form className="sales-work-modal planning-modal" onSubmit={saveTask} onClick={(event) => event.stopPropagation()}>
            <div className="sales-work-modal-head">
              <strong>{editingId ? 'Edit Task' : 'Add Task'}</strong>
              <button type="button" onClick={closeForm}>Close</button>
            </div>
            <label className="wide"><span>Title</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label><span>Priority</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>{PRIORITIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>{STATUSES.filter((item) => item !== 'Overdue').map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Due Date</span><input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></label>
            <label><span>Due Time</span><input type="time" value={form.dueTime} onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))} /></label>
            <label><span>Assigned To</span><input value={form.assignedToName} onChange={(event) => setForm((current) => ({ ...current, assignedToName: event.target.value }))} /></label>
            <label><span>Assigned Email</span><input value={form.assignedToEmail} onChange={(event) => setForm((current) => ({ ...current, assignedToEmail: event.target.value }))} /></label>
            <label><span>Project</span><input value={form.projectName} onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))} /></label>
            <label><span>Category</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Reminder</span><input type="datetime-local" value={form.reminderAt} onChange={(event) => setForm((current) => ({ ...current, reminderAt: event.target.value }))} /></label>
            <label className="wide"><span>Description</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <label className="wide"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <div className="sales-work-modal-actions">
              <button type="button" onClick={closeForm}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Task'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
