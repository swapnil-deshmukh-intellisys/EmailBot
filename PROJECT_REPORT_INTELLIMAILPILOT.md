# IntelliMailPilot Final Project Report

## Executive Summary

IntelliMailPilot / EmailBot is a Next.js and MongoDB based email operations platform for managing client data, drafts, sender accounts, campaign workflows, campaign execution, inbox activity, warm-up flows, reporting, credits, and role-based administration.

As of June 25, 2026, the codebase contains a working application shell, authenticated user/admin flows, client-list ingestion and cleanup, draft/template management, campaign creation and scheduling, a persistent campaign worker design, Microsoft Graph and SMTP sending support, campaign tracking models, reply/reply-all/reminder threading support for sent campaign emails, operational reports, warm-up automation, and deployment assets for Docker, PM2, and AWS ECS-style worker separation.

The implementation is strongest around campaign orchestration, database-backed tracking, sender resolution, Microsoft Graph/SMTP sending, client data management, and the campaign detail workflow. Visible risks are mainly operational: email provider credentials must be correctly configured, Microsoft token expiry and Graph app-only permissions must be managed, long-running campaign sending requires the persistent worker rather than serverless execution, and some UI/code files are currently modified in the working tree and should be regression-tested before release.

## 1. Project Overview

IntelliMailPilot is designed to support sales/editorial outreach operations for multiple projects, especially TEC and TUT. The product manages lead lists, sender identities, email drafts, campaign steps, scheduled sending, delivery/reply tracking, and reporting.

Primary application root:

- `dashboard-next/`

Supporting/legacy areas:

- `campaign_engine/` contains an older Express-style campaign engine package.
- `legacy/` contains previous implementation files.
- `project-management/` contains project management tracker/report assets.

Current active application entry points:

- Frontend pages: `dashboard-next/app/**/page.js`
- API routes: `dashboard-next/app/api/**/route.js`
- Core services: `dashboard-next/core-lib/**`
- Database models: `dashboard-next/database-models/**`
- Feature modules: `dashboard-next/modules/**`

## 2. Technical Stack

Observed from `dashboard-next/package.json`:

- Frontend framework: Next.js 14.2.5, React 18.2.0, React DOM 18.2.0.
- Backend runtime: Next.js App Router API routes.
- Database: MongoDB with Mongoose 8.18.0.
- Authentication/security: JWT, bcryptjs, cookie-based auth helpers.
- Email sending: Microsoft Graph, delegated OAuth, nodemailer SMTP/Gmail fallback.
- Mailbox/inbox: Microsoft Graph mailbox APIs, IMAP support for Gmail warm-up auto reply.
- File/data handling: xlsx, mammoth, pdfjs-dist.
- UI/editor libraries: TipTap editor packages, AG Grid, framer-motion, lucide-react, Tabler icons via CSS usage.
- Build/deployment: Docker, PM2 ecosystem config, AWS ECS templates/scripts, standalone Next.js output.

Important files:

- `dashboard-next/package.json`
- `dashboard-next/next.config.js`
- `dashboard-next/Dockerfile`
- `dashboard-next/docker-compose.ecs-local.yml`
- `dashboard-next/ecosystem.config.cjs`
- `dashboard-next/scripts/campaign-worker.mjs`

## 3. Module-wise Completed Work

### 3.1 Dashboard Module

Completed Features:

- Role-aware dashboard pages for user, manager, and admin entry points.
- Dashboard stats, activity feed, quick actions, performance sections, recent campaigns, and project-oriented operational panels.
- Campaign action menus from dashboard broadcast/performance areas, including campaign view and reply-all flow entry points.

UI Pages:

- `dashboard-next/app/dashboard/page.js`
- `dashboard-next/app/dashboard/user/page.js`
- `dashboard-next/app/dashboard/manager/page.js`
- `dashboard-next/app/dashboard/admin/page.js`
- `dashboard-next/app/dashboard/broadcasts/page.js`
- `dashboard-next/app/dashboard/DashboardClientPage.jsx`
- `dashboard-next/app/dashboard/components/MainPanels.jsx`
- `dashboard-next/app/components/dashboard/*`

APIs:

- `dashboard-next/app/api/dashboard/overview/route.js`
- `dashboard-next/app/api/dashboard/activity/route.js`
- `dashboard-next/app/api/stats/route.js`

Database Models:

- `dashboard-next/database-models/Campaign.js`
- `dashboard-next/database-models/CampaignRecipientLog.js`
- `dashboard-next/database-models/ActivityLogModel.js`
- `dashboard-next/database-models/TimelineTask.js`
- `dashboard-next/database-models/WorkUpdate.js`

Current Status:

- Implemented as a production-style operational dashboard with separate role pages and reusable dashboard components.

