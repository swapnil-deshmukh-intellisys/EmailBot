import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getCampaignSchedulerState } from '@/lib/campaignScheduler';

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

    return NextResponse.json({
      status: 'healthy',
      service: 'intellimailpilot-web',
      database: {
        connected: mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState
      },
      scheduler: getCampaignSchedulerState(),
      campaigns: {
        queued,
        running,
        failedLast24h: failedToday
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error?.message || 'Health check failed'
      },
      { status: 500 }
    );
  }
}
