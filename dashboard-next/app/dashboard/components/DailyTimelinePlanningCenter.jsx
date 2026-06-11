'use client';

import React, { useEffect, useMemo, useState } from 'react';

const PRIORITIES = ['High', 'Medium', 'Low'];
const STATUSES = ['Pending', 'In Progress', 'Completed', 'Overdue'];
const EDITABLE_STATUSES = ['Pending', 'In Progress', 'Completed'];
const CATEGORIES = ['Sales', 'Outreach', 'Follow-Up', 'Research', 'Management', 'Campaign', 'Custom'];
const PROJECTS = ['TEC', 'TUT', 'Custom'];
const FILTERS = [
  ['Today', 'today'],
  ['Tomorrow', 'tomorrow'],
  ['This Week', 'week'],
  ['Upcoming', 'upcoming'],
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
  projectName: 'TEC',
  customProjectName: '',
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

function dateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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

function isNewAssignment(task) {
  const assignedBy = String(task.assignedBy || task.assignedByName || '').trim().toLowerCase();
  const assignedTo = String(task.assignedTo || task.assignedToName || '').trim().toLowerCase();
  const createdAt = new Date(task.createdAt || 0);
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return assignedBy && assignedTo && assignedBy !== assignedTo && createdAt.getTime() >= oneDayAgo;
}

function formatDate(value, options = {}) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options
  });
}

function formatDateTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'No time';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDueTime(value) {
  if (!value) return 'All day';
  const [hourText, minuteText] = String(value).split(':');
  const date = new Date();
  date.setHours(Number(hourText || 0), Number(minuteText || 0), 0, 0);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function groupLabel(value) {
  if (isToday(value)) return `Today - ${formatDate(value, { month: 'long' })}`;
  if (isTomorrow(value)) return `Tomorrow - ${formatDate(value, { month: 'long' })}`;
  return formatDate(value, { weekday: 'short' });
}

function normalizeTask(task = {}) {
  const status = isOverdue(task) ? 'Overdue' : task.status || 'Pending';
  return {
    ...task,
    id: String(task.id || task._id || ''),
    status,
    priority: PRIORITIES.includes(task.priority) ? task.priority : 'Medium',
    category: CATEGORIES.includes(task.category) ? task.category : 'Custom',
    assignedBy: task.assignedBy || task.assignedByName || task.assignedByEmail || 'Self',
    assignedTo: task.assignedTo || task.assignedToName || task.assignedToEmail || 'Self'
  };
}

function taskMatchesFilter(task, projectFilter, priorityFilter, statusFilter) {
  if (projectFilter && ![task.projectName, task.projectId].some((value) => String(value || '').toLowerCase() === projectFilter.toLowerCase())) {
    return false;
  }
  if (priorityFilter && task.priority !== priorityFilter) return false;
  if (statusFilter && task.status !== statusFilter) return false;
  return true;
}

function buildTaskQuery(range, filters = {}) {
  const params = new URLSearchParams({ range });
  if (filters.project) params.set('project', filters.project);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.status) params.set('status', filters.status);
  return params.toString();
}

