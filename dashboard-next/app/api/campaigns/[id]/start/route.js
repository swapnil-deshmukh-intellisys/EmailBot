import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState, validateCampaignExecutionPreflight } from '@/lib/campaignRunner';
import { triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { requireAuth } from '@/lib/apiAuth';

const ROUTE_NAME = 'POST /api/campaigns/[id]/start';

function logStartFailure({ campaignId = '', userEmail = '', code = '', message = '' }) {
  console.error(`[${ROUTE_NAME}] ${code}: ${message}`, { campaignId, userEmail });
}

function jsonError({
  status = 400,
  code = 'CAMPAIGN_START_FAILED',
  message = 'Start campaign failed.',
  campaignId = '',
  userEmail = ''
}) {
  logStartFailure({ campaignId, userEmail, code, message });
  return NextResponse.json(
    {
      success: false,
      code,
      message,
      error: message
    },
    { status }
  );
}

function resetWorkerFields(campaign) {
  campaign.queueRequestedAt = null;
  campaign.workerLockedAt = null;
  campaign.workerHeartbeatAt = null;
  campaign.workerId = '';
  campaign.finishedAt = null;
}

export async function POST(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
    .trim()
    .toLowerCase();
  const campaignId = String(params?.id || '').trim();

  if (!mongoose.isValidObjectId(campaignId)) {
    return jsonError({
      status: 400,
      code: 'INVALID_CAMPAIGN_ID',
      message: 'Invalid campaign id.',
      campaignId,
      userEmail
    });
  }

  await connectDB();
  const campaign = await Campaign.findOne({ _id: campaignId, userEmail });
  if (!campaign) {
    return jsonError({
      status: 404,
      code: 'CAMPAIGN_NOT_FOUND',
      message: 'Campaign not found for current user.',
      campaignId,
      userEmail
    });
  }

  if (campaign.status === 'Running') {
    const runner = getRunnerState(String(campaign._id));
    if (runner?.running) {
      return NextResponse.json({ success: true, ok: true, started: false, message: 'Campaign is already running.' });
    }

    try {
      await validateCampaignExecutionPreflight(campaign, { userEmail });
      campaign.status = 'Queued';
      resetWorkerFields(campaign);
      campaign.queueRequestedAt = new Date();
      campaign.logs.push({ level: 'info', message: 'Campaign re-queued because no active worker was found', at: new Date() });
      await campaign.save();
      await triggerCampaignSchedulerTick();
      return NextResponse.json({
        success: true,
        ok: true,
        queued: true,
        message: 'Campaign re-queued successfully.'
      });
    } catch (error) {
      return jsonError({
        status: 400,
        code: 'CAMPAIGN_PREFLIGHT_FAILED',
        message: error.message || 'Failed to re-queue campaign.',
        campaignId,
        userEmail
      });
    }
  }

  const scheduleMode = String(campaign.scheduleMode || 'send_now').trim().toLowerCase();
  const scheduledAt = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null;
  const isScheduledFuture =
    scheduleMode === 'scheduled' &&
    scheduledAt instanceof Date &&
    !Number.isNaN(scheduledAt.getTime()) &&
    scheduledAt.getTime() > Date.now();

  if (isScheduledFuture) {
    try {
      await validateCampaignExecutionPreflight(campaign, { userEmail });
    } catch (error) {
      return jsonError({
        status: 400,
        code: 'CAMPAIGN_PREFLIGHT_FAILED',
        message: error.message || 'Campaign preflight validation failed.',
        campaignId,
        userEmail
      });
    }

    campaign.status = 'Scheduled';
    resetWorkerFields(campaign);
    campaign.logs.push({ level: 'info', message: 'Campaign kept scheduled until its scheduled time', at: new Date() });
    await campaign.save();
    await triggerCampaignSchedulerTick();
    return NextResponse.json({
      success: true,
      ok: true,
      scheduled: true,
      started: false,
      message: 'Campaign scheduled successfully.'
    });
  }

  try {
    await validateCampaignExecutionPreflight(campaign, { userEmail });
    campaign.status = 'Queued';
    resetWorkerFields(campaign);
    campaign.queueRequestedAt = new Date();
    campaign.logs.push({ level: 'info', message: 'Campaign queued for server worker', at: new Date() });
    await campaign.save();
    await triggerCampaignSchedulerTick();
    return NextResponse.json({
      success: true,
      ok: true,
      queued: true,
      message: 'Campaign queued successfully.'
    });
  } catch (error) {
    return jsonError({
      status: 400,
      code: 'CAMPAIGN_PREFLIGHT_FAILED',
      message: error.message || 'Campaign preflight validation failed.',
      campaignId,
      userEmail
    });
  }
}
