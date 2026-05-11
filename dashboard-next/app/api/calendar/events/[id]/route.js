import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import CalendarEvent, { EVENT_TYPES, PRIORITIES, REMINDERS, REPEATS } from '@/models/CalendarEvent';

const DEFAULT_COLOR = '#2563eb';
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeEnum(value, allowed, fallback) {
  const text = String(value || '').trim();
  return allowed.includes(text) ? text : fallback;
}

function normalizeDate(value, end = false) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  date.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  return date;
}

function normalizePayload(body = {}) {
  const update = {};
  if (Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = String(body.title || '').trim();
    if (!title) throw new Error('Event title is required');
    update.title = title;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) update.description = String(body.description || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'startDate')) {
    const startDate = normalizeDate(body.startDate);
    if (!startDate) throw new Error('Valid start date is required');
    update.startDate = startDate;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'endDate')) {
    const endDate = normalizeDate(body.endDate, true);
    if (!endDate) throw new Error('Valid end date is required');
    update.endDate = endDate;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'startTime')) update.startTime = String(body.startTime || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'endTime')) update.endTime = String(body.endTime || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'type')) update.type = normalizeEnum(body.type, EVENT_TYPES, 'Reminder');
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) update.priority = normalizeEnum(body.priority, PRIORITIES, 'Medium');
  if (Object.prototype.hasOwnProperty.call(body, 'reminder')) update.reminder = normalizeEnum(body.reminder, REMINDERS, 'None');
  if (Object.prototype.hasOwnProperty.call(body, 'repeat')) update.repeat = normalizeEnum(body.repeat, REPEATS, 'None');
  if (Object.prototype.hasOwnProperty.call(body, 'notes')) update.notes = String(body.notes || '').trim();
  if (Object.prototype.hasOwnProperty.call(body, 'color')) {
    const color = String(body.color || DEFAULT_COLOR).trim();
    update.color = COLOR_RE.test(color) ? color : DEFAULT_COLOR;
  }
  return update;
}

async function getOwnedEvent(req, id) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return { auth, errorResponse: auth.errorResponse };
  if (!mongoose.isValidObjectId(id)) {
    return { auth, errorResponse: NextResponse.json({ ok: false, error: 'Invalid event id' }, { status: 400 }) };
  }
  const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
    .trim()
    .toLowerCase();
  await connectDB();
  const event = await CalendarEvent.findOne({ _id: id, userEmail });
  if (!event) {
    return { auth, errorResponse: NextResponse.json({ ok: false, error: 'Calendar event not found' }, { status: 404 }) };
  }
  return { auth, event };
}

export async function PUT(req, { params }) {
  try {
    const { event, errorResponse } = await getOwnedEvent(req, params?.id);
    if (errorResponse) return errorResponse;
    const update = normalizePayload(await req.json().catch(() => ({})));
    Object.assign(event, update);
    if (event.endDate < event.startDate) {
      return NextResponse.json({ ok: false, error: 'End date cannot be before start date' }, { status: 400 });
    }
    await event.save();
    return NextResponse.json({ ok: true, event });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to update calendar event' }, { status: 400 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { event, errorResponse } = await getOwnedEvent(req, params?.id);
    if (errorResponse) return errorResponse;
    await event.deleteOne();
    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to delete calendar event' }, { status: 400 });
  }
}
