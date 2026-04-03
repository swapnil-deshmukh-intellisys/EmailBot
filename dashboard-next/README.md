# Next.js Email Automation Dashboard

A web-based dashboard to upload lead files, create campaigns, send templated emails in controlled batches, and track status in real time.

## Stack
- Next.js (App Router) for UI + API routes
- MongoDB Atlas (Mongoose)
- Node.js email worker logic (Nodemailer SMTP/Outlook)

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

## Notes
- Campaign runner is in-process (`lib/campaignRunner.js`). For production at scale, move it to a queue worker (BullMQ/RabbitMQ).
- SMTP credentials should be app passwords or secrets manager values.
- If Graph variables are present, sender uses Graph first; SMTP is fallback.
