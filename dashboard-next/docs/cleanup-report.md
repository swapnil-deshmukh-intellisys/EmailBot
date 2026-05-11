# Cleanup Report

Generated during the production stabilization pass. No files were deleted.

## Safe To Delete

- None confirmed in this pass. Deletion should wait until a build and route smoke test pass on production-like data.

## Risky To Delete

- `legacy/` at repository root: legacy Express/Python dashboards and automation. It is outside `dashboard-next`, but may contain migration/reference code.
- `campaign_engine/` at repository root: separate campaign engine package with local modifications in the current worktree.
- `dashboard-next/static-assets/`, `dashboard-next/global-styles/`, `dashboard-next/project-config/`: README-only folders. Low runtime risk, but keep until deployment packaging is confirmed.
- `dashboard-next/scripts/mongo-forensics.mjs`, `dashboard-next/scripts/mongo-recover-missing-data.mjs`, `dashboard-next/scripts/backfill-owner-fields.js`: operational scripts. Keep unless the deployment runbook says they are obsolete.

## Keep

- `app/api/health/route.js` and `app/api/worker-health/route.js`: production smoke checks.
- `scripts/campaign-worker.mjs`: PM2 worker entrypoint.
- `ecosystem.config.cjs`: production PM2 process definition.
- `database-models/*`: active Mongoose models used by App Router APIs.
- `.env`, `.env.example`, `.env.backup-before-db-name-fix`: do not delete environment or backup files.

## Duplicate But Currently Used

- Dashboard routes exist at both `app/dashboard/page.js` and role-specific routes such as `app/dashboard/user/page.js`, `app/user/dashboard/page.js`, `app/admin/dashboard/page.js`, and `app/dashboard/admin/page.js`. These are navigation/role compatibility routes and should not be deleted without redirect testing.
- Mailbox APIs exist under both `app/api/mailbox/*` and `app/api/mailbox-folders/route.js`. Current frontend calls `/api/mailbox/*`; keep the older endpoint until external links are checked.
- Inbox pages exist as `app/mail-inbox/page.js` and `app/master-inbox/page.js`. Both are user-facing routes.
- Warmup pages exist as `app/warm-up/page.js` and `app/email-warmup/page.js`. Keep until navigation and redirects are clarified.

## Duplicate And Unused Candidates

- No duplicate component/page was proven unused by import and route checks in this pass.
- Candidate old routes needing confirmation: `app/sidebar-campaigns/page.js`, `app/leads/page.js`, `app/report/page.js`, `app/summary/page.js`.

## 404 Route Mismatches Found

- Frontend calls `/api/lists` in `app/dashboard/user/profile/page.js`, but only `/api/lists/[id]`, `/api/lists/[id]/normalize-emails`, and `/api/lists/custom` exist. This is a likely repeated 404 source.
- Requested campaign, upload, client-data, draft, account, mailbox, and auth APIs exist in `app/api`.
- Dashboard route aliases `/dashboard/user` and `/user/dashboard` both exist; no patch applied because both are currently valid.

## Final Decision

- Stage 1 complete: identified risky legacy/duplicate areas and one likely 404 route mismatch.
- Stage 2 pending: archive only after route analytics/import checks confirm no traffic.
- Stage 3 pending: build and smoke tests.
- Stage 4 pending: delete only confirmed unused files.
