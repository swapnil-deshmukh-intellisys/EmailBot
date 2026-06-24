import mongoose from 'mongoose';
import Campaign from '../../database-models/Campaign.js';
import CampaignRecipientClaim from '../../database-models/CampaignRecipientClaim.js';
import CampaignRecipientLog from '../../database-models/CampaignRecipientLog.js';
import LeadList from '../../database-models/LeadList.js';
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
const WORKER_LOCK_STALE_MS = Math.max(5 * 60 * 1000, Number(process.env.CAMPAIGN_WORKER_LOCK_STALE_MS || 5 * 60 * 1000));
const QUEUE_ITEM_STALE_MS = Math.max(5 * 60 * 1000, Number(process.env.CAMPAIGN_QUEUE_ITEM_STALE_MS || 15 * 60 * 1000));

export function isInAppCampaignSchedulerEnabled() {
  if (process.env.VERCEL) return false;
  const configured = String(process.env.ENABLE_IN_APP_CAMPAIGN_SCHEDULER || '').trim().toLowerCase();
  return configured === 'true';
}

async function recoverStaleCampaigns(now = new Date()) {
  const staleBefore = new Date(now.getTime() - WORKER_LOCK_STALE_MS);
  const staleCampaigns = await Campaign.find({
    status: 'Running',
    $or: [
      { workerHeartbeatAt: { $lt: staleBefore } },
      { workerHeartbeatAt: null, workerLockedAt: { $lt: staleBefore } },
      { workerHeartbeatAt: null, workerLockedAt: null }
    ]
  })
    .select('_id sentCount pendingCount workerStatus workerLockedAt workerHeartbeatAt')
    .lean();

  for (const campaign of staleCampaigns) {
    const id = String(campaign._id);
    if (schedulerState.inFlight.has(id)) continue;

    const staleForMs = Math.max(
      0,
      now.getTime() - new Date(campaign.workerHeartbeatAt || campaign.workerLockedAt || 0).getTime()
    );
    const staleMinutes = Math.max(1, Math.round(staleForMs / 60000));
    const queueReason = `Requeued because worker heartbeat stale for ${staleMinutes} minutes`;
    await Campaign.updateOne(
      {
        _id: campaign._id,
        status: 'Running',
        $or: [
          { workerHeartbeatAt: { $lt: staleBefore } },
          { workerHeartbeatAt: null, workerLockedAt: { $lt: staleBefore } },
          { workerHeartbeatAt: null, workerLockedAt: null }
        ]
      },
      {
        $set: {
          status: 'Queued',
          queueRequestedAt: now,
          queueReason,
          workerStatus: 'stale_requeued',
          workerId: '',
          workerLockedBy: '',
          workerLockedAt: null,
          workerHeartbeatAt: null
        },
        $push: {
          logs: {
            level: 'info',
            message: queueReason,
            at: now
          }
        }
      }
    );
    schedulerState.recoveredCount += 1;
  }
}

async function recoverStaleQueueItems(now = new Date()) {
  const staleBefore = new Date(now.getTime() - QUEUE_ITEM_STALE_MS);
  const staleClaims = await CampaignRecipientClaim.find({
    status: 'Sending',
    claimedAt: { $lt: staleBefore }
  })
    .select('_id campaignId recipientEmail listId leadIndex claimedAt')
    .limit(Number(process.env.CAMPAIGN_QUEUE_RECOVERY_LIMIT || 100))
    .lean();

  for (const claim of staleClaims) {
    const leadIndex = Number(claim.leadIndex);
    if (claim.listId && leadIndex >= 0) {
      await LeadList.updateOne(
        {
          _id: claim.listId,
          [`leads.${leadIndex}.status`]: 'Sending'
        },
        {
          $set: {
            [`leads.${leadIndex}.status`]: 'Pending',
            [`leads.${leadIndex}.error`]: '',
            [`leads.${leadIndex}.sendingStartedAt`]: null
          }
        }
      );
    }

    await CampaignRecipientLog.updateOne(
      {
        campaignId: claim.campaignId,
        email: String(claim.recipientEmail || '').trim().toLowerCase(),
        status: 'Sending'
      },
      {
        $set: {
          status: 'Pending',
          pendingCount: 1,
          lastActivityAt: now
        }
      }
    );

    await CampaignRecipientClaim.deleteOne({ _id: claim._id, status: 'Sending' });

    await Campaign.updateOne(
      { _id: claim.campaignId },
      {
        $push: {
          logs: {
            level: 'warning',
            message: `Reset stale queue item to pending: ${claim.recipientEmail || 'unknown recipient'}`,
            at: now
          }
        },
        $set: {
          lastActivityAt: now
        }
      }
    );
    schedulerState.recoveredCount += 1;
  }
}

