# Next.js Email Automation Dashboard

A web-based dashboard to upload lead files, create campaigns, send templated emails in controlled batches, and track status in real time.

## Stack
- Next.js (App Router) for UI + API routes
- MongoDB Atlas (Mongoose)
- Node.js email worker logic (Nodemailer SMTP/Outlook)

## Project Structure
The codebase is now organized around app routes, feature modules, shared UI, and backend core services:

```text
app/
  api/                     Route handlers grouped by feature
  components/
    dashboard/             Dashboard-only presentation pieces
    role-dashboard/        Shared authenticated shell for role-based dashboards
  dashboard/               Main dashboard route config/constants
  lib/                     App-facing helpers for roles/navigation/ui
  <route>/page.js          Feature pages such as campaigns, drafts, inbox, warm-up

modules/
  admin-module/            Admin-only feature components
  analytics-module/        Dashboard analytics components and hooks
  campaign-module/         Campaign tables, hooks, and scheduling helpers
  draft-module/            Draft editor and draft-specific utilities
  lead-module/             Lead-list presentation components
  template-module/         Template and draft-template services

shared-components/
  ui-components/           Reusable UI primitives
  layout-components/       App shell, topbar, sidebar, layout wrappers
  common-components/
    workspace-components/  Reusable workspace shells and placeholder page templates

core-lib/
  auth-config/             Auth/session guards and token helpers
  campaign-engine/         Campaign runner and scheduler
  database-config/         Mongo connection bootstrap
  logging/                 Activity logging services
  mail-engine/             SMTP/Graph sender logic and warmup services
  constants/               Shared backend constants

database-models/           Mongoose models
scripts/                   Operational scripts (campaign worker, data cleanup)
public/                    Static assets
aws/ecs/                   Deployment templates and runbooks
```

### Module Boundaries
- `app/api/*`: request/response orchestration only
- `core-lib/*`: reusable backend logic used by routes and workers
- `database-models/*`: database schema definitions only
- `shared-components/*`: reusable cross-feature UI and layout
- `modules/*`: feature-owned components, hooks, and utilities
- `app/components/dashboard/*`: dashboard-only presentation shared by the dashboard route
- `app/lib/*`: app-facing role, routing, and UI helpers
- `scripts/*`: standalone operational entry points

## Features Implemented
- Login-protected dashboard
- Upload `.xlsx` / `.csv` lead files
- Table preview after upload
- Campaign creation with template + list selection
- Start / Pause / Resume campaign controls
- Controlled batch sending (`batchSize`, `delaySeconds`)
- Email statuses per lead: `Pending`, `Sent`, `Failed`
- Live progress + logs via polling
- Multiple account support hook (rotation supported in runner)

## Setup
1. Install dependencies:
```bash
cd dashboard-next
npm install
```

2. Create env file:
```bash
copy .env.example .env
```

