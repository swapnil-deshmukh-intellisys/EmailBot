import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import {
  getVisibleTask,
  jsonError,
  NO_STORE_HEADERS,
  normalizePatch,
  serializeTask
} from '../_timelineTaskApi';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PATCH(req, { params }) {
  try {
    await connectDB();
    const { task, identity, errorResponse } = await getVisibleTask(req, params?.id);
    if (errorResponse) return errorResponse;
    Object.assign(task, normalizePatch(await req.json().catch(() => ({})), identity));
    await task.save();
    return NextResponse.json({ ok: true, task: serializeTask(task) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError(error.message || 'Failed to update timeline task.');
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const { task, errorResponse } = await getVisibleTask(req, params?.id);
    if (errorResponse) return errorResponse;
    await task.deleteOne();
    return NextResponse.json({ ok: true, deleted: true }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError(error.message || 'Failed to delete timeline task.');
  }
}
