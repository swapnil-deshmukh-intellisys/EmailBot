import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WarmupConversation from '@/models/WarmupConversation';
import { requireAuth } from '@/lib/apiAuth';
import { processDueWarmupCommunications } from '@/core-lib/mail-engine/WarmupAutoCommunicationService';
import { normalizeProject, NO_STORE_HEADERS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const body = await req.json().catch(() => ({}));
    const projectId = normalizeProject(body.projectId || body.project || '');
    const conversationId = String(body.conversationId || '').trim();
    const force = Boolean(body.force);

    if (force) {
      const filter = {
        userEmail,
        status: { $in: ['pending', 'running', 'failed'] },
        $expr: { $lt: ['$currentMessageNumber', { $ifNull: ['$totalMessages', 10] }] }
      };
      if (projectId) filter.projectId = projectId;
      if (conversationId) filter._id = conversationId;
      await WarmupConversation.updateMany(filter, { $set: { status: 'running', nextMessageAt: new Date(), updatedAt: new Date(), lastError: '', failedReason: '' } });
    }

    const result = await processDueWarmupCommunications({ limit: Math.max(1, Math.min(100, Number(body.limit || 25) || 25)) });
    return NextResponse.json({ success: true, ...result }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to run warmup communication.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
