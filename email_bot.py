import pandas as pd
from jinja2 import Template
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import re
from dotenv import load_dotenv
import schedule
import time
from datetime import datetime, timedelta
import threading

load_dotenv("crendentials.env")

EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

def clean_email(email_str):
    """Extract email from markdown format or return clean version"""
    email_str = str(email_str).strip()
    mailto_match = re.search(r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', email_str)
    if mailto_match:
        return mailto_match.group(1)
    email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', email_str)
    return email_match.group(0) if email_match else None

def read_excel():
    try:
        df = pd.read_excel("data/clients_blank.xlsx", engine="openpyxl")
        df['Clean_Email'] = df['Email'].apply(clean_email)
        return df.dropna(subset=['Clean_Email'])
    except Exception as e:
        print(f"Error reading Excel file: {str(e)}")
        return pd.DataFrame()

def render_template(name, cost="USD 1,600"):
    try:
        with open("templates/weekly_email.html") as f:
            template = Template(f.read())
        return template.render(name=name, cost=cost)
    except Exception as e:
        print(f"Error rendering template: {str(e)}")
        return None

def send_email(to_email, subject, html_content):
    """
    Send an email and return (success: bool, error: str|None).
    If an error message contains '429' treat it as a rate-limit.
    """
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Updated Sponsorship Details – Top Supply Chain Visionaries Redefining Global Operations – 2025 <{EMAIL_ADDRESS}>"
        msg['To'] = to_email

        msg.attach(MIMEText(html_content, 'html'))

        with smtplib.SMTP("smtp.office365.com", 587) as server:
            server.starttls()
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, to_email, msg.as_string())
        print(f"✓ Email sent to {to_email} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return True, None
    except Exception as e:
        err = str(e)
        print(f"✗ Error sending to {to_email}: {err}")
        return False, err

def send_emails_to_all():
    print(f"\n=== Starting email batch at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===")
    df = read_excel()
    if df.empty:
        print("⚠ No valid email addresses found")
        return False
        
    results = []
    for _, row in df.iterrows():
        email = row['Clean_Email']
        print(f"Processing: {email}")
        try:
            # Basic single-send flow (legacy)
            cost = None
            for c in ('FinalCost', 'UpdatedCost', 'InitialCost'):
                if c in row and pd.notna(row.get(c)):
                    cost = row.get(c)
                    break
            cost_str = f"USD {cost}" if cost is not None else "USD 1,600"
            html = render_template(row.get('Name', ''), cost=cost_str)
            if html:
                success, err = send_email(email, "Cover Story Proposal - Top Visionary Leaders in Artificial Intelligence Powering the Next Tech Revolution - 2026", html)
                results.append(bool(success))
                # Wait 60 seconds before sending next email
                if success:
                    print("⏳ Waiting 60 seconds before next email...")
                    time.sleep(60)
            else:
                results.append(False)
        except Exception as e:
            print(f"⚠ Error processing {email}: {str(e)}")
            results.append(False)
    
    success_rate = sum(results)/len(results) if results else 0
    print(f"=== Batch completed. Success rate: {success_rate:.1%} ===\n")
    return all(results)

def run_scheduler():
    # Get current time plus 1 minute (to ensure we schedule in the future)
    now = datetime.now()
    current_time = (now + timedelta(minutes=1)).strftime("%H:%M")
    
    # Schedule for current time (for testing)
    schedule.every().day.at(current_time).do(
        lambda: threading.Thread(target=send_emails_to_all).start()
    ).tag('test_run')
    
    # Schedule weekly (Monday 10 AM for production)
    schedule.every().monday.at("11:56").do(
        lambda: threading.Thread(target=send_emails_to_all).start()
    ).tag('weekly_run')
    
    print("\n📅 Email Scheduler Started")
    print(f"⏰ Immediate test run scheduled at: {current_time}")
    print(f"⏰ Next weekly run at: {schedule.next_run()}")
    print("🔄 Running scheduler loop... (Ctrl+C to stop)\n")
    
    while True:
        try:
            schedule.run_pending()
            time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Scheduler stopped by user")
            break
        except Exception as e:
            print(f"⚠ Scheduler error: {str(e)}")
            time.sleep(60)

if __name__ == "__main__":
    # For production: start scheduler
    run_scheduler()
    
    # To clear test schedule after first run (uncomment if needed):
    # schedule.clear('test_run')