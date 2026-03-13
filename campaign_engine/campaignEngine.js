const express = require('express');
const axios = require('axios');
const moment = require('moment');
const winston = require('winston');
require('dotenv').config();

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'campaign.log' }),
    new winston.transports.Console()
  ]
});

const app = express();
app.use(express.json());

// Microsoft Graph API Configuration
const GRAPH_API_ENDPOINT = 'https://graph.microsoft.com/v1.0';
const MAX_CONCURRENT_EMAILS = 10;
const BATCH_DELAY = 3000; // 3 seconds
const RATE_LIMIT_RETRY_DELAY = 10000; // 10 seconds

// Campaign State
let campaignStats = {
  coverSent: 0,
  reminderSent: 0,
  followUpSent: 0,
  totalEmailsSent: 0,
  failedEmails: 0,
  lastExecutionDate: null
};

// Mock Lead Database (Replace with actual database)
let leads = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    stage: 'new',
    coverSentDate: null,
    reminderSent: false,
    followUpSent: false,
    initialCost: 1600,
    updatedCost: null,
    finalCost: null,
    totalEmailsSent: 0,
    lastEmailDate: null
  },
  {
    id: 2,
    name: 'Jane Smith',
    email: 'jane@company.com',
    stage: 'cover_sent',
    coverSentDate: moment().subtract(2, 'days').toDate(),
    reminderSent: false,
    followUpSent: false,
    initialCost: 1600,
    updatedCost: 1400,
    finalCost: null,
    totalEmailsSent: 1,
    lastEmailDate: moment().subtract(2, 'days').toDate()
  },
  {
    id: 3,
    name: 'Mike Johnson',
    email: 'mike@startup.io',
    stage: 'reminder_sent',
    coverSentDate: moment().subtract(4, 'days').toDate(),
    reminderSent: true,
    followUpSent: false,
    initialCost: 1600,
    updatedCost: null,
    finalCost: 1200,
    totalEmailsSent: 2,
    lastEmailDate: moment().subtract(2, 'days').toDate()
  }
];

// Get cost based on priority logic
function getCost(lead) {
  if (lead.finalCost) return lead.finalCost;
  if (lead.updatedCost) return lead.updatedCost;
  return lead.initialCost;
}

// Send email via Microsoft Graph API
async function sendEmailViaGraphAPI(toEmail, subject, htmlContent) {
  try {
    const accessToken = await getGraphAccessToken();
    
    const emailData = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: htmlContent
        },
        toRecipients: [
          {
            emailAddress: {
              address: toEmail
            }
          }
        ]
      }
    };

    const response = await axios.post(
      `${GRAPH_API_ENDPOINT}/users/eliana@theentrepreneurialchronicle.com/sendMail`,
      emailData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { success: true, response: response.data };
  } catch (error) {
    if (error.response && error.response.status === 429) {
      return { success: false, rateLimited: true, error: error.response.data };
    }
    return { success: false, error: error.message };
  }
}

// Get Graph API access token
async function getGraphAccessToken() {
  // Implement your MSAL authentication here
  // For demo, return a mock token
  return 'mock-access-token';
}

// Send emails with controlled concurrency
async function sendEmailsWithConcurrency(emails, emailType) {
  const results = [];
  let failedEmails = [];
  
  for (let i = 0; i < emails.length; i += MAX_CONCURRENT_EMAILS) {
    const batch = emails.slice(i, i + MAX_CONCURRENT_EMAILS);
    
    const batchPromises = batch.map(async (email) => {
      const result = await sendEmailViaGraphAPI(email.to, email.subject, email.html);
      
      if (result.success) {
        // Update lead tracking
        updateLeadTracking(email.leadId, emailType);
        campaignStats.totalEmailsSent++;
        campaignStats[emailType.replace('Sent', 'Sent')]++;
        logger.info(`Email sent successfully to ${email.to}`, { type: emailType, leadId: email.leadId });
      } else {
        if (result.rateLimited) {
          logger.warn(`Rate limited for ${email.to}, will retry`, { error: result.error });
          failedEmails.push(email);
        } else {
          campaignStats.failedEmails++;
          logger.error(`Failed to send email to ${email.to}`, { error: result.error });
        }
      }
      
      return result;
    });
    
    await Promise.all(batchPromises);
    
    // Wait between batches
    if (i + MAX_CONCURRENT_EMAILS < emails.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }
  
  // Retry rate limited emails
  if (failedEmails.length > 0) {
    logger.info(`Retrying ${failedEmails.length} rate limited emails after delay`);
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY));
    
    for (const email of failedEmails) {
      const result = await sendEmailViaGraphAPI(email.to, email.subject, email.html);
      if (result.success) {
        updateLeadTracking(email.leadId, emailType);
        campaignStats.totalEmailsSent++;
        campaignStats[emailType.replace('Sent', 'Sent')]++;
        logger.info(`Retry successful for ${email.to}`, { type: emailType, leadId: email.leadId });
      } else {
        campaignStats.failedEmails++;
        logger.error(`Retry failed for ${email.to}`, { error: result.error });
      }
    }
  }
  
  return results;
}

// Update lead tracking information
function updateLeadTracking(leadId, emailType) {
  const lead = leads.find(l => l.id === leadId);
  if (!lead) return;
  
  const now = new Date();
  lead.totalEmailsSent++;
  lead.lastEmailDate = now;
  
  switch (emailType) {
    case 'coverSent':
      lead.stage = 'cover_sent';
      lead.coverSentDate = now;
      break;
    case 'reminderSent':
      lead.stage = 'reminder_sent';
      lead.reminderSent = true;
      break;
    case 'followUpSent':
      lead.stage = 'follow_up_sent';
      lead.followUpSent = true;
      break;
  }
}