### 3.2 Client Data Module

Completed Features:

- Client list page with searchable rows, custom list creation, campaign history context, project metadata, and reply history actions.
- Upload sheet workflow with preview and normalized lead mapping.
- Duplicate detection based on email, phone, LinkedIn URL, company name, and full-name/company combinations.
- Bulk save, bulk update, bulk delete, bin, restore, history, extracted data, paste workspace, selected sheets, and custom lists.
- Lead field normalization for name, company, designation, email, phone, domain, sector, country, source, sourcer, project approach, and sender ID.

UI Pages:

- `dashboard-next/app/client-data/page.js`
- `dashboard-next/app/client-data/client-list/page.js`
- `dashboard-next/app/client-data/upload-sheet/page.js`
- `dashboard-next/app/client-data/uploaded-files/page.js`
- `dashboard-next/app/client-data/components/UploadSheetWorkflow.jsx`
- `dashboard-next/app/client-data/components/SheetDetailsPanel.jsx`
- `dashboard-next/app/client-data/components/ExcelGrid.jsx`
- `dashboard-next/app/client-data/components/DirectoryExcelGrid.jsx`

APIs:

- `dashboard-next/app/api/client-data/list/route.js`
- `dashboard-next/app/api/client-data/create/route.js`
- `dashboard-next/app/api/client-data/bulk-save/route.js`
- `dashboard-next/app/api/client-data/bulk-update/route.js`
- `dashboard-next/app/api/client-data/bulk-delete/route.js`
- `dashboard-next/app/api/client-data/duplicates/route.js`
- `dashboard-next/app/api/client-data/bin/route.js`
- `dashboard-next/app/api/client-data/history/route.js`
- `dashboard-next/app/api/client-data/extracted/route.js`
- `dashboard-next/app/api/client-data/paste/route.js`
- `dashboard-next/app/api/client-data/paste-workspace/route.js`
- `dashboard-next/app/api/client-data/custom-lists/route.js`
- `dashboard-next/app/api/client-sheets/upload/route.js`
- `dashboard-next/app/api/client-sheets/[id]/rows/route.js`
- `dashboard-next/app/api/client-records/*`

Database Models:

- `dashboard-next/database-models/LeadList.js`
- `dashboard-next/database-models/ClientRecord.js`
- `dashboard-next/database-models/ClientSheet.js`
- `dashboard-next/database-models/ClientBinRecord.js`
- `dashboard-next/database-models/UploadFile.js`

Important Files:

- `dashboard-next/core-lib/client-data-config/UploadSheetValidation.js`

Current Status:

- Implemented with normalization, validation, duplicate analysis, and campaign-ready list preparation.

### 3.3 Drafts / Template Module

Completed Features:

- Draft list and draft detail pages.
- Email draft/template storage.
- File text extraction support for draft input.
- Template API for reusable email content.
- Campaign creation can use draft ID, draft type, or inline template content.

UI Pages:

- `dashboard-next/app/drafts/page.js`
- `dashboard-next/app/drafts/[id]/page.js`
- `dashboard-next/app/draft-templates/page.js`

APIs:

- `dashboard-next/app/api/drafts/route.js`
- `dashboard-next/app/api/drafts/[id]/route.js`
- `dashboard-next/app/api/draft-file-text/route.js`
- `dashboard-next/app/api/templates/route.js`

Database Models:

- `dashboard-next/database-models/EmailDraft.js`
- `dashboard-next/database-models/EmailTemplate.js`
- `dashboard-next/database-models/MailDraft.js`

Current Status:

- Implemented as reusable campaign content and template input layer.

### 3.4 Campaign Workflow Module

Completed Features:

- Campaign creation, list selection, template/draft selection, sender selection, schedule/send-now configuration, tracking toggles, and project tagging.
- Multi-step workflow configuration for cover story, reminder, follow up, updated cost, and final call.
- Campaign list and campaign details drawer.
- Campaign detail drawer shows summary, recipients, timeline, step history, reply actions, and follow-up metrics.
- Reply, Reply All, and reminder compose actions are present in campaign detail/recipient activity surfaces.

UI Pages:

- `dashboard-next/app/campaigns/page.js`
- `dashboard-next/modules/campaign-module/campaign-components/CampaignDetailsDrawer.jsx`
- `dashboard-next/app/dashboard/components/Workflow.jsx`
- `dashboard-next/app/dashboard/components/WorkflowModal.css`

APIs:

