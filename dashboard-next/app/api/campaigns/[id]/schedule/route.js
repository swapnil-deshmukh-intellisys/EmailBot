import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';

export async function POST(req, { params }) {
  await connectDB();

  const campaign = await Campaign.findById(params.id);
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : null;

    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: 'Valid scheduledAt is required' }, { status: 400 });
    }

    campaign.scheduledStart = {
      country: body?.country || '',
      slot: body?.slot || '',
      timezone: body?.timezone || '',
      label: body?.label || '',
      at: scheduledAt
    };
    campaign.logs.push({
      level: 'info',
      message: `Campaign scheduled for ${body?.label || scheduledAt.toLocaleString()}`,
      at: new Date()
    });
    await campaign.save();

    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to schedule campaign' }, { status: 400 });
  }
}
