const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Global callback for real-time updates
let updateCallback = null;

// Set callback for real-time updates
function setUpdateCallback(callback) {
  updateCallback = callback;
}

// Helper function to send updates
function sendUpdate(type, message, email = null) {
  if (updateCallback) {
    updateCallback(type, message, email);
  }
}

// Read client data from Excel file
function readClientsFromExcel() {
  return new Promise((resolve, reject) => {
    sendUpdate('info', 'Reading client data from Excel file...');
    
    // Use Python to read the Excel file
    const pythonScript = `
import pandas as pd
import json
import sys
try:
    df = pd.read_excel('data/clients_new.xlsx', engine='openpyxl')
    emails = df['Email'].dropna().tolist()
    names = df['Name'].dropna().tolist()
    result = [{'email': emails[i], 'name': names[i] if i < len(names) else emails[i].split('@')[0]} for i in range(len(emails))]
    print(json.dumps(result))
except Exception as e:
    print(json.dumps([]))
    sys.exit(1)
`;
    
    exec(`python -c "${pythonScript}"`, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        console.error('Error reading Excel file:', error);
        sendUpdate('error', 'Failed to read Excel file');
        resolve([]); // Return empty list on error
        return;
      }
      
      try {
        const clients = JSON.parse(stdout.trim());
        sendUpdate('info', `Found ${clients.length} clients in Excel file`);
        resolve(clients);
      } catch (parseError) {
        console.error('Error parsing client list:', parseError);
        sendUpdate('error', 'Failed to parse client data');
        resolve([]);
      }
    });
  });
}

// Real email sending function
async function sendRealEmails() {
  try {
    // Read clients from Excel file
    const clients = await readClientsFromExcel();
    
    if (clients.length === 0) {
      sendUpdate('error', 'No clients found in Excel file');
      return [];
    }
    
    sendUpdate('info', `Starting to send ${clients.length} emails...`);
    const results = [];
    
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      const { email, name } = client;
      
      try {
        sendUpdate('sending', `Sending email ${i + 1}/${clients.length} to...`, email);
        
        // Use your existing email bot by calling it as a subprocess
        const result = await sendSingleEmail(email, name);
        
        const logEntry = {
          email: email,
          name: name,
          success: result.success,
          index: i + 1,
          message: result.message
        };
        
        results.push(logEntry);
        
        if (result.success) {
          sendUpdate('success', 'Email sent successfully', email);
        } else {
          sendUpdate('failed', 'Failed to send email', email);
        }
        
        // Wait 60 seconds between emails (your existing delay)
        if (i < clients.length - 1) {
          sendUpdate('waiting', 'Waiting 60 seconds before next email...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
        
      } catch (error) {
        console.error(`Error sending to ${email}:`, error.message);
        sendUpdate('failed', `Error sending email: ${error.message}`, email);
        
        results.push({
          email: email,
          name: name,
          success: false,
          error: error.message,
          index: i + 1
        });
      }
    }
    
    sendUpdate('success', `Campaign completed! Total: ${results.length}, Success: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);
    return results;
    
  } catch (error) {
    console.error('Error in sendRealEmails:', error);
    sendUpdate('error', `Campaign error: ${error.message}`);
    return [];
  }
}

// Send single email using your existing email bot
function sendSingleEmail(email, name) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import sys
import json
sys.path.append('.')
from email_bot import send_email, render_template

try:
    html = render_template('${name}')
    if html:
        success = send_email('${email}', "Cover Story Proposal - Top Visionary Leaders in Artificial Intelligence Powering the Next Tech Revolution - 2026", html)
        print(json.dumps({'success': success, 'message': 'Email sent successfully'}))
    else:
        print(json.dumps({'success': False, 'message': 'Failed to render template'}))
except Exception as e:
    print(json.dumps({'success': False, 'message': str(e)}))
`;
    
    exec(`python -c "${pythonScript}"`, { cwd: path.join(__dirname, '..') }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(error.message));
        return;
      }
      
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (parseError) {
        reject(new Error('Failed to parse result'));
      }
    });
  });
}

module.exports = { 
  sendRealEmails, 
  setUpdateCallback 
};
