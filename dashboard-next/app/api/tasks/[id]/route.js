import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
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
  const role = String(auth.currentUser?.role || auth.session?.role || 'user').trim().toLowerCase();
  return { userId: userId || email, email, role };
}

function startOfDay(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function normalizeEnum(value, allowed, fallback) {
  const text = String(value || '').trim();
  return allowed.includes(text) ? text : fallback;
}

function ownerQuery(identity, id) {
  const visibility = identity.role === 'admin'
    ? {}
    : {
        $or: [
          { userId: identity.userId },
          { assignedByUserId: identity.userId },
          { assignedToUserId: identity.userId },
          ...(identity.email ? [{ userEmail: identity.email }, { assignedByEmail: identity.email }, { assignedToEmail: identity.email }] : [])
        ]
      };
  return Object.keys(visibility).length ? { $and: [{ _id: id }, visibility] } : { _id: id };
}

function isOverdue(task = {}) {
  if (task.status === 'Completed' || !task.dueDate) return false;
  const today = startOfDay(new Date());
  return new Date(task.dueDate).getTime() < today.getTime();
}

function serializeTask(task = {}) {
  const plain = typeof task.toObject === 'function' ? task.toObject() : task;
  return {
    id: String(plain._id || plain.id || ''),
    userId: plain.userId || '',
    title: plain.title || '',
    description: plain.description || '',
    priority: plain.priority || 'Medium',
    status: isOverdue(plain) ? 'Overdue' : plain.status,
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

function normalizePatch(body = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'title') || Object.prototype.hasOwnProperty.call(body, 'taskName')) {
    const title = String(body.title || body.taskName || '').trim();
    if (!title) throw new Error('Task name is required.');
    patch.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) patch.description = String(body.description || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) patch.priority = normalizeEnum(body.priority, TIMELINE_PRIORITIES, 'Medium');
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = normalizeEnum(body.status, TIMELINE_STATUSES, 'Pending');
    patch.status = status;
    patch.completedAt = status === 'Completed' ? new Date() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'dueDate')) {
    const dueDate = startOfDay(body.dueDate);
    if (!dueDate) throw new Error('Valid due date is required.');
    patch.dueDate = dueDate;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'dueTime')) patch.dueTime = String(body.dueTime || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'project') || Object.prototype.hasOwnProperty.call(body, 'projectName')) {
    patch.projectName = String(body.project || body.projectName || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) patch.notes = String(body.notes || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'attachments')) {
    patch.attachments = Array.isArray(body.attachments) ? body.attachments.map((item) => String(item || '').trim()).filter(Boolean) : [];
  }
  return patch;
}

async function getOwnedTask(req, id) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return { errorResponse: auth.errorResponse };
  if (!mongoose.isValidObjectId(id)) {
    return { errorResponse: NextResponse.json({ ok: false, error: 'Invalid task id.' }, { status: 400, headers: NO_STORE_HEADERS }) };
  }
  const identity = authIdentity(auth);
  await connectDB();
  const task = await TimelineTask.findOne(ownerQuery(identity, id));
  if (!task) {
    return { errorResponse: NextResponse.json({ ok: false, error: 'Task not found.' }, { status: 404, headers: NO_STORE_HEADERS }) };
  }
  return { task };
}

export async function PATCH(req, { params }) {
  try {
    const { task, errorResponse } = await getOwnedTask(req, params?.id);
    if (errorResponse) return errorResponse;
    Object.assign(task, normalizePatch(await req.json().catch(() => ({}))));
    await task.save();
    return NextResponse.json({ ok: true, task: serializeTask(task) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to update task.' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { task, errorResponse } = await getOwnedTask(req, params?.id);
    if (errorResponse) return errorResponse;
    await task.deleteOne();
    return NextResponse.json({ ok: true, deleted: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to delete task.' }, { status: 400, headers: NO_STORE_HEADERS });
  }
}
