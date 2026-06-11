import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getVisibleTask, jsonError, NO_STORE_HEADERS, serializeTask } from '../../_timelineTaskApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    const note = String(body.note || body.notes || '').trim();
    if (!note) return jsonError('Note text is required.');

    await connectDB();
    const { task, identity, errorResponse } = await getVisibleTask(req, params?.id);
    if (errorResponse) return errorResponse;

    const currentNotes = String(task.notes || '').trim();
    task.notes = currentNotes ? `${currentNotes}\n${note}` : note;
    task.noteHistory.push({
      note,
      createdBy: identity.name || identity.email || 'Self',
      createdByEmail: identity.email || '',
      createdAt: new Date()
    });
    await task.save();

    return NextResponse.json({ ok: true, task: serializeTask(task) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError(error.message || 'Failed to add timeline note.');
  }
}
