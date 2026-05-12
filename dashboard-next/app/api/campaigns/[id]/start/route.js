import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState, validateCampaignExecutionPreflight } from '@/lib/campaignRunner';
import { triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { computeCampaignDisplayStatus } from '@/core-lib/campaign-engine/CampaignStatusSummary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROUTE_NAME = 'POST /api/campaigns/[id]/start';
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

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
    { status, headers: NO_STORE_HEADERS }
  );
}

function resetWorkerFields(campaign) {
  campaign.queueRequestedAt = null;
  campaign.queueReason = '';
  campaign.workerLockedAt = null;
  campaign.workerHeartbeatAt = null;
  campaign.workerId = '';
  campaign.workerLockedBy = '';
  campaign.workerStatus = '';
  campaign.finishedAt = null;
}

export async function POST(req, { params }) {
  const campaignId = String(params?.id || '').trim();
  let userEmail = '';

  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
      .trim()
      .toLowerCase();

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
    const campaign = await Campaign.findOne(buildAuthOwnerFilter(auth, { _id: campaignId }));
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
        return NextResponse.json({
          success: true,
          ok: true,
          started: false,
          status: campaign.status,
          displayStatus: computeCampaignDisplayStatus(campaign),
          workerStatus: campaign.workerStatus || '',
          queueReason: '',
          sentCount: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
          pendingCount: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
          failedCount: Number(campaign.failedCount ?? campaign.stats?.failed ?? 0),
          message: 'Campaign is already running.'
        }, { headers: NO_STORE_HEADERS });
      }

      await validateCampaignExecutionPreflight(campaign, { userEmail });
      campaign.status = 'Queued';
      resetWorkerFields(campaign);
      campaign.queueRequestedAt = new Date();
      campaign.queueReason = 'Queued because no active worker was found for a Running campaign';
      campaign.logs.push({ level: 'info', message: 'Campaign re-queued because no active worker was found', at: new Date() });
      await campaign.save();
      await triggerCampaignSchedulerTick();
      return NextResponse.json({
        success: true,
        ok: true,
        queued: true,
        status: campaign.status,
        displayStatus: computeCampaignDisplayStatus(campaign),
        workerStatus: campaign.workerStatus || '',
        queueReason: campaign.queueReason,
        sentCount: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
        pendingCount: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
        failedCount: Number(campaign.failedCount ?? campaign.stats?.failed ?? 0),
        message: 'Campaign re-queued successfully.'
      }, { headers: NO_STORE_HEADERS });
    }

    const scheduleMode = String(campaign.scheduleMode || 'send_now').trim().toLowerCase();
    const scheduledAt = campaign.scheduledAt ? new Date(campaign.scheduledAt) : null;
    const isScheduledFuture =
      scheduleMode === 'scheduled' &&
      scheduledAt instanceof Date &&
      !Number.isNaN(scheduledAt.getTime()) &&
      scheduledAt.getTime() > Date.now();

    await validateCampaignExecutionPreflight(campaign, { userEmail });

    if (isScheduledFuture) {
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
        status: campaign.status,
        displayStatus: computeCampaignDisplayStatus(campaign),
        workerStatus: campaign.workerStatus || '',
        queueReason: '',
        sentCount: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
        pendingCount: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
        failedCount: Number(campaign.failedCount ?? campaign.stats?.failed ?? 0),
        message: 'Campaign scheduled successfully.'
      }, { headers: NO_STORE_HEADERS });
    }

    campaign.status = 'Queued';
    resetWorkerFields(campaign);
    campaign.queueRequestedAt = new Date();
    campaign.queueReason = 'Queued by user start request';
    campaign.logs.push({ level: 'info', message: 'Campaign queued for server worker', at: new Date() });
    await campaign.save();
    await triggerCampaignSchedulerTick();
    return NextResponse.json({
      success: true,
      ok: true,
      queued: true,
      status: campaign.status,
      displayStatus: computeCampaignDisplayStatus(campaign),
      workerStatus: campaign.workerStatus || '',
      queueReason: campaign.queueReason,
      sentCount: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
      pendingCount: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
      failedCount: Number(campaign.failedCount ?? campaign.stats?.failed ?? 0),
      message: 'Campaign queued successfully.'
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const isValidationError = !error?.name || error.name === 'Error' || error.name === 'ValidationError';
    return jsonError({
      status: error?.name === 'CastError' || isValidationError ? 400 : 500,
      code: error?.name === 'CastError' ? 'INVALID_CAMPAIGN_ID' : isValidationError ? 'CAMPAIGN_PREFLIGHT_FAILED' : 'CAMPAIGN_START_FAILED',
      message: error.message || 'Campaign start failed.',
      campaignId,
      userEmail
    });
  }
}
