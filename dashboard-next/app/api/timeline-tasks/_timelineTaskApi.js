import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth } from '@/lib/apiAuth';
import TimelineTask, { TIMELINE_CATEGORIES, TIMELINE_PRIORITIES, TIMELINE_STATUSES } from '@/models/TimelineTask';

export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

export function jsonError(message, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status, headers: NO_STORE_HEADERS });
}

export function authIdentity(auth) {
  const userId = String(auth.currentUser?._id || auth.currentUser?.id || auth.session?.id || '').trim();
  const email = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
  const name = String(auth.currentUser?.name || auth.currentUser?.displayName || auth.currentUser?.fullName || auth.currentUser?.username || auth.session?.name || email || 'Self').trim();
  const role = String(auth.currentUser?.role || auth.session?.role || 'user').trim().toLowerCase();
  return { userId: userId || email, email, name, role };
}

export function canAssignOthers(identity = {}) {
  return ['admin', 'manager', 'teamlead', 'team_lead', 'team lead'].includes(String(identity.role || '').toLowerCase());
}

export async function requireTimelineIdentity(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return { errorResponse: auth.errorResponse };
  return { auth, identity: authIdentity(auth) };
}

export function startOfDay(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

export function normalizeEnum(value, allowed, fallback) {
  const text = String(value || '').trim();
  return allowed.includes(text) ? text : fallback;
}

export function normalizeDueDate(value) {
  const date = startOfDay(value);
  if (!date) throw new Error('Valid due date is required.');
  return date;
}

function compactOr(items = []) {
  return items.filter((item) => item && Object.keys(item).length);
}

export function buildVisibility(identity = {}) {
  if (identity.role === 'admin') return {};
  return {
    $or: compactOr([
      { userId: identity.userId },
      { assignedByUserId: identity.userId },
      { assignedToUserId: identity.userId },
      identity.email ? { userEmail: identity.email } : null,
      identity.email ? { assignedByEmail: identity.email } : null,
      identity.email ? { assignedToEmail: identity.email } : null
    ])
  };
}

export function buildRangeFilter(range = 'today', identity = {}) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = endOfDay(tomorrowStart);
  const weekEnd = endOfDay(now);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (range === 'today') return { dueDate: { $gte: todayStart, $lte: todayEnd } };
  if (range === 'tomorrow') return { dueDate: { $gte: tomorrowStart, $lte: tomorrowEnd } };
  if (range === 'week' || range === 'this-week') return { dueDate: { $gte: todayStart, $lte: weekEnd } };
  if (range === 'upcoming') return { status: { $ne: 'Completed' }, dueDate: { $gt: tomorrowEnd } };
  if (range === 'overdue') return { status: { $ne: 'Completed' }, dueDate: { $lt: todayStart } };
  if (range === 'completed') return { status: 'Completed' };
  if (range === 'my') {
    return {
      $or: compactOr([
        { userId: identity.userId },
        { assignedToUserId: identity.userId },
        identity.email ? { userEmail: identity.email } : null,
        identity.email ? { assignedToEmail: identity.email } : null
      ])
    };
  }
  if (range === 'assigned-by-me') {
    return {
      $or: compactOr([
        { assignedByUserId: identity.userId },
        identity.email ? { assignedByEmail: identity.email } : null
      ])
    };
  }
  return {};
}

