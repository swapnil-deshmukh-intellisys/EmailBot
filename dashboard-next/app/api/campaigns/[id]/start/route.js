import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState, startCampaignRunner } from '@/lib/campaignRunner';
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
    // Recover after server restart: DB says Running but in-memory runner is gone.
    campaign.status = 'Paused';
    campaign.logs.push({ level: 'info', message: 'Recovered stale running state. Restarting campaign runner.', at: new Date() });
    await campaign.save();
  }

  try {
    const result = await startCampaignRunner(String(campaign._id));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