3. Update `.env` with:
- `MONGODB_URI` (Atlas connection string)
- `JWT_SECRET`
- `ALLOWED_ORIGINS` (comma-separated domains like `localhost:3000,yourdomain.com`)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Either SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
- Or Microsoft Graph settings (`TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `GRAPH_SENDER_EMAIL`)

Outlook SMTP values:
- `SMTP_HOST=smtp.office365.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`

Graph API notes:
- App must have `Mail.Send` application permission in Azure AD.
- Admin consent is required for that permission.
- `GRAPH_SENDER_EMAIL` must be a mailbox user allowed to send.
- For delegated OAuth mailbox access, set `MS_REDIRECT_URI` to your real deployed callback URL, for example `https://yourdomain.com/api/graph-oauth/callback`.

4. Run app:
```bash
npm run dev
```

For reliable long-running campaign sending, use production mode instead of dev mode:
```bash
npm run build
npm run start
```

5. Open:
- `http://localhost:3000/login`

## API Routes
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/uploads`
- `GET /api/stats`
- `GET /api/templates`
- `POST /api/templates`
- `GET /api/campaigns`
- `POST /api/campaigns`
- `POST /api/campaigns/:id/start`
- `POST /api/campaigns/:id/pause`
- `POST /api/campaigns/:id/resume`
- `GET /api/campaigns/:id/status`

## Health Checks
- `GET /api/health`
- `GET /api/worker-health`

Example:
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/worker-health
```

## AWS Deployment Runbook
Use one web process and one separate campaign worker process against the same MongoDB.

### 1. Web App
Environment:
```env
ENABLE_IN_APP_CAMPAIGN_SCHEDULER=false
CAMPAIGN_SCHEDULER_INTERVAL_MS=5000
CAMPAIGN_WORKER_LOCK_STALE_MS=120000
```

Run:
```bash
npm install
npm run build
npm run start
```

### 2. Campaign Worker
Environment:
```env
ENABLE_IN_APP_CAMPAIGN_SCHEDULER=true
CAMPAIGN_WORKER_ID=aws-worker-1
CAMPAIGN_SCHEDULER_INTERVAL_MS=5000
CAMPAIGN_WORKER_HEARTBEAT_MS=15000
CAMPAIGN_WORKER_LOCK_STALE_MS=120000
```

Run:
```bash
npm install
npm run worker:campaigns
```

### 3. Operational Checks
- Web healthy:
  - `GET /api/health`
- Queue healthy:
  - `GET /api/worker-health`
- Expected:
  - queued campaigns decrease when worker is live
  - running campaigns show fresh `workerHeartbeatAt`
  - `staleRunning` stays `0`

### 4. Failure Recovery
- If worker crashes, stale running campaigns are automatically re-queued after `CAMPAIGN_WORKER_LOCK_STALE_MS`.
- If queue grows but running stays `0`, restart the worker process.
- If `/api/health` fails, check web app logs and MongoDB connectivity first.

### 5. Recommended AWS Shape
- Web app:
  - ECS service, EC2 process manager, or similar
- Worker:
  - separate ECS service / EC2 process / PM2 process
- Database:
  - MongoDB Atlas or central MongoDB reachable from both
- Secrets:
  - store SMTP/Graph secrets in AWS Secrets Manager or Parameter Store

## PM2 on EC2
An EC2-ready PM2 config is included at:
- `ecosystem.config.cjs`

### Install PM2
```bash
npm install -g pm2
```

### Start both web + worker
```bash
pm2 start ecosystem.config.cjs
```

### Useful PM2 commands
```bash
pm2 status
pm2 logs intellimailpilot-web
pm2 logs intellimailpilot-worker
pm2 restart intellimailpilot-web
pm2 restart intellimailpilot-worker
pm2 save
pm2 startup
```

### Recommended EC2 rollout
```bash
git pull
npm install
npm run build
pm2 start ecosystem.config.cjs
```

### PM2 expectations
- web runs with `ENABLE_IN_APP_CAMPAIGN_SCHEDULER=false`
- worker runs with `ENABLE_IN_APP_CAMPAIGN_SCHEDULER=true`
- both must use the same MongoDB and same production env values

## Docker / ECS
A production Docker image is included at:
- `Dockerfile`

A local two-service example is included at:
- `docker-compose.ecs-local.yml`

### Build image
```bash
docker build -t intellimailpilot:latest .
```

### Run web container
```bash
docker run --env-file .env -p 3000:3000 \
  -e NODE_ENV=production \
  -e ENABLE_IN_APP_CAMPAIGN_SCHEDULER=false \
  intellimailpilot:latest
```

### Run worker container
```bash
docker run --env-file .env \
  -e NODE_ENV=production \
  -e ENABLE_IN_APP_CAMPAIGN_SCHEDULER=true \
  -e CAMPAIGN_WORKER_ID=aws-worker-1 \
  -e CAMPAIGN_SCHEDULER_INTERVAL_MS=5000 \
  -e CAMPAIGN_WORKER_HEARTBEAT_MS=15000 \
  -e CAMPAIGN_WORKER_LOCK_STALE_MS=120000 \
  intellimailpilot:latest npm run worker:campaigns
```

### ECS shape
- Service 1:
  - web container
  - desired count `1+`
  - public or behind ALB
- Service 2:
  - worker container
  - desired count `1`
  - private service, no public listener required

### ECS env guidance
- Web task:
  - `ENABLE_IN_APP_CAMPAIGN_SCHEDULER=false`
- Worker task:
  - `ENABLE_IN_APP_CAMPAIGN_SCHEDULER=true`
  - `CAMPAIGN_WORKER_ID=aws-worker-1`
- Shared:
  - `MONGODB_URI`
  - auth envs
  - SMTP / Graph envs
  - `JWT_SECRET`

### Local container test
```bash
docker compose -f docker-compose.ecs-local.yml up --build
```

### ECS templates included
- `aws/ecs/web-task-definition.template.json`
- `aws/ecs/worker-task-definition.template.json`
- `aws/ecs/deploy-checklist.md`
- `aws/ecs/env.example.production`

## Legacy Data Cleanup
If you have old Mongo records from before the auth/worker fixes, a cleanup script is included:
- `scripts/cleanup-legacy-data.mjs`

Dry run:
```bash
npm run cleanup:legacy
```

Apply fixes:
```bash
npm run cleanup:legacy -- --apply
```

What it fixes:
- unsets empty `intellisysUserId` values on `UserProfile`
- fills missing `intellisysUserId` from email-like identifiers when safe
- re-queues stale `Running` campaigns with dead worker locks
- clears worker lock metadata from finished campaigns

## Notes
- Campaign execution is now queue-oriented and worker-owned.
- SMTP credentials should be app passwords or secrets manager values.
- If Graph variables are present, sender uses Graph first; SMTP is fallback.
