import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import { ensureStepLogs, refreshCampaignRollups } from '@/core-lib/campaign-engine/CampaignAnalyticsService';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

export async function GET(req, { params }) {
  const trackingId = String(params?.trackingId || '').trim();
  if (trackingId) {
    await connectDB();
    const now = new Date();
    const existing = await CampaignRecipientLog.findOne({ 'stepLogs.trackingId': trackingId }).lean();
    const stepLogs = ensureStepLogs(existing?.stepLogs || [], 5).map((step) => (
      step.trackingId === trackingId
        ? {
            ...step,
            status: ['Replied', 'Auto Reply'].includes(step.status) ? step.status : 'Opened',
            openedAt: now
          }
        : step
    ));
    const nextStatus = existing?.replyReceived || existing?.followUpStopped
      ? existing.status
      : 'Opened';
    const log = existing
      ? await CampaignRecipientLog.findOneAndUpdate(
          { _id: existing._id },
          {
            $set: {
              status: nextStatus,
              lastOpenedAt: now,
              lastActivityAt: now,
              stepLogs
            },
            $inc: { openCount: 1 }
          },
          { new: true }
        ).lean()
      : null;
    if (log?.campaignId) {
      if (!log.firstOpenedAt) {
        await CampaignRecipientLog.updateOne({ _id: log._id }, { $set: { firstOpenedAt: now } }).catch(() => {});
      }
      await refreshCampaignRollups(log.campaignId).catch(() => {});
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    }
  });
}
