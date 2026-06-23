import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import TimelineTask, { TIMELINE_PRIORITIES, TIMELINE_STATUSES } from '@/models/TimelineTask';

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

function buildRangeFilter(range) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  if (range === 'today') return { dueDate: { $gte: todayStart, $lte: todayEnd } };
  if (range === 'pending') return { status: { $in: ['Pending', 'In Progress'] } };
  if (range === 'completed') return { status: 'Completed' };
  if (range === 'overdue') return { status: { $ne: 'Completed' }, dueDate: { $lt: todayStart } };
  return {};
}

function normalizeDueDate(value) {
  const dueDate = startOfDay(value);
  if (!dueDate) throw new Error('Valid due date is required.');
  return dueDate;
}

function normalizePayload(body = {}, identity) {
  const title = String(body.title || body.taskName || '').trim();
  if (!title) throw new Error('Task name is required.');
  const status = normalizeEnum(body.status, TIMELINE_STATUSES, 'Pending');
  return {
    title,
    description: String(body.description || '').trim(),
    priority: normalizeEnum(body.priority, TIMELINE_PRIORITIES, 'Medium'),
    status,
    dueDate: normalizeDueDate(body.dueDate || new Date()),
    dueTime: String(body.dueTime || '').trim(),
    projectName: String(body.project || body.projectName || '').trim(),
    notes: String(body.notes || '').trim(),
    attachments: Array.isArray(body.attachments) ? body.attachments.map((item) => String(item || '').trim()).filter(Boolean) : [],
    category: 'Custom',
    completedAt: status === 'Completed' ? new Date() : null,
    assignedByUserId: identity.userId,
    assignedByEmail: identity.email,
    assignedByName: identity.name,
    assignedToUserId: identity.userId,
    assignedToEmail: identity.email,
    assignedToName: identity.name,
    createdBy: identity.name
  };
}

function isOverdue(task = {}) {
  if (task.status === 'Completed' || !task.dueDate) return false;
  return new Date(task.dueDate).getTime() < startOfDay().getTime();
}

function serializeTask(task = {}) {
  const plain = typeof task.toObject === 'function' ? task.toObject() : task;
  const status = isOverdue(plain) ? 'Overdue' : plain.status;
  return {
    id: String(plain._id || plain.id || ''),
    userId: plain.userId || '',
    title: plain.title || '',
    description: plain.description || '',
    priority: plain.priority || 'Medium',
    status,
    project: plain.projectName || plain.project || '',
    dueDate: plain.dueDate || null,
    dueTime: plain.dueTime || '',
    notes: plain.notes || '',
    attachments: Array.isArray(plain.attachments) ? plain.attachments : [],
    createdBy: plain.createdBy || plain.assignedByName || plain.assignedByEmail || 'Self',
    assignedBy: plain.assignedByName || plain.assignedByEmail || plain.createdBy || 'Self',
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const identity = authIdentity(auth);
    const { searchParams } = new URL(req.url);
    const range = String(searchParams.get('range') || 'all').trim().toLowerCase();
    const queryParts = [buildVisibility(identity), buildRangeFilter(range)].filter((item) => Object.keys(item).length);
    const query = queryParts.length ? { $and: queryParts } : {};

    await connectDB();
    const tasks = await TimelineTask.find(query).sort({ status: 1, dueDate: 1, createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, tasks: tasks.map(serializeTask) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load tasks.' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const identity = authIdentity(auth);
    const payload = normalizePayload(await req.json().catch(() => ({})), identity);

    await connectDB();
    const task = await TimelineTask.create({
      ...payload,
      userId: identity.userId,
      userEmail: identity.email
    });
    return NextResponse.json({ ok: true, task: serializeTask(task) }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to create task.' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}
