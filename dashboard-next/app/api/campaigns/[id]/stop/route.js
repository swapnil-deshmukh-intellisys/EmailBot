import { NextResponse } from 'next/server';
import connectDB from '../../../../../lib/mongodb';
import Campaign from '../../../../../models/Campaign';
import { stopCampaignRunner } from '../../../../../lib/campaignRunner';

export async function POST(_, { params }) {
  await connectDB();
  const campaign = await Campaign.findById(params.id);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const result = await stopCampaignRunner(String(campaign._id));
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  campaign.status = 'Paused';
  campaign.logs.push({ level: 'info', message: 'Stop requested', at: new Date() });
  await campaign.save();

  return NextResponse.json({ ok: true });
}
