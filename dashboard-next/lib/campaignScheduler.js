import mongoose from 'mongoose';
import Campaign from '@/models/Campaign';
import { startCampaignRunner } from '@/lib/campaignRunner';

const schedulerState =
  global.campaignSchedulerState ||
  (global.campaignSchedulerState = {
    started: false,
    intervalId: null,
    inFlight: new Set()
  });

async function runCampaignSchedulerTick() {
  if (mongoose.connection.readyState !== 1) return;

  const now = new Date();
  const dueCampaigns = await Campaign.find({
    status: 'Scheduled',
    $or: [
      { scheduledAt: { $ne: null, $lte: now } },
      { 'scheduledStart.at': { $ne: null, $lte: now } }
    ]
  })
    .select('_id')
    .lean();

  for (const campaign of dueCampaigns) {
    const id = String(campaign._id);
    if (schedulerState.inFlight.has(id)) continue;

    schedulerState.inFlight.add(id);
    try {
      await startCampaignRunner(id, { trigger: 'scheduler' });
    } catch (error) {
      console.error(`Failed to auto-start scheduled campaign ${id}:`, error);
    } finally {
      schedulerState.inFlight.delete(id);
    }
  }
}

export function initCampaignScheduler() {
  if (schedulerState.started) return;

  schedulerState.started = true;
  schedulerState.intervalId = setInterval(() => {
    runCampaignSchedulerTick().catch((error) => {
      console.error('Campaign scheduler tick failed:', error);
    });
  }, 60000);

  if (typeof schedulerState.intervalId?.unref === 'function') {
    schedulerState.intervalId.unref();
  }

  runCampaignSchedulerTick().catch((error) => {
    console.error('Initial campaign scheduler tick failed:', error);
  });
}
