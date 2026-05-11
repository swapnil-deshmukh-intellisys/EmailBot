import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import CalendarEvent, { EVENT_TYPES, PRIORITIES, REMINDERS, REPEATS } from '@/models/CalendarEvent';

const DEFAULT_COLOR = '#2563eb';
const COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function startOfDay(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function normalizeEnum(value, allowed, fallback) {
  const text = String(value || '').trim();
  return allowed.includes(text) ? text : fallback;
}

function normalizePayload(body = {}) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Event title is required');

  const startDate = startOfDay(body.startDate);
  const endDate = endOfDay(body.endDate || body.startDate);
  if (!startDate || !endDate) throw new Error('Valid start and end dates are required');
  if (endDate < startDate) throw new Error('End date cannot be before start date');

  const color = String(body.color || DEFAULT_COLOR).trim();
  return {
    title,
    description: String(body.description || '').trim(),
    startDate,
    endDate,
    startTime: String(body.startTime || '').trim(),
    endTime: String(body.endTime || '').trim(),
    type: normalizeEnum(body.type, EVENT_TYPES, 'Reminder'),
    priority: normalizeEnum(body.priority, PRIORITIES, 'Medium'),
    reminder: normalizeEnum(body.reminder, REMINDERS, 'None'),
    repeat: normalizeEnum(body.repeat, REPEATS, 'None'),
    notes: String(body.notes || '').trim(),
    color: COLOR_RE.test(color) ? color : DEFAULT_COLOR
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
      .trim()
      .toLowerCase();
    const url = new URL(req.url);
    const from = startOfDay(url.searchParams.get('from')) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = endOfDay(url.searchParams.get('to')) || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

    await connectDB();
    const events = await CalendarEvent.find({
      userEmail,
      startDate: { $lte: to },
      endDate: { $gte: from }
    })
      .sort({ startDate: 1, startTime: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, events });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load calendar events' }, { status: 400 });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
      .trim()
      .toLowerCase();
    const payload = normalizePayload(await req.json().catch(() => ({})));

    await connectDB();
    const event = await CalendarEvent.create({
      ...payload,
      userId: auth.currentUser?._id || null,
      userEmail
    });

    return NextResponse.json({ ok: true, event }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to save calendar event' }, { status: 400 });
  }
}
