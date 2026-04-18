import mongoose from 'mongoose';
import connectDB from '../lib/mongodb.js';
import UserProfile from '../models/UserProfile.js';
import Campaign from '../models/Campaign.js';

const applyChanges = process.argv.includes('--apply');
const WORKER_LOCK_STALE_MS = Math.max(30000, Number(process.env.CAMPAIGN_WORKER_LOCK_STALE_MS || 120000));

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isEmailLike(value = '') {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizeEmail(value));
}

async function collectUserProfileFixes() {
  const fixes = [];

  const emptyIdProfiles = await UserProfile.find({
    intellisysUserId: { $in: ['', ' '] }
  })
    .select({ _id: 1, identifier: 1, intellisysUserId: 1 })
    .lean();

  for (const profile of emptyIdProfiles) {
    fixes.push({
      kind: 'unset-empty-intellisysUserId',
      profileId: String(profile._id),
      identifier: profile.identifier || ''
    });
  }

  const profilesMissingUserId = await UserProfile.find({
    $or: [
      { intellisysUserId: { $exists: false } },
      { intellisysUserId: null }
    ]
  })
    .select({ _id: 1, identifier: 1, email: 1, username: 1 })
    .lean();

  for (const profile of profilesMissingUserId) {
    const candidate = normalizeEmail(profile.identifier || profile.email || profile.username || '');
    if (!isEmailLike(candidate)) continue;

    const existing = await UserProfile.findOne({
      intellisysUserId: candidate,
      _id: { $ne: profile._id }
    })
      .select({ _id: 1 })
      .lean();

    if (!existing) {
      fixes.push({
        kind: 'set-intellisysUserId-from-identifier',
        profileId: String(profile._id),
        identifier: candidate
      });
    }
  }

  return fixes;
}

async function collectCampaignFixes() {
  const fixes = [];
  const now = new Date();
  const staleBefore = new Date(now.getTime() - WORKER_LOCK_STALE_MS);

  const staleRunningCampaigns = await Campaign.find({
    status: 'Running',
    workerLockedAt: { $ne: null, $lt: staleBefore },
    $or: [
      { workerHeartbeatAt: null },
      { workerHeartbeatAt: { $lt: staleBefore } }
    ]
  })
    .select({ _id: 1, name: 1, userEmail: 1 })
    .lean();

  for (const campaign of staleRunningCampaigns) {
    fixes.push({
      kind: 'requeue-stale-running-campaign',
      campaignId: String(campaign._id),
      name: campaign.name || '',
      userEmail: campaign.userEmail || ''
    });
  }

  const lockedFinishedCampaigns = await Campaign.find({
    status: { $in: ['Paused', 'Completed', 'Failed'] },
    $or: [
      { workerId: { $ne: '' } },
      { workerLockedAt: { $ne: null } },
      { workerHeartbeatAt: { $ne: null } }
    ]
  })
    .select({ _id: 1, name: 1, status: 1, userEmail: 1 })
    .lean();

  for (const campaign of lockedFinishedCampaigns) {
    fixes.push({
      kind: 'clear-finished-worker-lock',
      campaignId: String(campaign._id),
      name: campaign.name || '',
      status: campaign.status || '',
      userEmail: campaign.userEmail || ''
    });
  }

  return fixes;
}

async function applyUserProfileFixes(fixes = []) {
  const operations = [];

  for (const fix of fixes) {
    if (fix.kind === 'unset-empty-intellisysUserId') {
      operations.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(fix.profileId) },
          update: { $unset: { intellisysUserId: 1 } }
        }
      });
    }

    if (fix.kind === 'set-intellisysUserId-from-identifier') {
      operations.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(fix.profileId) },
          update: { $set: { intellisysUserId: fix.identifier } }
        }
      });
    }
  }

  if (!operations.length) return { modifiedCount: 0 };
  return UserProfile.bulkWrite(operations, { ordered: false });
}

async function applyCampaignFixes(fixes = []) {
  const operations = [];
  const now = new Date();

  for (const fix of fixes) {
    if (fix.kind === 'requeue-stale-running-campaign') {
      operations.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(fix.campaignId) },
          update: {
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
                message: 'Legacy cleanup re-queued stale running campaign',
                at: now
              }
            }
          }
        }
      });
    }

    if (fix.kind === 'clear-finished-worker-lock') {
      operations.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(fix.campaignId) },
          update: {
            $set: {
              workerId: '',
              workerLockedAt: null,
              workerHeartbeatAt: null
            },
            $push: {
              logs: {
                level: 'info',
                message: 'Legacy cleanup cleared stale worker lock metadata',
                at: now
              }
            }
          }
        }
      });
    }
  }

  if (!operations.length) return { modifiedCount: 0 };
  return Campaign.bulkWrite(operations, { ordered: false });
}

async function main() {
  await connectDB();

  const [userProfileFixes, campaignFixes] = await Promise.all([
    collectUserProfileFixes(),
    collectCampaignFixes()
  ]);

  const summary = {
    mode: applyChanges ? 'apply' : 'dry-run',
    userProfiles: {
      unsetEmptyIntellisysUserId: userProfileFixes.filter((item) => item.kind === 'unset-empty-intellisysUserId').length,
      setFromIdentifier: userProfileFixes.filter((item) => item.kind === 'set-intellisysUserId-from-identifier').length
    },
    campaigns: {
      requeueStaleRunning: campaignFixes.filter((item) => item.kind === 'requeue-stale-running-campaign').length,
      clearFinishedLocks: campaignFixes.filter((item) => item.kind === 'clear-finished-worker-lock').length
    }
  };

  console.log('[LEGACY_CLEANUP_SUMMARY]', JSON.stringify(summary, null, 2));

  if (!applyChanges) {
    console.log('[LEGACY_CLEANUP_NOTE] Dry run only. Re-run with --apply to write changes.');
    return;
  }

  const [userResult, campaignResult] = await Promise.all([
    applyUserProfileFixes(userProfileFixes),
    applyCampaignFixes(campaignFixes)
  ]);

  console.log('[LEGACY_CLEANUP_APPLIED]', JSON.stringify({
    userProfileOps: userResult,
    campaignOps: campaignResult
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('[LEGACY_CLEANUP_ERROR]', {
      message: error?.message || 'Unknown cleanup error',
      stack: error?.stack || ''
    });
    process.exit(1);
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  });
