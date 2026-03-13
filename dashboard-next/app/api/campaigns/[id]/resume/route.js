import { NextResponse } from 'next/server';
import connectDB from '../../../../../lib/mongodb';
import Campaign from '../../../../../models/Campaign';
import { resumeCampaignRunner } from '../../../../../lib/campaignRunner';

export async function POST(_, { params }) {
  await connectDB();
  const campaign = await Campaign.findById(params.id);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const result = await resumeCampaignRunner(String(campaign._id));
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  campaign.status = 'Running';
  campaign.logs.push({ level: 'info', message: 'Campaign resumed', at: new Date() });
  await campaign.save();

  return NextResponse.json({ ok: true });
}