// Generate email content based on type and cost
function generateEmailContent(lead, emailType) {
  const cost = getCost(lead);
  const costText = emailType === 'coverSent' ? 
    `The sponsorship cost for this premium advertorial package is USD ${cost}.` :
    `Following up on our previous communication regarding the USD ${cost} sponsorship package.`;
  
  let subject, body;
  
  switch (emailType) {
    case 'coverSent':
      subject = `Cover Story Proposal - Top Visionary Leaders in AI - 2026`;
      body = `
        <p>Dear ${lead.name},</p>
        <p>I hope you are doing well.</p>
        <p>I am writing to inform you that our editorial team has shortlisted you for inclusion in our upcoming 2026 leadership edition.</p>
        <p>${costText}</p>
        <p>Warm regards,<br>Eliana Turner</p>
      `;
      break;
      
    case 'reminderSent':
      subject = `Reminder: Cover Story Proposal - AI Leaders 2026`;
      body = `
        <p>Dear ${lead.name},</p>
        <p>Following up on our previous email regarding your inclusion in our AI Leaders 2026 edition.</p>
        <p>${costText}</p>
        <p>Would you like to discuss this opportunity further?</p>
        <p>Best regards,<br>Eliana Turner</p>
      `;
      break;
      
    case 'followUpSent':
      subject = `Final Follow-up: AI Leaders 2026 Cover Story`;
      body = `
        <p>Dear ${lead.name},</p>
        <p>This is our final follow-up regarding the AI Leaders 2026 cover story opportunity.</p>
        <p>${costText}</p>
        <p>This is your last chance to be featured in this exclusive edition.</p>
        <p>Regards,<br>Eliana Turner</p>
      `;
      break;
  }
  
  return { subject, body };
}

// Main Campaign Execution Engine
async function runDailyCampaign() {
  logger.info('Starting Daily Campaign Execution');
  campaignStats = {
    coverSent: 0,
    reminderSent: 0,
    followUpSent: 0,
    totalEmailsSent: 0,
    failedEmails: 0,
    lastExecutionDate: new Date()
  };
  
  try {
    // A. Send 50 new Cover Story emails
    const newLeads = leads.filter(lead => lead.stage === 'new').slice(0, 50);
    const coverEmails = newLeads.map(lead => {
      const { subject, body } = generateEmailContent(lead, 'coverSent');
      return {
        leadId: lead.id,
        to: lead.email,
        subject,
        html: body,
        lead
      };
    });
    
    if (coverEmails.length > 0) {
      logger.info(`Sending ${coverEmails.length} cover story emails`);
      await sendEmailsWithConcurrency(coverEmails, 'coverSent');
    }
    
    // B. Send Reminder emails (2 days after cover)
    const reminderLeads = leads.filter(lead => 
      lead.coverSentDate && 
      moment(lead.coverSentDate).isSame(moment().subtract(2, 'days'), 'day') &&
      !lead.reminderSent
    );
    
    const reminderEmails = reminderLeads.map(lead => {
      const { subject, body } = generateEmailContent(lead, 'reminderSent');
      return {
        leadId: lead.id,
        to: lead.email,
        subject,
        html: body,
        lead
      };
    });
    
    if (reminderEmails.length > 0) {
      logger.info(`Sending ${reminderEmails.length} reminder emails`);
      await sendEmailsWithConcurrency(reminderEmails, 'reminderSent');
    }
    
    // C. Send Follow-up emails (4 days after cover)
    const followUpLeads = leads.filter(lead => 
      lead.coverSentDate && 
      moment(lead.coverSentDate).isSame(moment().subtract(4, 'days'), 'day') &&
      !lead.followUpSent
    );
    
    const followUpEmails = followUpLeads.map(lead => {
      const { subject, body } = generateEmailContent(lead, 'followUpSent');
      return {
        leadId: lead.id,
        to: lead.email,
        subject,
        html: body,
        lead
      };
    });
    
    if (followUpEmails.length > 0) {
      logger.info(`Sending ${followUpEmails.length} follow-up emails`);
      await sendEmailsWithConcurrency(followUpEmails, 'followUpSent');
    }
    
    // Log final summary
    const summary = {
      executionDate: campaignStats.lastExecutionDate,
      coverSent: campaignStats.coverSent,
      reminderSent: campaignStats.reminderSent,
      followUpSent: campaignStats.followUpSent,
      totalEmailsSent: campaignStats.totalEmailsSent,
      failedEmails: campaignStats.failedEmails
    };
    
    logger.info('Daily Campaign Execution Completed', summary);
    
    return summary;
    
  } catch (error) {
    logger.error('Campaign execution failed', { error: error.message });
    throw error;
  }
}

// API Routes
app.post('/api/run-daily-campaign', async (req, res) => {
  try {
    if (campaignStats.lastExecutionDate && 
        moment(campaignStats.lastExecutionDate).isSame(moment(), 'day')) {
      return res.status(400).json({ 
        error: 'Campaign already executed today' 
      });
    }
    
    const summary = await runDailyCampaign();
    res.json({ 
      success: true, 
      message: 'Daily campaign executed successfully',
      summary 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Campaign execution failed',
      details: error.message 
    });
  }
});

app.get('/api/campaign-stats', (req, res) => {
  res.json(campaignStats);
});

app.get('/api/leads', (req, res) => {
  res.json(leads);
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    campaignEngine: 'ready'
  });
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Batch Email Campaign Engine running on port ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}`);
  console.log(`⚡ Ready for campaign execution!`);
});

module.exports = app;