- `dashboard-next/app/api/campaigns/route.js`
- `dashboard-next/app/api/campaigns/[id]/route.js`
- `dashboard-next/app/api/campaigns/[id]/start/route.js`
- `dashboard-next/app/api/campaigns/[id]/pause/route.js`
- `dashboard-next/app/api/campaigns/[id]/resume/route.js`
- `dashboard-next/app/api/campaigns/[id]/stop/route.js`
- `dashboard-next/app/api/campaigns/[id]/schedule/route.js`
- `dashboard-next/app/api/campaigns/[id]/status/route.js`
- `dashboard-next/app/api/campaigns/[id]/recipients/route.js`
- `dashboard-next/app/api/campaigns/[id]/activity/route.js`
- `dashboard-next/app/api/campaigns/[id]/export/route.js`
- `dashboard-next/app/api/campaigns/[id]/debug/route.js`
- `dashboard-next/app/api/campaigns/[id]/next-step/route.js`

Database Models:

- `dashboard-next/database-models/Campaign.js`
- `dashboard-next/database-models/CampaignRecipientLog.js`
- `dashboard-next/database-models/CampaignRecipientClaim.js`
- `dashboard-next/database-models/RecipientSendLock.js`

Current Status:

- Implemented with detailed campaign lifecycle control and recipient-level activity tracking.

### 3.5 Campaign Execution Engine

Completed Features:

- Persistent queue scheduler for queued/scheduled campaigns.
- Campaign runner with campaign locks, sender send slots, concurrency limits, stale lock recovery, heartbeat updates, pause/resume/stop handling, and recipient send claims.
- Credit reservation/refund integration during send attempts.
- Recipient-level send status, failure classification, bounce/spam/failure handling, and campaign rollup refresh.
- Thread metadata storage for later replies/follow-ups.

Important Files:

- `dashboard-next/core-lib/campaign-engine/CampaignQueueScheduler.js`
- `dashboard-next/core-lib/campaign-engine/CampaignExecutionRunner.js`
- `dashboard-next/core-lib/campaign-engine/CampaignAnalyticsService.js`
- `dashboard-next/core-lib/campaign-engine/CampaignStatusSummary.js`
- `dashboard-next/scripts/campaign-worker.mjs`

APIs:

- `dashboard-next/app/api/worker/tick/route.js`
- `dashboard-next/app/api/worker-health/route.js`
- `dashboard-next/app/api/campaigns/[id]/start/route.js`

Database Models:

- `dashboard-next/database-models/Campaign.js`
- `dashboard-next/database-models/CampaignRecipientLog.js`
- `dashboard-next/database-models/CampaignSentEmail.js`
- `dashboard-next/database-models/EmailThread.js`
- `dashboard-next/database-models/CampaignWorkerHeartbeat.js`
- `dashboard-next/database-models/CampaignRecipientClaim.js`
- `dashboard-next/database-models/RecipientSendLock.js`
- `dashboard-next/database-models/CreditTransaction.js`
- `dashboard-next/database-models/UserSubscription.js`

Current Status:

- Implemented for persistent worker execution. Deployment documentation explicitly warns not to rely on Vercel serverless functions for normal campaign sending.

### 3.6 Sender ID / Mail Account Module

Completed Features:

- Sender ID creation with project assignment.
- Sender account resolution from DB accounts, Microsoft OAuth accounts, Graph app-only preset senders, and runtime SMTP environment accounts.
- Project-scoped preset senders for TEC and TUT.
- Account verification before DB account creation.
- Sender account APIs support owned-only and all-account views.

UI Pages:

- `dashboard-next/app/sender-emails/page.js`

APIs:

- `dashboard-next/app/api/sender-ids/route.js`
- `dashboard-next/app/api/accounts/route.js`
- `dashboard-next/app/api/accounts/[id]/route.js`
- `dashboard-next/app/api/accounts/connect/route.js`
- `dashboard-next/app/api/preset-senders/route.js`

Database Models:

- `dashboard-next/database-models/SenderId.js`
- `dashboard-next/database-models/SenderAccount.js`
- `dashboard-next/database-models/ConnectedMailAccount.js`
- `dashboard-next/database-models/GraphOAuthAccount.js`
- `dashboard-next/database-models/PresetSender.js`
- `dashboard-next/database-models/Project.js`

Important Files:

- `dashboard-next/core-lib/mail-engine/SenderAccountResolver.js`
- `dashboard-next/core-lib/mail-engine/GraphAndSmtpMailSender.js`

Current Status:

- Implemented with TEC/TUT project-aware sender discovery and campaign runner integration.

### 3.7 Outlook / Microsoft Graph Integration

Completed Features:

- Delegated Microsoft OAuth start/callback flow.
- Encrypted token storage and token refresh.
- Microsoft mailbox account lookup.
- Graph folders, messages, message details, send, reply, forward, archive, delete, mark-read routes.
- Campaign sending through Graph app-only or delegated OAuth paths.
- Campaign reply/reply-all uses Graph createReply/createReplyAll where available.

UI Pages:

