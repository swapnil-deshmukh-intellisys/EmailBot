import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { stopCampaignRunner } from '@/lib/campaignRunner';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function jsonError({ status = 400, code = 'CAMPAIGN_STOP_FAILED', message = 'Unable to stop campaign.' }) {
  return NextResponse.json({ success: false, ok: false, code, message, error: message }, { status, headers: NO_STORE_HEADERS });
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

  const result = await stopCampaignRunner(String(campaign._id));
  if (!result.ok) {
    campaign.status = 'Stopped';
    campaign.stopReason = 'Manual stop by user';
    campaign.lastActivityAt = new Date();
    campaign.logs.push({ level: 'info', message: 'Stop requested', at: new Date() });
    await campaign.save();
    return NextResponse.json({ success: true, ok: true, message: result.message || 'Stop requested.' }, { headers: NO_STORE_HEADERS });
  }

  campaign.status = 'Stopped';
  campaign.stopReason = 'Manual stop by user';
  campaign.lastActivityAt = new Date();
  campaign.logs.push({ level: 'info', message: 'Stop requested', at: new Date() });
  await campaign.save();

  return NextResponse.json({ success: true, ok: true, message: 'Stop requested.' }, { headers: NO_STORE_HEADERS });
}
