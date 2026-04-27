import pandas as pd
from jinja2 import Template
import requests
import json
import os
import re
from dotenv import load_dotenv
import schedule
import time
from datetime import datetime, timedelta
import threading
from msal import ConfidentialClientApplication

load_dotenv("credentials_graph.env")

# Microsoft Graph API Configuration
TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
SCOPE = ["https://graph.microsoft.com/.default"]
GRAPH_API_ENDPOINT = "https://graph.microsoft.com/v1.0"

def get_access_token():
    """Get OAuth2 access token using client credentials flow"""
    try:
        app = ConfidentialClientApplication(
            client_id=CLIENT_ID,
            client_credential=CLIENT_SECRET,
            authority=f"https://login.microsoftonline.com/{TENANT_ID}"
        )
        
        result = app.acquire_token_for_client(scopes=SCOPE)
        
        if "access_token" in result:
            return result["access_token"]
        else:
            print(f"Error getting access token: {result.get('error', 'Unknown error')}")
            return None
    except Exception as e:
        print(f"Exception getting access token: {str(e)}")
        return None

def clean_email(email_str):
    """Extract email from markdown format or return clean version"""
    email_str = str(email_str).strip()
    mailto_match = re.search(r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', email_str)
    if mailto_match:
        return mailto_match.group(1)
    email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', email_str)
    return email_match.group(0) if email_match else None

def read_excel():
    """Read client data from Excel file"""
    try:
        df = pd.read_excel("data/clients_new.xlsx", engine="openpyxl")
        df['Clean_Email'] = df['Email'].apply(clean_email)
        return df.dropna(subset=['Clean_Email'])
    except Exception as e:
        print(f"Error reading Excel file: {str(e)}")
        return pd.DataFrame()

def render_template(name):
    """Render email template with client name"""
    try:
        with open("templates/weekly_email.html") as f:
            template = Template(f.read())
        return template.render(name=name)
    except Exception as e:
        print(f"Error rendering template: {str(e)}")
        return None

def send_email_graph(to_email, subject, html_content):
    """Send email using Microsoft Graph API"""
    try:
        access_token = get_access_token()
        if not access_token:
            return False
        
        # Prepare email message
        email_data = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_content
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": to_email
                        }
                    }
                ]
            }
        }
        
        # Send email using Graph API
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{GRAPH_API_ENDPOINT}/users/eliana@theentrepreneurialchronicle.com/sendMail",
            headers=headers,
            json=email_data
        )
        
        if response.status_code == 202:
            print(f"✓ Email sent to {to_email} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            return True
        else:
            print(f"✗ Error sending to {to_email}: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"✗ Exception sending to {to_email}: {str(e)}")
        return False

def send_emails_to_all():
    """Send emails to all clients with 60-second delay between each"""
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
            html = render_template(row['Name'])
            if html:
                success = send_email_graph(email, "Updated Sponsorship Details – Top Supply Chain Visionaries Redefining Global Operations – 2025", html)
                results.append(success)
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
    """Run the email scheduler"""
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
    
    print("\n📅 Email Scheduler Started (Microsoft Graph API)")
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
