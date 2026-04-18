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
