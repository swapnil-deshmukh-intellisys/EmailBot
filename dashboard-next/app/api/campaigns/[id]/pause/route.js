import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { pauseCampaignRunner } from '@/lib/campaignRunner';
import { requireUser } from '@/lib/apiAuth';

function jsonError({ status = 400, code = 'CAMPAIGN_PAUSE_FAILED', message = 'Unable to pause campaign.' }) {
  return NextResponse.json({ success: false, ok: false, code, message, error: message }, { status });
}

export async function POST(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  const campaignId = String(params?.id || '').trim();
  if (!mongoose.isValidObjectId(campaignId)) {
    return jsonError({ status: 400, code: 'INVALID_CAMPAIGN_ID', message: 'Invalid campaign id.' });
  }

  await connectDB();
  const campaign = await Campaign.findOne({ _id: campaignId, userEmail });
  if (!campaign) {
    return jsonError({ status: 404, code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found for current user.' });
  }

  const result = await pauseCampaignRunner(String(campaign._id));
  if (!result.ok) {
    campaign.status = 'Paused';
    campaign.pauseReason = 'Paused by user';
    campaign.lastActivityAt = new Date();
    campaign.logs.push({ level: 'info', message: 'Campaign paused', at: new Date() });
    await campaign.save();
    return NextResponse.json({ success: true, ok: true, message: result.message || 'Campaign paused.' });
  }

  campaign.status = 'Paused';
  campaign.pauseReason = 'Paused by user';
  campaign.lastActivityAt = new Date();
  campaign.logs.push({ level: 'info', message: 'Campaign paused', at: new Date() });
  await campaign.save();

  return NextResponse.json({ success: true, ok: true, message: 'Campaign paused.' });
}
