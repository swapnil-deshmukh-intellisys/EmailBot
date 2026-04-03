import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { resumeCampaignRunner, startCampaignRunner } from '@/lib/campaignRunner';
import { requireUser } from '@/lib/apiAuth';

export async function POST(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();
  const campaign = await Campaign.findOne({ _id: params.id, userEmail });
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const result = await resumeCampaignRunner(String(campaign._id));
  if (!result.ok) {
    try {
      const started = await startCampaignRunner(String(campaign._id));
      campaign.status = 'Running';
      campaign.logs.push({ level: 'info', message: 'Campaign resumed', at: new Date() });
      await campaign.save();
      return NextResponse.json({ ok: true, ...started });
    } catch (error) {
      return NextResponse.json({ error: error.message || result.message || 'Failed to resume campaign' }, { status: 400 });
    }
  }

  campaign.status = 'Running';
  campaign.logs.push({ level: 'info', message: 'Campaign resumed', at: new Date() });
  await campaign.save();

  return NextResponse.json({ ok: true });
}
