import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { requireAuth } from '@/lib/apiAuth';
import {
  buildScheduledDateTimeInZone,
  buildScheduledLabel,
  convertDelayIntervalToSeconds,
  isFutureScheduledDate,
  normalizeDurationUnit
} from '@/modules/campaign-module/campaign-utils/CampaignScheduleHelper';

const ROUTE_NAME = 'POST /api/campaigns/[id]/schedule';
const MIN_CAMPAIGN_SEND_GAP_SECONDS = 60;

function jsonError({ status = 400, code = 'CAMPAIGN_SCHEDULE_FAILED', message = 'Failed to schedule campaign.', campaignId = '', userEmail = '' }) {
  console.error(`[${ROUTE_NAME}] ${code}: ${message}`, { campaignId, userEmail });
  return NextResponse.json({ success: false, code, message, error: message }, { status });
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

  const existing = await Campaign.findOne({ _id: campaignId, userEmail }).select('_id').lean();
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
    const delayIntervalInput = Math.max(1, Math.floor(Number(body?.delayInterval ?? body?.options?.delayInterval ?? MIN_CAMPAIGN_SEND_GAP_SECONDS) || MIN_CAMPAIGN_SEND_GAP_SECONDS));
    const durationUnit = normalizeDurationUnit(body?.durationUnit || body?.options?.durationUnit || 'seconds');
    const batchSize = Math.max(1, Math.floor(Number(body?.batchSize ?? body?.options?.batchSize ?? 1) || 1));
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

    const scheduledAt = normalizedScheduleMode === 'scheduled'
      ? (scheduledInput
          ? new Date(scheduledInput)
          : buildScheduledDateTimeInZone(normalizedDateValue, normalizedSlot, normalizedTimezone))
      : null;

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
      if (!isFutureScheduledDate(scheduledAt)) {
        return jsonError({
          status: 400,
          code: 'SCHEDULE_TIME_NOT_FUTURE',
          message: 'Scheduled time must be in future.',
          campaignId,
          userEmail
        });
      }
    }

    const scheduledLabel = buildScheduledLabel({
      country: normalizedCountry,
      timeZone: normalizedTimezone,
      dateValue: normalizedDateValue,
      timeValue: normalizedSlot,
      scheduledAt
    });

    const nextStatus = normalizedScheduleMode === 'scheduled'
      ? (activate ? 'Scheduled' : 'Draft')
      : 'Draft';

    await Campaign.updateOne(
      { _id: campaignId, userEmail },
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
          queueRequestedAt: null,
          workerId: '',
          workerLockedAt: null,
          workerHeartbeatAt: null,
          'options.batchSize': batchSize,
          'options.delayInterval': delayInterval,
          'options.durationUnit': durationUnit,
          'options.delaySeconds': delaySeconds,
          ...(typeof body?.replyMode === 'boolean' ? { 'options.replyMode': body.replyMode } : {})
        },
        $push: {
          logs: {
            level: 'info',
            message: normalizedScheduleMode === 'scheduled'
              ? (persistOnly
                  ? `Schedule saved for ${scheduledLabel} (UTC: ${scheduledAt.toISOString()})`
                  : `Campaign scheduled for ${scheduledLabel} (UTC: ${scheduledAt.toISOString()})`)
              : `Schedule preferences saved for send-now mode | batch ${batchSize} | delay ${delayInterval} ${durationUnit}`,
            at: new Date()
          }
        }
      }
    );

    const campaign = await Campaign.findOne({ _id: campaignId, userEmail }).lean();

    return NextResponse.json({ success: true, ok: true, campaign });
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
