import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState, startCampaignRunner } from '@/lib/campaignRunner';
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
  if (String(campaign.status || '') === 'Running' && !runner?.running) {
    try {
      await startCampaignRunner(String(campaign._id), { trigger: 'recovery' });
      campaign = await Campaign.findOne({ _id: params.id, userEmail }).lean();
      runner = getRunnerState(String(campaign._id));
    } catch (error) {
      // Keep returning current campaign state; recovery failures are captured in campaign logs.
    }
  }

  return NextResponse.json({ campaign, runner });
}
