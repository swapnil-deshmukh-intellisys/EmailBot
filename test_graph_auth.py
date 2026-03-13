import os
from dotenv import load_dotenv
from msal import ConfidentialClientApplication
import requests

load_dotenv("credentials_graph.env")

# Microsoft Graph API Configuration
TENANT_ID = os.getenv("TENANT_ID")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
SCOPE = ["https://graph.microsoft.com/.default"]

def test_authentication():
    """Test Microsoft Graph API authentication"""
    print("=== Testing Microsoft Graph API Authentication ===")
    print(f"Tenant ID: {TENANT_ID}")
    print(f"Client ID: {CLIENT_ID}")
    print(f"Client Secret: {'*' * len(CLIENT_SECRET) if CLIENT_SECRET else 'Not found'}")
    print()
    
    try:
        # Create MSAL application
        app = ConfidentialClientApplication(
            client_id=CLIENT_ID,
            client_credential=CLIENT_SECRET,
            authority=f"https://login.microsoftonline.com/{TENANT_ID}"
        )
        
        print("Attempting to acquire token...")
        result = app.acquire_token_for_client(scopes=SCOPE)
        
        print(f"Token result: {result}")
        
        if "access_token" in result:
            print("✓ Authentication successful!")
            print(f"Access Token: {result['access_token'][:50]}...")
            
            # Test a simple Graph API call
            headers = {
                "Authorization": f"Bearer {result['access_token']}",
                "Content-Type": "application/json"
            }
            
            response = requests.get(
                "https://graph.microsoft.com/v1.0/users/eliana@theentrepreneurialchronicle.com",
                headers=headers
            )
            
            print(f"Graph API test call status: {response.status_code}")
            if response.status_code == 200:
                print("✓ Graph API access working!")
            else:
                print(f"✗ Graph API error: {response.text}")
                
        else:
            print("✗ Authentication failed!")
            print(f"Error: {result.get('error', 'Unknown error')}")
            print(f"Error description: {result.get('error_description', 'No description')}")
            
    except Exception as e:
        print(f"Exception during authentication: {str(e)}")

if __name__ == "__main__":
    test_authentication()
