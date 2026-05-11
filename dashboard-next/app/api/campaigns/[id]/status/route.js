import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState } from '@/lib/campaignRunner';
import { requireAuth } from '@/lib/apiAuth';

function jsonError({ status = 400, code = 'CAMPAIGN_STATUS_FAILED', message = 'Failed to load campaign status.', campaignId = '', userEmail = '' }) {
  console.error(`[GET /api/campaigns/[id]/status] ${code}: ${message}`, { campaignId, userEmail });
  return NextResponse.json({ success: false, code, message, error: message }, { status });
}

export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
  const campaignId = String(params?.id || '').trim();
  if (!mongoose.isValidObjectId(campaignId)) {
    return jsonError({ status: 400, code: 'INVALID_CAMPAIGN_ID', message: 'Invalid campaign id.', campaignId, userEmail });
  }

  await connectDB();
  let campaign = await Campaign.findOne({ _id: campaignId, userEmail }).lean();
  if (!campaign) {
    return jsonError({
      status: 404,
      code: 'CAMPAIGN_NOT_FOUND',
      message: 'Campaign not found for current user.',
      campaignId,
      userEmail
    });
  }

  let runner = getRunnerState(String(campaign._id));

  return NextResponse.json({
    success: true,
    campaign,
    runner,
    queueState: {
      workerId: String(campaign?.workerId || ''),
      workerLockedAt: campaign?.workerLockedAt || null,
      workerHeartbeatAt: campaign?.workerHeartbeatAt || null,
      queueRequestedAt: campaign?.queueRequestedAt || null
    }
  });
}
