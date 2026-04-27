# Legacy Cleanup Report

## Summary
- Old legacy file count: `2375`
- New legacy file count: `35`
- Total files removed: `2340`
- Old legacy size: `17,258,287 bytes`
- New legacy size: `145,185 bytes`
- Total storage saved: `17,113,102 bytes` (~16.32 MiB)

## Deleted Paths

### Archived dependency folders
- `legacy/legacy-dashboard/node_modules/`
  - Reason: reproducible dependency install folder for archived app; not runtime-required

### Archived generated uploads
- `legacy/legacy-dashboard/uploads/`
  - Reason: generated upload artifacts; not source code
- `legacy/legacy-dashboard/dashboard/uploads/`
  - Reason: generated upload artifacts; not source code
- `legacy/python-mail-automation/uploads/`
  - Reason: generated upload artifacts; not source code

### Archived lock/cache artifacts
- `legacy/legacy-dashboard/package-lock.json`
  - Reason: archived app only; reproducible from `package.json`

### Archived backup file
- `legacy/python-mail-automation/data/clients_backup.xlsx`
  - Reason: explicit backup artifact, not required runtime source

### Archived log file
- `legacy/python-mail-automation/auto_reply_log.txt`
  - Reason: generated log output, safe to remove

## Kept Paths

### Archived legacy dashboard source
- `legacy/legacy-dashboard/package.json`
  - Reason: project manifest
- `legacy/legacy-dashboard/README.md`
  - Reason: documentation
- `legacy/legacy-dashboard/.env`
  - Reason: archived configuration reference
- `legacy/legacy-dashboard/.env.example`
  - Reason: environment example
- `legacy/legacy-dashboard/server.js`
  - Reason: source entrypoint
- `legacy/legacy-dashboard/src/**`
  - Reason: archived source code
- `legacy/legacy-dashboard/public/**`
  - Reason: archived app assets

### Archived Python automation source/config
- `legacy/python-mail-automation/daily_campaign.py`
  - Reason: source code
- `legacy/python-mail-automation/email_bot.py`
  - Reason: source code
- `legacy/python-mail-automation/email_bot_graph.py`
  - Reason: source code
- `legacy/python-mail-automation/scheduler.py`
  - Reason: source code
- `legacy/python-mail-automation/test_graph_auth.py`
  - Reason: source/test utility retained for historical reference
- `legacy/python-mail-automation/requirements.txt`
  - Reason: dependency manifest
- `legacy/python-mail-automation/requirements_graph.txt`
  - Reason: dependency manifest
- `legacy/python-mail-automation/credentials_graph.env`
  - Reason: archived configuration
- `legacy/python-mail-automation/crendentials.env`
  - Reason: archived configuration
- `legacy/python-mail-automation/templates/weekly_email.html`
  - Reason: template source

### Archived data kept intentionally
- `legacy/python-mail-automation/data/clients.xlsx`
  - Reason: possible original sample/input data; not clearly reproducible
- `legacy/python-mail-automation/data/clients_ai.xlsx`
  - Reason: possible original sample/input data; not clearly reproducible
- `legacy/python-mail-automation/data/clients_blank.xlsx`
  - Reason: possible original template/input data; not clearly reproducible
- `legacy/python-mail-automation/data/clients_new.xlsx`
  - Reason: possible original sample/input data; not clearly reproducible
- `legacy/python-mail-automation/replied_emails.json`
  - Reason: archived runtime state; kept because historical behavior/state may matter

## Manual Review Files
- None moved to `legacy/manual-review/`
- No additional ambiguous files were deleted; uncertain historical data was kept
