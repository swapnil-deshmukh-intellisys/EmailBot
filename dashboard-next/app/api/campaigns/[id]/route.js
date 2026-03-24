import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { stopCampaignRunner } from '@/lib/campaignRunner';

export async function DELETE(_, { params }) {
  await connectDB();

  const campaign = await Campaign.findById(params.id);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  if (campaign.status === 'Running' || campaign.status === 'Paused') {
    await stopCampaignRunner(String(campaign._id));
  }

  await Campaign.deleteOne({ _id: campaign._id });
  return NextResponse.json({ ok: true, deletedId: String(campaign._id) });
}
