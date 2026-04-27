import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { requireUser } from '@/lib/apiAuth';
import {
  buildScheduledDateTimeInZone,
  buildScheduledLabel,
  convertDelayIntervalToSeconds,
  isFutureScheduledDate,
  normalizeDurationUnit
} from '@/modules/campaign-module/campaign-utils/CampaignScheduleHelper';

export async function POST(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  if (!mongoose.isValidObjectId(params?.id)) {
    return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 });
  }

  await connectDB();

  const existing = await Campaign.findOne({ _id: params.id, userEmail }).select('_id').lean();
  if (!existing) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
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
    const delayInterval = Math.max(1, Math.floor(Number(body?.delayInterval ?? body?.options?.delayInterval ?? 1) || 1));
    const durationUnit = normalizeDurationUnit(body?.durationUnit || body?.options?.durationUnit || 'seconds');
    const batchSize = Math.max(1, Math.floor(Number(body?.batchSize ?? body?.options?.batchSize ?? 1) || 1));
    const delaySeconds = convertDelayIntervalToSeconds(delayInterval, durationUnit);
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
        return NextResponse.json(
          { error: 'Please select scheduled date and time.' },
          { status: 400 }
        );
      }
      if (!isFutureScheduledDate(scheduledAt)) {
        return NextResponse.json(
          { error: 'Scheduled time must be in future.' },
          { status: 400 }
        );
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
      { _id: params.id, userEmail },
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

    const campaign = await Campaign.findOne({ _id: params.id, userEmail }).lean();

    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to schedule campaign' },
      { status: 400 }
    );
  }
}
