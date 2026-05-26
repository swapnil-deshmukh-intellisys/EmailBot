import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WarmupConversation from '@/models/WarmupConversation';
import WarmupMessage from '@/models/WarmupMessage';
import { requireAuth } from '@/lib/apiAuth';
import { processDueWarmupCommunications } from '@/core-lib/mail-engine/WarmupAutoCommunicationService';
import { normalizeProject, NO_STORE_HEADERS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    await processDueWarmupCommunications({ limit: 25 }).catch(() => null);
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const url = new URL(req.url);
    const projectId = normalizeProject(url.searchParams.get('projectId') || url.searchParams.get('project') || '');
    const query = { userEmail };
    if (projectId) query.projectId = projectId;
    const conversations = await WarmupConversation.find(query).sort({ updatedAt: -1 }).limit(200).lean();
    const ids = conversations.map((item) => item._id);
    const failedMessages = ids.length
      ? await WarmupMessage.countDocuments({ conversationId: { $in: ids }, status: 'failed' })
      : 0;
    const rows = conversations.map((item) => ({
      id: String(item._id),
      projectId: item.projectId,
      selectedSenderId: item.selectedSenderId || '',
      receiverAccountId: item.receiverAccountId || '',
      senderEmail: item.senderEmail,
      receiverEmail: item.receiverEmail,
      threadId: item.threadId,
      totalMessages: item.totalMessages,
      currentMessageNumber: item.currentMessageNumber,
      status: item.status,
      nextMessageAt: item.nextMessageAt,
      lastMessageAt: item.lastMessageAt,
      completedAt: item.completedAt || null,
      mode: item.mode,
      delayMinutes: item.delayMinutes,
      lastError: item.lastError || '',
      failedReason: item.failedReason || item.lastError || ''
    }));
    return NextResponse.json({
      success: true,
      conversations: rows,
      summary: {
        activeConversations: rows.filter((row) => ['pending', 'running'].includes(row.status)).length,
        completedConversations: rows.filter((row) => row.status === 'completed').length,
        failedMessages,
        nextScheduledMessageTime: rows.map((row) => row.nextMessageAt).filter(Boolean).sort()[0] || null
      }
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load warmup conversations.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
