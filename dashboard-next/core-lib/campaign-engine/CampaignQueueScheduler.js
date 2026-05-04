import mongoose from 'mongoose';
import Campaign from '../../database-models/Campaign.js';
import { startCampaignRunner } from './CampaignExecutionRunner.js';

const schedulerState =
  global.campaignSchedulerState ||
  (global.campaignSchedulerState = {
    started: false,
    startedAt: null,
    intervalId: null,
    tickPromise: null,
    inFlight: new Set(),
    lastTickAt: null,
    lastTickStatus: 'idle',
    lastError: '',
    recoveredCount: 0
  });
const WORKER_LOCK_STALE_MS = Math.max(30000, Number(process.env.CAMPAIGN_WORKER_LOCK_STALE_MS || 120000));

async function recoverStaleCampaigns(now = new Date()) {
  const staleBefore = new Date(now.getTime() - WORKER_LOCK_STALE_MS);
  const staleCampaigns = await Campaign.find({
    status: 'Running',
    workerLockedAt: { $ne: null, $lt: staleBefore },
    $or: [
      { workerHeartbeatAt: null },
      { workerHeartbeatAt: { $lt: staleBefore } }
    ]
  })
    .select('_id')
    .lean();

  for (const campaign of staleCampaigns) {
    const id = String(campaign._id);
    if (schedulerState.inFlight.has(id)) continue;

    await Campaign.updateOne(
      {
        _id: campaign._id,
        status: 'Running',
        workerLockedAt: { $ne: null, $lt: staleBefore },
        $or: [
          { workerHeartbeatAt: null },
          { workerHeartbeatAt: { $lt: staleBefore } }
        ]
      },
      {
        $set: {
          status: 'Queued',
          queueRequestedAt: now,
          workerId: '',
          workerLockedAt: null,
          workerHeartbeatAt: null
        },
        $push: {
          logs: {
            level: 'info',
            message: 'Campaign re-queued after stale worker lock recovery',
            at: now
          }
        }
      }
    );
    schedulerState.recoveredCount += 1;
  }
}

export async function runCampaignSchedulerTick() {
  if (mongoose.connection.readyState !== 1) return;
  schedulerState.lastTickAt = new Date();
  schedulerState.lastTickStatus = 'running';
  schedulerState.lastError = '';

  const now = new Date();
  await recoverStaleCampaigns(now);
  const dueCampaigns = await Campaign.find({
    $or: [
      { status: 'Queued' },
      {
        status: 'Scheduled',
        $or: [
          { scheduledAt: { $ne: null, $lte: now } },
          { 'scheduledStart.at': { $ne: null, $lte: now } }
        ]
      }
    ]
  })
    .select('_id')
    .sort({ queueRequestedAt: 1, scheduledAt: 1, createdAt: 1 })
    .lean();

  for (const campaign of dueCampaigns) {
    const id = String(campaign._id);
    if (schedulerState.inFlight.has(id)) continue;

    schedulerState.inFlight.add(id);
    try {
      await startCampaignRunner(id, { trigger: 'scheduler' });
    } catch (error) {
      schedulerState.lastError = error?.message || 'Unknown scheduler error';
      console.error(`Failed to auto-start scheduled campaign ${id}:`, error);
    } finally {
      schedulerState.inFlight.delete(id);
    }
  }

  schedulerState.lastTickStatus = 'ok';
}

export function triggerCampaignSchedulerTick() {
  if (schedulerState.tickPromise) {
    return schedulerState.tickPromise;
  }

  schedulerState.tickPromise = runCampaignSchedulerTick()
    .catch((error) => {
      schedulerState.lastTickAt = new Date();
      schedulerState.lastTickStatus = 'error';
      schedulerState.lastError = error?.message || 'Unknown scheduler error';
      console.error('Campaign scheduler tick failed:', error);
    })
    .finally(() => {
      schedulerState.tickPromise = null;
    });

  return schedulerState.tickPromise;
}

export function initCampaignScheduler() {
  if (schedulerState.started) return;

  schedulerState.started = true;
  schedulerState.startedAt = new Date();
  schedulerState.intervalId = setInterval(() => {
    triggerCampaignSchedulerTick();
  }, Math.max(2000, Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 5000)));

  if (typeof schedulerState.intervalId?.unref === 'function') {
    schedulerState.intervalId.unref();
  }

  triggerCampaignSchedulerTick();
}

export function getCampaignSchedulerState() {
  return {
    started: Boolean(schedulerState.started),
    startedAt: schedulerState.startedAt || null,
    lastTickAt: schedulerState.lastTickAt || null,
    lastTickStatus: schedulerState.lastTickStatus || 'idle',
    lastError: schedulerState.lastError || '',
    recoveredCount: Number(schedulerState.recoveredCount || 0),
    inFlightCount: schedulerState.inFlight.size,
    intervalMs: Math.max(2000, Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 5000)),
    workerLockStaleMs: WORKER_LOCK_STALE_MS
  };
}
