import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import TimelineTask, { TIMELINE_CATEGORIES, TIMELINE_PRIORITIES, TIMELINE_STATUSES } from '@/models/TimelineTask';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function authIdentity(auth) {
  const userId = String(auth.currentUser?._id || auth.currentUser?.id || auth.session?.id || '').trim();
  const email = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
  const name = String(auth.currentUser?.name || auth.currentUser?.fullName || auth.currentUser?.username || auth.session?.name || email || 'Self').trim();
  const role = String(auth.currentUser?.role || auth.session?.role || 'user').trim().toLowerCase();
  return { userId: userId || email, email, name, role };
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function normalizeEnum(value, allowed, fallback) {
  const text = String(value || '').trim();
  return allowed.includes(text) ? text : fallback;
}

function normalizeDueDate(value) {
  const date = startOfDay(value);
  if (!date) throw new Error('Valid due date is required.');
  return date;
}

function buildVisibility(identity) {
  if (identity.role === 'admin') return {};
  return {
    $or: [
      { userId: identity.userId },
      { assignedByUserId: identity.userId },
      { assignedToUserId: identity.userId },
      ...(identity.email ? [{ userEmail: identity.email }, { assignedByEmail: identity.email }, { assignedToEmail: identity.email }] : [])
    ]
  };
}

function buildRangeFilter(range, identity) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = endOfDay(tomorrowStart);
  const weekStart = startOfDay(now);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekEnd = endOfDay(now);

  if (range === 'today') return { dueDate: { $gte: todayStart, $lte: todayEnd } };
  if (range === 'tomorrow') return { dueDate: { $gte: tomorrowStart, $lte: tomorrowEnd } };
  if (range === 'week') return { dueDate: { $gte: weekStart, $lte: weekEnd } };
  if (range === 'overdue') return { status: { $ne: 'Completed' }, dueDate: { $lt: todayStart } };
  if (range === 'completed') return { status: 'Completed' };
  if (range === 'my') return { $or: [{ userId: identity.userId }, { assignedToUserId: identity.userId }, { assignedToEmail: identity.email }] };
  if (range === 'assigned-by-me') return { $or: [{ assignedByUserId: identity.userId }, { assignedByEmail: identity.email }] };
  return {};
}

function normalizePayload(body = {}, identity) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Task title is required.');
  const dueDate = normalizeDueDate(body.dueDate);
  const status = normalizeEnum(body.status, TIMELINE_STATUSES, 'Pending');
  return {
    title,
    description: String(body.description || '').trim(),
    priority: normalizeEnum(body.priority, TIMELINE_PRIORITIES, 'Medium'),
    status,
    dueDate,
    dueTime: String(body.dueTime || '').trim(),
    projectId: String(body.projectId || '').trim(),
    projectName: String(body.projectName || '').trim(),
    category: normalizeEnum(body.category, TIMELINE_CATEGORIES, 'Custom'),
    assignedToUserId: String(body.assignedToUserId || '').trim(),
    assignedToEmail: String(body.assignedToEmail || '').trim().toLowerCase(),
    assignedToName: String(body.assignedToName || '').trim() || 'Self',
    notes: String(body.notes || '').trim(),
    reminderAt: body.reminderAt ? new Date(body.reminderAt) : null,
    completedAt: status === 'Completed' ? new Date() : null,
    assignedByUserId: String(body.assignedByUserId || identity.userId || '').trim(),
    assignedByEmail: String(body.assignedByEmail || identity.email || '').trim().toLowerCase(),
    assignedByName: String(body.assignedByName || identity.name || 'Self').trim()
  };
}

function isOverdue(task = {}) {
  if (task.status === 'Completed' || !task.dueDate) return false;
  return new Date(task.dueDate).getTime() < startOfDay().getTime();
}

function serializeTask(task = {}) {
  const plain = typeof task.toObject === 'function' ? task.toObject() : task;
  return {
    ...plain,
    id: String(plain._id || plain.id || ''),
    status: isOverdue(plain) ? 'Overdue' : plain.status
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const identity = authIdentity(auth);
    const { searchParams } = new URL(req.url);
    const range = String(searchParams.get('range') || 'today').trim().toLowerCase();
    const category = String(searchParams.get('category') || '').trim();
    const priority = String(searchParams.get('priority') || '').trim();
    const query = { $and: [buildVisibility(identity), buildRangeFilter(range, identity)].filter((item) => Object.keys(item).length) };
    if (!query.$and.length) delete query.$and;
    if (TIMELINE_CATEGORIES.includes(category)) query.category = category;
    if (TIMELINE_PRIORITIES.includes(priority)) query.priority = priority;

    await connectDB();
    const tasks = await TimelineTask.find(query).sort({ dueDate: 1, dueTime: 1, createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, tasks: tasks.map(serializeTask) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load timeline tasks.' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const identity = authIdentity(auth);
    const payload = normalizePayload(await req.json().catch(() => ({})), identity);

    await connectDB();
    const duplicate = await TimelineTask.findOne({
      userId: identity.userId,
      title: payload.title,
      dueDate: payload.dueDate,
      dueTime: payload.dueTime,
      assignedToEmail: payload.assignedToEmail
    }).lean();
    if (duplicate) {
      return NextResponse.json({ ok: false, error: 'This timeline task already exists.' }, { status: 409, headers: NO_STORE_HEADERS });
    }

    const task = await TimelineTask.create({
      ...payload,
      userId: identity.userId,
      userEmail: identity.email,
      assignedToUserId: payload.assignedToUserId || identity.userId,
      assignedToEmail: payload.assignedToEmail || identity.email,
      assignedToName: payload.assignedToName === 'Self' ? identity.name : payload.assignedToName
    });
    return NextResponse.json({ ok: true, task: serializeTask(task) }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to create timeline task.' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}
