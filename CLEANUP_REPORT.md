# Cleanup Report

## Deleted Files

### Confirmed junk / temp files
- `=`
- `dashboard-next/edit.py`
- `dashboard-next/temp_edit.js`
- `dashboard-next/temp_edit_page.py`
- `dashboard-next/tmp_patch.py`
- `dashboard-next/tmp_script.py`

### Unused / duplicate files
- `dashboard-next/public/dashboard-bg.png`
- `dashboard-next/app/lib/draftCategories.js`
- `dashboard-next/app/components/BlankDashboardPage.jsx`
- `dashboard-next/app/components/SavedDraftsPanel.jsx`

## Deleted Empty / Obsolete Folders
- `dashboard-next/app/api/scheduler/run/`
- `dashboard-next/app/api/scheduler/`
- `dashboard-next/app/components/layout/`
- `dashboard-next/app/components/ui/`
- `dashboard-next/app/components/workspace/`
- `dashboard-next/app/dashboard/hooks/`
- `dashboard-next/app/dashboard/utils/`
- `dashboard-next/lib/`
- `dashboard-next/models/`
- root `__pycache__/`

## Moved To Legacy

### Legacy dashboard
`dashboard/`
→ `legacy/legacy-dashboard/`

### Legacy Python automation
- `daily_campaign.py`
- `email_bot.py`
- `email_bot_graph.py`
- `scheduler.py`
- `test_graph_auth.py`
- `requirements.txt`
- `requirements_graph.txt`
- `credentials_graph.env`
- `crendentials.env`
- `auto_reply_log.txt`
- `replied_emails.json`
- `data/`
- `templates/`
- `uploads/`

All moved to:
`legacy/python-mail-automation/`

## Kept Intentionally
- `campaign_engine/` kept at root as active service
- env files inside active apps kept untouched
- empty structure placeholders kept:
  - `dashboard-next/global-styles/`
  - `dashboard-next/static-assets/`
  - `dashboard-next/project-config/`

## Manual Review Items Kept
- `legacy/legacy-dashboard/node_modules/` still exists inside the moved legacy app
- `campaign_engine` dependency list may need modernization, but was not functionally changed
