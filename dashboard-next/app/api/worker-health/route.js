import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import CampaignWorkerHeartbeat from '@/models/CampaignWorkerHeartbeat';
import { validateEnvironment } from '@/core-lib/env-config/EnvironmentSafety';

export const dynamic = 'force-dynamic';

const WORKER_LOCK_STALE_MS = Math.max(5 * 60 * 1000, Number(process.env.CAMPAIGN_WORKER_LOCK_STALE_MS || 5 * 60 * 1000));
const WORKER_HEARTBEAT_STALE_MS = Math.max(2 * 60 * 1000, Number(process.env.CAMPAIGN_WORKER_HEALTH_STALE_MS || 2 * 60 * 1000));

export async function GET() {
  try {
    await connectDB();
    const staleBefore = new Date(Date.now() - WORKER_LOCK_STALE_MS);

    const [queued, running, staleRunning, latestHeartbeat] = await Promise.all([
      Campaign.countDocuments({ status: 'Queued' }),
      Campaign.countDocuments({ status: 'Running' }),
      Campaign.countDocuments({
        status: 'Running',
        $or: [
          { workerHeartbeatAt: { $lt: staleBefore } },
          { workerHeartbeatAt: null, workerLockedAt: { $lt: staleBefore } },
          { workerHeartbeatAt: null, workerLockedAt: null }
        ]
      }),
      CampaignWorkerHeartbeat.findOne({})
        .sort({ lastHeartbeatAt: -1 })
        .lean()
    ]);

    const env = validateEnvironment({ nodeEnv: process.env.NODE_ENV || 'production' });
    const heartbeatAgeMs = latestHeartbeat?.lastHeartbeatAt
      ? Date.now() - new Date(latestHeartbeat.lastHeartbeatAt).getTime()
      : null;
    const workerAlive = heartbeatAgeMs !== null && heartbeatAgeMs <= WORKER_HEARTBEAT_STALE_MS;
    const queueNeedsWorker = queued > 0 || running > 0;
    const status = staleRunning > 0 || (queueNeedsWorker && !workerAlive) ? 'degraded' : 'healthy';

    return NextResponse.json({
      status,
      service: 'intellimailpilot-worker',
      version: process.env.npm_package_version || '1.0.0',
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || process.env.BUILD_TIME || null,
      queue: {
        queued,
        running,
        staleRunning
      },
      worker: {
        alive: workerAlive,
        workerId: latestHeartbeat?.workerId || '',
        status: latestHeartbeat?.status || '',
        host: latestHeartbeat?.host || '',
        pid: latestHeartbeat?.pid || null,
        lastHeartbeatAt: latestHeartbeat?.lastHeartbeatAt || null,
        heartbeatAgeMs,
        staleAfterMs: WORKER_HEARTBEAT_STALE_MS,
        message: workerAlive
          ? 'Campaign worker heartbeat is active.'
          : queueNeedsWorker
          ? 'Campaign worker heartbeat is missing or stale while campaigns need processing.'
          : 'No active worker heartbeat found.'
      },
      lockPolicy: {
        staleAfterMs: WORKER_LOCK_STALE_MS,
        workerHeartbeatStaleAfterMs: WORKER_HEARTBEAT_STALE_MS
      },
      env: {
        ok: env.ok,
        errors: env.errors,
        warnings: env.warnings,
        checkedAt: env.checkedAt,
        masked: env.masked,
        worker: env.worker,
        recommendedWorkerEnv: env.recommendedWorkerEnv
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
