import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState, validateCampaignExecutionPreflight } from '@/lib/campaignRunner';
import { triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { requireUser } from '@/lib/apiAuth';

export async function POST(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();
  const campaign = await Campaign.findOne({ _id: params.id, userEmail });
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (campaign.status === 'Running') {
    const runner = getRunnerState(String(campaign._id));
    if (runner?.running) {
      return NextResponse.json({ ok: true, started: false, message: 'Campaign is already running' });
    }
    return NextResponse.json({
      ok: true,
      started: false,
      message: 'Campaign is already marked running. Use the worker/scheduler to continue it.'
    });
  }

  try {
    await validateCampaignExecutionPreflight(campaign);
    campaign.status = 'Queued';
    campaign.queueRequestedAt = new Date();
    campaign.workerLockedAt = null;
    campaign.workerHeartbeatAt = null;
    campaign.workerId = '';
    campaign.finishedAt = null;
    campaign.logs.push({ level: 'info', message: 'Campaign queued for server worker', at: new Date() });
    await campaign.save();
    await triggerCampaignSchedulerTick();
    return NextResponse.json({
      ok: true,
      queued: true,
      message: 'Campaign queued successfully.'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
