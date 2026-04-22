import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    if (!key || process.env[key]) continue;

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

process.env.ENABLE_IN_APP_CAMPAIGN_SCHEDULER = 'true';
process.env.CAMPAIGN_WORKER_ID =
  String(process.env.CAMPAIGN_WORKER_ID || `aws-worker-${process.pid}`).trim() || `aws-worker-${process.pid}`;

async function main() {
  const [{ default: connectDB }, { initCampaignScheduler, triggerCampaignSchedulerTick }] = await Promise.all([
    import('../lib/mongodb.js'),
    import('../lib/campaignScheduler.js')
  ]);

  await connectDB();
  initCampaignScheduler();
  await triggerCampaignSchedulerTick();

  console.log('[CAMPAIGN_WORKER_READY]', {
    workerId: process.env.CAMPAIGN_WORKER_ID,
    intervalMs: Number(process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || 5000)
  });
}

main().catch((error) => {
  console.error('[CAMPAIGN_WORKER_FATAL]', {
    message: error?.message || 'Unknown worker error',
    stack: error?.stack || ''
  });
  process.exit(1);
});