function taskPayload(form) {
  const projectName = form.projectName === 'Custom'
    ? String(form.customProjectName || 'Custom').trim()
    : form.projectName;
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    status: form.status,
    dueDate: form.dueDate,
    dueTime: form.dueTime,
    assignedToName: form.assignedToName.trim(),
    assignedToEmail: form.assignedToEmail.trim(),
    projectId: projectName,
    projectName,
    category: form.category,
    notes: form.notes.trim(),
    reminderAt: form.reminderAt || null
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

function ReminderStrip({ reminders }) {
  if (!reminders.length) return null;

  return (
    <div className="planning-reminders">
      {reminders.map((task) => {
        const state = task.reminderState || (task.status === 'Overdue' ? 'overdue' : isToday(task.dueDate) ? 'due-today' : 'assignment');
        const label = state === 'overdue'
          ? 'Overdue'
          : state === 'reminder-due'
            ? 'Reminder'
            : state === 'due-today'
              ? 'Due today'
              : `Assigned by ${task.assignedBy}`;
        return <span key={`${task.id}-${state}`}>{label}: {task.title}</span>;
      })}
    </div>
  );
}

function PlanningTask({ task, busyId, onEdit, onComplete, onDelete, onReassign, onNote, onReminder }) {
  const statusSlug = task.status.toLowerCase().replace(/\s+/g, '-');

  return (
    <article className={`planning-task status-${statusSlug}`}>
      <time>{formatDueTime(task.dueTime)}</time>
      <div className="planning-task-body">
        <div className="planning-task-head">
          <strong>{task.title}</strong>
          <span className={`planning-priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
          <span className={`planning-status status-${statusSlug}`}>{task.status}</span>
        </div>
        <p>{task.description || 'No description added.'}</p>
        <div className="planning-meta">
          <em>Due Date: {formatDate(task.dueDate)}</em>
          <em>Due Time: {formatDueTime(task.dueTime)}</em>
          <em>Created Date: {formatDateTime(task.createdAt)}</em>
          <em>Last Updated Date: {formatDateTime(task.updatedAt)}</em>
          <em>Assigned by: {task.assignedBy}</em>
          <em>Assigned to: {task.assignedTo}</em>
          <em>Created by: {task.createdBy || task.userEmail || 'Self'}</em>
          <em>Project: {task.projectName || task.projectId || 'No project'}</em>
          <em>Category: {task.category}</em>
          {task.reminderAt ? <em>Reminder: {formatDateTime(task.reminderAt)}</em> : null}
        </div>
        {task.notes ? <p className="planning-note">{task.notes}</p> : null}
        <div className="planning-actions">
          {task.status !== 'Completed' ? (
            <button type="button" disabled={busyId === task.id} onClick={() => onComplete(task)}>Complete Task</button>
          ) : null}
          <button type="button" disabled={busyId === task.id} onClick={() => onEdit(task)}>Edit Task</button>
          <button type="button" disabled={busyId === task.id} onClick={() => onReassign(task)}>Reassign Task</button>
          <button type="button" disabled={busyId === task.id} onClick={() => onNote(task)}>Add Note</button>
          <button type="button" disabled={busyId === task.id} onClick={() => onReminder(task)}>Add Reminder</button>
          <button type="button" className="danger" disabled={busyId === task.id} onClick={() => onDelete(task)}>Delete Task</button>
        </div>
      </div>
    </article>
  );
}

export default function DailyTimelinePlanningCenter({ onShowMessage }) {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [filter, setFilter] = useState('today');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, dueDate: todayInput() });

  const loadTasks = async (nextFilter = filter) => {
    const filters = {
      project: projectFilter,
      priority: priorityFilter,
      status: statusFilter
    };

    try {
      setLoading(true);
      const [allResponse, rangeResponse] = await Promise.all([
        fetch('/api/timeline-tasks?range=all', { cache: 'no-store' }),
        fetch(`/api/timeline-tasks?${buildTaskQuery(nextFilter, filters)}`, { cache: 'no-store' })
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
      setFilteredTasks([]);
      setError(loadError.message || 'Failed to load timeline tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks(filter);
  }, [filter, projectFilter, priorityFilter, statusFilter]);

  const visibleTasks = useMemo(() => {
    return filteredTasks
      .filter((task) => taskMatchesFilter(task, projectFilter, priorityFilter, statusFilter))
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0) || String(a.dueTime || '').localeCompare(String(b.dueTime || '')));
  }, [filteredTasks, projectFilter, priorityFilter, statusFilter]);

  const groupedTasks = useMemo(() => {
    const groups = new Map();
    visibleTasks.forEach((task) => {
      const label = groupLabel(task.dueDate);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(task);
    });
    return Array.from(groups.entries());
  }, [visibleTasks]);

  const stats = useMemo(() => ({
    today: tasks.filter((task) => isToday(task.dueDate)).length,
    pending: tasks.filter((task) => task.status === 'Pending').length,
    completed: tasks.filter((task) => task.status === 'Completed').length,
    overdue: tasks.filter((task) => task.status === 'Overdue').length,
    upcoming: tasks.filter((task) => task.status !== 'Completed' && new Date(task.dueDate || 0) > endOfDay()).length
  }), [tasks]);

  const reminders = useMemo(() => {
    return tasks
      .filter((task) => task.status !== 'Completed')
      .filter((task) => ['overdue', 'due-today', 'reminder-due'].includes(task.reminderState) || isToday(task.dueDate) || task.status === 'Overdue' || isNewAssignment(task))
      .sort((a, b) => {
        const aReminder = a.reminderAt ? new Date(a.reminderAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bReminder = b.reminderAt ? new Date(b.reminderAt).getTime() : Number.MAX_SAFE_INTEGER;
        return aReminder - bReminder || new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      })
      .slice(0, 4);
  }, [tasks]);

  const projectOptions = useMemo(() => {
    const values = new Set(PROJECTS);
    tasks.forEach((task) => {
      const project = String(task.projectName || task.projectId || '').trim();
      if (project) values.add(project);
    });
    return Array.from(values);
  }, [tasks]);

  const openForm = (task = null, patch = {}) => {
    if (task) {
      const projectName = task.projectName || task.projectId || 'Custom';
      setEditingId(task.id);
      setForm({
        title: task.title || '',
        description: task.description || '',
        priority: task.priority || 'Medium',
        status: task.status === 'Overdue' ? 'Pending' : task.status || 'Pending',
        dueDate: dateInput(task.dueDate),
        dueTime: task.dueTime || '',
        assignedToName: task.assignedToName || task.assignedTo || '',
        assignedToEmail: task.assignedToEmail || '',
        projectName: PROJECTS.includes(projectName) ? projectName : 'Custom',
        customProjectName: PROJECTS.includes(projectName) ? '' : projectName,
        category: task.category || 'Custom',
        notes: task.notes || '',
        reminderAt: dateTimeInput(task.reminderAt),
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

  const showError = (message) => {
    setError(message);
    onShowMessage?.(message, 'error');
  };

  const saveTask = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.title.trim()) {
      showError('Task title is required.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/timeline-tasks/${editingId}` : '/api/timeline-tasks', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload(form))
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to save timeline task.');
      await loadTasks(filter);
      closeForm();
      onShowMessage?.(editingId ? 'Timeline task saved.' : 'Timeline task added.', 'success');
    } catch (saveError) {
      showError(saveError.message || 'Failed to save timeline task.');
    } finally {
      setSaving(false);
    }
  };

  const completeTask = async (task) => {
    if (!task.id || busyId) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`/api/timeline-tasks/${task.id}/complete`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to complete timeline task.');
      await loadTasks(filter);
      onShowMessage?.('Timeline task completed.', 'success');
    } catch (completeError) {
      showError(completeError.message || 'Failed to complete timeline task.');
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
      await loadTasks(filter);
      onShowMessage?.('Timeline task deleted.', 'success');
    } catch (deleteError) {
      showError(deleteError.message || 'Failed to delete timeline task.');
    } finally {
      setBusyId('');
    }
  };

  const addTaskNote = async (task) => {
    if (!task.id || busyId) return;
    const note = window.prompt('Add note');
    if (!note?.trim()) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`/api/timeline-tasks/${task.id}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to add note.');
      await loadTasks(filter);
      onShowMessage?.('Timeline note added.', 'success');
    } catch (noteError) {
      showError(noteError.message || 'Failed to add note.');
    } finally {
      setBusyId('');
    }
  };

  const reassignTask = async (task) => {
    if (!task.id || busyId) return;
    const assignedToName = window.prompt('Assign to name', task.assignedToName || task.assignedTo || '');
    if (assignedToName === null) return;
    const assignedToEmail = window.prompt('Assign to email (optional)', task.assignedToEmail || '');
    if (assignedToEmail === null) return;
    if (!assignedToName.trim() && !assignedToEmail.trim()) return;

    setBusyId(task.id);
    try {
      const response = await fetch(`/api/timeline-tasks/${task.id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToName, assignedToEmail })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to reassign task.');
      await loadTasks(filter);
      onShowMessage?.('Timeline task reassigned.', 'success');
    } catch (reassignError) {
      showError(reassignError.message || 'Failed to reassign task.');
    } finally {
      setBusyId('');
    }
  };

  const addReminder = async (task) => {
    if (!task.id || busyId) return;
    const fallback = dateTimeInput(task.reminderAt || new Date());
    const reminderAt = window.prompt('Reminder time (YYYY-MM-DDTHH:mm)', fallback);
    if (!reminderAt?.trim()) return;
    setBusyId(task.id);
    try {
      const response = await fetch(`/api/timeline-tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderAt })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to add reminder.');
      await loadTasks(filter);
      onShowMessage?.('Timeline reminder saved.', 'success');
    } catch (reminderError) {
      showError(reminderError.message || 'Failed to add reminder.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="panel planning-center-card">
      <div className="planning-head">
        <div>
          <span className="section-title">Daily Timeline & Planning Center</span>
          <small>Daily, weekly, future work planning, assignments, notes, and reminders.</small>
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

      <ReminderStrip reminders={reminders} />

      <div className="planning-filters">
        {FILTERS.map(([label, value]) => (
          <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className="planning-filter-selects">
        <label>
          <span>Project</span>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">All Projects</option>
            {projectOptions.map((project) => <option key={project} value={project}>{project}</option>)}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="">All Priorities</option>
            {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>

      {error ? <p className="sales-error-state">{error}</p> : null}
      {loading ? <p className="sales-empty-state compact">Loading planning timeline...</p> : null}

      <div className="planning-list">
        {!loading && !groupedTasks.length ? <p className="sales-empty-state">No planning tasks match this view. Add a task for today, tomorrow, this week, or a future date.</p> : null}
        {groupedTasks.map(([label, items]) => (
          <div key={label} className="planning-day-group">
            <div className="planning-day-label">{label}</div>
            {items.map((task) => (
              <PlanningTask
                key={task.id}
                task={task}
                busyId={busyId}
                onEdit={openForm}
                onComplete={completeTask}
                onDelete={deleteTask}
                onReassign={reassignTask}
                onNote={addTaskNote}
                onReminder={addReminder}
              />
            ))}
          </div>
        ))}
      </div>

      {formOpen ? (
        <div className="sales-work-modal-backdrop" onClick={closeForm}>
          <form className="sales-work-modal planning-modal" onSubmit={saveTask} onClick={(event) => event.stopPropagation()}>
            <div className="sales-work-modal-head">
              <strong>{editingId ? 'Edit Task' : 'Add Task'}</strong>
              <button type="button" onClick={closeForm}>Close</button>
            </div>
            <label className="wide">
              <span>Title</span>
              <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              <span>Priority</span>
              <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                {EDITABLE_STATUSES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Due Date</span>
              <input required type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </label>
            <label>
              <span>Due Time</span>
              <input type="time" value={form.dueTime} onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))} />
            </label>
            <label>
              <span>Assigned To</span>
              <input value={form.assignedToName} onChange={(event) => setForm((current) => ({ ...current, assignedToName: event.target.value }))} />
            </label>
            <label>
              <span>Assigned Email</span>
              <input type="email" value={form.assignedToEmail} onChange={(event) => setForm((current) => ({ ...current, assignedToEmail: event.target.value }))} />
            </label>
            <label>
              <span>Project</span>
              <select value={form.projectName} onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))}>
                {PROJECTS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            {form.projectName === 'Custom' ? (
              <label>
                <span>Custom Project</span>
                <input value={form.customProjectName} onChange={(event) => setForm((current) => ({ ...current, customProjectName: event.target.value }))} />
              </label>
            ) : null}
            <label>
              <span>Category</span>
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Reminder</span>
              <input type="datetime-local" value={form.reminderAt} onChange={(event) => setForm((current) => ({ ...current, reminderAt: event.target.value }))} />
            </label>
            <label className="wide">
              <span>Description</span>
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="wide">
              <span>Notes</span>
              <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </label>
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
