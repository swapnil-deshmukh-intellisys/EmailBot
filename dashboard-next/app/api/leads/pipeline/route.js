import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate', Pragma: 'no-cache', Expires: '0', 'Surrogate-Control': 'no-store' };

const STAGES = ['New Response', 'Interested', 'Follow-up Needed', 'Proposal Sent', 'Negotiation', 'Converted', 'Not Interested', 'Closed'];

function inferStage(log = {}) {
  const replyType = String(log.replyType || '').toLowerCase();
  const status = String(log.status || '').toLowerCase();
  const notes = String(log.notes || log.replyPreview || '').toLowerCase();
  if (replyType.includes('positive') || notes.includes('interested')) return 'Interested';
  if (replyType.includes('negative') || notes.includes('not interested') || log.unsubscribe || log.dnc) return 'Not Interested';
  if (status.includes('proposal')) return 'Proposal Sent';
  if (status.includes('converted')) return 'Converted';
  if (status.includes('closed')) return 'Closed';
  if (log.followUpStopped) return 'Closed';
  if (log.replyReceived) return 'New Response';
  return 'Follow-up Needed';
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const logs = await CampaignRecipientLog.find(buildAuthOwnerFilter(auth, { $or: [{ replyReceived: true }, { replyCount: { $gt: 0 } }, { lastReplyAt: { $ne: null } }] }))
      .select('campaignName projectName recipientEmail recipientName clientName email company status replyType replyPreview lastReplyAt updatedAt notes userEmail followUpStopped unsubscribe dnc')
      .sort({ lastReplyAt: -1, updatedAt: -1 })
      .limit(300)
      .lean();
    const stages = STAGES.map((stage) => ({ stage, count: 0, cards: [] }));
    const stageMap = new Map(stages.map((item) => [item.stage, item]));
    logs.forEach((log) => {
      const stage = inferStage(log);
      const bucket = stageMap.get(stage) || stageMap.get('New Response');
      bucket.count += 1;
      bucket.cards.push({
        id: String(log._id),
        clientName: log.clientName || log.recipientName || log.email || 'Client',
        email: log.recipientEmail || log.email,
        company: log.company || '-',
        campaignName: log.campaignName || '-',
        responseStatus: log.replyType || log.status || 'Response',
        lastReplyDate: log.lastReplyAt || log.updatedAt || null,
        assignedUser: log.userEmail || 'Team',
        nextFollowUpDate: null,
        preview: log.replyPreview || log.notes || ''
      });
    });
    return NextResponse.json({ ok: true, stages }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, stages: STAGES.map((stage) => ({ stage, count: 0, cards: [] })), error: error.message || 'Failed to load lead pipeline' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
