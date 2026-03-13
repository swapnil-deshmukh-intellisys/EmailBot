# Batch Email Campaign Execution Engine

A sophisticated email campaign system with controlled parallel sending, multi-stage follow-ups, and Microsoft Graph API integration.

## 🎯 Core Features

### **Campaign Flow Management**
- **Cover Story**: Send initial emails to new leads (max 50 per day)
- **Reminder**: Follow-up 2 days after cover (if not responded)
- **Follow-up**: Final follow-up 4 days after cover (if not responded)

### **Controlled Parallel Sending**
- **Max 10 emails simultaneously**
- **3-second delay between batches**
- **Rate limit handling with 10-second retry**
- **Microsoft Graph API compliance**

### **Smart Cost Logic**
```
IF FinalCost exists → use FinalCost
ELSE IF UpdatedCost exists → use UpdatedCost  
ELSE → use InitialCost
```

### **Comprehensive Tracking**
- Email count per lead
- Stage progression tracking
- Last email date recording
- Success/failure logging
- Daily execution limits

## 🚀 Quick Start

### Installation
```bash
cd campaign_engine
npm install
```

### Configuration
Edit `.env` file with your Microsoft Graph API credentials:
```env
GRAPH_TENANT_ID=your_tenant_id
GRAPH_CLIENT_ID=your_client_id
GRAPH_CLIENT_SECRET=your_client_secret
```

### Run Campaign Engine
```bash
npm start
```

### Execute Daily Campaign
```bash
curl -X POST http://localhost:5001/api/run-daily-campaign
```

## 📊 API Endpoints

### **POST /api/run-daily-campaign**
Executes the complete daily campaign flow:
- Sends 50 new cover story emails
- Sends reminder emails (2-day rule)
- Sends follow-up emails (4-day rule)
- Returns execution summary

**Response:**
```json
{
  "success": true,
  "message": "Daily campaign executed successfully",
  "summary": {
    "coverSent": 45,
    "reminderSent": 12,
    "followUpSent": 8,
    "totalEmailsSent": 65,
    "failedEmails": 2
  }
}
```

### **GET /api/campaign-stats**
Returns current campaign statistics and execution history.

### **GET /api/leads**
Returns all leads with their current stage and tracking data.

### **GET /api/health**
Health check endpoint for monitoring.

## 🔄 Campaign Execution Logic

### **Daily Campaign Flow**
1. **Cover Story Phase**
   - Select up to 50 leads with stage = 'new'
   - Send personalized cover story emails
   - Update lead tracking: coverSentDate, stage = 'cover_sent'

2. **Reminder Phase**
   - Find leads where coverSentDate = 2 days ago
   - Check reminderSent = false
   - Send reminder emails
   - Update lead tracking: reminderSent = true, stage = 'reminder_sent'

3. **Follow-up Phase**
   - Find leads where coverSentDate = 4 days ago
   - Check followUpSent = false
   - Send final follow-up emails
   - Update lead tracking: followUpSent = true, stage = 'follow_up_sent'

### **Sending Strategy**
```
Batch Size: 10 emails max
Batch Delay: 3 seconds
Rate Limit Retry: 10 seconds
Max Retries: 1 per failed email
```

### **Rate Limit Handling**
- Detect 429 responses from Graph API
- Wait 10 seconds
- Retry failed emails once
- Log persistent failures

## 📧 Email Templates

### **Cover Story Email**
- Subject: "Cover Story Proposal - Top Visionary Leaders in AI - 2026"
- Content: Initial proposal with cost details
- Personalization: Lead name, dynamic cost

### **Reminder Email**
- Subject: "Reminder: Cover Story Proposal - AI Leaders 2026"
- Content: Follow-up reminder
- Cost reference: Previous communication

### **Follow-up Email**
- Subject: "Final Follow-up: AI Leaders 2026 Cover Story"
- Content: Final opportunity notice
- Urgency: Last chance to participate

## 📈 Analytics & Logging

### **Campaign Statistics**
- Total emails sent per day
- Success/failure rates
- Stage progression metrics
- Cost optimization tracking

### **Logging Levels**
- **INFO**: Successful email sends
- **WARN**: Rate limit events
- **ERROR**: Failed email attempts
- **DEBUG**: Detailed execution flow

### **Log Files**
- `campaign.log`: Detailed execution logs
- Console output: Real-time monitoring

## 🔧 Configuration Options

### **Sending Parameters**
```javascript
const MAX_CONCURRENT_EMAILS = 10;
const BATCH_DELAY = 3000; // 3 seconds
const RATE_LIMIT_RETRY_DELAY = 10000; // 10 seconds
```

### **Campaign Limits**
```javascript
const MAX_COVER_EMAILS_PER_DAY = 50;
const REMINDER_DELAY_DAYS = 2;
const FOLLOW_UP_DELAY_DAYS = 4;
```

## 🛡️ Safety Features

### **Execution Controls**
- **No auto-running**: Manual trigger only
- **Daily execution limit**: Once per day max
- **Rate limit respect**: Microsoft Graph API compliance
- **Error handling**: Graceful failure recovery

### **Data Protection**
- **Secure credential storage**: Environment variables
- **Input validation**: Email format verification
- **Error logging**: Detailed failure tracking
- **Backup mechanisms**: Retry logic for failed sends

## 🔍 Monitoring & Debugging

### **Health Checks**
```bash
curl http://localhost:5001/api/health
```

### **Campaign Status**
```bash
curl http://localhost:5001/api/campaign-stats
```

### **Lead Tracking**
```bash
curl http://localhost:5001/api/leads
```

## 🚀 Production Deployment

### **Environment Setup**
1. Configure Microsoft Graph API credentials
2. Set up MongoDB for lead storage (optional)
3. Configure logging and monitoring
4. Set up backup and recovery procedures

### **Scaling Considerations**
- Horizontal scaling with load balancer
- Database connection pooling
- Email queue management
- Rate limit distributed tracking

### **Security Best Practices**
- Use HTTPS for all API calls
- Implement API authentication
- Regular credential rotation
- Monitor for abuse patterns

---

**Batch Email Campaign Engine** - Professional email automation with intelligent follow-up sequences and controlled sending rates.
