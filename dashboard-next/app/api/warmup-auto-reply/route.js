import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/apiAuth';
import { getWarmupAutoReplySetting, processWarmupAutoReplies } from '@/lib/warmupAutoReply';

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;

    const setting = await getWarmupAutoReplySetting(userEmail);
    return NextResponse.json({ setting });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load warmup auto reply setting' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;

    const body = await req.json().catch(() => ({}));
    const setting = await getWarmupAutoReplySetting(userEmail);

    if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
      setting.enabled = Boolean(body.enabled);
    }
    if (typeof body.replyTemplate === 'string') {
      setting.replyTemplate = body.replyTemplate.trim() || setting.replyTemplate;
    }
    if (Array.isArray(body.keywords)) {
      setting.keywords = body.keywords.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (body.maxRepliesPerRun !== undefined) {
      setting.maxRepliesPerRun = Math.max(1, Math.min(10, Number(body.maxRepliesPerRun || 3)));
    }

    await setting.save();

    let run = null;
    if (body.runNow) {
      run = await processWarmupAutoReplies(userEmail, { force: true });
    }

    return NextResponse.json({ ok: true, setting, run });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update warmup auto reply setting' }, { status: 500 });
  }
}
