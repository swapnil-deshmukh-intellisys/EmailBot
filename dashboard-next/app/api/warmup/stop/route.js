import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WarmupConversation from '@/models/WarmupConversation';
import { requireAuth } from '@/lib/apiAuth';
import { normalizeProject, NO_STORE_HEADERS } from '../_utils';

export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  await connectDB();
  const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
  const body = await req.json().catch(() => ({}));
  const projectId = normalizeProject(body.projectId || body.project || '');
  const filter = { userEmail, status: { $in: ['pending', 'running', 'paused'] } };
  if (projectId) filter.projectId = projectId;
  if (body.conversationId) filter._id = body.conversationId;
  const result = await WarmupConversation.updateMany(filter, { $set: { status: 'completed', nextMessageAt: null, updatedAt: new Date() } });
  return NextResponse.json({ success: true, stopped: result.modifiedCount }, { headers: NO_STORE_HEADERS });
}
