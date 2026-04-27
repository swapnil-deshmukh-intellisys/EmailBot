export const workspacePageConfigs = {
  leads: {
    section: 'Leads',
    title: 'Keep your lead pipeline clean, segmented, and launch-ready.',
    description: 'Review source quality, prioritize prospects, and catch weak records before they reach a campaign.',
    primaryAction: 'Create Segment',
    secondaryAction: 'Import Leads',
    stats: [
      { label: 'Total Leads', value: '8,420' },
      { label: 'Qualified', value: '2,180' },
      { label: 'Needs Review', value: '146' },
      { label: 'New Today', value: '84' }
    ],
    tableTitle: 'Lead Queue',
    tableDescription: 'Recent lead records across active sources and lifecycle stages.',
    columns: ['Name', 'Company', 'Stage', 'Region', 'Source'],
    rows: [
      ['Akshay Patel', 'ABC Tech', 'Qualified', 'India', 'CSV Import'],
      ['Riya Sharma', 'ScaleOps', 'New', 'APAC', 'Website Form'],
      ['Milan Shah', 'Northstar', 'Contacted', 'India', 'CRM Sync'],
      ['Neha Joshi', 'Marketify', 'Review', 'India', 'Manual Entry']
    ],
    sideTitle: 'Segment Health',
    sideDescription: 'A quick view of the lists driving current outreach.',
    sideItems: [
      { title: 'Founder Outreach', meta: '1,280 records - 91% complete profiles' },
      { title: 'Enterprise Prospects', meta: '860 records - 84% verified' },
      { title: 'Newsletter Subscribers', meta: '2,120 records - 96% usable' }
    ],
    activityTitle: 'Recent Activity',
    activityDescription: 'Latest changes across import, validation, and segmentation.',
    activityItems: [
      { title: '84 leads imported', meta: 'Founder upload finished processing this morning' },
      { title: 'Validation completed', meta: '146 records flagged for manual review' },
      { title: 'Stage updated', meta: 'Outbound trial list moved to Contacted' }
    ],
    accent: '#2563eb'
  },
  drafts: {
    section: 'Drafts',
    title: 'Manage campaign messaging with a cleaner editorial workflow.',
    description: 'Keep approved copy, work-in-progress drafts, and archived variants visible to the whole team.',
    primaryAction: 'Create Draft',
    secondaryAction: 'Import Copy',
    stats: [
      { label: 'Saved Drafts', value: '124' },
      { label: 'Approved', value: '86' },
      { label: 'In Review', value: '18' },
      { label: 'Archived', value: '20' }
    ],
    tableTitle: 'Draft Library',
    tableDescription: 'High-priority drafts, approval state, and last editor activity.',
    columns: ['Draft', 'Subject', 'Status', 'Owner', 'Updated'],
    rows: [
      ['Founder Outreach V2', 'A simpler way to send your next campaign', 'Approved', 'Akshay', '2 hours ago'],
      ['April Newsletter', 'What shipped this month', 'Review', 'Riya', 'Today'],
      ['Webinar Reminder', 'You are still on the guest list', 'Approved', 'Team', 'Yesterday'],
      ['Follow-up Demo', 'Checking in after our walkthrough', 'Archived', 'Milan', 'Last week']
    ],
    sideTitle: 'Editorial Status',
    sideDescription: 'What the content team should focus on next.',
    sideItems: [
      { title: 'Ready to Send', meta: '86 approved drafts are campaign-ready' },
      { title: 'Waiting for Review', meta: '18 drafts need approval before launch' },
      { title: 'Imported This Week', meta: '7 new drafts entered the workspace' }
    ],
    activityTitle: 'Editor Activity',
    activityDescription: 'Recent copy edits and review requests.',
    activityItems: [
      { title: 'Draft updated', meta: 'Founder Outreach V2 got a new CTA block' },
      { title: 'Review requested', meta: 'April Newsletter sent to content review' },
      { title: 'Archive cleaned', meta: 'Legacy webinar copy moved out of active use' }
    ],
    accent: '#f97316'
  },
  'draft-templates': {
    section: 'Draft & Templates',
    title: 'Build a reusable messaging system for every outreach motion.',
    description: 'Organize templates, snippets, and variants so new campaigns start from proven copy.',
    primaryAction: 'New Template',
    secondaryAction: 'Browse Categories',
    stats: [
      { label: 'Templates', value: '74' },
      { label: 'Categories', value: '12' },
      { label: 'Active Variants', value: '29' },
      { label: 'Shared Blocks', value: '41' }
    ],
    tableTitle: 'Template Catalog',
    tableDescription: 'Reusable templates by category, usage, and current owner.',
    columns: ['Template', 'Category', 'Variant', 'Usage', 'Owner'],
    rows: [
      ['Cold Intro', 'Outbound', 'A/B', '124 sends', 'Akshay'],
      ['Follow-up 01', 'Nurture', 'Single', '88 sends', 'Riya'],
      ['Webinar Reminder', 'Events', 'A/B', '42 sends', 'Team'],
      ['Demo Follow-up', 'Sales', 'Single', '39 sends', 'Milan']
    ],
    sideTitle: 'Library Overview',
    sideDescription: 'Signals that keep the template library healthy.',
    sideItems: [
      { title: 'Top Performer', meta: 'Cold Intro remains the highest-used template' },
      { title: 'Shared Snippets', meta: '41 reusable blocks available to the team' },
      { title: 'Needs Cleanup', meta: '6 outdated templates are still active' }
    ],
    activityTitle: 'Template Activity',
    activityDescription: 'Recent changes across categories and reusable copy.',
    activityItems: [
      { title: 'Variant created', meta: 'Cold Intro branched into a new A/B version' },
      { title: 'Category updated', meta: 'Sales follow-ups were reorganized' },
      { title: 'Snippet added', meta: 'A new CTA block was saved for SaaS campaigns' }
    ],
    accent: '#ea580c'
  },
  'master-inbox': {
    section: 'Master Inbox',
    title: 'Keep shared conversations organized and ready for follow-up.',
    description: 'Monitor replies, assign ownership, and move important threads forward without leaving the workspace.',
    primaryAction: 'Open Shared Inbox',
    secondaryAction: 'Create Rule',
    stats: [
      { label: 'Unread Threads', value: '42' },
      { label: 'Assigned', value: '19' },
      { label: 'Awaiting Reply', value: '11' },
      { label: 'Closed Today', value: '27' }
    ],
    tableTitle: 'Inbox Threads',
    tableDescription: 'Latest conversations across the shared outreach mailbox.',
    columns: ['Contact', 'Subject', 'Owner', 'Status', 'Last Reply'],
    rows: [
      ['Steven Spielberg', 'Partnership follow-up', 'Akshay', 'Awaiting Reply', '2h ago'],
      ['Gayatri Pro', 'Demo request', 'Riya', 'Assigned', '5h ago'],
      ['Mark Lewis', 'Pricing question', 'Milan', 'Unread', 'Today'],
      ['Northstar Team', 'Campaign feedback', 'Team', 'Closed', 'Yesterday']
    ],
    sideTitle: 'Inbox Queues',
    sideDescription: 'Operational priorities for the shared mailbox.',
    sideItems: [
      { title: 'Priority Replies', meta: '8 threads need same-day action' },
      { title: 'Waiting for Follow-up', meta: '14 contacts are awaiting a response' },
      { title: 'Resolved Today', meta: '27 conversations were closed cleanly' }
    ],
    activityTitle: 'Mailbox Activity',
    activityDescription: 'Recent routing, reply, and tagging changes.',
    activityItems: [
      { title: 'Assignment updated', meta: 'Pricing thread moved to Akshay' },
      { title: 'Reply sent', meta: 'Demo request answered from the shared inbox' },
      { title: 'Rule applied', meta: 'Partner outreach emails now auto-tag correctly' }
    ],
    accent: '#0f766e'
  },
  'sender-emails': {
    section: 'Sender Emails',
    title: 'Monitor sender health, connection status, and warmup readiness.',
    description: 'See which mailboxes are healthy, which need attention, and which are ready for campaign volume.',
    primaryAction: 'Connect Sender',
    secondaryAction: 'Run Health Check',
    stats: [
      { label: 'Connected Senders', value: '14' },
      { label: 'Healthy', value: '11' },
      { label: 'Needs Attention', value: '3' },
      { label: 'Warmup Active', value: '9' }
    ],
    tableTitle: 'Sender Accounts',
    tableDescription: 'Connected mailboxes, provider health, and latest sync status.',
    columns: ['Sender', 'Provider', 'Health', 'Warmup', 'Last Sync'],
    rows: [
      ['akshay@company.com', 'Google', 'Healthy', 'Active', '10 min ago'],
      ['sales@company.com', 'Outlook', 'Healthy', 'Active', '22 min ago'],
      ['team@company.com', 'Google', 'Warning', 'Paused', '1h ago'],
      ['growth@company.com', 'SMTP', 'Healthy', 'Active', '2h ago']
    ],
    sideTitle: 'Sender Health',
    sideDescription: 'Daily signals that affect deliverability and launch confidence.',
    sideItems: [
      { title: 'Deliverability Score', meta: '91% average mailbox health this week' },
      { title: 'Warmup Pool', meta: '9 accounts are actively building reputation' },
      { title: 'Needs Reconnect', meta: '2 mailboxes lost sync and need attention' }
    ],
    activityTitle: 'Sender Activity',
    activityDescription: 'Recent connection and warmup events.',
    activityItems: [
      { title: 'Health check completed', meta: 'All active sender accounts were scanned' },
      { title: 'Reconnect required', meta: 'team@company.com lost token sync' },
      { title: 'Warmup resumed', meta: 'sales@company.com moved back to active' }
    ],
    accent: '#7c3aed'
  },
  'email-warmup': {
    section: 'Email Warmup',
    title: 'Control mailbox warmup without losing sight of sender health.',
    description: 'Balance daily volume, reputation growth, and pacing so accounts stay ready for production sending.',
    primaryAction: 'Start Warmup',
    secondaryAction: 'Adjust Limits',
    stats: [
      { label: 'Warmup Accounts', value: '9' },
      { label: 'Average Score', value: '74%' },
      { label: 'Paused', value: '2' },
      { label: 'Daily Sends', value: '312' }
    ],
    tableTitle: 'Warmup Overview',
    tableDescription: 'Mailbox readiness, volume, and current warmup direction.',
    columns: ['Mailbox', 'Score', 'Daily Volume', 'Status', 'Trend'],
    rows: [
      ['akshay@company.com', '82%', '48', 'Active', 'Up'],
      ['sales@company.com', '76%', '42', 'Active', 'Stable'],
      ['team@company.com', '61%', '30', 'Paused', 'Down'],
      ['growth@company.com', '79%', '51', 'Active', 'Up']
    ],
    sideTitle: 'Warmup Segments',
    sideDescription: 'Where mailbox performance is strongest and weakest.',
    sideItems: [
      { title: 'High Readiness', meta: '4 mailboxes are above 80%' },
      { title: 'Mid-range Pool', meta: '3 mailboxes are between 70% and 79%' },
      { title: 'Needs Help', meta: '2 mailboxes are still under 65%' }
    ],
    activityTitle: 'Warmup Activity',
    activityDescription: 'Latest updates to warmup pacing and status.',
    activityItems: [
      { title: 'Volume adjusted', meta: 'growth@company.com got a higher daily cap' },
      { title: 'Mailbox paused', meta: 'team@company.com paused after a warning spike' },
      { title: 'Score improved', meta: 'akshay@company.com crossed the 80% mark' }
    ],
    accent: '#14b8a6'
  },
  campaigns: {
    section: 'Campaigns',
    title: 'Run campaigns with clearer visibility into pace, status, and launch timing.',
    description: 'Track which campaigns are active, which are queued, and where operational attention is needed.',
    primaryAction: 'New Campaign',
    secondaryAction: 'Open Calendar',
    stats: [
      { label: 'Active Campaigns', value: '24' },
      { label: 'Scheduled', value: '7' },
      { label: 'Paused', value: '3' },
      { label: 'Sent Today', value: '1,204' }
    ],
    tableTitle: 'Campaign Queue',
    tableDescription: 'Current campaign execution across live, scheduled, and paused work.',
    columns: ['Campaign', 'Audience', 'Status', 'Window', 'Owner'],
    rows: [
      ['April SaaS Outreach', '2,450 contacts', 'Active', 'Today', 'Akshay'],
      ['Webinar Invite', '820 contacts', 'Scheduled', 'Tomorrow', 'Team'],
      ['Follow-up Demo', '640 contacts', 'Paused', 'Reviewing', 'Riya'],
      ['Founder Intro', '1,120 contacts', 'Active', 'This Week', 'Milan']
    ],
    sideTitle: 'Campaign Health',
    sideDescription: 'Which launches need attention before they drift.',
    sideItems: [
      { title: 'On Track', meta: '18 campaigns are pacing normally' },
      { title: 'Needs Review', meta: '3 campaigns need sender or copy checks' },
      { title: 'Queued Next', meta: '7 campaigns are ready for launch windows' }
    ],
    activityTitle: 'Campaign Activity',
    activityDescription: 'Recent schedule, status, and delivery updates.',
    activityItems: [
      { title: 'Campaign resumed', meta: 'April SaaS Outreach is back in progress' },
      { title: 'Schedule updated', meta: 'Webinar Invite moved to tomorrow morning' },
      { title: 'Pause requested', meta: 'Follow-up Demo is waiting on content review' }
    ],
    accent: '#f97316'
  },
  report: {
    section: 'Report',
    title: 'Review performance snapshots without digging through raw activity.',
    description: 'Follow delivery, engagement, and quality trends from one cleaner reporting workspace.',
    primaryAction: 'New Report',
    secondaryAction: 'Export Summary',
    stats: [
      { label: 'Reports Saved', value: '38' },
      { label: 'Open Rate', value: '42%' },
      { label: 'Reply Rate', value: '12%' },
      { label: 'Bounce Rate', value: '1.2%' }
    ],
    tableTitle: 'Saved Reports',
    tableDescription: 'Recent reporting snapshots ready for review or export.',
    columns: ['Report', 'Range', 'Open', 'Replies', 'Updated'],
    rows: [
      ['Weekly SaaS Summary', 'This Week', '41%', '11%', 'Today'],
      ['India Founder Report', 'Last 14 Days', '44%', '13%', 'Yesterday'],
      ['Newsletter Performance', 'March', '38%', '9%', '2 days ago'],
      ['Sales Sequence Review', 'Q1', '46%', '15%', 'Last week']
    ],
    sideTitle: 'Reporting Focus',
    sideDescription: 'The strongest and weakest signals in current performance.',
    sideItems: [
      { title: 'Best Segment', meta: 'India founders are driving the strongest replies' },
      { title: 'Lowest Bounce', meta: 'Newsletter traffic is holding at 0.4%' },
      { title: 'Needs Refresh', meta: '2 saved reports are missing recent sync data' }
    ],
    activityTitle: 'Reporting Activity',
    activityDescription: 'Recent exports, saves, and metric refreshes.',
    activityItems: [
      { title: 'Report saved', meta: 'Weekly SaaS Summary was generated today' },
      { title: 'Export downloaded', meta: 'March performance was exported by Akshay' },
      { title: 'Metrics refreshed', meta: 'Campaign reporting finished a full sync' }
    ],
    accent: '#0ea5e9'
  },
  'mail-inbox': {
    section: 'Mail Inbox',
    title: 'Process campaign replies with a clearer, faster team workflow.',
    description: 'Keep inbox context, ownership, and response urgency visible while campaign conversations are active.',
    primaryAction: 'Open Inbox',
    secondaryAction: 'Sync Mail',
    stats: [
      { label: 'New Replies', value: '26' },
      { label: 'Unread', value: '17' },
      { label: 'Assigned', value: '8' },
      { label: 'Resolved', value: '54' }
    ],
    tableTitle: 'Inbox Feed',
    tableDescription: 'Latest inbound replies from active campaign traffic.',
    columns: ['Sender', 'Subject', 'Mailbox', 'Status', 'Received'],
    rows: [
      ['Mark Lewis', 'Re: Product demo', 'akshay@company.com', 'Unread', '18 min ago'],
      ['Steven Spielberg', 'Partnership update', 'sales@company.com', 'Assigned', '42 min ago'],
      ['Gayatri Pro', 'Interested in details', 'team@company.com', 'Unread', '1h ago'],
      ['Northstar Team', 'Pricing follow-up', 'akshay@company.com', 'Resolved', 'Yesterday']
    ],
    sideTitle: 'Reply Buckets',
    sideDescription: 'A quick operational view of current inbox load.',
    sideItems: [
      { title: 'Priority Replies', meta: '6 messages need action within the hour' },
      { title: 'Waiting for Assignment', meta: '11 replies still need an owner' },
      { title: 'Resolved This Week', meta: '54 threads were cleared successfully' }
    ],
    activityTitle: 'Inbox Activity',
    activityDescription: 'Recent reply handling and mailbox sync changes.',
    activityItems: [
      { title: 'Reply assigned', meta: 'Partnership thread was routed to Akshay' },
      { title: 'Thread resolved', meta: 'Pricing follow-up was marked complete' },
      { title: 'Mailbox synced', meta: 'Latest campaign replies finished importing' }
    ],
    accent: '#4f46e5'
  }
};
