import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';

export async function POST(req, { params }) {
  if (!mongoose.isValidObjectId(params?.id)) {
    return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 });
  }

  await connectDB();

  const existing = await Campaign.findById(params.id).select('_id').lean();
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

    const scheduledInput =
      body?.scheduledAt ??
      body?.at ??
      body?.scheduledStartAt ??
      body?.scheduledStart?.at ??
      null;
    const scheduledAt = scheduledInput ? new Date(scheduledInput) : null;

    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { error: 'Valid scheduledAt is required', received: scheduledInput },
        { status: 400 }
      );
    }

    await Campaign.updateOne(
      { _id: params.id },
      {
        $set: {
          scheduledStart: {
            country: body?.country || '',
            slot: body?.slot || '',
            timezone: body?.timezone || '',
            label: body?.label || '',
            at: scheduledAt
          },
          scheduledAt,
          status: 'Scheduled'
        },
        $push: {
          logs: {
            level: 'info',
            message: `Campaign scheduled (UTC: ${scheduledAt.toISOString()})${body?.label ? ` | ${body.label}` : ''}`,
            at: new Date()
          }
        }
      }
    );

    const campaign = await Campaign.findById(params.id).lean();

    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to schedule campaign' },
      { status: 400 }
    );
  }
}
