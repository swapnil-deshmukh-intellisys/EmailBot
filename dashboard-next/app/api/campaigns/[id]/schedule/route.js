import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { isInAppCampaignSchedulerEnabled, triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { startCampaignRunner } from '@/lib/campaignRunner';
import {
  buildScheduledDateTimeInZone,
  buildScheduledLabel,
  convertDelayIntervalToSeconds,
  isFutureScheduledDate,
  normalizeDurationUnit
} from '@/modules/campaign-module/campaign-utils/CampaignScheduleHelper';

const ROUTE_NAME = 'POST /api/campaigns/[id]/schedule';
const MIN_CAMPAIGN_SEND_GAP_SECONDS = 60;
const SCHEDULE_START_GRACE_MS = 90 * 1000;
const MAX_SCHEDULE_DELAY_MINUTES = 1440;
const MAX_SCHEDULE_DELAY_HOURS = 24;
const MAX_SCHEDULE_DELAY_SECONDS = 86400;

function getScheduleDelayLimit(unit = 'minutes') {
  const normalizedUnit = normalizeDurationUnit(unit);
  if (normalizedUnit === 'hours') return MAX_SCHEDULE_DELAY_HOURS;
  if (normalizedUnit === 'seconds') return MAX_SCHEDULE_DELAY_SECONDS;
  return MAX_SCHEDULE_DELAY_MINUTES;
}

function jsonError({ status = 400, code = 'CAMPAIGN_SCHEDULE_FAILED', message = 'Failed to schedule campaign.', campaignId = '', userEmail = '' }) {
  console.error(`[${ROUTE_NAME}] ${code}: ${message}`, { campaignId, userEmail });
  return NextResponse.json({ success: false, ok: false, code, message, error: message }, { status });
}

export async function POST(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
  const campaignId = String(params?.id || '').trim();
  if (!mongoose.isValidObjectId(campaignId)) {
    return jsonError({ status: 400, code: 'INVALID_CAMPAIGN_ID', message: 'Invalid campaign id.', campaignId, userEmail });
  }

  await connectDB();

  const ownerQuery = buildAuthOwnerFilter(auth, { _id: campaignId });
  const existing = await Campaign.findOne(ownerQuery).select('_id').lean();
  if (!existing) {
    return jsonError({
      status: 404,
      code: 'CAMPAIGN_NOT_FOUND',
      message: 'Campaign not found for current user.',
      campaignId,
      userEmail
    });
  }

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const normalizedScheduleMode = String(body?.scheduleMode || body?.mode || 'scheduled').trim().toLowerCase() === 'scheduled'
      ? 'scheduled'
      : 'send_now';
    const normalizedCountry = String(body?.country || 'India').trim() || 'India';
    const normalizedTimezone = String(body?.timezone || body?.scheduledStart?.timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata';
    const normalizedSlot = String(body?.slot || body?.scheduledTime || '').trim();
    const normalizedDateValue = String(body?.scheduledDate || '').trim();
    const durationUnit = normalizeDurationUnit(body?.durationUnit || body?.options?.durationUnit || 'seconds');
    const delayIntervalInput = Math.max(1, Math.floor(Number(body?.delayInterval ?? body?.options?.delayInterval ?? MIN_CAMPAIGN_SEND_GAP_SECONDS) || MIN_CAMPAIGN_SEND_GAP_SECONDS));
    if (delayIntervalInput > getScheduleDelayLimit(durationUnit)) {
      return jsonError({
        status: 400,
        code: 'DELAY_INTERVAL_TOO_LARGE',
        message: `Delay interval cannot be more than ${getScheduleDelayLimit(durationUnit)} ${durationUnit}.`,
        campaignId,
        userEmail
      });
    }
    const batchSize = Math.max(1, Math.floor(Number(body?.batchSize ?? body?.options?.batchSize ?? 1) || 1));
    const rowRange = String(body?.rowRange ?? body?.options?.rowRange ?? '').trim();
    const rowRangeMatch = rowRange.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rowRange && (!rowRangeMatch || Number(rowRangeMatch[1]) < 1 || Number(rowRangeMatch[1]) > Number(rowRangeMatch[2]))) {
      return jsonError({
        status: 400,
        code: 'INVALID_ROW_RANGE',
        message: 'Sheet row range must use format like 10-20.',
        campaignId,
        userEmail
      });
    }
    const delaySeconds = Math.max(
      MIN_CAMPAIGN_SEND_GAP_SECONDS,
      convertDelayIntervalToSeconds(delayIntervalInput, durationUnit)
    );
    const delayInterval = durationUnit === 'seconds'
      ? Math.max(MIN_CAMPAIGN_SEND_GAP_SECONDS, delayIntervalInput)
      : delayIntervalInput;
    const persistOnly = Boolean(body?.persistOnly);
    const activate = Boolean(body?.activate);

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
    let shouldQueueImmediately = false;

    if (normalizedScheduleMode === 'scheduled') {
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
        return jsonError({
          status: 400,
          code: 'INVALID_SCHEDULE_TIME',
          message: 'Please select scheduled date and time.',
          campaignId,
          userEmail
        });
      }
      const now = new Date();
      if (!isFutureScheduledDate(scheduledAt)) {
        const pastByMs = now.getTime() - scheduledAt.getTime();
        if (activate && pastByMs >= 0 && pastByMs <= SCHEDULE_START_GRACE_MS) {
          scheduledAt = now;
          shouldQueueImmediately = true;
        } else {
        return jsonError({
          status: 400,
          code: 'SCHEDULE_TIME_NOT_FUTURE',
          message: 'Scheduled time must be in future. Pick a later time or use Send now.',
          campaignId,
          userEmail
        });
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

    const nextStatus = shouldQueueImmediately
      ? 'Queued'
      : normalizedScheduleMode === 'scheduled'
      ? (activate ? 'Scheduled' : 'Draft')
      : 'Draft';

    console.info('[campaign_scheduled]', {
      campaignId: String(campaignId || ''),
      userEmail,
      scheduleMode: normalizedScheduleMode,
      status: nextStatus,
      scheduledAt: scheduledAt ? scheduledAt.toISOString() : '',
      timezone: normalizedTimezone,
      shouldQueueImmediately
    });

    await Campaign.updateOne(
      ownerQuery,
      {
        $set: {
          scheduleMode: normalizedScheduleMode,
          country: normalizedCountry,
          timezone: normalizedTimezone,
          scheduledStart: {
            country: normalizedCountry,
            slot: normalizedSlot,
            timezone: normalizedTimezone,
            label: normalizedScheduleMode === 'scheduled' ? scheduledLabel : '',
            at: normalizedScheduleMode === 'scheduled' ? scheduledAt : null
          },
          scheduledAt: normalizedScheduleMode === 'scheduled' ? scheduledAt : null,
          status: nextStatus,
          queueRequestedAt: shouldQueueImmediately ? new Date() : null,
          queueReason: shouldQueueImmediately ? 'Scheduled time reached; queued immediately' : '',
          workerId: '',
          workerLockedAt: null,
          workerHeartbeatAt: null,
          'options.batchSize': batchSize,
          'options.rowRange': rowRange,
          'options.delayInterval': delayInterval,
          'options.durationUnit': durationUnit,
          'options.delaySeconds': delaySeconds,
          ...(typeof body?.replyMode === 'boolean' ? { 'options.replyMode': body.replyMode } : {})
        },
        $push: {
          logs: {
            level: 'info',
            message: normalizedScheduleMode === 'scheduled'
              ? (shouldQueueImmediately
                  ? `campaign_scheduled: scheduled time reached; campaign queued immediately (${scheduledLabel})`
                  : persistOnly
                  ? `campaign_scheduled: schedule saved for ${scheduledLabel} (UTC: ${scheduledAt.toISOString()})`
                  : `campaign_scheduled: campaign scheduled for ${scheduledLabel} (UTC: ${scheduledAt.toISOString()})`)
              : `Schedule preferences saved for send-now mode | batch ${batchSize} | delay ${delayInterval} ${durationUnit}`,
            at: new Date()
          }
        }
      }
    );

    const campaign = await Campaign.findOne(ownerQuery).lean();
    const schedulerWarning =
      normalizedScheduleMode === 'scheduled' &&
      !shouldQueueImmediately &&
      !isInAppCampaignSchedulerEnabled()
        ? 'Campaign scheduled. The persistent campaign worker must be running to send it at the selected time.'
        : '';
    if (shouldQueueImmediately && isInAppCampaignSchedulerEnabled()) {
      await startCampaignRunner(String(campaignId), { trigger: 'scheduler' });
    } else if (activate || normalizedScheduleMode === 'send_now') {
      await triggerCampaignSchedulerTick();
    }

    return NextResponse.json({
      success: true,
      ok: true,
      data: campaign,
      campaign,
      warning: schedulerWarning,
      message: schedulerWarning || (shouldQueueImmediately ? 'Campaign queued. Worker will process it shortly.' : 'Campaign schedule saved.')
    });
  } catch (error) {
    return jsonError({
      status: 400,
      code: 'CAMPAIGN_SCHEDULE_FAILED',
      message: error.message || 'Failed to schedule campaign.',
      campaignId,
      userEmail
    });
  }
}
