import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { pauseCampaignRunner } from '@/lib/campaignRunner';

export async function POST(_, { params }) {
  await connectDB();
  const campaign = await Campaign.findById(params.id);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const result = await pauseCampaignRunner(String(campaign._id));
  if (!result.ok) {
    campaign.status = 'Paused';
    campaign.logs.push({ level: 'info', message: 'Campaign paused', at: new Date() });
    await campaign.save();
    return NextResponse.json({ ok: true, message: result.message || 'Campaign paused' });
  }

  campaign.status = 'Paused';
  campaign.logs.push({ level: 'info', message: 'Campaign paused', at: new Date() });
  await campaign.save();

  return NextResponse.json({ ok: true });
}
