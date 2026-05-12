import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { stopCampaignRunner } from '@/lib/campaignRunner';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import {
  buildTimeline,
  ensureRecipientLogsForCampaign,
  serializeCampaignForList
} from '@/core-lib/campaign-engine/CampaignAnalyticsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function jsonError({ status = 400, code = 'CAMPAIGN_REQUEST_FAILED', message = 'Campaign request failed.', campaignId = '', userEmail = '' }) {
  console.error(`[api/campaigns/[id]] ${code}: ${message}`, { campaignId, userEmail });
  return NextResponse.json({ success: false, code, message, error: message }, { status, headers: NO_STORE_HEADERS });
}

async function getCampaignForCurrentUser(req, params) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return { errorResponse: auth.errorResponse };
  const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
  const campaignId = String(params?.id || '').trim();
  if (!mongoose.isValidObjectId(campaignId)) {
    return {
      errorResponse: jsonError({
        status: 400,
        code: 'INVALID_CAMPAIGN_ID',
        message: 'Invalid campaign id.',
        campaignId,
        userEmail
      })
    };
  }
  await connectDB();
  const campaign = await Campaign.findOne(buildAuthOwnerFilter(auth, { _id: campaignId }));
  return { campaign, campaignId, userEmail, auth };
}

export async function GET(req, { params }) {
  let campaignId = String(params?.id || '').trim();
  let userEmail = '';
  try {
    const result = await getCampaignForCurrentUser(req, params);
    const { campaign, errorResponse } = result;
    campaignId = result.campaignId || campaignId;
    userEmail = result.userEmail || '';
    if (errorResponse) return errorResponse;
    if (!campaign) {
      return jsonError({
        status: 404,
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found for current user.',
        campaignId,
        userEmail
      });
    }

    const rawCampaign = campaign.toObject ? campaign.toObject() : campaign;
    const recipientLogs = await ensureRecipientLogsForCampaign(rawCampaign);
    const summary = serializeCampaignForList(rawCampaign, recipientLogs);
    const timeline = buildTimeline(rawCampaign, recipientLogs);

    return NextResponse.json({
      success: true,
      campaign: summary,
      summary,
      recipients: recipientLogs,
      timeline,
      lastUpdatedAt: new Date()
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError({
      status: 500,
      code: 'CAMPAIGN_DETAIL_LOAD_FAILED',
      message: error.message || 'Unable to load campaign details.',
      campaignId,
      userEmail
    });
  }
}

export async function DELETE(req, { params }) {
  const { campaign, campaignId, userEmail, errorResponse } = await getCampaignForCurrentUser(req, params);
  if (errorResponse) return errorResponse;
  if (!campaign) {
    return jsonError({
      status: 404,
      code: 'CAMPAIGN_NOT_FOUND',
      message: 'Campaign not found for current user.',
      campaignId,
      userEmail
    });
  }

  if (campaign.status === 'Running' || campaign.status === 'Paused') {
    await stopCampaignRunner(String(campaign._id));
  }

  await Campaign.deleteOne({ _id: campaign._id });
  return NextResponse.json({ success: true, ok: true, deletedId: String(campaign._id) }, { headers: NO_STORE_HEADERS });
}
