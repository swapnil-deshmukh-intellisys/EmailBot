# Campaign Worker Deployment

IntelliMailPilot must not rely on Vercel serverless functions for campaign sending. Vercel should create campaigns, validate send settings, and set campaigns to `Queued`. A persistent Node worker must process queued campaigns.

## Recommended Architecture

Use Vercel for the Next.js UI/API and run the campaign worker on a persistent server such as AWS EC2.

```bash
npm install
npm run build
pm2 start npm --name intellimailpilot-worker -- run worker:campaigns
pm2 save
pm2 status
```

The worker script is:

```bash
npm run worker:campaigns
```

It polls MongoDB, recovers stale locks, claims queued campaigns, sends mail, updates recipient logs, and refreshes campaign counters.

## Required Environment Variables

Set the same production secrets on Vercel and the worker server unless noted.

```bash
MONGODB_URI=
JWT_SECRET=
NEXTAUTH_SECRET=
AUTH_SECRET=
ENCRYPTION_KEY=

TEC_TENANT_ID=
TEC_CLIENT_ID=
TEC_CLIENT_SECRET=
TEC_GRAPH_SENDER_EMAIL=

TUT_TENANT_ID=
TUT_CLIENT_ID=
TUT_CLIENT_SECRET=
TUT_GRAPH_SENDER_EMAIL=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

APP_URL=
NEXT_PUBLIC_APP_URL=
WORKER_SECRET=
CRON_SECRET=
CAMPAIGN_WORKER_ID=ec2-worker-1
ENABLE_IN_APP_CAMPAIGN_SCHEDULER=true
CAMPAIGN_SCHEDULER_INTERVAL_MS=10000
CAMPAIGN_WORKER_LOCK_STALE_MS=300000
CAMPAIGN_QUEUE_ITEM_STALE_MS=900000
```

On Vercel, campaign scheduler execution is forced off even if `ENABLE_IN_APP_CAMPAIGN_SCHEDULER=true`. This prevents serverless request handlers from running long campaign loops.

## Debugging

Check a campaign:

```bash
GET /api/campaigns/:id/debug
```

The response includes campaign status, queue counts, worker heartbeat, lock fields, sender account state, user/project ownership, and recent logs/errors.

Check the worker tick endpoint on a persistent server:

```bash
curl -H "Authorization: Bearer $WORKER_SECRET" "$APP_URL/api/worker/tick"
```

The endpoint intentionally refuses to run on Vercel unless `ALLOW_VERCEL_WORKER_TICK=true` is set. Use that only for tiny emergency batches, not normal sending.

## Expected Status Flow

1. User clicks Send Now.
2. API validates sender, draft/template, lead list, owner, schedule, and limits.
3. Campaign status becomes `Queued`.
4. Worker claims it and sets status to `Running`.
5. Each recipient moves through pending/sending/sent/failed/skipped states.
6. Worker updates campaign counts.
7. Campaign becomes `Completed` or `Failed`.

If a worker dies, stale campaign locks and stale recipient send claims are reset automatically so the worker can retry safely.
