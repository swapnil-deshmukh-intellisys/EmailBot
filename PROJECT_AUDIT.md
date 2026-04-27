# Project Audit

## Scope
- Main production app: `dashboard-next`
- Legacy app: `legacy/legacy-dashboard`
- Active service: `campaign_engine`
- Legacy Python automation: `legacy/python-mail-automation`

## Audit Findings

### 1. Multi-app repo layout
The repository previously mixed four runtime zones at the root:
- `dashboard-next` Next.js application
- `dashboard` older Express dashboard
- `campaign_engine` standalone Node service
- root Python automation scripts

This was the main reason the codebase felt unstructured.

### 2. Repeated / generic filenames
The following repeated or overly generic filenames were identified and cleaned up:
- `index.js` barrel files inside UI/layout/dashboard/workspace areas
- `activityLog.js` vs `ActivityLog.js`
- `draftCategories.js` duplicates
- generic UI names such as `Button.jsx`, `Card.jsx`, `Modal.jsx`, `Table.jsx`
- dashboard utility names such as `draftTemplates.js`, `dashboardConstants.js`

### 3. Confirmed cleanup candidates
Confirmed safe cleanup candidates found during audit:
- root junk file named `=`
- `dashboard-next/public/dashboard-bg.png` with no active references
- empty stub route folder `dashboard-next/app/api/scheduler/run/`
- temp scripts in `dashboard-next`:
  - `edit.py`
  - `temp_edit.js`
  - `temp_edit_page.py`
  - `tmp_patch.py`
  - `tmp_script.py`
- malformed duplicate `dashboard-next/app/lib/draftCategories.js`

### 4. Legacy/runtime separation needs
The repo required clear separation between:
- production UI/API app
- legacy dashboard implementation
- active campaign engine service
- legacy Python automation artifacts

## Risks Kept Intentionally
- `campaign_engine` dependency set was preserved as-is; only `package.json` encoding was normalized to valid UTF-8.
- `campaign_engine` still has one dependency issue:
  - `msal@^1.34.0` is not resolvable from npm during validation
- Next.js framework route filenames were preserved:
  - `page.js`
  - `layout.js`
  - `route.js`
  - `middleware.js`
- Environment files were preserved and not restructured to avoid config risk.

## Validation Summary
- `dashboard-next`: `npm install` succeeded
- `dashboard-next`: `npm run build` succeeded
- `dashboard-next`: `npm run lint` requires interactive ESLint initialization because no lint config is committed
- `campaign_engine`: `node --check campaignEngine.js` succeeded
- `campaign_engine`: `npm install` failed because `msal@^1.34.0` is not available from npm
