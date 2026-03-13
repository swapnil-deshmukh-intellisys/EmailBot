import time
from datetime import datetime, timedelta
import threading
import pandas as pd
import os
import argparse
import json

from email_bot import read_excel, render_template, send_email

DATA_CANDIDATES = [
    "data/clients_new.xlsx",
    "data/clients.xlsx",
    "data/clients_blank.xlsx",
]


def _load_leads():
    for p in DATA_CANDIDATES:
        if os.path.exists(p):
            try:
                df = pd.read_excel(p, engine="openpyxl")
                return df, p
            except Exception:
                continue
    return pd.DataFrame(), None


def _ensure_columns(df):
    cols = ['Clean_Email', 'CoverSentDate', 'ReminderSent', 'FollowUpSent', 'lastEmailDate', 'stage',
            'FinalCost', 'UpdatedCost', 'InitialCost']
    for c in cols:
        if c not in df.columns:
            df[c] = pd.NA
    return df


def _choose_cost(row):
    for c in ('FinalCost', 'UpdatedCost', 'InitialCost'):
        if c in row and pd.notna(row.get(c)):
            return f"USD {row.get(c)}"
    return "USD 1,600"


def _make_tasks(df):
    today = datetime.now().date()
    tasks = []

    # A. 50 new Cover Story emails to fresh leads
    fresh = df[df['Clean_Email'].notna() & df['CoverSentDate'].isna()]
    fresh = fresh.head(50)
    for idx, row in fresh.iterrows():
        tasks.append({'type': 'cover', 'index': idx, 'row': row})

    # B. Reminder: Cover Sent Date = 2 days ago and ReminderSent != True
    two_days = today - timedelta(days=2)
    if 'CoverSentDate' in df.columns:
        mask = pd.to_datetime(df['CoverSentDate'], errors='coerce').dt.date == two_days
        mask = mask.fillna(False) & (~df['ReminderSent'].fillna(False))
        for idx, row in df[mask].iterrows():
            tasks.append({'type': 'reminder', 'index': idx, 'row': row})

    # C. Follow-up: Cover Sent Date = 4 days ago and FollowUpSent != True
    four_days = today - timedelta(days=4)
    if 'CoverSentDate' in df.columns:
        mask2 = pd.to_datetime(df['CoverSentDate'], errors='coerce').dt.date == four_days
        mask2 = mask2.fillna(False) & (~df['FollowUpSent'].fillna(False))
        for idx, row in df[mask2].iterrows():
            tasks.append({'type': 'followup', 'index': idx, 'row': row})

    return tasks


