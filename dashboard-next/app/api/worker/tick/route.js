import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getCampaignSchedulerState, triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function readBearerSecret(req) {
  const auth = String(req.headers.get('authorization') || '').trim();
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return String(new URL(req.url).searchParams.get('secret') || '').trim();
}

function isWorkerAuthorized(req) {
  const expected = String(process.env.WORKER_SECRET || process.env.CRON_SECRET || '').trim();
  if (!expected) return false;
  return readBearerSecret(req) === expected;
}

export async function GET(req) {
  try {
    if (!isWorkerAuthorized(req)) {
      return NextResponse.json(
        { ok: false, error: 'Worker secret is required.' },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    if (process.env.VERCEL && String(process.env.ALLOW_VERCEL_WORKER_TICK || '').toLowerCase() !== 'true') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Campaign worker tick is disabled on Vercel serverless. Run npm run worker:campaigns on a persistent worker server.',
          scheduler: getCampaignSchedulerState()
        },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    await connectDB();
    const result = await triggerCampaignSchedulerTick({ force: true });
    return NextResponse.json(
      {
        ok: true,
        result,
        scheduler: getCampaignSchedulerState()
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Worker tick failed.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req) {
  return GET(req);
}
