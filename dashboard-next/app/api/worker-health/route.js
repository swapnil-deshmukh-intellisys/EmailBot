import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';

export const dynamic = 'force-dynamic';

const WORKER_LOCK_STALE_MS = Math.max(5 * 60 * 1000, Number(process.env.CAMPAIGN_WORKER_LOCK_STALE_MS || 5 * 60 * 1000));

export async function GET() {
  try {
    await connectDB();
    const staleBefore = new Date(Date.now() - WORKER_LOCK_STALE_MS);

    const [queued, running, staleRunning] = await Promise.all([
      Campaign.countDocuments({ status: 'Queued' }),
      Campaign.countDocuments({ status: 'Running' }),
      Campaign.countDocuments({
        status: 'Running',
        workerLockedAt: { $ne: null, $lt: staleBefore },
        $or: [
          { workerHeartbeatAt: null },
          { workerHeartbeatAt: { $lt: staleBefore } }
        ]
      })
    ]);

    return NextResponse.json({
      status: staleRunning > 0 ? 'degraded' : 'healthy',
      service: 'intellimailpilot-worker',
      version: process.env.npm_package_version || '1.0.0',
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || process.env.BUILD_TIME || null,
      queue: {
        queued,
        running,
        staleRunning
      },
      lockPolicy: {
        staleAfterMs: WORKER_LOCK_STALE_MS
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error?.message || 'Worker health check failed'
      },
      { status: 500 }
    );
  }
}
