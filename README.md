# Email Bot Dashboard & Campaign Engine

This workspace contains a Python backend for sending batch email campaigns and a Node/Express dashboard frontend.

## Key Features

- **Campaign logic** (Python `daily_campaign.py`):
  - Sends Cover Story, Reminder, and Follow-up emails in one run.
  - Controlled concurrency (10 at a time, 3s between batches).
  - Rate-limit handling and retry logic.
  - Cost priority logic for email content.
  - Updates lead spreadsheet with sent stages and logs summary to `auto_reply_log.txt`.
  - Dry-run by default; real sending requires `--send` flag.
  - `--dump` option to output leads as JSON (used by dashboard).

- **Dashboard** (`dashboard/server.js`, `public/index.html`):
  - View contacts/leads imported from Excel.
  - Upload new leads spreadsheet.
  - Trigger daily campaign via UI or API.
  - Simple analytics and campaign management UI.
  - Contacts page extracts data from sheet in real time.

## Setup & Usage

### Python environment

1. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
2. Ensure your email credentials are available via `crendentials.env` or environment variables:
   ```text
   EMAIL_ADDRESS=your@domain.com
   EMAIL_PASSWORD=yourpassword
   ```
3. Place your leads Excel file in `data/` (e.g. `clients_new.xlsx`). Field names expected: `Email`, `Name`, optionally `FinalCost`/`UpdatedCost`/`InitialCost`.

4. To see leads JSON (dry-run):
   ```powershell
   python daily_campaign.py --dump
   ```
5. To run a dry-run campaign:
   ```powershell
   python daily_campaign.py
   ```
6. To perform actual send:
   ```powershell
   python daily_campaign.py --send
   ```
   or via dashboard with POST `/api/run-daily-campaign` and body `{ "send": true }`.

### Dashboard setup

1. Navigate into dashboard folder:
   ```powershell
   cd dashboard
   npm install
   ```
2. Start server (hot reload):
   ```powershell
   npx nodemon server.js
   ```
3. Open browser to `http://localhost:5000`.
4. Go to **Contacts** to upload your leads spreadsheet and view entries.
5. Click **Run Email Bot** on dashboard to trigger campaign (dry-run by default). Use upload or API to send for real.

### API Endpoints

- `GET /api/leads` - Returns leads from the active sheet.
- `POST /api/upload-leads` - Form-data file upload (`file` field) to replace sheet.
- `POST /api/run-daily-campaign` - Triggers campaign; body may include `"send":true`.


## Notes

- Dashboard authentication is relaxed for demo; in production integrate real auth.
- The Python script reads `data/clients_new.xlsx` first, then `clients.xlsx`, then `clients_blank.xlsx`.
- Uploaded files overwrite `clients_new.xlsx`.

---

Now the dashboard will fetch real data from the sheet and allow sending emails accordingly.