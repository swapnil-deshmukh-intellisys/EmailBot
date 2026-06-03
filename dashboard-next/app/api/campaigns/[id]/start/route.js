import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState, startCampaignRunner, validateCampaignExecutionPreflight } from '@/lib/campaignRunner';
import { isInAppCampaignSchedulerEnabled, triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { computeCampaignDisplayStatus } from '@/core-lib/campaign-engine/CampaignStatusSummary';
import {
  buildScheduledDateTimeInZone,
  buildScheduledLabel,
  convertDelayIntervalToSeconds,
  isFutureScheduledDate,
  normalizeDurationUnit
} from '@/modules/campaign-module/campaign-utils/CampaignScheduleHelper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROUTE_NAME = 'POST /api/campaigns/[id]/start';
const MIN_CAMPAIGN_SEND_GAP_SECONDS = 60;
const SCHEDULE_START_GRACE_MS = 90 * 1000;
const MAX_SCHEDULE_DELAY_MINUTES = 1440;
const MAX_SCHEDULE_DELAY_HOURS = 24;
const MAX_SCHEDULE_DELAY_SECONDS = 86400;
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function getScheduleDelayLimit(unit = 'minutes') {
  const normalizedUnit = normalizeDurationUnit(unit);
  if (normalizedUnit === 'hours') return MAX_SCHEDULE_DELAY_HOURS;
  if (normalizedUnit === 'seconds') return MAX_SCHEDULE_DELAY_SECONDS;
  return MAX_SCHEDULE_DELAY_MINUTES;
}

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
      ok: false,
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

async function readRequestBody(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function applyStartSchedulePayload(campaign, body = {}) {
  const hasSchedulePayload =
    body &&
    typeof body === 'object' &&
    (
      body.scheduleMode ||
      body.mode ||
      body.scheduledAt ||
      body.scheduledDate ||
      body.scheduledTime ||
      body.batchSize ||
      body.delayInterval ||
      body.options
    );

  if (!hasSchedulePayload) {
    return { ok: true, scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt) : null };
  }

  const normalizedScheduleMode = String(body?.scheduleMode || body?.mode || 'send_now').trim().toLowerCase() === 'scheduled'
    ? 'scheduled'
    : 'send_now';
  const normalizedCountry = String(body?.country || campaign.country || 'India').trim() || 'India';
  const normalizedTimezone = String(body?.timezone || body?.scheduledStart?.timezone || campaign.timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata';
  const normalizedSlot = String(body?.slot || body?.scheduledTime || body?.scheduledStart?.slot || '').trim();
  const normalizedDateValue = String(body?.scheduledDate || '').trim();
  const durationUnit = normalizeDurationUnit(body?.durationUnit || body?.options?.durationUnit || campaign.options?.durationUnit || 'seconds');
  const delayIntervalInput = Math.max(1, Math.floor(Number(body?.delayInterval ?? body?.options?.delayInterval ?? campaign.options?.delayInterval ?? MIN_CAMPAIGN_SEND_GAP_SECONDS) || MIN_CAMPAIGN_SEND_GAP_SECONDS));
  if (delayIntervalInput > getScheduleDelayLimit(durationUnit)) {
    return {
      ok: false,
      code: 'DELAY_INTERVAL_TOO_LARGE',
      message: `Delay interval cannot be more than ${getScheduleDelayLimit(durationUnit)} ${durationUnit}.`
    };
  }
  const batchSize = Math.max(1, Math.floor(Number(body?.batchSize ?? body?.options?.batchSize ?? campaign.options?.batchSize ?? 1) || 1));
  const delaySeconds = Math.max(
    MIN_CAMPAIGN_SEND_GAP_SECONDS,
    convertDelayIntervalToSeconds(delayIntervalInput, durationUnit)
  );
  const delayInterval = durationUnit === 'seconds'
    ? Math.max(MIN_CAMPAIGN_SEND_GAP_SECONDS, delayIntervalInput)
    : delayIntervalInput;
  const scheduledInput =
    body?.scheduledAt ??
    body?.at ??
    body?.scheduledStartAt ??
    body?.scheduledStart?.at ??
    null;

  let scheduledAt = normalizedScheduleMode === 'scheduled'
    ? (scheduledInput
        ? new Date(scheduledInput)
        : buildScheduledDateTimeInZone(normalizedDateValue, normalizedSlot, normalizedTimezone))
    : null;
  let queueImmediately = false;

  if (normalizedScheduleMode === 'scheduled') {
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return { ok: false, code: 'INVALID_SCHEDULE_TIME', message: 'Please select scheduled date and time.' };
    }

    const now = new Date();
    if (!isFutureScheduledDate(scheduledAt)) {
      const pastByMs = now.getTime() - scheduledAt.getTime();
      if (pastByMs >= 0 && pastByMs <= SCHEDULE_START_GRACE_MS) {
        scheduledAt = now;
        queueImmediately = true;
      } else {
        return {
          ok: false,
          code: 'SCHEDULE_TIME_NOT_FUTURE',
          message: 'Scheduled time must be in future. Pick a later time or use Send now.'
        };
      }
    }
  }

  const scheduledLabel = buildScheduledLabel({
    country: normalizedCountry,
    timeZone: normalizedTimezone,
    dateValue: normalizedDateValue,
    timeValue: normalizedSlot,
    scheduledAt
  });

  campaign.scheduleMode = normalizedScheduleMode;
  campaign.country = normalizedCountry;
  campaign.timezone = normalizedTimezone;
  campaign.scheduledAt = normalizedScheduleMode === 'scheduled' ? scheduledAt : null;
  campaign.scheduledStart = {
    country: normalizedCountry,
    slot: normalizedSlot,
    timezone: normalizedTimezone,
    label: normalizedScheduleMode === 'scheduled' ? scheduledLabel : '',
    at: normalizedScheduleMode === 'scheduled' ? scheduledAt : null
  };
  campaign.options = campaign.options || {};
  campaign.options.batchSize = batchSize;
  campaign.options.delayInterval = delayInterval;
  campaign.options.durationUnit = durationUnit;
  campaign.options.delaySeconds = delaySeconds;
  if (typeof body?.replyMode === 'boolean') {
    campaign.options.replyMode = body.replyMode;
  }

  campaign.logs = campaign.logs || [];
  campaign.logs.push({
    level: 'info',
    message: normalizedScheduleMode === 'scheduled'
      ? `Start settings applied: scheduled for ${scheduledLabel}`
      : `Start settings applied: send now | batch ${batchSize} | delay ${delayInterval} ${durationUnit}`,
    at: new Date()
  });

  return { ok: true, scheduledAt, queueImmediately };
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

    const body = await readRequestBody(req);
    const schedulePayloadResult = applyStartSchedulePayload(campaign, body);
    if (!schedulePayloadResult.ok) {
      return jsonError({
        status: 400,
        code: schedulePayloadResult.code || 'INVALID_START_SCHEDULE',
        message: schedulePayloadResult.message || 'Invalid start schedule.',
        campaignId,
        userEmail
      });
    }

    if (['Completed', 'Stopped'].includes(String(campaign.status || ''))) {
      return jsonError({
        status: 409,
        code: 'CAMPAIGN_ALREADY_FINISHED',
        message: `Campaign is already ${campaign.status}. Create a new campaign to send this list again.`,
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
      if (!isInAppCampaignSchedulerEnabled()) {
        return NextResponse.json({
          success: true,
          ok: true,
          queued: true,
          started: false,
          status: campaign.status,
          displayStatus: computeCampaignDisplayStatus(campaign),
          workerStatus: campaign.workerStatus || '',
          queueReason: campaign.queueReason,
          sentCount: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
          pendingCount: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
          failedCount: Number(campaign.failedCount ?? campaign.stats?.failed ?? 0),
          warning: 'Campaign queued. Worker will process it shortly. If it is not picked within 2 minutes, check the campaign worker process.',
          message: 'Campaign queued. Worker will process it shortly.'
        }, { headers: NO_STORE_HEADERS });
      }
      await startCampaignRunner(String(campaign._id), { trigger: 'manual' });
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
      const schedulerWarning = !isInAppCampaignSchedulerEnabled()
        ? 'In-app campaign scheduler is disabled on this process. Ensure the PM2 campaign worker is running, or this scheduled campaign will not auto-start.'
        : '';
      campaign.status = 'Scheduled';
      resetWorkerFields(campaign);
      campaign.logs.push({
        level: schedulerWarning ? 'warning' : 'info',
        message: schedulerWarning || 'Campaign kept scheduled until its scheduled time',
        at: new Date()
      });
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
        warning: schedulerWarning,
        message: schedulerWarning || 'Campaign scheduled successfully.'
      }, { headers: NO_STORE_HEADERS });
    }

    campaign.status = 'Queued';
    resetWorkerFields(campaign);
    campaign.queueRequestedAt = new Date();
    campaign.queueReason = 'Queued by user start request';
    campaign.logs.push({ level: 'info', message: 'Campaign queued for server worker', at: new Date() });
    await campaign.save();
    if (!isInAppCampaignSchedulerEnabled()) {
      return NextResponse.json({
        success: true,
        ok: true,
        queued: true,
        started: false,
        status: campaign.status,
        displayStatus: computeCampaignDisplayStatus(campaign),
        workerStatus: campaign.workerStatus || '',
        queueReason: campaign.queueReason,
        sentCount: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
        pendingCount: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
        failedCount: Number(campaign.failedCount ?? campaign.stats?.failed ?? 0),
        warning: 'Campaign queued. Worker will process it shortly. If it is not picked within 2 minutes, check the campaign worker process.',
        message: 'Campaign queued. Worker will process it shortly.'
      }, { headers: NO_STORE_HEADERS });
    }
    const runnerResult = await startCampaignRunner(String(campaign._id), { trigger: 'manual' });
    const latestCampaign = await Campaign.findById(campaign._id).lean();
    return NextResponse.json({
      success: true,
      ok: true,
      queued: !runnerResult?.started,
      started: Boolean(runnerResult?.started),
      status: latestCampaign?.status || campaign.status,
      displayStatus: computeCampaignDisplayStatus(latestCampaign || campaign),
      workerStatus: latestCampaign?.workerStatus || campaign.workerStatus || '',
      queueReason: latestCampaign?.queueReason || campaign.queueReason,
      sentCount: Number(latestCampaign?.sentCount ?? latestCampaign?.stats?.sent ?? campaign.sentCount ?? campaign.stats?.sent ?? 0),
      pendingCount: Number(latestCampaign?.pendingCount ?? latestCampaign?.stats?.pending ?? campaign.pendingCount ?? campaign.stats?.pending ?? 0),
      failedCount: Number(latestCampaign?.failedCount ?? latestCampaign?.stats?.failed ?? campaign.failedCount ?? campaign.stats?.failed ?? 0),
      message: runnerResult?.started ? 'Campaign started successfully.' : (runnerResult?.message || 'Campaign queued successfully.')
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
