import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { stopCampaignRunner } from '@/lib/campaignRunner';
import { requireUser } from '@/lib/apiAuth';

export async function POST(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();
  const campaign = await Campaign.findOne({ _id: params.id, userEmail });
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const result = await stopCampaignRunner(String(campaign._id));
  if (!result.ok) {
    campaign.status = 'Stopped';
    campaign.logs.push({ level: 'info', message: 'Stop requested', at: new Date() });
    await campaign.save();
    return NextResponse.json({ ok: true, message: result.message || 'Stop requested' });
  }

  campaign.status = 'Stopped';
  campaign.logs.push({ level: 'info', message: 'Stop requested', at: new Date() });
  await campaign.save();

  return NextResponse.json({ ok: true });
}
