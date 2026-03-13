import { NextResponse } from 'next/server';
import connectDB from '../../../../../lib/mongodb';
import Campaign from '../../../../../models/Campaign';
import { startCampaignRunner } from '../../../../../lib/campaignRunner';

export async function POST(_, { params }) {
  await connectDB();
  const campaign = await Campaign.findById(params.id);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }
  if (campaign.status === 'Running') {
    return NextResponse.json({ error: 'Campaign is already running' }, { status: 400 });
  }

  try {
    const result = await startCampaignRunner(String(campaign._id));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
