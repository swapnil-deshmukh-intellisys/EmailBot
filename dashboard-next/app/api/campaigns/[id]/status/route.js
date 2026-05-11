import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState } from '@/lib/campaignRunner';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { computeCampaignDisplayStatus } from '@/core-lib/campaign-engine/CampaignStatusSummary';

function jsonError({ status = 400, code = 'CAMPAIGN_STATUS_FAILED', message = 'Failed to load campaign status.', campaignId = '', userEmail = '' }) {
  console.error(`[GET /api/campaigns/[id]/status] ${code}: ${message}`, { campaignId, userEmail });
  return NextResponse.json({ success: false, code, message, error: message }, { status });
}

export async function GET(req, { params }) {
  const campaignId = String(params?.id || '').trim();
  let userEmail = '';

  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    if (!mongoose.isValidObjectId(campaignId)) {
      return jsonError({ status: 400, code: 'INVALID_CAMPAIGN_ID', message: 'Invalid campaign id.', campaignId, userEmail });
    }

    await connectDB();
    let campaign = await Campaign.findOne(buildAuthOwnerFilter(auth, { _id: campaignId })).lean();
    if (!campaign) {
      return jsonError({
        status: 404,
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found for current user.',
        campaignId,
        userEmail
      });
    }

    const displayStatus = computeCampaignDisplayStatus(campaign);
    campaign = { ...campaign, displayStatus };
    let runner = getRunnerState(String(campaign._id));

    return NextResponse.json({
      success: true,
      campaign,
      runner,
      status: campaign.status,
      displayStatus,
      workerStatus: campaign.workerStatus || '',
      queueReason: displayStatus === 'Queued' ? campaign.queueReason || '' : '',
      sentCount: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
      pendingCount: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
      failedCount: Number(campaign.failedCount ?? campaign.stats?.failed ?? 0),
      queueState: {
        workerId: String(campaign?.workerId || ''),
        workerStatus: String(campaign?.workerStatus || ''),
        workerLockedBy: String(campaign?.workerLockedBy || ''),
        workerLockedAt: campaign?.workerLockedAt || null,
        workerHeartbeatAt: campaign?.workerHeartbeatAt || null,
        queueRequestedAt: campaign?.queueRequestedAt || null,
        queueReason: displayStatus === 'Queued' ? campaign?.queueReason || '' : ''
      }
    });
  } catch (error) {
    return jsonError({
      status: 500,
      code: 'CAMPAIGN_STATUS_FAILED',
      message: error.message || 'Failed to load campaign status.',
      campaignId,
      userEmail
    });
  }
}
