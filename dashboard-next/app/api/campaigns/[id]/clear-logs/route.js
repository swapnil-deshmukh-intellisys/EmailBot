import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

export async function POST(req, { params }) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    if (!params?.id) {
      return NextResponse.json({ error: 'Campaign id is required' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    await connectDB();
    const campaign = await Campaign.findOne({ _id: params.id, userEmail });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404, headers: NO_STORE_HEADERS });
    }

    campaign.logs = [];
    campaign.stats = {
      total: 0,
      sent: 0,
      failed: 0,
      bounced: 0,
      spam: 0,
      pending: 0
    };
    campaign.totalRecipients = 0;
    campaign.sentCount = 0;
    campaign.pendingCount = 0;
    campaign.failedCount = 0;
    campaign.openCount = 0;
    campaign.replyCount = 0;
    campaign.lastActivityAt = new Date();
    campaign.startedAt = null;
    campaign.finishedAt = null;
    if (campaign.status !== 'Running' && campaign.status !== 'Paused') {
      campaign.status = 'Draft';
    }
    await campaign.save();

    return NextResponse.json({ ok: true, campaignId: String(campaign._id) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error('Failed to clear campaign logs:', error);
    return NextResponse.json({ error: error.message || 'Failed to clear campaign logs' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
