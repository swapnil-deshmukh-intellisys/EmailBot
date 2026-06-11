import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getVisibleTask, jsonError, NO_STORE_HEADERS, serializeTask } from '../../_timelineTaskApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req, { params }) {
  try {
    await connectDB();
    const { task, errorResponse } = await getVisibleTask(req, params?.id);
    if (errorResponse) return errorResponse;

    task.status = 'Completed';
    task.completedAt = new Date();
    await task.save();

    return NextResponse.json({ ok: true, task: serializeTask(task) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError(error.message || 'Failed to complete timeline task.');
  }
}