export async function runCampaignSchedulerTick(options = {}) {
  if (!options.force && !isInAppCampaignSchedulerEnabled()) {
    return { skipped: true, reason: 'campaign scheduler disabled on this process' };
  }
  if (mongoose.connection.readyState !== 1) return;
  schedulerState.lastTickAt = new Date();
  schedulerState.lastTickStatus = 'running';
  schedulerState.lastError = '';

  const now = new Date();
  await recoverStaleCampaigns(now);
  await recoverStaleQueueItems(now);
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
    .select('_id name status userEmail scheduledAt scheduledStart queueRequestedAt')
    .sort({ queueRequestedAt: 1, scheduledAt: 1, createdAt: 1 })
    .lean();

  for (const campaign of dueCampaigns) {
    const id = String(campaign._id);
    if (schedulerState.inFlight.has(id)) continue;

    schedulerState.inFlight.add(id);
    try {
      if (String(campaign.status || '') === 'Scheduled') {
        const dueAt = campaign.scheduledAt || campaign.scheduledStart?.at || null;
        console.info('[campaign_due]', {
          campaignId: id,
          campaignName: campaign.name || '',
          userEmail: campaign.userEmail || '',
          scheduledAt: dueAt ? new Date(dueAt).toISOString() : '',
          tickAt: now.toISOString()
        });
        await Campaign.updateOne(
          {
            _id: campaign._id,
            status: 'Scheduled',
            $or: [
              { scheduledAt: { $ne: null, $lte: now } },
              { 'scheduledStart.at': { $ne: null, $lte: now } }
            ]
          },
          {
            $set: {
              status: 'Queued',
              queueRequestedAt: now,
              queueReason: 'Scheduled time reached; queued by scheduler',
              workerStatus: 'queued_by_scheduler',
              lastActivityAt: now
            },
            $push: {
              logs: {
                level: 'info',
                message: `campaign_due: scheduled time reached; queued by scheduler at ${now.toISOString()}`,
                at: now
              }
            }
          }
        );
      }
      await startCampaignRunner(id, { trigger: 'scheduler' });
    } catch (error) {
      schedulerState.lastError = error?.message || 'Unknown scheduler error';
      console.error(`Failed to auto-start scheduled campaign ${id}:`, error);
    } finally {
      schedulerState.inFlight.delete(id);
    }
  }

  schedulerState.lastTickStatus = 'ok';
  return { skipped: false, startedCount: dueCampaigns.length };
}

export function triggerCampaignSchedulerTick(options = {}) {
  if (schedulerState.tickPromise) {
    return schedulerState.tickPromise;
  }

  schedulerState.tickPromise = runCampaignSchedulerTick(options)
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
    enabled: isInAppCampaignSchedulerEnabled(),
    started: Boolean(schedulerState.started),
    startedAt: schedulerState.startedAt || null,
    lastTickAt: schedulerState.lastTickAt || null,
    lastTickStatus: schedulerState.lastTickStatus || 'idle',
    lastError: schedulerState.lastError || '',
    recoveredCount: Number(schedulerState.recoveredCount || 0),
    inFlightCount: schedulerState.inFlight.size,
    intervalMs: Math.max(2000, Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 5000)),
    workerLockStaleMs: WORKER_LOCK_STALE_MS,
    queueItemStaleMs: QUEUE_ITEM_STALE_MS
  };
}
