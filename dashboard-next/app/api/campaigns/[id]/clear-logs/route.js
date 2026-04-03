import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { requireUser } from '@/lib/apiAuth';

export async function POST(req, { params }) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    if (!params?.id) {
      return NextResponse.json({ error: 'Campaign id is required' }, { status: 400 });
    }

    await connectDB();
    const campaign = await Campaign.findOne({ _id: params.id, userEmail });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    campaign.logs = [];
    campaign.stats = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0
    };
    campaign.startedAt = null;
    campaign.finishedAt = null;
    if (campaign.status !== 'Running' && campaign.status !== 'Paused') {
      campaign.status = 'Draft';
    }
    await campaign.save();

    return NextResponse.json({ ok: true, campaignId: String(campaign._id) });
  } catch (error) {
    console.error('Failed to clear campaign logs:', error);
    return NextResponse.json({ error: error.message || 'Failed to clear campaign logs' }, { status: 500 });
  }
}
