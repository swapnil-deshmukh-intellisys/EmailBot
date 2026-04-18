import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState } from '@/lib/campaignRunner';
import { triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { requireUser } from '@/lib/apiAuth';

export async function GET(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;

  await connectDB();
  let campaign = await Campaign.findOne({ _id: params.id, userEmail }).lean();
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  let runner = getRunnerState(String(campaign._id));
  if (['Queued', 'Scheduled'].includes(String(campaign.status || ''))) {
    await triggerCampaignSchedulerTick();
    campaign = await Campaign.findOne({ _id: params.id, userEmail }).lean();
    runner = getRunnerState(String(campaign._id));
  }

  return NextResponse.json({
    campaign,
    runner,
    queueState: {
      workerId: String(campaign?.workerId || ''),
      workerLockedAt: campaign?.workerLockedAt || null,
      workerHeartbeatAt: campaign?.workerHeartbeatAt || null,
      queueRequestedAt: campaign?.queueRequestedAt || null
    }
  });
}
