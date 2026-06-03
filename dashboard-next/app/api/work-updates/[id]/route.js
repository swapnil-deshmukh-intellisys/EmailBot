import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import WorkUpdate, { WORK_UPDATE_PRIORITIES, WORK_UPDATE_STATUSES, WORK_UPDATE_TYPES } from '@/models/WorkUpdate';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function userIdFromAuth(auth) {
  const id = String(auth.currentUser?._id || auth.currentUser?.id || auth.session?.id || '').trim();
  const email = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
    .trim()
    .toLowerCase();
  return id || email;
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

function serializeWorkUpdate(update = {}) {
  const plain = typeof update.toObject === 'function' ? update.toObject() : update;
  return {
    ...plain,
    id: String(plain._id || plain.id || ''),
    workTitle: plain.workTitle || plain.title || '',
    workType: plain.workType || plain.type || 'Todo',
    workDate: plain.workDate || plain.dueDate || null,
    status: WORK_UPDATE_STATUSES.includes(plain.status) ? plain.status : 'Pending',
    priority: WORK_UPDATE_PRIORITIES.includes(plain.priority) ? plain.priority : 'Medium'
  };
}

function normalizePatch(body = {}) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(body, 'workTitle') || Object.prototype.hasOwnProperty.call(body, 'title')) {
    const workTitle = String(body.workTitle ?? body.title ?? '').trim();
    if (!workTitle) throw new Error('Work title is required.');
    patch.workTitle = workTitle;
    patch.title = workTitle;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'workType') || Object.prototype.hasOwnProperty.call(body, 'type')) {
    const workType = normalizeEnum(body.workType ?? body.type, WORK_UPDATE_TYPES, 'Todo');
    patch.workType = workType;
    patch.type = workType;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'workDate') || Object.prototype.hasOwnProperty.call(body, 'dueDate')) {
    const workDate = startOfDay(body.workDate ?? body.dueDate);
    if (!workDate) throw new Error('Valid work date is required.');
    patch.workDate = workDate;
    patch.dueDate = workDate;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'status')) {
    const status = normalizeEnum(body.status, WORK_UPDATE_STATUSES, 'Pending');
    patch.status = status;
    patch.completedAt = status === 'Completed' ? new Date() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) patch.priority = normalizeEnum(body.priority, WORK_UPDATE_PRIORITIES, 'Medium');
  if (Object.prototype.hasOwnProperty.call(body, 'relatedClientId')) patch.relatedClientId = String(body.relatedClientId || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'relatedClientName')) patch.relatedClientName = String(body.relatedClientName || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'projectId')) patch.projectId = String(body.projectId || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'projectName')) patch.projectName = String(body.projectName || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'campaignId')) patch.campaignId = String(body.campaignId || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'campaignName')) patch.campaignName = String(body.campaignName || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) patch.notes = String(body.notes || '').trim();
  return patch;
}

async function getOwnedWorkUpdate(req, id) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return { errorResponse: auth.errorResponse };
  if (!mongoose.isValidObjectId(id)) {
    return {
      errorResponse: NextResponse.json({ ok: false, error: 'Invalid work update id.' }, { status: 400, headers: NO_STORE_HEADERS })
    };
  }
  const userId = userIdFromAuth(auth);
  if (!userId) {
    return {
      errorResponse: NextResponse.json({ ok: false, error: 'Logged-in user id is required.' }, { status: 400, headers: NO_STORE_HEADERS })
    };
  }
  await connectDB();
  const update = await WorkUpdate.findOne({ _id: id, userId });
  if (!update) {
    return {
      errorResponse: NextResponse.json({ ok: false, error: 'Work update not found.' }, { status: 404, headers: NO_STORE_HEADERS })
    };
  }
  return { update };
}

export async function PATCH(req, { params }) {
  try {
    const { update, errorResponse } = await getOwnedWorkUpdate(req, params?.id);
    if (errorResponse) return errorResponse;
    Object.assign(update, normalizePatch(await req.json().catch(() => ({}))));
    await update.save();
    return NextResponse.json({ ok: true, update: serializeWorkUpdate(update) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update work update.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const { update, errorResponse } = await getOwnedWorkUpdate(req, params?.id);
    if (errorResponse) return errorResponse;
    await update.deleteOne();
    return NextResponse.json({ ok: true, deleted: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete work update.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}
