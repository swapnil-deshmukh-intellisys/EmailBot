import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { resumeCampaignRunner, validateCampaignExecutionPreflight } from '@/lib/campaignRunner';
import { triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { requireUser } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function jsonError({ status = 400, code = 'CAMPAIGN_RESUME_FAILED', message = 'Unable to resume campaign.' }) {
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

  const result = await resumeCampaignRunner(String(campaign._id));
  if (!result.ok) {
    try {
      await validateCampaignExecutionPreflight(campaign, { userEmail });
      campaign.status = 'Queued';
      campaign.pauseReason = '';
      campaign.lastActivityAt = new Date();
      campaign.queueRequestedAt = new Date();
      campaign.workerLockedAt = null;
      campaign.workerHeartbeatAt = null;
      campaign.workerId = '';
      campaign.finishedAt = null;
      campaign.logs.push({ level: 'info', message: 'Campaign re-queued for server worker', at: new Date() });
      await campaign.save();
      await triggerCampaignSchedulerTick();
      return NextResponse.json({
        success: true,
        ok: true,
        queued: true,
        message: 'Campaign resumed and queued. Worker will process it shortly.'
      }, { headers: NO_STORE_HEADERS });
    } catch (error) {
      return jsonError({
        status: 400,
        code: 'CAMPAIGN_PREFLIGHT_FAILED',
        message: error.message || result.message || 'Unable to resume campaign.'
      });
    }
  }

  campaign.status = 'Running';
  campaign.pauseReason = '';
  campaign.lastActivityAt = new Date();
  campaign.logs.push({ level: 'info', message: 'Campaign resumed', at: new Date() });
  await campaign.save();

  return NextResponse.json({ success: true, ok: true, message: 'Campaign resumed.' }, { headers: NO_STORE_HEADERS });
}