- `dashboard-next/app/mail-inbox/page.js`
- `dashboard-next/app/user/master-inbox/page.js`

APIs:

- `dashboard-next/app/api/graph-oauth/start/route.js`
- `dashboard-next/app/api/graph-oauth/callback/route.js`
- `dashboard-next/app/api/mailbox/accounts/route.js`
- `dashboard-next/app/api/mailbox/folders/route.js`
- `dashboard-next/app/api/mailbox/messages/route.js`
- `dashboard-next/app/api/mailbox/messages/[id]/route.js`
- `dashboard-next/app/api/mailbox/reply/route.js`
- `dashboard-next/app/api/outlook/*`

Database Models:

- `dashboard-next/database-models/GraphOAuthAccount.js`
- `dashboard-next/database-models/ConnectedMailAccount.js`
- `dashboard-next/database-models/MailFolderCache.js`
- `dashboard-next/database-models/MailMessageCache.js`
- `dashboard-next/database-models/MailSyncState.js`

Important Files:

- `dashboard-next/core-lib/mail-engine/MicrosoftGraphMailboxService.js`
- `dashboard-next/core-lib/mail-engine/MicrosoftGraphOAuthScopes.js`
- `dashboard-next/core-lib/auth-config/TokenCryptoService.js`

Current Status:

- Implemented. Requires correct Microsoft OAuth/app credentials and token encryption secret in environment.

### 3.8 SMTP Integration

Completed Features:

- SMTP/Gmail runtime account support from environment variables.
- DB-backed SMTP/Gmail sender accounts.
- Nodemailer sending with validated recipient/subject.
- Campaign threading fallback using `In-Reply-To` and `References` headers.
- Gmail IMAP inbox scan support for warm-up auto replies.

APIs:

- `dashboard-next/app/api/accounts/route.js`
- `dashboard-next/app/api/sender-ids/route.js`
- `dashboard-next/app/api/send-test/route.js`
- `dashboard-next/app/api/mailbox/send/route.js`

Database Models:

- `dashboard-next/database-models/SenderAccount.js`
- `dashboard-next/database-models/SenderId.js`

Important Files:

- `dashboard-next/core-lib/mail-engine/GraphAndSmtpMailSender.js`
- `dashboard-next/core-lib/mail-engine/SenderAccountResolver.js`

Current Status:

- Implemented. SMTP account health depends on correct app passwords and provider SMTP settings.

### 3.9 Inbox / Reply / Reply All / Reminder Threading

Completed Features:

- Sent campaign email metadata model.
- Email thread metadata model.
- Campaign email replies model.
- Campaign recipient logs store step-level message IDs, internet message IDs, conversation IDs, and tracking IDs.
- Campaign details UI exposes Reply All actions and compose modal.
- Compose prefill API loads original subject, recipient, CC, sender, project, campaign, draft, and previous email preview.
- Reply send API supports `reply`, `reply_all`, and `reminder`.
- Graph path uses createReply/createReplyAll draft update and send.
- SMTP path uses `In-Reply-To`, `References`, and `Re:` subject logic.
- Reply activity updates campaign recipient log counters and thread status.

UI Pages:

- `dashboard-next/modules/campaign-module/campaign-components/CampaignDetailsDrawer.jsx`
- `dashboard-next/app/campaigns/page.js`
- `dashboard-next/app/client-data/client-list/page.js`
- `dashboard-next/app/dashboard/components/MainPanels.jsx`
- `dashboard-next/app/mail-inbox/page.js`

APIs:

- `dashboard-next/app/api/campaigns/[id]/replies/route.js`
- `dashboard-next/app/api/campaigns/[id]/sync-replies/route.js`
- `dashboard-next/app/api/mailbox/reply/route.js`
- `dashboard-next/app/api/outlook/reply/route.js`

Database Models:

- `dashboard-next/database-models/CampaignSentEmail.js`
- `dashboard-next/database-models/EmailThread.js`
- `dashboard-next/database-models/CampaignEmailReply.js`
- `dashboard-next/database-models/CampaignReply.js`
- `dashboard-next/database-models/CampaignRecipientLog.js`

Important Files:

- `dashboard-next/core-lib/mail-engine/CampaignThreadReplyService.js`
- `dashboard-next/core-lib/mail-engine/GraphAndSmtpMailSender.js`

Current Status:

- Implemented at backend/service/API level and visible in campaign detail/client list/dashboard action surfaces. Exact inbox parity depends on provider metadata availability from original sent email records.

### 3.10 Reports & Analytics

Completed Features:

- Report dashboard for delivery, campaign status, client coverage, project comparison, sender health, warm-up, and credits.
- Project-wise report API.
- Campaign export API includes reply/reminder metrics.
- Campaign analytics service builds timeline, step history, safe actions, display status, counts, and rollups.

