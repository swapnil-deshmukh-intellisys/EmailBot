import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { requireUser } from '@/lib/apiAuth';

function buildPixelResponse() {
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2nq0QAAAAASUVORK5CYII=',
    'base64'
  );
  return new NextResponse(pixel, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(pixel.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0'
    }
  });
}

async function recordTrackingEvent(req, params, eventType, target = '') {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return { errorResponse };
  await connectDB();

  const campaign = await Campaign.findOne({ _id: params.id, userEmail });
  if (!campaign) {
    return { response: NextResponse.json({ error: 'Campaign not found' }, { status: 404 }) };
  }

  const trackingEnabled = campaign?.tracking?.enabled !== false || campaign?.tracking?.opens || campaign?.tracking?.clicks || campaign?.tracking?.replies;
  if (!trackingEnabled) {
    return { campaign };
  }

  const normalizedType = String(eventType || '').toLowerCase();
  const event = {
    type: normalizedType,
    email: String(new URL(req.url).searchParams.get('email') || '').trim().toLowerCase(),
    target: String(target || '').trim(),
    at: new Date(),
    meta: {
      ip: String(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '').split(',')[0].trim(),
      userAgent: String(req.headers.get('user-agent') || '')
    }
  };

  campaign.tracking = {
    ...(campaign.tracking || {}),
    enabled: true,
    updatedAt: new Date()
  };
  campaign.trackingEvents = [...(campaign.trackingEvents || []), event];

  if (!campaign.trackingStats) {
    campaign.trackingStats = { openCount: 0, clickCount: 0, replyCount: 0 };
  }

  if (normalizedType === 'open') {
    campaign.trackingStats.openCount += 1;
  } else if (normalizedType === 'click') {
    campaign.trackingStats.clickCount += 1;
  } else if (normalizedType === 'reply') {
    campaign.trackingStats.replyCount += 1;
  }

  await campaign.save();

  return { campaign };
}

export async function GET(req, { params }) {
  const eventType = String(params.event || '').toLowerCase();
  const target = new URL(req.url).searchParams.get('target') || '';

  const result = await recordTrackingEvent(req, params, eventType, target);
  if (result?.errorResponse) return result.errorResponse;
  if (result?.response) return result.response;

  if (eventType === 'click' && target) {
    return NextResponse.redirect(target, 302);
  }

  if (eventType === 'open') {
    return buildPixelResponse();
  }

  return NextResponse.json({ ok: true, event: eventType });
}

export async function POST(req, { params }) {
  const eventType = String(params.event || '').toLowerCase();
  const target = new URL(req.url).searchParams.get('target') || '';

  const result = await recordTrackingEvent(req, params, eventType, target);
  if (result?.errorResponse) return result.errorResponse;
  if (result?.response) return result.response;

  return NextResponse.json({ ok: true, event: eventType });
}