def run_daily_campaign(max_concurrent=10, batch_wait=3, send=False):
    """
    Run the daily campaign once. This function does NOT auto-schedule.
    It will process Cover/Reminder/Follow-up tasks in the same run with controlled concurrency.
    Returns a summary dict.
    """
    df, path = _load_leads()
    if df.empty:
        print("No leads file found or empty lead list.")
        return {}

    df = _ensure_columns(df)
    tasks = _make_tasks(df)
    if not tasks:
        print("No tasks to process today.")
        return {}

    lock = threading.Lock()
    summary = {'cover': 0, 'reminder': 0, 'followup': 0, 'total_sent': 0, 'failed': 0}

    sending_enabled = bool(send)

    def worker(task, dry_run=False):
        nonlocal df, summary
        idx = task['index']
        row = task['row']
        ttype = task['type']

        name = row.get('Name', '')
        to_email = row.get('Clean_Email')
        cost = _choose_cost(row)
        html = render_template(name, cost=cost)

        subject_map = {
            'cover': "Cover Story Proposal - Top Visionary Leaders in Artificial Intelligence - 2026",
            'reminder': "Reminder: Cover Story Proposal",
            'followup': "Follow-up: Cover Story Proposal",
        }

        subject = subject_map.get(ttype, "Cover Story Proposal")

        # Attempt send (or simulate in dry-run)
        if dry_run:
            print(f"[DRY RUN] Would send {ttype} to {to_email} (name='{name}', cost={cost})")
            success, err = True, None
        else:
            success, err = send_email(to_email, subject, html)

            # If rate-limited, wait 10s and retry once
            if not success and err and '429' in err:
                print(f"Rate limited when sending to {to_email}, waiting 10s then retrying...")
                time.sleep(10)
                success, err = send_email(to_email, subject, html)

        with lock:
            if success:
                summary['total_sent'] += 1
                if ttype == 'cover':
                    summary['cover'] += 1
                    df.at[idx, 'CoverSentDate'] = datetime.now()
                    df.at[idx, 'stage'] = 'Cover Sent'
                elif ttype == 'reminder':
                    summary['reminder'] += 1
                    df.at[idx, 'ReminderSent'] = True
                    df.at[idx, 'stage'] = 'Reminder Sent'
                elif ttype == 'followup':
                    summary['followup'] += 1
                    df.at[idx, 'FollowUpSent'] = True
                    df.at[idx, 'stage'] = 'Follow-up Sent'
                df.at[idx, 'lastEmailDate'] = datetime.now()
            else:
                summary['failed'] += 1

    # Process tasks in batches of size max_concurrent
    def chunks(lst, n):
        for i in range(0, len(lst), n):
            yield lst[i:i + n]

    for batch in chunks(tasks, max_concurrent):
        threads = []
        for task in batch:
            t = threading.Thread(target=worker, args=(task, not sending_enabled))
            t.start()
            threads.append(t)

        # Wait for batch to complete
        for t in threads:
            t.join()

        # After each batch, wait batch_wait seconds
        print(f"Batch completed. Waiting {batch_wait}s before next batch...")
        time.sleep(batch_wait)

    # Persist updates back to the same file
    try:
        df.to_excel(path, index=False, engine='openpyxl')
    except Exception as e:
        print(f"Warning: failed to write updates back to {path}: {e}")

    # Append summary to log
    log_line = (f"{datetime.now().isoformat()} | Cover:{summary['cover']} | Reminder:{summary['reminder']} | "
                f"FollowUp:{summary['followup']} | Total:{summary['total_sent']} | Failed:{summary['failed']}\n")
    try:
        with open('auto_reply_log.txt', 'a', encoding='utf-8') as f:
            f.write(log_line)
    except Exception:
        pass

    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run daily email campaign')
    parser.add_argument('--send', action='store_true', help='Actually send emails (default is dry-run)')
    parser.add_argument('--dump', action='store_true', help='Dump lead records as JSON then exit')
    parser.add_argument('--file', type=str, help='Path to leads file (overrides defaults)')
    parser.add_argument('--max-concurrent', type=int, default=10, help='Max concurrent sends')
    parser.add_argument('--batch-wait', type=int, default=3, help='Seconds to wait between batches')
    args = parser.parse_args()

    # If user requests real sending, ensure credentials exist
    if args.send:
        if not os.getenv('EMAIL_ADDRESS') or not os.getenv('EMAIL_PASSWORD'):
            print(json.dumps({'error': 'EMAIL_ADDRESS or EMAIL_PASSWORD not set in environment. Aborting.'}))
            raise SystemExit(1)

    # If a custom file was provided, prioritize it
    if args.file:
        if os.path.exists(args.file):
            DATA_CANDIDATES.insert(0, args.file)
        else:
            print(json.dumps({'error': f'Provided file not found: {args.file}'}))
            raise SystemExit(1)

    # handle dump request early
    if args.dump:
        df, path = _load_leads()
        if df.empty:
            print(json.dumps([]))
        else:
            df = _ensure_columns(df)
            # convert datetimes to iso strings
            df_serial = df.replace({pd.NaT: None}).copy()
            for col in ['CoverSentDate', 'lastEmailDate']:
                if col in df_serial:
                    df_serial[col] = df_serial[col].apply(lambda x: x.isoformat() if pd.notna(x) else None)
            # Normalize pandas NaN/NA values so output is valid JSON.
            df_serial = df_serial.astype(object).where(pd.notna(df_serial), None)
            print(json.dumps(df_serial.to_dict(orient='records'), ensure_ascii=False))
        raise SystemExit(0)

    # Run campaign with dry-run unless --send is provided
    sending_enabled = args.send
    # Expose sending_enabled into the worker via monkeypatching variable used earlier
    try:
        # call run_daily_campaign which will pick up DATA_CANDIDATES override
        summary = run_daily_campaign(max_concurrent=args.max_concurrent, batch_wait=args.batch_wait, send=sending_enabled)
        # If dry-run, summary returns counts as if sent; indicate dry-run
        out = {'summary': summary, 'dry_run': not sending_enabled}
        print(json.dumps(out))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        raise
