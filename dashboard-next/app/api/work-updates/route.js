import { NextResponse } from 'next/server';
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

function userEmailFromAuth(auth) {
  return String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
    .trim()
    .toLowerCase();
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

function normalizeWorkDate(value) {
  const date = startOfDay(value);
  if (!date) throw new Error('Valid work date is required.');
  return date;
}

function buildRangeFilter(range) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  const yesterdayStart = startOfDay();
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayEnd = endOfDay(yesterdayStart);
  const weekStart = startOfDay();
  weekStart.setDate(weekStart.getDate() - 6);

  if (range === 'today') return { workDate: { $gte: todayStart, $lte: todayEnd } };
  if (range === 'yesterday') return { workDate: { $gte: yesterdayStart, $lte: yesterdayEnd } };
  if (range === 'week') return { workDate: { $gte: weekStart, $lte: todayEnd } };
  if (range === 'completed') return { status: 'Completed' };
  return {};
}

function normalizePayload(body = {}) {
  const workTitle = String(body.workTitle ?? body.title ?? '').trim();
  if (!workTitle) throw new Error('Work title is required.');

  return {
    workTitle,
    workType: normalizeEnum(body.workType ?? body.type, WORK_UPDATE_TYPES, 'Todo'),
    workDate: normalizeWorkDate(body.workDate ?? body.dueDate),
    status: normalizeEnum(body.status, WORK_UPDATE_STATUSES, 'Pending'),
    priority: normalizeEnum(body.priority, WORK_UPDATE_PRIORITIES, 'Medium'),
    relatedClientId: String(body.relatedClientId || '').trim(),
    relatedClientName: String(body.relatedClientName || '').trim(),
    projectId: String(body.projectId || '').trim(),
    projectName: String(body.projectName || '').trim(),
    campaignId: String(body.campaignId || '').trim(),
    campaignName: String(body.campaignName || '').trim(),
    notes: String(body.notes || '').trim()
  };
}

function serializeWorkUpdate(update = {}) {
  const plain = typeof update.toObject === 'function' ? update.toObject() : update;
  const workTitle = plain.workTitle || plain.title || '';
  const workType = plain.workType || plain.type || 'Todo';
  const workDate = plain.workDate || plain.dueDate || null;
  return {
    ...plain,
    id: String(plain._id || plain.id || ''),
    workTitle,
    workType,
    workDate,
    status: WORK_UPDATE_STATUSES.includes(plain.status) ? plain.status : 'Pending',
    priority: WORK_UPDATE_PRIORITIES.includes(plain.priority) ? plain.priority : 'Medium'
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userId = userIdFromAuth(auth);
    if (!userId) throw new Error('Logged-in user id is required.');

    const { searchParams } = new URL(req.url);
    const range = String(searchParams.get('range') || 'today').trim().toLowerCase();
    const workType = String(searchParams.get('workType') || searchParams.get('type') || '').trim();
    const priority = String(searchParams.get('priority') || '').trim();
    const status = String(searchParams.get('status') || '').trim();
    const query = { userId, ...buildRangeFilter(range) };
    if (WORK_UPDATE_TYPES.includes(workType)) query.workType = workType;
    if (WORK_UPDATE_PRIORITIES.includes(priority)) query.priority = priority;
    if (WORK_UPDATE_STATUSES.includes(status)) query.status = status;

    await connectDB();
    const updates = await WorkUpdate.find(query).sort({ workDate: -1, createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, updates: updates.map(serializeWorkUpdate) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to load work updates.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userId = userIdFromAuth(auth);
    const userEmail = userEmailFromAuth(auth);
    if (!userId) throw new Error('Logged-in user id is required.');

    const payload = normalizePayload(await req.json().catch(() => ({})));
    await connectDB();
    const duplicate = await WorkUpdate.findOne({
      userId,
      workTitle: payload.workTitle,
      workType: payload.workType,
      workDate: payload.workDate,
      relatedClientName: payload.relatedClientName,
      projectName: payload.projectName,
      campaignName: payload.campaignName
    }).lean();
    if (duplicate) {
      return NextResponse.json({ ok: false, error: 'This work update already exists.' }, { status: 409, headers: NO_STORE_HEADERS });
    }

    const update = await WorkUpdate.create({
      ...payload,
      userId,
      userEmail,
      completedAt: payload.status === 'Completed' ? new Date() : null,
      title: payload.workTitle,
      type: payload.workType,
      dueDate: payload.workDate
    });
    return NextResponse.json({ ok: true, update: serializeWorkUpdate(update) }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create work update.' },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }
}