UI Pages:

- `dashboard-next/app/report/page.js`
- `dashboard-next/app/summary/page.js`

APIs:

- `dashboard-next/app/api/reports/overview/route.js`
- `dashboard-next/app/api/reports/project-wise/route.js`
- `dashboard-next/app/api/reports/sender-health/route.js`
- `dashboard-next/app/api/reports/warmup/route.js`
- `dashboard-next/app/api/reports/credits/route.js`
- `dashboard-next/app/api/campaigns/[id]/export/route.js`

Database Models:

- `dashboard-next/database-models/Campaign.js`
- `dashboard-next/database-models/CampaignRecipientLog.js`
- `dashboard-next/database-models/CreditTransaction.js`
- `dashboard-next/database-models/WarmupConversation.js`
- `dashboard-next/database-models/WarmupMessage.js`

Important Files:

- `dashboard-next/core-lib/campaign-engine/CampaignAnalyticsService.js`

Current Status:

- Implemented as operational analytics, not a formal BI warehouse.

### 3.11 Credits / Usage Limit System

Completed Features:

- Subscription summary generation.
- Basic, Starter, Professional, and Enterprise plan definitions.
- Monthly and daily limit tracking.
- Credit transactions for reservation, refund, plan upgrade, and admin extra credits.
- Upgrade request flow and admin review support.
- Sending-disabled indicator based on daily usage/status.

APIs:

- `dashboard-next/app/api/credits/route.js`
- `dashboard-next/app/api/subscription/route.js`
- `dashboard-next/app/api/subscription/upgrade/route.js`
- `dashboard-next/app/api/billing/upgrade/route.js`
- `dashboard-next/app/api/billing/invoice/route.js`
- `dashboard-next/app/api/admin/upgrade-requests/route.js`
- `dashboard-next/app/api/admin/users/[id]/subscription/route.js`

Database Models:

- `dashboard-next/database-models/UserSubscription.js`
- `dashboard-next/database-models/CreditTransaction.js`
- `dashboard-next/database-models/UpgradeRequest.js`
- `dashboard-next/database-models/UserProfile.js`

Important Files:

- `dashboard-next/core-lib/billing/SubscriptionCreditService.js`

Current Status:

- Implemented and connected to campaign send reservation/refund logic.

### 3.12 Warm-up Module

Completed Features:

- Warm-up dashboard page and APIs.
- Warm-up sheets, senders, leads, drafts, projects, conversations, start/pause/stop/run-next flows.
- Auto communication scheduler for warm-up conversations.
- Warm-up message sequence with real send when both sides have verified accounts, otherwise simulated messages.
- Auto-reply setting and logs for Graph/Gmail warm-up replies.

UI Pages:

- `dashboard-next/app/warm-up/page.js`

APIs:

- `dashboard-next/app/api/warmup-dashboard/route.js`
- `dashboard-next/app/api/warmup/start/route.js`
- `dashboard-next/app/api/warmup/pause/route.js`
- `dashboard-next/app/api/warmup/stop/route.js`
- `dashboard-next/app/api/warmup/run-next/route.js`
- `dashboard-next/app/api/warmup/start-auto-communication/route.js`
- `dashboard-next/app/api/warmup-auto-reply/route.js`
- `dashboard-next/app/api/warmup/*`

Database Models:

- `dashboard-next/database-models/WarmupSheet.js`
- `dashboard-next/database-models/WarmupConversation.js`
- `dashboard-next/database-models/WarmupMessage.js`
- `dashboard-next/database-models/WarmupAutoReplySetting.js`
- `dashboard-next/database-models/WarmupAutoReplyLog.js`

Important Files:

- `dashboard-next/core-lib/mail-engine/WarmupAutoCommunicationService.js`
- `dashboard-next/core-lib/mail-engine/WarmupAutoReplyService.js`

Current Status:

- Implemented with both simulated and real provider-backed flows depending on sender connectivity.

### 3.13 Admin Module

Completed Features:

- Admin dashboard, user list, user detail, pending access requests, upgrade request handling, user status management, password reset, user campaigns/drafts/client-lists, and subscription management.
- Activity logging helper for audit-style events.

UI Pages:

- `dashboard-next/app/dashboard/admin/page.js`
- `dashboard-next/app/dashboard/admin/users/page.js`
- `dashboard-next/app/dashboard/admin/users/[id]/page.js`
- `dashboard-next/app/dashboard/admin/pending-requests/page.js`

APIs:

