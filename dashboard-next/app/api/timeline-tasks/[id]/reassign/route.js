import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { canAssignOthers, getVisibleTask, jsonError, NO_STORE_HEADERS, serializeTask } from '../../_timelineTaskApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));

    await connectDB();
    const { task, identity, errorResponse } = await getVisibleTask(req, params?.id);
    if (errorResponse) return errorResponse;
    if (!canAssignOthers(identity)) {
      return jsonError('Only a manager or admin can reassign tasks.', 403);
    }

    const assignedToUserId = String(body.assignedToUserId || '').trim();
    const assignedToEmail = String(body.assignedToEmail || '').trim().toLowerCase();
    const assignedToName = String(body.assignedToName || '').trim();
    if (!assignedToUserId && !assignedToEmail && !assignedToName) {
      return jsonError('Assigned user details are required.');
    }

    task.assignedToUserId = assignedToUserId || assignedToEmail || assignedToName;
    task.assignedToEmail = assignedToEmail;
    task.assignedToName = assignedToName || assignedToEmail || assignedToUserId;
    task.assignedTo = task.assignedToName || task.assignedToEmail || task.assignedToUserId;
    task.assignedByUserId = identity.userId;
    task.assignedByEmail = identity.email || '';
    task.assignedByName = identity.name || identity.email || 'Self';
    task.assignedBy = task.assignedByName || task.assignedByEmail || 'Self';
    task.lastReminderMessage = `Assigned to ${task.assignedTo}`;
    await task.save();

    return NextResponse.json({ ok: true, task: serializeTask(task) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError(error.message || 'Failed to reassign timeline task.');
  }
}
