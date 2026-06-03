import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

function maskEnvValue(value = '') {
  const text = String(value || '');
  if (!text) return 'missing';
  if (text.length <= 8) return 'set';
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function loadEnvFromFile() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(scriptDir, '../.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFromFile();

process.on('unhandledRejection', (reason) => {
  console.error('[CAMPAIGN_WORKER_UNHANDLED_REJECTION]', {
    message: reason?.message || String(reason || 'Unknown rejection'),
    stack: reason?.stack || ''
  });
});

process.on('uncaughtException', (error) => {
  console.error('[CAMPAIGN_WORKER_UNCAUGHT_EXCEPTION]', {
    message: error?.message || 'Unknown exception',
    stack: error?.stack || ''
  });
  process.exit(1);
});

process.env.ENABLE_IN_APP_CAMPAIGN_SCHEDULER = 'true';
process.env.CAMPAIGN_WORKER_ID =
  String(process.env.CAMPAIGN_WORKER_ID || `aws-worker-${process.pid}`).trim() || `aws-worker-${process.pid}`;
const HEARTBEAT_INTERVAL_MS = Math.max(10000, Number(process.env.CAMPAIGN_WORKER_HEALTH_INTERVAL_MS || 30000));

async function writeWorkerHeartbeat(WorkerHeartbeat, extra = {}) {
  await WorkerHeartbeat.updateOne(
    { workerId: process.env.CAMPAIGN_WORKER_ID },
    {
      $set: {
        workerId: process.env.CAMPAIGN_WORKER_ID,
        host: os.hostname(),
        pid: process.pid,
        status: extra.status || 'running',
        lastHeartbeatAt: new Date(),
        intervalMs: HEARTBEAT_INTERVAL_MS,
        version: process.env.npm_package_version || '1.0.0',
        lastError: extra.lastError || '',
        meta: {
          nodeEnv: process.env.NODE_ENV || '',
          schedulerIntervalMs: Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 5000)
        }
      },
      $setOnInsert: {
        startedAt: new Date()
      }
    },
    { upsert: true }
  );
}

async function main() {
  const [{ default: connectDB }, { initCampaignScheduler, triggerCampaignSchedulerTick }, { assertValidEnvironment }, { default: CampaignWorkerHeartbeat }] = await Promise.all([
    import('../core-lib/database-config/MongoDatabaseConnection.js'),
    import('../core-lib/campaign-engine/CampaignQueueScheduler.js'),
    import('../core-lib/env-config/EnvironmentSafety.js'),
    import('../database-models/CampaignWorkerHeartbeat.js')
  ]);

  assertValidEnvironment({ nodeEnv: process.env.NODE_ENV || 'production' });
  await connectDB();
  await writeWorkerHeartbeat(CampaignWorkerHeartbeat);
  const heartbeatTimer = setInterval(() => {
    writeWorkerHeartbeat(CampaignWorkerHeartbeat).catch((error) => {
      console.error('[CAMPAIGN_WORKER_HEARTBEAT_FAILED]', {
        message: error?.message || 'Unknown heartbeat error'
      });
    });
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();

  const markStopping = async () => {
    try {
      await writeWorkerHeartbeat(CampaignWorkerHeartbeat, { status: 'stopping' });
    } finally {
      process.exit(0);
    }
  };
  process.once('SIGINT', markStopping);
  process.once('SIGTERM', markStopping);

  initCampaignScheduler();
  await triggerCampaignSchedulerTick();

  console.log('[CAMPAIGN_WORKER_READY]', {
    workerId: process.env.CAMPAIGN_WORKER_ID,
    intervalMs: Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 5000),
    graphSecrets: {
      tec: maskEnvValue(process.env.TEC_CLIENT_SECRET),
      tut: maskEnvValue(process.env.TUT_CLIENT_SECRET),
      default: maskEnvValue(process.env.CLIENT_SECRET)
    }
  });
}

main().catch((error) => {
  console.error('[CAMPAIGN_WORKER_FATAL]', {
    message: error?.message || 'Unknown worker error',
    stack: error?.stack || ''
  });
  process.exit(1);
});