- `dashboard-next/app/api/admin/users/route.js`
- `dashboard-next/app/api/admin/users/[id]/route.js`
- `dashboard-next/app/api/admin/users/[id]/status/route.js`
- `dashboard-next/app/api/admin/users/[id]/reset-password/route.js`
- `dashboard-next/app/api/admin/users/[id]/subscription/route.js`
- `dashboard-next/app/api/admin/users/[id]/campaigns/route.js`
- `dashboard-next/app/api/admin/users/[id]/drafts/route.js`
- `dashboard-next/app/api/admin/users/[id]/client-lists/route.js`
- `dashboard-next/app/api/admin/pending-requests/route.js`
- `dashboard-next/app/api/admin/upgrade-requests/route.js`

Database Models:

- `dashboard-next/database-models/UserProfile.js`
- `dashboard-next/database-models/SignupRequest.js`
- `dashboard-next/database-models/UpgradeRequest.js`
- `dashboard-next/database-models/ActivityLogModel.js`

Current Status:

- Implemented with protected admin APIs.

### 3.14 User Module

Completed Features:

- Login, logout, current user, request access, forgot password, reset password, change password, profile overview, profile update, and password update.
- Account pending, disabled, and unauthorized pages.
- Role-based auth guards and owner filters for API queries.

UI Pages:

- `dashboard-next/app/login/page.js`
- `dashboard-next/app/request-access/page.js`
- `dashboard-next/app/forgot-password/page.js`
- `dashboard-next/app/reset-password/page.js`
- `dashboard-next/app/change-password/page.js`
- `dashboard-next/app/account/pending/page.js`
- `dashboard-next/app/account/disabled/page.js`
- `dashboard-next/app/unauthorized/page.js`
- `dashboard-next/app/dashboard/user/profile/page.js`
- `dashboard-next/app/dashboard/user/profile/[section]/page.js`

APIs:

- `dashboard-next/app/api/auth/login/route.js`
- `dashboard-next/app/api/auth/logout/route.js`
- `dashboard-next/app/api/auth/me/route.js`
- `dashboard-next/app/api/auth/request-access/route.js`
- `dashboard-next/app/api/auth/forgot-password/route.js`
- `dashboard-next/app/api/auth/reset-password/route.js`
- `dashboard-next/app/api/auth/change-password/route.js`
- `dashboard-next/app/api/profile/route.js`
- `dashboard-next/app/api/profile/overview/route.js`
- `dashboard-next/app/api/profile/password/route.js`

Database Models:

- `dashboard-next/database-models/UserProfile.js`
- `dashboard-next/database-models/SignupRequest.js`

Important Files:

- `dashboard-next/core-lib/auth-config/ApiAuthGuard.js`
- `dashboard-next/core-lib/auth-config/AuthSessionService.js`

Current Status:

- Implemented with JWT cookie sessions, password hashing, password reset tokens, account statuses, and role restrictions.

### 3.15 Project Filter System TEC/TUT

Completed Features:

- Project model and seeded default TEC/TUT projects in sender ID API.
- TEC/TUT sender preset lists.
- Project-aware Microsoft Graph config from TEC/TUT environment variables.
- Project filters in campaign APIs using project code/name and sender domain.
- Client data stores project and project name metadata.
- Reports include project-wise campaign/client/sent breakdown.

Important Files:

- `dashboard-next/core-lib/mail-engine/SenderAccountResolver.js`
- `dashboard-next/core-lib/mail-engine/GraphAndSmtpMailSender.js`
- `dashboard-next/app/api/campaigns/route.js`
- `dashboard-next/app/api/reports/project-wise/route.js`
- `dashboard-next/app/report/page.js`

Database Models:

- `dashboard-next/database-models/Project.js`
- `dashboard-next/database-models/PresetSender.js`
- `dashboard-next/database-models/Campaign.js`
- `dashboard-next/database-models/LeadList.js`

Current Status:

- Implemented across sender resolution, campaign filtering, client metadata, and reports.

## 4. Backend Architecture

The backend uses Next.js App Router API routes under `dashboard-next/app/api`. Database access is handled with Mongoose models under `dashboard-next/database-models`, commonly imported through path aliases such as `@/models/*`.

Key backend service layers:

- Authentication and authorization: `dashboard-next/core-lib/auth-config/*`
- Database connection: `dashboard-next/core-lib/database-config/MongoDatabaseConnection.js`
- Campaign execution: `dashboard-next/core-lib/campaign-engine/*`
- Mail sending and mailbox integration: `dashboard-next/core-lib/mail-engine/*`
- Billing/credits: `dashboard-next/core-lib/billing/SubscriptionCreditService.js`
- Client data validation: `dashboard-next/core-lib/client-data-config/UploadSheetValidation.js`
- Environment validation: `dashboard-next/core-lib/env-config/EnvironmentSafety.js`
- Logging: `dashboard-next/core-lib/logging/ActivityLogService.js`

The architecture is service-oriented inside the Next.js app, with API routes acting as thin controllers around shared core-lib services.

## 5. Frontend Architecture

