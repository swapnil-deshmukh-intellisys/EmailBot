import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const appRoot = path.join(repoRoot, 'dashboard-next');
const outputDir = path.join(repoRoot, 'project-management', 'google-sheets');
const statePath = path.join(repoRoot, 'project-management', 'project_state.json');
const generatedOn = '2026-06-25';
const owner = 'Akshay / Full-stack';
const baselineDate = '2026-06-23';

fs.mkdirSync(outputDir, { recursive: true });

function walk(dir, predicate) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(entry.name)) result.push(...walk(full, predicate));
    } else if (predicate(full)) {
      result.push(full);
    }
  }
  return result;
}

function rel(file) {
  return path.relative(appRoot, file).replaceAll('\\', '/');
}

function routeFromFile(file, prefix) {
  const value = rel(file)
    .replace(/^app\//, '/')
    .replace(/\/page\.(js|jsx)$/, '')
    .replace(/\/route\.js$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1');
  return value === prefix ? '/' : value;
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, headers, rows) {
  const content = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))
  ].join('\r\n');
  fs.writeFileSync(path.join(outputDir, `${name}.csv`), `${content}\r\n`, 'utf8');
}

function isoDate(offset) {
  const date = new Date(`${baselineDate}T00:00:00+05:30`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function displayDate(isoValue) {
  if (typeof isoValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoValue)) return isoValue;
  const [year, month, day] = isoValue.split('-');
  return `${day}-${month}-${year}`;
}

function daysFromGenerated(dateValue) {
  const dayMs = 24 * 60 * 60 * 1000;
  const current = new Date(`${generatedOn}T00:00:00+05:30`);
  const target = new Date(`${dateValue}T00:00:00+05:30`);
  return Math.round((target - current) / dayMs);
}

function dateInRange(dateValue, startValue, endValue) {
  return dateValue >= startValue && dateValue <= endValue;
}

function taskOverlapsRange(task, startValue, endValue) {
  return task['Start Date'] <= endValue && task['Target Date'] >= startValue;
}

const pageFiles = walk(path.join(appRoot, 'app'), (file) => /[\\/]page\.(js|jsx)$/.test(file)).sort();
const apiFiles = walk(path.join(appRoot, 'app', 'api'), (file) => file.endsWith(`${path.sep}route.js`)).sort();
const modelFiles = walk(path.join(appRoot, 'database-models'), (file) => file.endsWith('.js')).sort();

const apiRows = [];
for (const file of apiFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((match) => match[1]);
  const endpoint = routeFromFile(file, '/api');
  for (const method of methods.length ? methods : ['UNKNOWN']) {
    apiRows.push({
      'API Name': `${method} ${endpoint}`,
      Endpoint: endpoint,
      Method: method,
      Integrated: methods.length ? 'Yes' : 'Review required',
      'Testing Status': 'Automated coverage missing',
      'Completion %': methods.length ? 72 : 40
    });
  }
}

const frontendRows = pageFiles.map((file) => {
  const route = routeFromFile(file, '/');
  const source = fs.readFileSync(file, 'utf8');
  const imported = [...source.matchAll(/import\s+([A-Za-z0-9_{}*,\s]+)\s+from/g)]
    .slice(0, 4)
    .map((match) => match[1].replace(/\s+/g, ' ').trim())
    .join('; ');
  return {
    Page: route,
    Module: route.split('/').filter(Boolean)[0] || 'Landing',
    Components: imported || 'Page-local components',
    Framework: 'Next.js 14 / React 18',
    Status: route.includes(':') ? 'Implemented - dynamic route QA pending' : 'Implemented - QA pending',
    'Completion %': route.includes('dashboard') ? 82 : 76
  };
});

const databaseRows = modelFiles.map((file) => {
  const source = fs.readFileSync(file, 'utf8');
  const refs = [...source.matchAll(/ref:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const indexCount = (source.match(/\.index\s*\(/g) || []).length;
  const hasSeed = /seed|default/i.test(source);
  return {
    Table: path.basename(file, '.js'),
    Relationships: refs.length ? [...new Set(refs)].join(', ') : 'No explicit Mongoose ref',
    Indexes: indexCount ? `${indexCount} declared index(es)` : 'Index review required',
    Migration: 'Schema exists; migration/versioning framework pending',
    'Seed Data': hasSeed ? 'Defaults present; seed script review required' : 'Not documented',
    'Completion %': indexCount ? 76 : 65
  };
});

const taskSeed = [
  ['IMP-001','Project Management','All','Architecture','Baseline','Create durable project baseline and Google Sheets import pack','Inventory pages and components','Inventory services and workers','Inventory schemas and indexes','Inventory endpoints and methods','Validate generated trackers','Critical',8,0,0,'None','Low','Completed',100,owner,'15 trackers, reports, state file'],
  ['IMP-002','Campaign Workflow','Dashboard','Schedule Modal','Schedule Details','Finish four-column schedule details layout and six-column delivery settings','Responsive JSX/CSS','No change','No change','No change','Build and viewport smoke test','High',4,0,1,'Current uncommitted workflow changes','Medium','In Progress',80,owner,'Stable schedule modal across desktop/mobile'],
  ['IMP-003','Engineering Quality','All','Linting','ESLint','Commit a non-interactive ESLint configuration and resolve baseline violations','Fix lint findings','Fix server lint findings','No change','Fix route lint findings','Run lint in CI','Critical',8,0,2,'None','Medium','Not Started',0,owner,'npm run lint passes unattended'],
  ['IMP-004','Engineering Quality','All','Build','Production Build','Run clean production build and document warnings','Resolve UI compile issues','Resolve server compile issues','Validate model compilation','Validate route compilation','Build smoke test','Critical',6,1,2,'IMP-002, IMP-003','Medium','Not Started',0,owner,'next build succeeds cleanly'],
  ['IMP-005','QA Foundation','All','Testing','Test Strategy','Define test pyramid, fixtures, environments, and release gates','Component test plan','Service test plan','Test database strategy','Contract test plan','QA matrix and acceptance criteria','Critical',8,1,3,'IMP-001','Low','Not Started',0,owner,'Approved QA strategy'],
  ['IMP-006','Authentication','Login and account pages','Auth','RBAC','Automate login, logout, session, role routing, pending and disabled account flows','Auth page tests','Auth service tests','UserProfile fixture coverage','Auth endpoint tests','Security and negative-path tests','Critical',18,2,7,'IMP-005','High','Not Started',0,owner,'Verified USER/MANAGER/ADMIN access matrix'],
  ['IMP-007','Security','All','Secrets and Tokens','Security Audit','Audit cookie flags, JWT expiry, token crypto, password reset and secret handling','Review client exposure','Harden auth services','Review sensitive fields','Pen-test auth APIs','OWASP checklist','Critical',20,4,10,'IMP-006','High','Not Started',0,owner,'Security findings closed or accepted'],
  ['IMP-008','Client Data','Client Data','Upload','File Validation','Harden XLSX/CSV upload, preview, commit and validation errors','Upload UX and validation states','Chunking and validation','UploadFile/ClientSheet consistency','Upload endpoint contracts','Large file and malformed file tests','High',24,3,10,'IMP-005','High','In Progress',70,owner,'Reliable upload pipeline'],
  ['IMP-009','Client Data','Client List','Records','CRUD and Duplicates','Verify bulk edit/delete, duplicate detection, bin and restore workflows','Grid and selection QA','Bulk operation safety','ClientRecord/ClientBin integrity','CRUD API integration','Regression and concurrency tests','High',28,6,14,'IMP-008','High','In Progress',68,owner,'Data operations are reversible and scoped'],
  ['IMP-010','Drafts','Drafts','Editor','Rich Text','Stabilize draft editor, templates, file text extraction and preview','Editor and responsive QA','Sanitization and conversion','Draft schema validation','Draft/template API tests','Content and XSS tests','High',24,7,14,'IMP-005','Medium','In Progress',75,owner,'Safe reusable draft workflow'],
  ['IMP-011','Campaigns','Campaign Wizard','Creation','Preflight','Validate audience, sender, content, credits and scheduling before creation','Wizard state and validation','Preflight business rules','Campaign relation integrity','Campaign create contracts','End-to-end creation tests','Critical',30,8,17,'IMP-006, IMP-008, IMP-010','High','In Progress',72,owner,'Campaign creation cannot enter invalid state'],
  ['IMP-012','Campaigns','Broadcasts','Execution','Worker Lifecycle','Test queue, locks, heartbeat, stale recovery, pause, resume, stop and completion','Live status UI','Worker idempotency and recovery','Campaign/claim/log consistency','Control and status APIs','Crash/retry/concurrency tests','Critical',40,12,24,'IMP-011','Critical','In Progress',65,owner,'Recoverable exactly-once-oriented execution'],
  ['IMP-013','Campaigns','Broadcasts','Delivery','Recipient Safety','Verify recipient claims, global send locks, dedupe and retry classification','Failure visibility','Locking and classification','Unique indexes and retention','Recipient/debug/export APIs','Duplicate-send and bounce tests','Critical',32,17,28,'IMP-012','Critical','In Progress',62,owner,'No accidental duplicate sends'],
  ['IMP-014','Campaigns','Reports','Tracking','Open/Click/Reply','Validate tracking pixels, event endpoints, reply sync and campaign attribution','Metrics presentation','Tracking/reply matcher','Tracking ID indexes','Tracking and sync APIs','Webhook and attribution tests','High',28,22,33,'IMP-012','High','In Progress',65,owner,'Trustworthy campaign analytics'],
  ['IMP-015','Mail Accounts','Sender Emails','Connections','SMTP and Graph','Stabilize sender account creation, OAuth callback, token refresh and status','Connection UX','Provider resolution and refresh','Account uniqueness and encryption review','Account/OAuth endpoint tests','Expired token and provider fallback tests','Critical',36,14,28,'IMP-006','Critical','In Progress',70,owner,'Reliable connected sender accounts'],
  ['IMP-016','Mailbox','Master Inbox','Messages','Unified Inbox','Validate folder sync, cache, pagination, read/archive/delete/reply/forward/send','Inbox interaction QA','Graph mailbox service','Cache and sync state integrity','Mailbox API contract tests','Provider integration tests','High',40,25,40,'IMP-015','High','In Progress',68,owner,'Consistent inbox across supported providers'],
  ['IMP-017','Warm-up','Warm-up','Automation','Conversations','Validate sheets, senders, conversations, run-next, pause/stop and auto replies','Warm-up dashboard QA','Automation safety and throttling','Warmup model lifecycle','Warm-up endpoint tests','Scenario and rate-limit tests','High',40,29,45,'IMP-015','Critical','In Progress',60,owner,'Controlled and auditable warm-up engine'],
  ['IMP-018','Admin','Admin Dashboard','User Management','Lifecycle','Test request approval, status, password reset, subscription and scoped resource views','Admin UX and empty/error states','Authorization checks','User/subscription consistency','Admin API tests','Role-escalation tests','High',30,30,42,'IMP-006','High','In Progress',72,owner,'Safe admin operations'],
  ['IMP-019','Billing','Profile and Admin','Credits','Ledger','Validate subscriptions, upgrades, invoices, credit reservation and reports','Billing states','Atomic credit logic','Ledger reconciliation','Billing/credits/report APIs','Reconciliation and race tests','Critical',32,35,49,'IMP-012','Critical','In Progress',66,owner,'Auditable credit accounting'],
  ['IMP-020','Reporting','Reports and Summary','Analytics','Dashboards','Reconcile dashboard, campaign, project, sender, warm-up and credit metrics','Chart/table QA','Analytics aggregation','Query/index tuning','Report API tests','Metric reconciliation tests','High',36,40,56,'IMP-014, IMP-019','High','In Progress',64,owner,'Consistent stakeholder reporting'],
  ['IMP-021','Productivity','Dashboard','Tasks and Calendar','Planning','Validate timeline tasks, calendar events, work updates and approvals','Planner UX','Assignment rules','Task/event relationships','Task/calendar API tests','Workflow tests','Medium',28,45,58,'IMP-006','Medium','In Progress',70,owner,'Reliable internal planning workflow'],
  ['IMP-022','Performance','All','Frontend','Bundle and Rendering','Profile large dashboard component, CSS size, rerenders and route payloads','Split components and reduce CSS debt','Optimize response payloads','No change','Measure API payloads','Lighthouse and interaction profiling','High',40,50,66,'IMP-004','High','Not Started',0,owner,'Measured performance budget achieved'],
  ['IMP-023','Performance','All','Backend','Database Queries','Profile slow queries and validate indexes for campaign, client data, inbox and reports','No change','Query optimization','Index audit and explain plans','Pagination and field projection','Load and soak tests','High',36,54,70,'IMP-012, IMP-016, IMP-020','High','Not Started',0,owner,'Documented query SLOs'],
  ['IMP-024','Observability','Operations','Logging','Health and Alerts','Standardize structured logs, correlation IDs, worker health, queue alerts and dashboards','Admin health view','Logging and heartbeat telemetry','Retention policy','Health/debug API hardening','Failure drill','High',32,60,75,'IMP-012','High','Not Started',0,owner,'Actionable production telemetry'],
  ['IMP-025','CI/CD','Repository','Pipeline','Quality Gates','Add install, lint, test, build, secret scan and artifact checks','Frontend CI','Backend CI','Migration checks','Contract checks','Automated quality gates','Critical',28,63,77,'IMP-003, IMP-005','Medium','Not Started',0,owner,'Every change gets repeatable validation'],
  ['IMP-026','Deployment','AWS ECS','Web and Worker','Immutable Release','Validate Docker build, ECS task definitions, secrets, rollbacks and worker singleton','Runtime config','Web/worker separation','Connectivity and backup check','Health probes','Staging deployment test','Critical',36,70,84,'IMP-024, IMP-025','High','In Progress',45,owner,'Repeatable staging deployment'],
  ['IMP-027','Data Reliability','MongoDB','Recovery','Backup and Migration','Create schema migration policy, backup/restore test and data retention rules','No change','Recovery scripts','Versioning and retention','Admin-only operations','Restore rehearsal','Critical',32,68,82,'IMP-023','High','Not Started',0,owner,'Proven recovery procedure'],
  ['IMP-028','Legacy Cleanup','Repository','Legacy Apps','Decommission','Decide and execute retirement path for legacy dashboard, Python automation and standalone campaign engine','Remove dead UI references','Archive superseded services','Data compatibility review','Remove obsolete endpoints','Regression check','Medium',24,75,88,'IMP-026, IMP-027','Medium','Not Started',0,owner,'Single supported production architecture'],
  ['IMP-029','Accessibility','All Pages','UI','WCAG','Complete keyboard, focus, contrast, labels, modal and reduced-motion audit','Accessibility fixes','No change','No change','No change','Automated and manual WCAG QA','High',36,58,76,'IMP-004','Medium','Not Started',0,owner,'WCAG 2.1 AA critical paths'],
  ['IMP-030','Responsive UI','All Pages','UI','Viewport Matrix','Execute manual QA at 320, 375, 430, 768, 1024, 1280, 1440 and 1920 pixels','Responsive fixes','No change','No change','No change','Evidence screenshots and checklist','High',32,2,12,'IMP-002, IMP-004','Medium','In Progress',35,owner,'Signed responsive test matrix'],
  ['IMP-031','Release','All','UAT','Business Acceptance','Run role-based UAT with realistic data and production-like sender accounts','UAT fixes','UAT fixes','Data setup','API fixes','Acceptance sign-off','Critical',40,78,92,'IMP-006 through IMP-030','High','Not Started',0,owner,'Signed UAT report'],
  ['IMP-032','Release','Production','Go-live','Release Candidate','Freeze scope, close critical defects, rehearse rollback and deploy','Release UI','Release services','Backup and migration','Smoke suite','Production verification','Critical',32,90,96,'IMP-031','Critical','Not Started',0,owner,'Production release with rollback readiness'],
  ['IMP-033','Release','Production','Hypercare','Stabilization','Monitor delivery, errors, credits, worker queues and inbox sync after launch','Hotfix UI','Hotfix services','Integrity monitoring','Endpoint monitoring','Daily hypercare report','High',40,97,104,'IMP-032','High','Not Started',0,owner,'Stable seven-day production window'],
  ['IMP-034','Project Management','All','Google Sheets Import','Excel Date Format','Fix Excel and Google Sheets import date formatting and weekly auto-fill summaries','Workbook rebuild and date-safe export','No change','No change','No change','Verify imported date values and summary tabs','High',4,1,2,'IMP-001','Low','Completed',100,owner,'Existing workbook, CSV tabs, ZIP packs, and extracted import folders show exact yyyy-mm-dd dates']
];

const taskColumns = ['Task ID','Project','Page','Module','Submodule','Task Description','Frontend Work','Backend Work','Database Work','API Work','Testing Work','Priority','Estimated Hours','Start Date','Target Date','Dependencies','Risk Level','Current Status','Completion %','Owner','Expected Output'];
let tasks = taskSeed.map((row) => Object.fromEntries(taskColumns.map((column, index) => [column, row[index]])));
for (const task of tasks) {
  task['Start Date'] = isoDate(task['Start Date']);
  task['Target Date'] = isoDate(task['Target Date']);
}

if (fs.existsSync(statePath)) {
  try {
    const prior = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const priorById = new Map((prior.tasks || []).map((task) => [task['Task ID'], task]));
    tasks = tasks.map((task) => ({ ...task, ...(priorById.get(task['Task ID']) || {}) }));
  } catch {
    // A malformed state file should not prevent regeneration of a recoverable baseline.
  }
}

const featureSeed = [
  ['Authentication and RBAC',82,78,78,80,25,45],
  ['Dashboard and role workspaces',84,76,70,76,30,45],
  ['Client data and lead lists',80,76,78,78,32,45],
  ['Drafts and templates',82,72,72,75,30,45],
  ['Campaign workflow',86,74,76,78,35,48],
  ['Campaign execution worker',70,78,76,76,22,48],
  ['Sender accounts and OAuth',74,76,72,78,25,45],
  ['Unified mailbox',76,74,74,76,24,42],
  ['Warm-up automation',72,70,72,72,20,40],
  ['Reports and analytics',78,68,70,72,22,42],
  ['Admin and subscriptions',78,76,74,78,28,45],
  ['Tasks, calendar and productivity',76,72,72,74,25,42],
  ['Observability and operations',45,58,55,60,18,38],
  ['Automated QA',20,20,25,20,12,20],
  ['CI/CD and deployment',35,45,50,45,15,45]
];

const featureRows = featureSeed.map(([Feature, Frontend, Backend, Database, API, Testing, Deployment]) => {
  const overall = Math.round((Frontend + Backend + Database + API + Testing + Deployment) / 6);
  return {
    Feature, Frontend, Backend, Database, API, Testing, Deployment,
    'Overall Status': overall >= 80 ? 'Green' : overall >= 55 ? 'Yellow' : 'Red',
    'Completion %': overall
  };
});

const overall = Math.round(featureRows.reduce((sum, row) => sum + row['Completion %'], 0) / featureRows.length);
const projectRows = [{
  'Project Name': 'IntelliMailPilot / EmailBot',
  Owner: owner,
  'Start Date': displayDate('2026-06-23'),
  'Target Date': displayDate('2026-10-05'),
  'Current Sprint': 'Sprint 1 - Stabilization and QA Foundation',
  'Overall Progress %': overall,
  'Frontend %': 74,
  'Backend %': 70,
  'Database %': 71,
  'Testing %': 24,
  'Deployment %': 43,
  'Current Status': 'Active stabilization',
  'Health Status': 'Yellow',
  'Expected Completion': '2026-10-05 (planning baseline; depends on QA capacity)'
}];

const weekStartDate = '2026-06-22';
const weekEndDate = '2026-06-28';
const nextWeekStartDate = '2026-06-29';
const nextWeekEndDate = '2026-07-05';
const thisWeekTasks = tasks.filter((task) => taskOverlapsRange(task, weekStartDate, weekEndDate));
const nextWeekTasks = tasks.filter((task) => taskOverlapsRange(task, nextWeekStartDate, nextWeekEndDate));
const thisWeekCompleted = thisWeekTasks.filter((task) => task['Current Status'] === 'Completed');
const thisWeekActive = thisWeekTasks.filter((task) => task['Current Status'] === 'In Progress');
const thisWeekPending = thisWeekTasks.filter((task) => task['Current Status'] === 'Not Started');
const nextWeekPlanned = nextWeekTasks.filter((task) => task['Current Status'] !== 'Completed');

function taskListSummary(items) {
  return items.length
    ? items.map((task) => `${task['Task ID']}: ${task['Task Description']}`).join(' | ')
    : 'None';
}

function idList(items) {
  return items.length ? items.map((task) => task['Task ID']).join(', ') : 'None';
}

const dailyRows = tasks.map((task) => ({
  Date: displayDate(generatedOn),
  Developer: task.Owner,
  Project: task.Project,
  Sprint: new Date(task['Start Date']) < new Date('2026-07-07') ? 'Sprint 1' : 'Roadmap Backlog',
  Page: task.Page,
  Module: task.Module,
  Submodule: task.Submodule,
  'Task ID': task['Task ID'],
  'Task Description': task['Task Description'],
  'Frontend Status': task['Frontend Work'] === 'No change' ? 'N/A' : task['Current Status'],
  'Backend Status': task['Backend Work'] === 'No change' ? 'N/A' : task['Current Status'],
  'Database Status': task['Database Work'] === 'No change' ? 'N/A' : task['Current Status'],
  'API Status': task['API Work'] === 'No change' ? 'N/A' : task['Current Status'],
  'Testing Status': task['Testing Work'] === 'No change' ? 'N/A' : task['Current Status'],
  Priority: task.Priority,
  'Estimated Hours': task['Estimated Hours'],
  'Actual Hours': task['Current Status'] === 'Completed' ? task['Estimated Hours'] : '',
  'Completion %': task['Completion %'],
  'Current Status': task['Current Status'],
  Blockers: task.Dependencies === 'None' ? '' : task.Dependencies,
  'Start Date': displayDate(task['Start Date']),
  'Target Date': displayDate(task['Target Date']),
  Remarks: task['Expected Output'],
  'This Week Completed': task['Current Status'] === 'Completed' && dateInRange(task['Target Date'], weekStartDate, weekEndDate) ? 'Yes' : '',
  'This Week Update': taskOverlapsRange(task, weekStartDate, weekEndDate) ? `${task['Current Status']} - ${task['Completion %']}%` : '',
  'Next Week Plan': taskOverlapsRange(task, nextWeekStartDate, nextWeekEndDate) ? 'Planned / continues next week' : '',
  'Google Sheet Import Status': 'Auto-filled from project tracker'
}));

const plannerRows = tasks
  .filter((task) => task['Current Status'] !== 'Completed')
  .map((task) => {
    const startOffset = daysFromGenerated(task['Start Date']);
    const targetOffset = daysFromGenerated(task['Target Date']);
    const isDueOrActiveToday = startOffset <= 0 && targetOffset >= 0;
    const isOverdue = targetOffset < 0;
    const todayText = isDueOrActiveToday
      ? task['Task Description']
      : isOverdue
        ? `Pending update: ${task['Task Description']}`
        : '';

    return {
      'Task ID': task['Task ID'],
      "Today's Tasks": todayText,
      'Tomorrow Tasks': startOffset === 1 ? task['Task Description'] : '',
      'Day After Tomorrow Tasks': startOffset === 2 ? task['Task Description'] : '',
      'This Week Update': taskOverlapsRange(task, weekStartDate, weekEndDate) ? `${task['Current Status']} - ${task['Completion %']}%` : '',
      'Next Week Plan': taskOverlapsRange(task, nextWeekStartDate, nextWeekEndDate) ? task['Task Description'] : '',
      'Estimated Hours': task['Estimated Hours'],
      Priority: task.Priority,
      Dependencies: task.Dependencies,
      Status: isOverdue ? 'Pending Update' : task['Current Status']
    };
  });

const weekStarts = [0,7,14,21,30,60,90];
const weeklyRows = weekStarts.map((start, index) => {
  const end = index < 4 ? start + 6 : (index === 4 ? 59 : index === 5 ? 89 : 104);
  const scoped = tasks.filter((task) => task['Start Date'] >= isoDate(start) && task['Start Date'] <= isoDate(end));
  return {
    'Week Number': index < 4 ? `Week ${index + 1}` : index === 4 ? 'Month 2' : index === 5 ? 'Month 3' : 'Completion / Hypercare',
    Feature: scoped.map((task) => task['Task ID']).join(', '),
    Page: [...new Set(scoped.map((task) => task.Page))].join(', '),
    Module: [...new Set(scoped.map((task) => task.Module))].join(', '),
    Owner: owner,
    'Planned Hours': scoped.reduce((sum, task) => sum + Number(task['Estimated Hours'] || 0), 0),
    'Actual Hours': '',
    Dependencies: [...new Set(scoped.map((task) => task.Dependencies).filter((value) => value !== 'None'))].join('; '),
    'Target Date': displayDate(isoDate(end)),
    'Completion %': scoped.length ? Math.round(scoped.reduce((sum, task) => sum + Number(task['Completion %'] || 0), 0) / scoped.length) : 0,
    Status: scoped.some((task) => task['Current Status'] === 'In Progress') ? 'In Progress' : 'Planned',
    'Completed This Week': index === 0 ? taskListSummary(thisWeekCompleted) : '',
    'Updated This Week': index === 0 ? taskListSummary([...thisWeekActive, ...thisWeekPending]) : '',
    'Next Week Planned': index === 1 ? taskListSummary(nextWeekPlanned) : '',
    'Next Week Completion Target': index === 1 ? 'Finish draft/editor stabilization, campaign preflight validation, and start worker lifecycle verification' : '',
    Remarks: index === 0 ? 'Stabilize current UI work and establish repeatable quality gates.' : 'Sequence may shift after measured QA findings.'
  };
});

const sprintRows = [
  {Sprint:'Sprint 1 (Jun 23-Jul 6)',Features:'Baseline, tracker date fix, workflow UI, lint/build, QA strategy, auth start, client data, drafts, campaign preflight',Completed:thisWeekCompleted.length,'In Progress':thisWeekActive.length,Pending:thisWeekPending.length,Bugs:'Date serial import fixed; lint/build still pending','Testing Status':'Manual / setup','Release Readiness':'Low','Health Status':'Yellow','This Week Completed':idList(thisWeekCompleted),'Next Week Plan':idList(nextWeekPlanned)},
  {Sprint:'Sprint 2 (Jul 7-Jul 20)',Features:'Worker lifecycle, recipient safety, mail accounts, campaign tracking',Completed:0,'In Progress':0,Pending:6,Bugs:'TBD','Testing Status':'Planned','Release Readiness':'Low','Health Status':'Yellow','This Week Completed':'','Next Week Plan':'IMP-012, IMP-013, IMP-015'},
  {Sprint:'Sprint 3 (Jul 21-Aug 3)',Features:'Worker lifecycle, recipient safety, mail accounts',Completed:0,'In Progress':0,Pending:5,Bugs:'TBD','Testing Status':'Planned','Release Readiness':'Medium-Low','Health Status':'Yellow'},
  {Sprint:'Sprint 4 (Aug 4-Aug 17)',Features:'Inbox, warm-up, billing, reporting',Completed:0,'In Progress':0,Pending:5,Bugs:'TBD','Testing Status':'Planned','Release Readiness':'Medium','Health Status':'Yellow'},
  {Sprint:'Sprint 5 (Aug 18-Aug 31)',Features:'Performance, accessibility, observability, data reliability',Completed:0,'In Progress':0,Pending:5,Bugs:'TBD','Testing Status':'Planned','Release Readiness':'Medium','Health Status':'Yellow'},
  {Sprint:'Sprint 6 (Sep 1-Sep 14)',Features:'CI/CD, ECS staging, legacy cleanup, UAT preparation',Completed:0,'In Progress':0,Pending:5,Bugs:'TBD','Testing Status':'Planned','Release Readiness':'Medium-High','Health Status':'Yellow'},
  {Sprint:'Sprint 7 (Sep 15-Oct 5)',Features:'UAT, release candidate, production deployment, hypercare',Completed:0,'In Progress':0,Pending:3,Bugs:'Exit criterion: no Sev-1/2','Testing Status':'Planned','Release Readiness':'Target 90%+','Health Status':'Yellow'}
];

const backendRows = [
  ['Authentication','ApiAuthGuard / AuthSessionService','JWT sessions, role and account status checks','Route guards and cookie security','JWT + password flows','Implemented; security tests pending',72],
  ['Campaign Engine','CampaignExecutionRunner','Preflight, mail merge, credits, locks, retries','Worker ownership and heartbeat','Session-scoped campaign APIs','Implemented; high-risk QA pending',68],
  ['Campaign Scheduler','CampaignQueueScheduler','Queue polling and stale recovery','Worker heartbeat','Worker tick and health endpoints','Implemented; soak tests pending',66],
  ['Mail Delivery','GraphAndSmtpMailSender','Provider dispatch and fallback','Sender resolution','Graph and SMTP','Implemented; provider tests pending',70],
  ['Mailbox','MicrosoftGraphMailboxService','Folders, messages and actions','OAuth token handling','Mailbox and Outlook APIs','Implemented; integration tests pending',68],
  ['Warm-up','WarmupAutoCommunicationService / WarmupAutoReplyService','Conversation scheduling and replies','Rate and safety controls','Warm-up APIs','Implemented; safety QA pending',60],
  ['Billing','SubscriptionCreditService','Credit reset, reserve and ledger','Authenticated ownership','Billing and report APIs','Implemented; reconciliation pending',65],
  ['Client Data','Route-local controllers + validation','Upload, normalize, CRUD, duplicates, bin','Owner scoping','Client data APIs','Implemented; consolidation pending',70],
  ['Analytics','CampaignAnalyticsService','Aggregations and summaries','Authenticated reporting','Dashboard/report APIs','Implemented; metric reconciliation pending',64],
  ['Logging','ActivityLogService','Operational activity records','Actor and owner context','Activity/debug endpoints','Implemented; observability incomplete',58]
].map(([Service, Controller, businessLogic, Middleware, Authentication, Status, completion]) => ({
  Service,
  Controller,
  'Business Logic': businessLogic,
  Middleware,
  Authentication,
  Status,
  'Completion %': completion
}));

const bugRows = [
  { 'Bug ID':'BUG-001', Module:'Engineering Quality', Severity:'Critical', 'Assigned To':owner, ETA:displayDate('2026-06-25'), Status:'Open - ESLint configuration missing' },
  { 'Bug ID':'BUG-002', Module:'Schedule Workflow', Severity:'High', 'Assigned To':owner, ETA:displayDate('2026-06-24'), Status:'In Progress - build verification interrupted' },
  { 'Bug ID':'BUG-003', Module:'Responsive UI', Severity:'High', 'Assigned To':owner, ETA:displayDate('2026-07-05'), Status:'Open - manual viewport matrix incomplete' },
  { 'Bug ID':'BUG-004', Module:'Automated Testing', Severity:'Critical', 'Assigned To':owner, ETA:displayDate('2026-07-10'), Status:'Open - no product test suite' },
  { 'Bug ID':'BUG-005', Module:'Campaign Engine', Severity:'Critical', 'Assigned To':owner, ETA:displayDate('2026-07-21'), Status:'Risk - duplicate-send and recovery proof missing' },
  { 'Bug ID':'BUG-006', Module:'Legacy Campaign Engine', Severity:'Medium', 'Assigned To':owner, ETA:displayDate('2026-09-10'), Status:'Open - unresolved msal dependency in legacy service' }
];

const testingRows = featureRows.map((row) => ({
  Feature: row.Feature,
  'Unit Test': row.Testing >= 60 ? 'Partial' : 'Missing',
  'Integration Test': 'Missing / not evidenced',
  'Manual Test': row.Feature.includes('Dashboard') ? 'Partial' : 'Required',
  UAT: 'Not started',
  Status: row.Testing >= 40 ? 'Partial' : 'Red'
}));

const deploymentRows = [
  {Environment:'Local Development','Frontend Version':'Next.js 14.2.5 working tree','Backend Version':'App Router APIs + worker','Database Version':'MongoDB/Mongoose 8.18 schemas','Status':'Active; lint setup missing'},
  {Environment:'Local Production Build','Frontend Version':'Pending clean rebuild','Backend Version':'Pending clean rebuild','Database Version':'Shared development DB','Status':'Build was interrupted on 2026-06-23'},
  {Environment:'Staging ECS','Frontend Version':'Not verified','Backend Version':'Web + worker templates exist','Database Version':'MongoDB Atlas expected','Status':'Planned'},
  {Environment:'Production ECS','Frontend Version':'Not released from this baseline','Backend Version':'Not released from this baseline','Database Version':'Backup/restore proof pending','Status':'Not ready'}
];

const riskRows = [
  ['Quality','No committed ESLint configuration; lint prompts interactively','High',owner,'Add config, baseline violations, enforce in CI','Open'],
  ['Testing','Only utility/diagnostic scripts found; no meaningful automated product suite','Critical',owner,'Implement test pyramid and release gates','Open'],
  ['Delivery Safety','Campaign concurrency, stale recovery and recipient dedupe are high-impact','Critical',owner,'Crash, race, retry and duplicate-send test matrix','Open'],
  ['Security','Broad auth, OAuth and mailbox surface needs systematic security validation','Critical',owner,'OWASP review, token/secret audit, negative tests','Open'],
  ['Maintainability','PremiumDashboardShell.jsx and globals.css are very large and change-prone','High',owner,'Split by domain and reduce global override debt','Open'],
  ['Data Reliability','39 models without formal migration/versioning framework','High',owner,'Migration registry, backups, restore rehearsal','Open'],
  ['Operations','Worker/web separation exists in docs but staging proof is incomplete','High',owner,'ECS staging deployment and failure drills','Open'],
  ['Scope','One full-stack owner is carrying product, QA, DevOps and PM responsibilities','High','Project Sponsor','Add QA/reviewer capacity or extend dates','Open'],
  ['Legacy','Multiple legacy runtimes can cause confusion and dependency/security drift','Medium',owner,'Archive or decommission after production parity','Open'],
  ['Planning','Progress percentages are evidence-based estimates, not measured time-sheet data','Medium',owner,'Update Daily_Updates with actual hours and acceptance evidence','Accepted for baseline']
].map(([riskType, Description, Severity, Owner, mitigation, Status]) => ({
  'Risk Type': riskType,
  Description,
  Severity,
  Owner,
  'Mitigation Plan': mitigation,
  Status
}));

const productivityRows = [{
  Developer: owner,
  'Tasks Completed': tasks.filter((task) => task['Current Status'] === 'Completed').length,
  'Hours Worked': '',
  'Productivity Score': 'Baseline pending actual-hours input',
  'This Week Completed': taskListSummary(thisWeekCompleted),
  'This Week Updated': taskListSummary([...thisWeekActive, ...thisWeekPending]),
  'Next Week Focus': taskListSummary(nextWeekPlanned),
  Remarks: 'Do not infer productivity from commit count; record actual hours and accepted outputs daily.'
}];

writeCsv('Projects_Master', Object.keys(projectRows[0]), projectRows);
writeCsv('Daily_Updates', Object.keys(dailyRows[0]), dailyRows);
writeCsv('Daily_Task_Planner', Object.keys(plannerRows[0]), plannerRows);
writeCsv('Weekly_Roadmap', Object.keys(weeklyRows[0]), weeklyRows);
writeCsv('Sprint_Tracker', Object.keys(sprintRows[0]), sprintRows);
writeCsv('Feature_Tracker', Object.keys(featureRows[0]), featureRows);
writeCsv('Frontend_Tracker', Object.keys(frontendRows[0]), frontendRows);
writeCsv('Backend_Tracker', Object.keys(backendRows[0]), backendRows);
writeCsv('Database_Tracker', Object.keys(databaseRows[0]), databaseRows);
writeCsv('API_Tracker', Object.keys(apiRows[0]), apiRows);
writeCsv('Bug_Tracker', Object.keys(bugRows[0]), bugRows);
writeCsv('Testing_Tracker', Object.keys(testingRows[0]), testingRows);
writeCsv('Deployment_Tracker', Object.keys(deploymentRows[0]), deploymentRows);
writeCsv('Risks_And_Blockers', Object.keys(riskRows[0]), riskRows);
writeCsv('Team_Productivity', Object.keys(productivityRows[0]), productivityRows);

const state = {
  schemaVersion: 1,
  project: 'IntelliMailPilot / EmailBot',
  generatedOn,
  updateRule: 'Preserve Task ID history. Update existing rows by Task ID; append new tasks; never regenerate completed work as pending.',
  evidence: {
    pages: pageFiles.length,
    apiRouteFiles: apiFiles.length,
    apiOperations: apiRows.length,
    databaseModels: modelFiles.length,
    automatedProductTestSuites: 0,
    currentGitOwner: 'akshay-intellisys'
  },
  projectMetrics: projectRows[0],
  tasks
};
fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

const completed = tasks.filter((task) => task['Current Status'] === 'Completed');
const inProgress = tasks.filter((task) => task['Current Status'] === 'In Progress');
const pending = tasks.filter((task) => task['Current Status'] === 'Not Started');
const report = `# IntelliMailPilot Project Management Baseline

Generated: ${generatedOn}

## Audit Summary

- Product pages: ${pageFiles.length}
- API route files: ${apiFiles.length}
- API operations discovered: ${apiRows.length}
- MongoDB/Mongoose models: ${modelFiles.length}
- Automated product test suites evidenced: 0
- Overall planning progress: ${overall}%
- Project health: Yellow
- Baseline target completion: 2026-10-05

## Daily Report - ${generatedOn}

| Metric | Result |
|---|---|
| Completed Tasks | ${completed.map((task) => task['Task ID']).join(', ') || 'None'} |
| Tasks In Progress | ${inProgress.map((task) => task['Task ID']).join(', ')} |
| Pending Tasks | ${pending.length} roadmap tasks |
| Blockers | ESLint unconfigured; production build verification interrupted; automated product tests absent |
| Bug Fixes | Schedule modal grid contract updated; final build verification pending |
| Hours Worked | Enter actual hours in Daily_Updates |
| Today's Progress % | Baseline created; current UI task estimated 80% |
| Overall Project % | ${overall}% evidence-based planning estimate |
| Today's Pending Updates | ${plannerRows.filter((row) => row["Today's Tasks"]).map((row) => row['Task ID']).join(', ') || 'None'} |
| This Week Completed | ${taskListSummary(thisWeekCompleted)} |
| This Week Updated | ${taskListSummary([...thisWeekActive, ...thisWeekPending])} |
| Next Week Plan | ${taskListSummary(nextWeekPlanned)} |
| Tomorrow's Deliverables | Clean build verification, QA strategy, upload hardening setup |
| Health Status | Yellow |

## Weekly Report

| Period | Summary |
|---|---|
| Week 1 | Stabilize current workflow UI, establish lint/build baseline, define QA strategy |
| Week 2 | Auth/RBAC automation, upload/client-data reliability, responsive QA |
| Completed Features | Core product breadth is implemented; PM baseline completed |
| Pending Features | Automated QA, security proof, worker reliability proof, staging deployment, UAT |
| Delays | Build verification interrupted on 2026-06-23; lint cannot run unattended |
| Dependencies | Single-owner capacity; test fixtures; staging credentials; production-like mail accounts |
| Risks | Delivery duplication, OAuth/security, migration/backup, large UI/CSS files |
| Testing Status | Red/Yellow â€” manual evidence exists, automation is largely absent |
| Overall Completion % | ${overall}% |
| Expected Completion Date | 2026-10-05 |
| Health Status | Yellow |

## Release Report

| Area | Completion / Status |
|---|---|
| Frontend Completion % | 74% |
| Backend Completion % | 70% |
| Database Completion % | 71% |
| API Completion % | 74% |
| Testing Completion % | 24% |
| Deployment Completion % | 43% |
| Security Status | Review required |
| Performance Optimization | Not baselined |
| CI/CD Status | Quality gates not evidenced |
| Known Issues | Missing ESLint config, missing automated product suites, incomplete viewport QA, unproven staging recovery |
| Release Readiness % | 48% |
| Confidence Level % | 55% |
| Ready For Deployment | NO |

## Update Protocol

1. Keep Task IDs stable.
2. Update status, completion percentage, actual hours, blockers, and evidence in \`project_state.json\`.
3. Run \`node project-management/generate_project_tracker.mjs\` from the repository root.
4. Import each CSV from \`project-management/google-sheets\` into the matching Google Sheets tab.
5. Add new work as new Task IDs; never overwrite completed history.
`;
fs.writeFileSync(path.join(repoRoot, 'project-management', 'PROJECT_MANAGEMENT_BASELINE.md'), report, 'utf8');

console.log(JSON.stringify({
  outputDir,
  sheets: 15,
  tasks: tasks.length,
  pages: pageFiles.length,
  apiRouteFiles: apiFiles.length,
  apiOperations: apiRows.length,
  models: modelFiles.length,
  overallProgress: overall
}, null, 2));



