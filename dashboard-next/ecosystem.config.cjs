const path = require('path');

const appRoot = __dirname;

module.exports = {
  apps: [
    {
      name: 'intellimailpilot-web',
      cwd: appRoot,
      env_file: path.join(appRoot, '.env'),
      script: 'npm',
      args: 'run start',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        ENABLE_IN_APP_CAMPAIGN_SCHEDULER: 'false'
      },
      out_file: path.join(appRoot, 'logs', 'web.out.log'),
      error_file: path.join(appRoot, 'logs', 'web.err.log'),
      time: true
    },
    {
      name: 'intellimailpilot-worker',
      cwd: appRoot,
      env_file: path.join(appRoot, '.env'),
      script: 'npm',
      args: 'run worker:campaigns',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '750M',
      env: {
        NODE_ENV: 'production',
        ENABLE_IN_APP_CAMPAIGN_SCHEDULER: 'true',
        CAMPAIGN_WORKER_ID: 'aws-worker-1',
        CAMPAIGN_SCHEDULER_INTERVAL_MS: '5000',
        CAMPAIGN_WORKER_HEARTBEAT_MS: '15000',
        CAMPAIGN_WORKER_LOCK_STALE_MS: '120000'
      },
      out_file: path.join(appRoot, 'logs', 'worker.out.log'),
      error_file: path.join(appRoot, 'logs', 'worker.err.log'),
      time: true
    }
  ]
};