The frontend is built with Next.js App Router pages and React components.

Main page groups:

- Auth/account pages: `dashboard-next/app/login`, `request-access`, `forgot-password`, `reset-password`, `change-password`, `account/*`.
- Dashboard pages: `dashboard-next/app/dashboard/**`.
- Campaign pages: `dashboard-next/app/campaigns/page.js` and `dashboard-next/modules/campaign-module/**`.
- Client data pages: `dashboard-next/app/client-data/**`.
- Draft pages: `dashboard-next/app/drafts/**`, `dashboard-next/app/draft-templates/page.js`.
- Inbox pages: `dashboard-next/app/mail-inbox/page.js`, `dashboard-next/app/user/master-inbox/page.js`.
- Sender page: `dashboard-next/app/sender-emails/page.js`.
- Warm-up page: `dashboard-next/app/warm-up/page.js`.
- Report page: `dashboard-next/app/report/page.js`.

Styling is concentrated in:

- `dashboard-next/app/globals.css`
- `dashboard-next/app/theme.css`
- `dashboard-next/app/dashboard/dashboard-design.css`
- Feature CSS files under `dashboard-next/app/dashboard/components/*.css`

## 6. Database Architecture

The codebase currently contains 41 database model files. Major collections include:

- User/auth/admin: `UserProfile`, `SignupRequest`, `ActivityLogModel`.
- Campaigns: `Campaign`, `CampaignRecipientLog`, `CampaignRecipientClaim`, `RecipientSendLock`, `CampaignWorkerHeartbeat`.
- Campaign threading: `CampaignSentEmail`, `EmailThread`, `CampaignEmailReply`, `CampaignReply`.
- Client data: `LeadList`, `ClientRecord`, `ClientSheet`, `ClientBinRecord`, `UploadFile`.
- Drafts/templates: `EmailDraft`, `EmailTemplate`, `MailDraft`.
- Sender/mailbox: `SenderId`, `SenderAccount`, `ConnectedMailAccount`, `GraphOAuthAccount`, `PresetSender`, `MailFolderCache`, `MailMessageCache`, `MailSyncState`.
- Billing: `UserSubscription`, `CreditTransaction`, `UpgradeRequest`.
- Warm-up: `WarmupSheet`, `WarmupConversation`, `WarmupMessage`, `WarmupAutoReplySetting`, `WarmupAutoReplyLog`.
- Productivity/project: `Project`, `TimelineTask`, `CalendarEvent`, `WorkUpdate`, `TargetApproval`.

The campaign execution path persists both campaign-level counters and recipient-level logs. This is important because reports and campaign details can be rebuilt from recipient-level state when needed.

## 7. Campaign Engine Architecture

The campaign engine has three main layers:

1. API layer creates and controls campaigns.
2. Queue scheduler claims due queued/scheduled campaigns.
3. Execution runner sends per-recipient emails and records results.

Important files:

- `dashboard-next/app/api/campaigns/route.js`
- `dashboard-next/core-lib/campaign-engine/CampaignQueueScheduler.js`
- `dashboard-next/core-lib/campaign-engine/CampaignExecutionRunner.js`
- `dashboard-next/scripts/campaign-worker.mjs`

The runner handles:

- Queued and scheduled campaign pickup.
- Running status and worker lock updates.
- Stale running campaign recovery.
- Sender account resolution.
- Credit reservation and refund.
- Per-recipient locks and claims.
- Reply-mode campaign handling for reminder/follow-up style sends.
- Campaign sent email and email thread persistence.
- Recipient log and campaign rollup updates.

## 8. Email Sending Architecture

Email sending is centralized in:

- `dashboard-next/core-lib/mail-engine/GraphAndSmtpMailSender.js`

Provider paths:

- Microsoft Graph app-only account for configured project senders.
- Microsoft Graph delegated OAuth account for connected user mailboxes.
- SMTP/Gmail account through nodemailer.

Threading support:

- Graph sends can resolve sent-item metadata including message ID, internet message ID, and conversation ID.
- SMTP sends can include `In-Reply-To` and `References` headers for same-thread behavior.
- Campaign sends persist thread metadata to `CampaignSentEmail` and `EmailThread`.

## 9. Integrations

Microsoft Graph:

- OAuth start/callback routes.
- Mailbox folders/messages/actions.
- Graph send and campaign reply threading.
- Token refresh and encrypted token storage.

SMTP/Gmail:

- Nodemailer sending.
- Gmail SMTP account support.
- Gmail IMAP scan for warm-up auto reply.

Excel/import:

- `xlsx` based file handling is present through upload/client-sheet routes.
- Client data validation normalizes raw sheet rows to campaign-ready leads.

Deployment:

