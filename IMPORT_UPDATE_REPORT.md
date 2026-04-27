# Import Update Report

## Import Strategy

The refactor used two compatible strategies:

1. Update direct imports where files were clearly feature-owned
2. Add `jsconfig.json` alias mappings for high-risk backend paths to preserve runtime compatibility

## `jsconfig.json` Alias Updates

Added root aliases:
- `@/shared-components/*`
- `@/modules/*`
- `@/core-lib/*`
- `@/database-models/*`

Added compatibility aliases for moved backend files:
- `@/lib/mongodb`
- `@/lib/apiAuth`
- `@/lib/auth`
- `@/lib/tokenCrypto`
- `@/lib/emailSender`
- `@/lib/senderAccounts`
- `@/lib/warmupAutoReply`
- `@/lib/campaignRunner`
- `@/lib/campaignScheduler`
- `@/lib/ActivityLogService`
- `@/lib/DraftCategoryConstants`
- `@/models/*`

Added compatibility aliases for selected frontend files:
- `@/app/components/layout/AppLayout`
- `@/app/components/layout/PageContainer`
- `@/app/components/ui/Badge`
- `@/app/components/ui/Button`
- `@/app/components/ui/Card`
- `@/app/components/ui/Input`
- `@/app/components/ui/PageSection`
- `@/app/components/ui/UiComponentExports`

## Major Files Updated

### App route files
- `app/dashboard/page.js`
- `app/email-warmup/page.js`
- `app/dashboard/admin/page.js`
- `app/dashboard/manager/page.js`
- `app/draft-templates/page.js`
- `app/drafts/page.js`
- `app/leads/page.js`
- `app/master-inbox/page.js`
- `app/report/page.js`
- `app/sender-emails/page.js`

### Shared component files
- all files under `shared-components/ui-components/`
- all files under `shared-components/layout-components/`
- all files under `shared-components/common-components/workspace-components/`

### Backend core files
- `core-lib/campaign-engine/CampaignExecutionRunner.js`
- `core-lib/campaign-engine/CampaignQueueScheduler.js`
- `core-lib/database-config/MongoDatabaseConnection.js`
- `core-lib/mail-engine/GraphAndSmtpMailSender.js`
- `core-lib/mail-engine/SenderAccountResolver.js`
- `core-lib/mail-engine/WarmupAutoReplyService.js`
- `core-lib/auth-config/AuthSessionService.js`

## Broken Imports Removed
- references to deleted `app/lib/draftCategories.js`
- stale relative imports pointing to old `lib/` and `models/` locations
- stale dashboard hook/util imports after module extraction

## Validation Result
- `dashboard-next` build passed after import rewiring
- no unresolved import errors remained in the final `next build`

## Remaining Manual Review
- `npm run lint` in `dashboard-next` still requires a committed ESLint config
- `campaign_engine` install is blocked by `msal@^1.34.0` not resolving from npm
