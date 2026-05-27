import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getCampaignSchedulerState } from '@/lib/campaignScheduler';
import { validateEnvironment } from '@/core-lib/env-config/EnvironmentSafety';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

export async function GET() {
  try {
    await connectDB();

    const [queued, running, failedToday] = await Promise.all([
      Campaign.countDocuments({ status: 'Queued' }),
      Campaign.countDocuments({ status: 'Running' }),
      Campaign.countDocuments({
        status: 'Failed',
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
    ]);

    const env = validateEnvironment({ nodeEnv: process.env.NODE_ENV || 'production' });

    return NextResponse.json({
      status: 'healthy',
      service: 'intellimailpilot-web',
      version: process.env.npm_package_version || '1.0.0',
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME || process.env.BUILD_TIME || null,
      database: {
        connected: mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState,
        name: mongoose.connection.name || '',
        host: mongoose.connection.host || ''
      },
      scheduler: getCampaignSchedulerState(),
      campaigns: {
        queued,
        running,
        failedLast24h: failedToday
      },
      env: {
        ok: env.ok,
        errors: env.errors,
        warnings: env.warnings,
        checkedAt: env.checkedAt,
        masked: env.masked
      }
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error?.message || 'Health check failed'
      },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
