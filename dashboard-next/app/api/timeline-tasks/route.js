import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import TimelineTask from '@/models/TimelineTask';
import {
  buildTaskQuery,
  jsonError,
  NO_STORE_HEADERS,
  normalizePayload,
  requireTimelineIdentity,
  serializeTask
} from './_timelineTaskApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const { identity, errorResponse } = await requireTimelineIdentity(req);
    if (errorResponse) return errorResponse;
    const { searchParams } = new URL(req.url);
    const query = buildTaskQuery(searchParams, identity);

    await connectDB();
    const tasks = await TimelineTask.find(query).sort({ dueDate: 1, dueTime: 1, createdAt: -1 }).lean();
    return NextResponse.json({ ok: true, tasks: tasks.map(serializeTask) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError(error.message || 'Failed to load timeline tasks.');
  }
}

export async function POST(req) {
  try {
    const { identity, errorResponse } = await requireTimelineIdentity(req);
    if (errorResponse) return errorResponse;
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
      return jsonError('This timeline task already exists.', 409);
    }

    const task = await TimelineTask.create({
      ...payload,
      userId: identity.userId,
      userEmail: identity.email
    });
    return NextResponse.json({ ok: true, task: serializeTask(task) }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError(error.message || 'Failed to create timeline task.');
  }
}