- Docker production image.
- Docker compose with separate web and worker services.
- PM2 ecosystem with `intellimailpilot-web` and `intellimailpilot-worker`.
- AWS ECS deployment assets under `dashboard-next/aws/ecs`.

## 10. Security

Completed security and validation controls:

- JWT auth sessions stored in HTTP-only cookies.
- Password hashing with bcryptjs.
- Role-based API guards for user/admin access.
- Owner filters for user-scoped data access.
- Account status checks for active/pending/disabled users.
- Password strength and reset-token support.
- AES-256-GCM token encryption for OAuth token storage.
- Environment validation for production secrets and Graph config.
- Sender account verification before storing accounts through `/api/accounts`.
- Campaign API validation for list ID, sender ID, batch size, delay interval, and scheduled date/time.

Important files:

- `dashboard-next/core-lib/auth-config/ApiAuthGuard.js`
- `dashboard-next/core-lib/auth-config/AuthSessionService.js`
- `dashboard-next/core-lib/auth-config/TokenCryptoService.js`
- `dashboard-next/core-lib/env-config/EnvironmentSafety.js`

Visible risks:

- Sender ID API stores raw SMTP app password in `SenderAccount.pass` for nodemailer use while separately encrypting `SenderId.password`. This is functional but should be reviewed for stricter secret storage.
- Development auth bypass paths exist in auth helpers and must remain disabled in production.

## 11. Deployment

Completed deployment setup:

- `dashboard-next/Dockerfile` builds Node 20 Alpine image, runs `npm run build`, and starts Next.js.
- `dashboard-next/docker-compose.ecs-local.yml` defines separate web and worker services.
- `dashboard-next/ecosystem.config.cjs` defines PM2 web and worker processes.
- `dashboard-next/scripts/campaign-worker.mjs` starts a persistent campaign scheduler worker with heartbeat.
- `dashboard-next/docs/campaign-worker-deployment.md` documents worker deployment and required environment variables.
- `dashboard-next/aws/ecs/*` contains ECS-style environment/checklist/task definition assets.

Current deployment architecture:

- Web/API process should handle UI and request/response APIs.
- Campaign worker process should handle long-running sending.
- Vercel serverless is explicitly not recommended for normal campaign sending.

## 12. Completed Features Checklist

- Authentication and role-based access: Completed.
- User request access and account lifecycle pages: Completed.
- Admin user management: Completed.
- Client data upload, normalization, duplicate checks, and list management: Completed.
- Draft and template management: Completed.
- Campaign creation and schedule/send-now configuration: Completed.
- Campaign start/pause/resume/stop/status APIs: Completed.
- Campaign queue and persistent worker: Completed.
- Campaign recipient logs and rollups: Completed.
- Microsoft Graph sending and mailbox APIs: Completed.
- SMTP/Gmail sending fallback: Completed.
- Sender ID and sender account selection: Completed.
- TEC/TUT project filtering and project sender presets: Completed.
- Campaign open tracking endpoint: Completed.
- Reply, Reply All, and reminder same-thread service/API/UI surfaces: Completed.
- Reports overview, project-wise, sender-health, warm-up, and credits APIs: Completed.
- Credit/usage/subscription system: Completed.
- Warm-up conversations and auto replies: Completed.
- Docker/PM2/worker deployment setup: Completed.

## 13. Pending Work / Known Issues

Visible pending risks and improvement areas from code inspection:

- Build/release validation is required before production because the current working tree already contains modified source files in campaign reply and dashboard areas.
- Microsoft Graph features require correct tenant/client/secret/redirect URI/scopes and token encryption configuration.
- SMTP/Gmail accounts require provider-specific app passwords and may fail with normal account passwords.
- Same-thread behavior depends on original sent metadata. If an old campaign lacks `internetMessageId`, `messageId`, or `conversationId`, same-thread reply behavior may degrade.
- Persistent worker deployment is mandatory for reliable campaign execution; serverless-only deployment is not enough.
- Secret storage for SMTP account passwords should be reviewed because nodemailer currently needs the raw password value from stored sender accounts.
- The mailbox reply route supports simple Graph replies, while richer campaign reply/reply-all/reminder behavior is implemented in campaign-specific reply routes.
- Automated test coverage was not visible during this inspection; build verification should be treated as the minimum release gate.

## 14. Final Notes

The IntelliMailPilot codebase has moved beyond a prototype and now contains the main operational systems needed for a campaign email product: data intake, draft/template preparation, sender identity management, campaign workflow, queue-based execution, delivery/reply tracking, same-thread follow-up support, warm-up automation, reporting, credits, and admin governance.

The most important production readiness requirement is operational discipline around the worker process, environment secrets, Microsoft Graph permissions, and sender account health. With those configured correctly and the current modified files regression-tested, the implemented modules form a coherent final project submission baseline.