export function buildTaskQuery(searchParams, identity = {}) {
  const range = String(searchParams.get('range') || 'today').trim().toLowerCase();
  const category = String(searchParams.get('category') || '').trim();
  const priority = String(searchParams.get('priority') || '').trim();
  const status = String(searchParams.get('status') || '').trim();
  const project = String(searchParams.get('project') || '').trim();
  const andConditions = [buildVisibility(identity), buildRangeFilter(range, identity)].filter((item) => Object.keys(item).length);
  const query = {
    $and: andConditions
  };
  if (!query.$and.length) delete query.$and;
  if (TIMELINE_CATEGORIES.includes(category)) query.category = category;
  if (TIMELINE_PRIORITIES.includes(priority)) query.priority = priority;
  if (status === 'Overdue') {
    const overdueFilter = { status: { $ne: 'Completed' }, dueDate: { $lt: startOfDay() } };
    query.$and = query.$and?.length ? [...query.$and, overdueFilter] : [overdueFilter];
  } else if (TIMELINE_STATUSES.includes(status)) {
    query.status = status;
  }
  if (project) {
    query.$or = [
      { projectId: project },
      { projectName: new RegExp(`^${project.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    ];
  }
  return query;
}

export function normalizePayload(body = {}, identity = {}) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Task title is required.');

  const status = normalizeEnum(body.status, TIMELINE_STATUSES, 'Pending');
  const canAssign = canAssignOthers(identity);
  const assignedToEmail = canAssign
    ? String(body.assignedToEmail || '').trim().toLowerCase()
    : identity.email;
  const assignedToUserId = canAssign
    ? String(body.assignedToUserId || '').trim()
    : identity.userId;
  const assignedToName = canAssign
    ? String(body.assignedToName || '').trim() || assignedToEmail || identity.name
    : identity.name;
  const assignedByName = String(identity.name || identity.email || 'Self').trim();
  const assignedByEmail = String(identity.email || '').trim().toLowerCase();

  return {
    title,
    description: String(body.description || '').trim(),
    priority: normalizeEnum(body.priority, TIMELINE_PRIORITIES, 'Medium'),
    status,
    dueDate: normalizeDueDate(body.dueDate),
    dueTime: String(body.dueTime || '').trim(),
    projectId: String(body.projectId || '').trim(),
    projectName: String(body.projectName || '').trim(),
    category: normalizeEnum(body.category, TIMELINE_CATEGORIES, 'Custom'),
    assignedToUserId: assignedToUserId || assignedToEmail || assignedToName,
    assignedToEmail,
    assignedToName,
    assignedTo: assignedToName || assignedToEmail || 'Self',
    notes: String(body.notes || '').trim(),
    reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
    completedAt: status === 'Completed' ? new Date() : null,
    assignedByUserId: identity.userId,
    assignedByEmail,
    assignedByName,
    assignedBy: assignedByName || assignedByEmail || 'Self',
    createdBy: String(identity.name || identity.email || 'Self').trim()
  };
}

export function normalizePatch(body = {}, identity = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = String(body.title || '').trim();
    if (!title) throw new Error('Task title is required.');
    patch.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) patch.description = String(body.description || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) patch.priority = normalizeEnum(body.priority, TIMELINE_PRIORITIES, 'Medium');
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = normalizeEnum(body.status, TIMELINE_STATUSES, 'Pending');
    patch.status = status;
    patch.completedAt = status === 'Completed' ? new Date() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) patch.dueDate = normalizeDueDate(body.dueDate);
  if (Object.prototype.hasOwnProperty.call(body, 'dueTime')) patch.dueTime = String(body.dueTime || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'projectId')) patch.projectId = String(body.projectId || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'projectName')) patch.projectName = String(body.projectName || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'category')) patch.category = normalizeEnum(body.category, TIMELINE_CATEGORIES, 'Custom');
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) patch.notes = String(body.notes || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'reminderAt')) patch.reminderAt = body.reminderAt ? new Date(body.reminderAt) : null;

  if (['assignedToUserId', 'assignedToEmail', 'assignedToName'].some((key) => Object.prototype.hasOwnProperty.call(body, key))) {
    if (!canAssignOthers(identity)) throw new Error('Only a manager or admin can reassign tasks.');
    patch.assignedToUserId = String(body.assignedToUserId || '').trim();
    patch.assignedToEmail = String(body.assignedToEmail || '').trim().toLowerCase();
    patch.assignedToName = String(body.assignedToName || '').trim();
    patch.assignedTo = patch.assignedToName || patch.assignedToEmail || patch.assignedToUserId || '';
  }

  return patch;
}

export function isOverdue(task = {}) {
  if (task.status === 'Completed' || !task.dueDate) return false;
  return new Date(task.dueDate).getTime() < startOfDay().getTime();
}

export function getReminderState(task = {}) {
  if (task.status === 'Completed') return '';
  const now = new Date();
  if (isOverdue(task)) return 'overdue';
  if (task.reminderAt && new Date(task.reminderAt).getTime() <= now.getTime()) return 'reminder-due';
  const due = task.dueDate ? new Date(task.dueDate) : null;
  if (due && due >= startOfDay(now) && due <= endOfDay(now)) return 'due-today';
  return '';
}

export function serializeTask(task = {}) {
  const plain = typeof task.toObject === 'function' ? task.toObject() : task;
  const status = isOverdue(plain) ? 'Overdue' : plain.status;
  return {
    ...plain,
    id: String(plain._id || plain.id || ''),
    assignedBy: plain.assignedBy || plain.assignedByName || plain.assignedByEmail || 'Self',
    assignedTo: plain.assignedTo || plain.assignedToName || plain.assignedToEmail || 'Self',
    status,
    reminderState: getReminderState({ ...plain, status })
  };
}

export function ownerQuery(identity, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const visibility = buildVisibility(identity);
  return Object.keys(visibility).length ? { $and: [{ _id: id }, visibility] } : { _id: id };
}

export async function getVisibleTask(req, id) {
  const { identity, errorResponse } = await requireTimelineIdentity(req);
  if (errorResponse) return { errorResponse };
  const query = ownerQuery(identity, id);
  if (!query) return { errorResponse: jsonError('Invalid timeline task id.', 400) };
  const task = await TimelineTask.findOne(query);
  if (!task) return { errorResponse: jsonError('Timeline task not found.', 404) };
  return { task, identity };
}
