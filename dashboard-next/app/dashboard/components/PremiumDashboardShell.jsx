'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import EmailRenderer from '../../../components/email/EmailRenderer';
import RichTextEditor from '@/modules/draft-module/draft-components/RichTextDraftEditor';
import {
  buildScheduledDateTimeInZone,
  isFutureScheduledDate,
  normalizeScheduleDateValue,
  normalizeDurationUnit
} from '@/modules/campaign-module/campaign-utils/CampaignScheduleHelper';
import { DRAFT_TYPE_ITEMS, draftTypeLabel, inferDraftTypeFromDraft, normalizeDraftType } from '@/app/lib/draftTypes';
import draftTemplates from '@/modules/template-module/template-services/DashboardDraftTemplateLibrary';
import StatStrip from './StatStrip';
import Workflow from './Workflow';
import MainPanels from './MainPanels';
import BottomGrid from './BottomGrid';
import './WorkflowModal.css';
import './UploadList.css';
import './ReviewList.css';
import './Campaign.css';
import './Draft.css';
import './DraftDummy.css';
import './TestEmail.css';
import './DashboardProductivity.css';
import './Schedule.css';
import './WorkflowFit.css';
import './WorkflowFinal.css';


const MAX_SCHEDULE_DELAY_MINUTES = 1440;
const MAX_SCHEDULE_DELAY_HOURS = 24;
const MAX_SCHEDULE_DELAY_SECONDS = 86400;
const DEFAULT_WORKFLOW_STEP_COUNT = 7;
const REVIEW_REQUIRED_COLUMNS = ['Name', 'Email', 'Company Name', 'Country', 'Sector'];
const REVIEW_TABLE_COLUMNS = [
  { key: 'Name', label: 'Name', type: 'text', aliases: ['Name', 'name', 'First Name', 'firstName'] },
  { key: 'Surname', label: 'Surname', type: 'text', aliases: ['Surname', 'surname', 'Last Name', 'lastName'] },
  { key: 'Designation', label: 'Designation', type: 'text', aliases: ['Designation', 'designation', 'Title', 'title'] },
  { key: 'Company Name', label: 'Company Name', type: 'text', aliases: ['Company Name', 'Company', 'companyName', 'cmpName', 'company'] },
  { key: 'Email', label: 'Email', type: 'email', aliases: ['Email', 'email'] },
  { key: 'Country', label: 'Country', type: 'text', aliases: ['Country', 'country'] },
  { key: 'Sector', label: 'Sector', type: 'text', aliases: ['Sector', 'sector', 'Industry', 'industry'] },
  { key: 'Source', label: 'Source', type: 'text', aliases: ['Source', 'source'] }
];
const MAGAZINE_SECTORS = [
  'Advertising and Marketing', 'Aerospace and Defense', 'Agriculture and Agritech', 'Architecture and Design',
  'Artificial Intelligence', 'Automotive and Mobility', 'Banking and Financial Services', 'Beauty and Cosmetics',
  'Biotechnology', 'Blockchain and Web3', 'Business and Entrepreneurship', 'Climate and Sustainability',
  'Construction and Infrastructure', 'Consumer Goods', 'Cybersecurity', 'Data and Analytics', 'Education and EdTech',
  'Energy and Utilities', 'Engineering', 'Entertainment and Media', 'Fashion and Apparel', 'FinTech',
  'Food and Beverage', 'Gaming and Esports', 'Government and Public Sector', 'Healthcare and HealthTech',
  'Hospitality', 'Human Resources and Future of Work', 'Industrial Manufacturing', 'Insurance and InsurTech',
  'Internet and E-commerce', 'Investment and Venture Capital', 'Legal and LegalTech', 'Logistics and Supply Chain',
  'Luxury and Lifestyle', 'Manufacturing', 'Mining and Metals', 'Nonprofit and Social Impact',
  'Pharmaceuticals and Life Sciences', 'Professional Services', 'Publishing and Journalism', 'Real Estate and PropTech',
  'Retail', 'Robotics and Automation', 'Science and Research', 'Sports and Fitness', 'Startups and Innovation',
  'Technology and Software', 'Telecommunications', 'Tourism and Travel', 'Transportation', 'Women in Leadership'
];
const COUNTRY_CODES = (
  'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'
).split(' ');

function getCountryNames() {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return COUNTRY_CODES.map((code) => displayNames.of(code)).filter(Boolean);
  } catch {
    return ['Australia', 'Canada', 'Germany', 'India', 'United Arab Emirates', 'United Kingdom', 'United States'];
  }
}

const CAMPAIGN_COUNTRIES = getCountryNames();

function getSequentialActiveWorkflowStep(stepCompletionChecks = [], totalSteps = DEFAULT_WORKFLOW_STEP_COUNT) {
  const safeTotal = Math.max(1, Number(totalSteps) || DEFAULT_WORKFLOW_STEP_COUNT);
  const firstIncompleteIndex = Array.from({ length: safeTotal }, (_, index) => Boolean(stepCompletionChecks[index]))
    .findIndex((done) => !done);

  return firstIncompleteIndex === -1 ? safeTotal + 1 : firstIncompleteIndex + 1;
}

function getDelayInputLimit(unit = 'minutes') {
  const normalizedUnit = normalizeDurationUnit(unit);
  if (normalizedUnit === 'hours') return MAX_SCHEDULE_DELAY_HOURS;
  if (normalizedUnit === 'seconds') return MAX_SCHEDULE_DELAY_SECONDS;
  return MAX_SCHEDULE_DELAY_MINUTES;
}

function normalizeDelayInputValue(value, unit = 'minutes') {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) return '';
  const numeric = Math.floor(Number(rawValue));
  if (!Number.isFinite(numeric)) return '';
  return String(Math.max(1, Math.min(getDelayInputLimit(unit), numeric)));
}

function isRowRangeInputValid(value = '') {
  const match = String(value || '').trim().match(/^\[?\s*(\d+)\s*-\s*(\d+)\s*\]?$/);
  if (!match) return false;
  return Number(match[1]) <= Number(match[2]);
}

function parseRowRangeInput(value = '') {
  const match = String(value || '').trim().match(/^\[?\s*(\d+)\s*-\s*(\d+)\s*\]?$/);
  if (!match) return { start: '', end: '' };
  return {
    start: String(Math.max(1, Number(match[1]) || 1)),
    end: String(Math.max(1, Number(match[2]) || 1))
  };
}

function getTemplateForDraftType(value = '') {
  const draftType = normalizeDraftType(value);
  const templateKey = draftType === 'followup' ? 'follow_up' : draftType;
  const template = draftTemplates[templateKey] || draftTemplates[draftType] || null;
  if (!template) return null;
  return {
    id: `template:${draftType}`,
    title: `${template.label || draftTypeLabel(draftType)} Template`,
    subject: template.subject || '',
    body: template.body || '',
    category: draftType,
    draftType,
    updated: 'Built-in template'
  };
}

function getDraftFileExtension(filename = '') {
  return String(filename || '').split('.').pop()?.toLowerCase() || '';
}

function normalizeDraftPreviewText(value = '') {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

async function extractDraftFileTextInBrowser(file) {
  const extension = getDraftFileExtension(file?.name);
  const fileType = String(file?.type || '');

  if (['txt', 'md', 'csv', 'html', 'htm'].includes(extension) || fileType.startsWith('text/')) {
    return file.text();
  }

  if (extension === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value || '';
  }

  throw new Error('Unsupported file type. Please upload DOCX, PDF, TXT, HTML, MD, or CSV.');
}

function clampPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function MetricCard({ item }) {
  const percent = clampPercent(item.percent);
  return (
    <div className={`stat-card si-${item.tone || 'neutral'}`}>
      <div className="stat-top">
        <span className="stat-label">{item.title}</span>
        {item.icon ? <div className="stat-icon">{item.icon}</div> : null}
      </div>
      <div className="stat-value">{item.value}</div>
      <div className="stat-pct">{item.meta || `${percent}% of audience`}</div>
    </div>
  );
}

function WorkflowStep({ step, isLast, status = 'pending', onAction, selectedDraftType, onSelectedDraftTypeChange }) {
  const isDraftStep = Number(step?.index) === 4;
  const isOverviewStep = Number(step?.index) === 2;
  const stepLabels = {
    1: 'Upload List',
    2: 'Review List',
    3: 'Campaign',
    4: 'Select Draft',
    5: 'Summary',
    6: 'Test',
    7: 'Schedule'
  };
  const stepIcons = {
    1: <i className="ti ti-upload"></i>,
    2: <i className="ti ti-users"></i>,
    3: <i className="ti ti-settings"></i>,
    4: <i className="ti ti-file-text"></i>,
    5: <i className="ti ti-clipboard-list"></i>,
    6: <i className="ti ti-mail"></i>,
    7: <i className="ti ti-calendar-time"></i>
  };
  const statusClass = status === 'completed' ? 'done' : status === 'active' ? 'active' : '';

  return (
    <div className={`step-item ${statusClass}`}>
      <div className="step-circle">
        {stepIcons[step.index] || <i className="ti ti-circle"></i>}
        <div className="step-num">{step.index}</div>
      </div>
      <div className="step-content">
        <div className="step-name">{step.title}</div>
        <button
          type="button"
          className="step-action"
          onClick={(event) => onAction?.(step, event)}
        >
          {isDraftStep ? 'Drafts' : step.action}
        </button>
      </div>
    </div>
  );
}

function ProgressFilterOptionLabel(value) {
  if (value === 'today') return 'Day Wise';
  if (value === '7d') return 'Week Wise';
  if (value === '30d') return 'Month Wise';
  if (value === 'customize') return 'Custom Dates';
  return value ? String(value) : 'Custom Option';
}

function NotificationItem({ item, onClick }) {
  const content = (
    <>
      <div className="premium-avatar">{item.avatar || 'SS'}</div>
      <div>
        <strong>{item.title || item.name}</strong>
        <small>{item.time}</small>
        {item.subject ? <span className="premium-list-item-subject">Subject: {item.subject}</span> : null}
        <p>{item.preview || item.text}</p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="premium-list-item premium-list-item-button" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="premium-list-item">{content}</div>;
}

function QuickNoteItem({ item }) {
  const timestamp = item.createdAt
    ? new Date(item.createdAt).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : item.time;
  return (
    <div className="premium-note-item">
      <div className="premium-note-item-head">
        <div className="premium-avatar premium-note-avatar">{item.avatar || 'QN'}</div>
        <div>
          <strong>{item.name}</strong>
          <small><i className="ti ti-clock" /> {timestamp}</small>
        </div>
      </div>
      <div className="premium-note-item-meta">
        {item.topic ? <span>Topic: {item.topic}</span> : null}
        {item.tag ? <span>Tag: {item.tag}</span> : null}
      </div>
      <p>{item.text}</p>
    </div>
  );
}

function TimelineItem({ item, checked = false, onToggle, onOpen }) {
  return (
    <button type="button" className={`premium-timeline-item ${checked ? 'completed' : ''}`} onClick={onOpen}>
      <span />
      <div>
        <div className="premium-timeline-headline">
          <label className="premium-timeline-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                event.stopPropagation();
                onToggle?.(event.target.checked);
              }}
              onClick={(event) => event.stopPropagation()}
            />
            <span />
          </label>
          <div className="premium-timeline-copy">
            <strong>{item.title}</strong>
            <small>{item.date}{item.time ? ` • ${item.time}` : ''}</small>
          </div>
          {item.type ? <span className={`premium-timeline-type type-${String(item.type).toLowerCase()}`}>{item.type}</span> : null}
          <span className={`premium-timeline-status ${checked ? 'done' : 'pending'}`}>
            {checked ? 'Done' : item.status || 'Pending'}
          </span>
        </div>
        {item.text ? <p>{item.text}</p> : null}
      </div>
    </button>
  );
}

function LogItem({ item, detailed = false }) {
  const tagText = String(item?.tag || '').toLowerCase();
  const isSentLog = tagText === 'sent';
  const sourceLabel = String(item?.source || 'System').trim();
  const actionLabel = String(item?.action || item?.tag || 'Update').trim();
  const statusText = String(item?.status || tagText || 'info').trim();
  const nextText = String(item?.next || '').trim();
  const metaLines = Array.isArray(item?.meta)
    ? item.meta.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  const sourceTone = String(sourceLabel || '').toLowerCase().includes('inbox')
    ? 'inbox'
    : String(sourceLabel || '').toLowerCase().includes('timeline')
      ? 'timeline'
      : String(sourceLabel || '').toLowerCase().includes('campaign')
        ? 'campaign'
        : 'system';
  const sourceIcon = sourceTone === 'timeline' ? '⏱' : sourceTone === 'inbox' ? '✉' : sourceTone === 'campaign' ? '◉' : '•';
  return (
    <div className={`premium-log-item ${detailed ? 'detailed' : 'compact'} ${isSentLog ? 'sent' : ''}`}>
      <strong>{detailed ? item.time : item.tag}</strong>
      <div>
        <span className={`premium-log-source tone-${sourceTone}`}>
          <span className="premium-log-source-icon">{sourceIcon}</span>
          {detailed ? `${sourceLabel} • ${actionLabel}` : sourceLabel}
        </span>
        <p>{item.msg}</p>
        {!detailed && item.time ? <small>{item.time}</small> : null}
        {item.detail ? <small>{item.detail}</small> : null}
        {metaLines.length ? metaLines.map((line, index) => <small key={`${line}-${index}`}>{line}</small>) : null}
        {detailed && nextText ? <small>Next: {nextText}</small> : null}
        {detailed ? <small className={`premium-log-status status-${statusText}`}>Status: {statusText}</small> : null}
      </div>
    </div>
  );
}

function groupLogsBySource(logItems = []) {
  return logItems.reduce((groups, item) => {
    const source = String(item?.source || 'System').trim();
    const normalized = source.toLowerCase().includes('inbox')
      ? 'Inbox'
      : source.toLowerCase().includes('timeline')
        ? 'Task'
        : source.toLowerCase().includes('campaign')
          ? 'Campaign'
          : 'System';
    if (!groups[normalized]) groups[normalized] = [];
    groups[normalized].push(item);
    return groups;
  }, {});
}

function parseEventDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferTimelineTaskType(hour) {
  if (hour < 12) return 'Reminder';
  if (hour < 17) return 'Meeting';
  return 'Appointment';
}

function inferTimelineTaskNote(type, time) {
  const normalizedType = String(type || '').toLowerCase();
  if (normalizedType === 'meeting') return `Prepare agenda for ${time || 'the meeting time'}.`;
  if (normalizedType === 'appointment') return `Confirm the appointment for ${time || 'this time'}.`;
  return `Set a reminder for ${time || 'this time'}.`;
}

function inferTimelineTaskTitle(type) {
  const normalizedType = String(type || '').toLowerCase();
  if (normalizedType === 'meeting') return 'Team meeting';
  if (normalizedType === 'appointment') return 'Client appointment';
  return 'Reminder task';
}

function buildTimelineDraftDefaults(type, time) {
  const nextType = String(type || 'Reminder').trim() || 'Reminder';
  return {
    title: inferTimelineTaskTitle(nextType),
    text: inferTimelineTaskNote(nextType, time)
  };
}

function timelineDateLabel(value) {
  const date = parseEventDate(value);
  if (!date) return 'Later';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfTarget - startOfToday) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return 'Earlier';
  if (diffDays <= 7) return 'Later This Week';
  return 'Later';
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const CALENDAR_EVENT_TYPES = [
  'Campaign Launch',
  'Follow-up',
  'Meeting',
  'Reminder',
  'Task',
  'Client Call',
  'Team Activity',
  'Deadline',
  'Custom'
];
const CALENDAR_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const CALENDAR_REMINDERS = ['None', '5 minutes before', '15 minutes before', '30 minutes before', '1 hour before', '1 day before'];
const CALENDAR_REPEATS = ['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'];
const CALENDAR_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#16a34a', '#f59e0b', '#ef4444', '#db2777'];

function formatDateInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCalendarEventDraft(date = new Date()) {
  const day = formatDateInput(date);
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    id: '',
    title: '',
    description: '',
    startDate: day,
    endDate: day,
    startTime: start.toTimeString().slice(0, 5),
    endTime: end.toTimeString().slice(0, 5),
    type: 'Reminder',
    priority: 'Medium',
    reminder: 'None',
    repeat: 'None',
    notes: '',
    color: CALENDAR_COLORS[0]
  };
}

function formatLogTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString();
}

export default function PremiumDashboardShell({
  reportDateLabel,
  reportRangeLabel,
  reportMetricCards,
  dailyMailCounts = [],
  workflowSteps,
  totalTrackedMails,
  notificationCards,
  timelineCards,
  timelineTaskStates = {},
  onTimelineTaskStatesChange,
  timelineCustomTasks = [],
  onTimelineCustomTaskAdd,
  performanceCampaigns,
  campaignRefreshing = false,
  onRefreshCampaigns,
  calendarDays,
  selectedAccountLabel,
  senderAccounts = [],
  senderEmptyMessage = 'No sender IDs available.',
  selectedSenderAccountId = '',
  onSelectSenderAccount,
  project,
  projectOptions = [],
  barChartMetrics,
  logs,
  workspaceOverviewItems = [],
  activeCampaign = null,
  activeCampaignProgressText = '0/0 emails sent',
  lists = [],
  selectedListId = '',
  selectedListName = '',
  previewRows = [],
  previewColumns = [],
  previewLoading = false,
  onPreviewCellChange,
  onPreviewAddRow,
  onPreviewAddColumn,
  onPreviewDeleteRow,
  onPreviewDeleteColumn,
  onPreviewRenameColumn,
  onPreviewSave,
  previewDirty = false,
  onUploadFile,
  onSelectList,
  draftOptions = [],
  activeDraftId = '',
  onSelectSavedDraft,
  onSaveDraft,
  draftSubject: controlledDraftSubject,
  onDraftSubjectChange,
  draftBody: controlledDraftBody,
  onDraftBodyChange,
  testEmailTo = '',
  onTestEmailToChange,
  onSendTestEmail,
  campaignName: controlledCampaignName,
  onCampaignNameChange,
  selectedDraftType = '',
  onSelectedDraftTypeChange,
  batchSize = '1',
  onBatchSizeChange,
  rowRange = '',
  onRowRangeChange,
  delaySeconds = 60,
  onDelaySecondsChange,
  initialScheduleMode = 'send_now',
  initialScheduledDateValue = '',
  initialScheduledTimeValue = '',
  initialScheduleTimezone = 'Asia/Kolkata',
  initialDurationUnit = 'seconds',
  onCreateCampaign,
  scheduledCountry = 'india',
  onScheduledCountryChange,
  scheduledSlot = '',
  onScheduledSlotChange,
  manualScheduledSlot = '',
  onManualScheduledSlotChange,
  onApplyManualScheduledSlot,
  onSaveSchedule,
  onStartCampaign,
  onCampaignStartSuccess,
  onOpenReportRangePopup,
  onApplyReportRange,
  onPauseCampaign,
  onResumeCampaign,
  onStopCampaign,
  onDeleteCampaign,
  onShowMessage,
  creditSummary = {},
  targetApprovalStatus = 'approved',
  targetApprovalRequestedAt = null,
  targetApprovalReviewedAt = null,
  targetApprovalReviewer = '',
  targetApprovalRequestNote = '',
  onViewCampaignDetail
}) {
  const router = useRouter();
  const scheduleCountries = {
    USA: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
    UK: ['Europe/London'],
    India: ['Asia/Kolkata'],
    Canada: ['America/Toronto', 'America/Vancouver'],
    Germany: ['Europe/Berlin'],
    UAE: ['Asia/Dubai']
  };
    const scheduleCountryKey =
    Object.keys(scheduleCountries).find((country) => country.toLowerCase() === String(scheduledCountry || '').toLowerCase()) ||
    'India';
    const [targetMode, setTargetMode] = useState('daily');
    const [customTargetStart, setCustomTargetStart] = useState('');
    const [customTargetEnd, setCustomTargetEnd] = useState('');
    const targetDailyCount = 300;
    const targetWindow = useMemo(() => {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      const startOfQuarter = new Date(today.getFullYear(), quarterStartMonth, 1);
      const endOfQuarter = new Date(today.getFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999);
      if (targetMode === 'weekly') return { label: 'This week', start: startOfWeek, end: endOfWeek, days: 7 };
      if (targetMode === 'monthly') return { label: 'This month', start: startOfMonth, end: endOfMonth, days: 30 };
      if (targetMode === 'quarterly') return { label: 'This quarter', start: startOfQuarter, end: endOfQuarter, days: 90 };
      if (targetMode === 'custom') {
        const start = customTargetStart ? new Date(`${customTargetStart}T00:00:00`) : startOfToday;
        const end = customTargetEnd ? new Date(`${customTargetEnd}T23:59:59.999`) : endOfToday;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
          return { label: 'Custom range', start: startOfToday, end: endOfToday, days: 1 };
        }
        const dayDiff = Math.max(1, Math.round((end - start) / 86400000) + 1);
        return { label: 'Custom range', start, end, days: dayDiff };
      }
      return { label: 'Today', start: startOfToday, end: endOfToday, days: 1 };
    }, [customTargetEnd, customTargetStart, targetMode]);
    const targetLimit = targetDailyCount * targetWindow.days;
    const targetWindowLabel = targetWindow.label;
    const targetSentCount = useMemo(() => {
      return (dailyMailCounts || []).reduce((total, item) => {
        const itemDate = parseEventDate(item?.date);
        const count = Math.max(0, Number(item?.count || item?.sent || item?.value || 0));
        if (!itemDate) return total;
        if (itemDate >= targetWindow.start && itemDate <= targetWindow.end) return total + count;
        return total;
      }, 0);
    }, [dailyMailCounts, targetWindow.end, targetWindow.start]);
    const targetPercent = targetLimit ? Math.min(100, Math.round((targetSentCount / targetLimit) * 100)) : 0;
    const targetAchieved = targetLimit > 0 && targetSentCount >= targetLimit;
    const targetRemaining = Math.max(0, targetLimit - targetSentCount);
      const targetResetText = 'Resets daily';
    const [targetApprovalStatusState, setTargetApprovalStatusState] = useState(String(targetApprovalStatus || 'approved'));
    useEffect(() => {
      setTargetApprovalStatusState(String(targetApprovalStatus || 'approved'));
    }, [targetApprovalStatus]);
    const targetApprovalLabel =
      targetApprovalStatusState === 'approved'
        ? 'Approved by team lead'
        : targetApprovalStatusState === 'pending'
          ? 'Pending team lead approval'
          : targetApprovalStatusState === 'rejected'
            ? 'Rejected by team lead'
            : 'Approval required';
    const targetStatusTone =
      targetApprovalStatusState === 'approved'
        ? 'done'
        : targetApprovalStatusState === 'pending'
          ? 'pending'
          : targetApprovalStatusState === 'rejected'
            ? 'failed'
            : 'pending';
    const targetPeriodValue = String(targetMode || 'daily');
  const formatInboxName = (value, fallback = 'Mail') => {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const localPart = text.includes('@') ? text.split('@')[0] : text;
    return localPart
      .split(/[._\-]+/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };
  const buildInboxRoute = (item) => {
    const params = new URLSearchParams();
    if (item?.sender) params.set('sender', item.sender);
    if (item?.subject) params.set('subject', item.subject);
    if (item?.preview) params.set('preview', item.preview);
    if (item?.time) params.set('time', item.time);
    const query = params.toString();
    return `/mail-inbox${query ? `?${query}` : ''}`;
  };
  const replyNotificationCards = useMemo(
    () =>
      (notificationCards || []).filter((item) => {
        const haystack = `${item?.name || ''} ${item?.text || ''}`.toLowerCase();
        const isReply = /^replied:|^reply:|received reply|reply notification/.test(haystack);
        const isNoise = /fallback|new email|no previous messagid|no previous messageid|campaign/.test(haystack);
        return isReply && !isNoise;
      }),
    [notificationCards]
  );
  const [userCalendarEvents, setUserCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarViewMode, setCalendarViewMode] = useState('month');
  const [showEventFormPopup, setShowEventFormPopup] = useState(false);
  const [editingCalendarEvent, setEditingCalendarEvent] = useState(null);
  const [calendarEventDraft, setCalendarEventDraft] = useState(() => buildCalendarEventDraft(new Date()));
  const calendarEvents = useMemo(() => {
    const notificationEvents = notificationCards.map((item, index) => ({
      id: `notification-${index}`,
      date: parseEventDate(item.time),
      title: item.name,
      detail: item.text,
      type: 'Mail'
    }));
    const timelineEvents = timelineCards.map((item, index) => ({
      id: `timeline-${index}`,
      date: parseEventDate(item.date),
      title: item.title,
      detail: item.text || 'Timeline update',
      type: 'Timeline'
    }));
    const performanceEvents = performanceCampaigns.map((item, index) => ({
      id: `campaign-${index}`,
      date: parseEventDate(item.publishDate),
      title: item.name,
      detail: `${item.sent} sent / ${item.total} total`,
      type: 'Campaign'
    }));
    return [...notificationEvents, ...timelineEvents, ...performanceEvents].filter((item) => item.date);
  }, [notificationCards, timelineCards, performanceCampaigns]);
  const allCalendarEvents = useMemo(
    () => [...calendarEvents, ...userCalendarEvents].filter((item) => item.date),
    [calendarEvents, userCalendarEvents]
  );
  const [timelineCompletionMap, setTimelineCompletionMap] = useState(() =>
    Object.fromEntries((timelineCards || []).map((item, index) => {
      const key = item.id || `${item.date}-${index}`;
      return [key, typeof timelineTaskStates[key] === 'boolean' ? timelineTaskStates[key] : Boolean(item.done)];
    }))
  );
  const [selectedTimelineTask, setSelectedTimelineTask] = useState(null);
  const [showCompletedTimelineGroup, setShowCompletedTimelineGroup] = useState(false);
  const [showTimelineAddPopup, setShowTimelineAddPopup] = useState(false);
  const [timelineTaskDraft, setTimelineTaskDraft] = useState({
    title: '',
    date: '',
    time: '',
    type: 'Reminder',
    text: ''
  });
  const timelineTaskTitleRef = useRef(null);
  useEffect(() => {
    if (!showTimelineAddPopup) return;
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const roundedMinutes = Math.ceil(now.getMinutes() / 30) * 30;
    const nextSlot = new Date(now);
    nextSlot.setHours(now.getHours(), roundedMinutes, 0, 0);
    if (roundedMinutes >= 60) {
      nextSlot.setHours(now.getHours() + 1, 0, 0, 0);
    }
    const time = nextSlot.toTimeString().slice(0, 5);
    const inferredType = inferTimelineTaskType(now.getHours());
    const defaults = buildTimelineDraftDefaults(inferredType, time);
    setTimelineTaskDraft((current) => ({
      ...current,
      title: defaults.title,
      date,
      time,
      type: inferredType,
      text: defaults.text
    }));
  }, [showTimelineAddPopup]);
  useEffect(() => {
    if (!showTimelineAddPopup) return;
    const timer = setTimeout(() => {
      timelineTaskTitleRef.current?.focus?.();
    }, 0);
    return () => clearTimeout(timer);
  }, [showTimelineAddPopup]);
  const timelineSortedCards = useMemo(() => {
    const combinedCards = [...(timelineCards || [])];
    return combinedCards.sort((a, b) => {
      const aTime = parseEventDate(`${a.date} ${a.time || ''}`)?.getTime?.() || parseEventDate(a.date)?.getTime?.() || 0;
      const bTime = parseEventDate(`${b.date} ${b.time || ''}`)?.getTime?.() || parseEventDate(b.date)?.getTime?.() || 0;
      return bTime - aTime;
    });
  }, [timelineCards]);
  const groupedTimelineCards = useMemo(() => {
    return timelineSortedCards.reduce((groups, item) => {
      const label = timelineDateLabel(item.date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
      return groups;
    }, {});
  }, [timelineSortedCards]);
  const inlineTimelineCards = useMemo(() => {
    return timelineSortedCards.slice(0, 8);
  }, [timelineSortedCards]);
  const timelinePopupGroups = useMemo(() => {
    const groups = {};
    timelineSortedCards.forEach((item, index) => {
      const key = item.id || `${item.date}-${index}`;
      const completed = Boolean(timelineCompletionMap[key]);
      const label = completed ? 'Completed' : timelineDateLabel(item.date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    return groups;
  }, [timelineCompletionMap, timelineSortedCards]);
  const logPopupGroups = useMemo(() => groupLogsBySource(logs), [logs]);
  useEffect(() => {
    setTimelineCompletionMap((current) => {
      const next = { ...current };
      (timelineSortedCards || []).forEach((item, index) => {
        const key = item.id || `${item.date}-${index}`;
        if (typeof next[key] === 'undefined') {
          next[key] = typeof timelineTaskStates[key] === 'boolean' ? timelineTaskStates[key] : Boolean(item.done);
        }
      });
      return next;
    });
  }, [timelineSortedCards, timelineTaskStates]);
  useEffect(() => {
    if (!selectedTimelineTask && timelineSortedCards?.length) {
      setSelectedTimelineTask(timelineSortedCards[0]);
    }
  }, [selectedTimelineTask, timelineSortedCards]);
  const openInboxMail = (item) => {
    if (!item) return;
    router.push(buildInboxRoute(item));
  };
  const scrollToBroadcastPerformance = () => {
    window.setTimeout(() => {
      const target = broadcastPerformanceRef.current || document.getElementById('all-broadcast-performance');
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, 80);
  };
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/dashboard/broadcasts') {
      scrollToBroadcastPerformance();
    }
  }, []);
  const initialCalendarDate = new Date();
  const [calendarCursor, setCalendarCursor] = useState(
    new Date(initialCalendarDate.getFullYear(), initialCalendarDate.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(initialCalendarDate);
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);
  const [showNotificationsPopup, setShowNotificationsPopup] = useState(false);
  const [showNotesPopup, setShowNotesPopup] = useState(false);
  const [showTimelinePopup, setShowTimelinePopup] = useState(false);
  const [showLogsPopup, setShowLogsPopup] = useState(false);
  const [showSchedulePopup, setShowSchedulePopup] = useState(false);
  const [showScheduleSuccessPopup, setShowScheduleSuccessPopup] = useState(false);
  const [scheduleSuccessDetails, setScheduleSuccessDetails] = useState(null);
  const [scheduleInlineNotice, setScheduleInlineNotice] = useState(null);
  const [showDraftSummaryPopup, setShowDraftSummaryPopup] = useState(false);
  const [isNextProcessMode, setIsNextProcessMode] = useState(false);
  const [isBulkReplyMode, setIsBulkReplyMode] = useState(false);
  const [sourceCampaignId, setSourceCampaignId] = useState('');
  const [threadMetadata, setThreadMetadata] = useState({});
  const [sheetMissing, setSheetMissing] = useState(false);
  const [canReuseSheet, setCanReuseSheet] = useState(false);
  const [senderActive, setSenderActive] = useState(true);
  const [canReuseSender, setCanReuseSender] = useState(true);
  const [originalCampaignName, setOriginalCampaignName] = useState('');
  const [originalSheetName, setOriginalSheetName] = useState('');
  const [originalRecipientCount, setOriginalRecipientCount] = useState(0);
  const [showClientListPopup, setShowClientListPopup] = useState(false);
  const [showOverviewPopup, setShowOverviewPopup] = useState(false);
  const [showOverviewNotice, setShowOverviewNotice] = useState(false);
  const [showCampaignPopup, setShowCampaignPopup] = useState(false);
  const [showSelectDraftPopup, setShowSelectDraftPopup] = useState(false);
  const [showTestEmailPopup, setShowTestEmailPopup] = useState(false);
  const [workflowPosition, setWorkflowPosition] = useState(1);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [showDraftContinueWarning, setShowDraftContinueWarning] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [popupAnchors, setPopupAnchors] = useState({});
  const [tableSearch, setTableSearch] = useState('');
  const [selectedTagFilters, setSelectedTagFilters] = useState([]);
  const [showTagFilterMenu, setShowTagFilterMenu] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const actionMenuRef = useRef(null);
  const tagFilterRef = useRef(null);
  const [currentTablePage, setCurrentTablePage] = useState(1);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteTag, setNoteTag] = useState('');
  const [quickNotes, setQuickNotes] = useState([]);
  const [sendMode, setSendMode] = useState(initialScheduleMode || 'send_now');
  const [clientListTab, setClientListTab] = useState('custom');
  const [clientListName, setClientListName] = useState('');
  const [selectedUploadFileName, setSelectedUploadFileName] = useState('');
  const [uploadedListId, setUploadedListId] = useState('');
  const [clientListUploading, setClientListUploading] = useState(false);
  const [selectedUploadedList, setSelectedUploadedList] = useState('');
  const [selectedCustomList, setSelectedCustomList] = useState('');
  const [clientListSearch, setClientListSearch] = useState('');
  const [clientListProjectFilter, setClientListProjectFilter] = useState('all');
  const [clientListSourceFilter, setClientListSourceFilter] = useState('all');
  const [clientListRecentFilter, setClientListRecentFilter] = useState('all');
  const [clientListCategoryFilter, setClientListCategoryFilter] = useState('all');
  const [clientListSidebarProjectFilter, setClientListSidebarProjectFilter] = useState('all');
  const [clientListSort, setClientListSort] = useState({ key: 'updatedAt', direction: 'desc' });
  const [clientListPage, setClientListPage] = useState(1);
  const [clientListMultiSelectedIds, setClientListMultiSelectedIds] = useState([]);
  const [clientListApiSheets, setClientListApiSheets] = useState([]);
  const [clientListLoadingSheets, setClientListLoadingSheets] = useState(false);
  const [clientListRefreshTick, setClientListRefreshTick] = useState(0);
  const [overviewFilter, setOverviewFilter] = useState('all');
  const [overviewSearch, setOverviewSearch] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [columnMappings, setColumnMappings] = useState([]);
  const [overviewRows, setOverviewRows] = useState([]);
  const [reviewLocalColumns, setReviewLocalColumns] = useState([]);
  const [selectedOverviewRowIds, setSelectedOverviewRowIds] = useState([]);
  const [selectedOverviewColumns, setSelectedOverviewColumns] = useState([]);
  const [mappingCollapsed, setMappingCollapsed] = useState(false);
  const [reviewTab, setReviewTab] = useState('all');
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewRowsPerPage, setReviewRowsPerPage] = useState(10);
  const [reviewColumnFilter, setReviewColumnFilter] = useState('all');
  const [reviewBulkColumn, setReviewBulkColumn] = useState('Email');
  const [reviewBulkValue, setReviewBulkValue] = useState('');
  const [reviewValidation, setReviewValidation] = useState(null);
  const [reviewValidationLoading, setReviewValidationLoading] = useState(false);
  const [quickClientDraft, setQuickClientDraft] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: ''
  });
  const reviewImportInputRef = useRef(null);
  const [showClientListSelectionNote, setShowClientListSelectionNote] = useState(false);
  const [showCampaignNotice, setShowCampaignNotice] = useState(false);
  const [showProceedWithoutListNote, setShowProceedWithoutListNote] = useState(false);
  const hasShownProceedWithoutListNoteRef = useRef(false);
  const hasShownCampaignMissingWarningRef = useRef(false);
  const hasShownOverviewWarningRef = useRef(false);
  const pendingSenderEmailRef = useRef(null);
  const pendingSenderIdRef = useRef(null);

  useEffect(() => {
    if ((pendingSenderEmailRef.current || pendingSenderIdRef.current) && senderAccounts.length > 0) {
      const email = pendingSenderEmailRef.current;
      const rawId = pendingSenderIdRef.current;

      let matched = null;
      if (rawId) {
        matched = senderAccounts.find(
          (account) =>
            String(account.id) === rawId ||
            String(account.id).endsWith(`:${rawId}`)
        );
      }

      if (!matched && email) {
        matched = senderAccounts.find(
          (account) => String(account?.from || '').trim().toLowerCase() === email.toLowerCase()
        );
      }

      if (matched) {
        onSelectSenderAccount?.(matched.id);
        pendingSenderEmailRef.current = null;
        pendingSenderIdRef.current = null;
      }
    }
  }, [senderAccounts, onSelectSenderAccount]);

  const [draftSubject, setDraftSubject] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [durationUnit, setDurationUnit] = useState(normalizeDurationUnit(initialDurationUnit || 'seconds'));
  const [scheduleTimezone, setScheduleTimezone] = useState(initialScheduleTimezone || 'Asia/Kolkata');
  const [scheduledDateValue, setScheduledDateValue] = useState(initialScheduledDateValue || '');
  const [scheduledTimeValue, setScheduledTimeValue] = useState(initialScheduledTimeValue || '');
  const [scheduleDelayBetweenBatches, setScheduleDelayBetweenBatches] = useState('5');
  const [scheduleDelayBatchUnit, setScheduleDelayBatchUnit] = useState('minutes');
  const [scheduleDailyLimit, setScheduleDailyLimit] = useState('500');
  const [scheduleBusinessDaysOnly, setScheduleBusinessDaysOnly] = useState(true);
  const [scheduleStopOnReply, setScheduleStopOnReply] = useState(false);
  const [scheduleStopOnBounce, setScheduleStopOnBounce] = useState(false);
  const [scheduleBounceThreshold, setScheduleBounceThreshold] = useState('5');
  const [scheduleResumeNextDay, setScheduleResumeNextDay] = useState(true);
  const [scheduleSmartSending, setScheduleSmartSending] = useState(false);
  const [rowLimitMode, setRowLimitMode] = useState(String(rowRange || '').trim() ? 'custom' : 'all');
  const [campaignName, setCampaignName] = useState('');
  const [campaignTags, setCampaignTags] = useState([]);
  const [campaignTagDraft, setCampaignTagDraft] = useState('');
  const [showCampaignTagSuggestions, setShowCampaignTagSuggestions] = useState(false);
  const [activeCampaignTagSuggestion, setActiveCampaignTagSuggestion] = useState(-1);
  const campaignTagsRef = useRef(null);
  const campaignTagSuggestionsRef = useRef(null);
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignGoal, setCampaignGoal] = useState('Lead Generation');
  const [campaignType, setCampaignType] = useState('Cold Email');
  const [campaignReplyTo, setCampaignReplyTo] = useState('');
  const [campaignOpenTracking, setCampaignOpenTracking] = useState(true);
  const [campaignClickTracking, setCampaignClickTracking] = useState(true);
  const [campaignUnsubscribe, setCampaignUnsubscribe] = useState(true);
  const [campaignStartTime, setCampaignStartTime] = useState('09:00');
  const [campaignEndTime, setCampaignEndTime] = useState('18:00');
  const [campaignMaxRetry, setCampaignMaxRetry] = useState('3');
  const [campaignPriority, setCampaignPriority] = useState('Normal');
  const [campaignSmartSending, setCampaignSmartSending] = useState(true);
  const [campaignSkipContacted, setCampaignSkipContacted] = useState(true);
  const [campaignAutoPause, setCampaignAutoPause] = useState(true);
  const [campaignProjectFilter, setCampaignProjectFilter] = useState('');
  const [campaignSender, setCampaignSender] = useState('');
  const [campaignFolder, setCampaignFolder] = useState('');
  const [campaignTracking, setCampaignTracking] = useState({
    opens: true,
    clicks: true,
    replies: true
  });
  const [campaignAbTesting, setCampaignAbTesting] = useState(true);
  const [selectDraftTab, setSelectDraftTab] = useState('my-drafts');
  const [showDraftTypeDropdown, setShowDraftTypeDropdown] = useState(false);
  const [draftTypeLibraryOpen, setDraftTypeLibraryOpen] = useState(false);
  const [selectDraftSearch, setSelectDraftSearch] = useState('');
  const [selectDraftTypeFilter, setSelectDraftTypeFilter] = useState('');
  const [selectDraftProjectFilter, setSelectDraftProjectFilter] = useState('');
  const [selectDraftCampaignTypeFilter, setSelectDraftCampaignTypeFilter] = useState('');
  const [selectDraftSort, setSelectDraftSort] = useState('updated-desc');
  const [selectDraftView, setSelectDraftView] = useState('grid');
  const [draftUploadedFileName, setDraftUploadedFileName] = useState('');
  const [draftUploadedText, setDraftUploadedText] = useState('');
  const [draftFileReading, setDraftFileReading] = useState(false);
  const [draftSummaryAttachments, setDraftSummaryAttachments] = useState([]);
  const draftSummaryFileInputRef = useRef(null);
  const [showProgressFilterDropdown, setShowProgressFilterDropdown] = useState(false);
  const [progressFilterOptions, setProgressFilterOptions] = useState([
    { label: 'Day Wise', value: 'today' },
    { label: 'Week Wise', value: '7d' },
    { label: 'Custom Dates', value: 'customize' },
    { label: 'Month Wise', value: '30d' }
  ]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [testPreviewMode, setTestPreviewMode] = useState('desktop');
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailError, setTestEmailError] = useState('');
  const [includeTracking, setIncludeTracking] = useState(false);
  const [testRecipientText, setTestRecipientText] = useState('');
  const [testRecipients, setTestRecipients] = useState([]);
  const [testIncludeAttachments, setTestIncludeAttachments] = useState(true);
  const [testDifferentSender, setTestDifferentSender] = useState(false);
  const [testSpamPremium, setTestSpamPremium] = useState(false);
  const [testVariablesPreview, setTestVariablesPreview] = useState(true);
  const workflowShellRef = useRef(null);
  const broadcastPerformanceRef = useRef(null);
  const draftTypeDropdownRef = useRef(null);
  const draftFileInputRef = useRef(null);
  const draftTypeItems = DRAFT_TYPE_ITEMS;
  const uploadedLists = [];
  const customLists = [];
  const savedDrafts = [];
  const draftViewerText = draftUploadedText;
  const effectiveDraftSubject = controlledDraftSubject ?? draftSubject;
  const effectiveDraftMessage = controlledDraftBody ?? draftMessage;
  const effectiveCampaignName = controlledCampaignName ?? campaignName;
  const effectiveCampaignSender = onSelectSenderAccount ? (selectedSenderAccountId || '') : campaignSender;

  const PROJECT_PRESET_SENDERS = {
    tec: [
      'lily@theentrepreneurialchronicle.com',
      'charlie@theentrepreneurialchronicle.com',
      'robert@theentrepreneurialchronicle.com',
      'mark@theentrepreneurialchronicle.com',
      'juan@theentrepreneurialchronicle.com',
      'manuel@theentrepreneurialchronicle.com',
      'antonio@theentrepreneurialchronicle.com',
      'john@theentrepreneurialchronicle.com',
      'sam@theentrepreneurialchronicle.com',
      'clara@theentrepreneurialchronicle.com',
      'sophia@theentrepreneurialchronicle.com',
      'jess@theentrepreneurialchronicle.com',
      'diana@theentrepreneurialchronicle.com',
      'victoria@theentrepreneurialchronicle.com',
      'alina@theentrepreneurialchronicle.com',
      'amelia@theentrepreneurialchronicle.com',
      'grace@theentrepreneurialchronicle.com',
      'eliana@theentrepreneurialchronicle.com',
      'liam@theentrepreneurialchronicle.com',
      'emma@theentrepreneurialchronicle.com',
      'fiona@theentrepreneurialchronicle.com',
      'daniel@theentrepreneurialchronicle.com',
      'lacy@theentrepreneurialchronicle.com'
    ],
    tut: [
      'matt@theunicorntimes.com',
      'jordan@theunicorntimes.com',
      'jessica@theunicorntimes.com',
      'ethan@theunicorntimes.com',
      'lily@theunicorntimes.com',
      'jasmin@theunicorntimes.com',
      'kevin@theunicorntimes.com',
      'peter@theunicorntimes.com',
      'tyler@theunicorntimes.com',
      'olivia@theunicorntimes.com',
      'allison@theunicorntimes.com',
      'carmen@theunicorntimes.com',
      'isla@theunicorntimes.com',
      'jason@theunicorntimes.com',
      'julia@theunicorntimes.com',
      'juliana@theunicorntimes.com',
      'lena@theunicorntimes.com',
      'lisa@theunicorntimes.com',
      'lucy@theunicorntimes.com',
      'martina@theunicorntimes.com',
      'mary@theunicorntimes.com',
      'nora@theunicorntimes.com',
      'valeria@theunicorntimes.com'
    ]
  };

  const visibleCampaignSenderAccounts = useMemo(() => {
    const selectedProject = String(campaignProjectFilter || '').trim().toLowerCase();
    if (!selectedProject) return [];
    
    const filtered = senderAccounts.filter((account) => {
      const from = String(account?.from || '').trim().toLowerCase();
      const accountProject = String(account?.project || '').trim().toLowerCase();
      
      if (accountProject === selectedProject) return true;
      if (selectedProject === 'tec' && (from.endsWith('@theentrepreneurialchronicle.com') || from.endsWith('.theentrepreneurialchronicle.com'))) return true;
      if (selectedProject === 'tut' && (from.endsWith('@theunicorntimes.com') || from.endsWith('.theunicorntimes.com'))) return true;
      
      const allowedList = PROJECT_PRESET_SENDERS[selectedProject] || [];
      if (allowedList.some(email => email.toLowerCase() === from)) return true;
      
      return false;
    });

    const activeSenderId = String(effectiveCampaignSender || selectedSenderAccountId || '').trim();
    const activeSenderEmail = String(pendingSenderEmailRef.current || '').trim().toLowerCase();

    const hasActive = filtered.some(account => 
      (activeSenderId && String(account.id) === activeSenderId) || 
      (activeSenderEmail && String(account.from).toLowerCase() === activeSenderEmail)
    );

    if (!hasActive && (activeSenderId || activeSenderEmail)) {
      const specialAccount = senderAccounts.find(account => 
        (activeSenderId && String(account.id) === activeSenderId) || 
        (activeSenderEmail && String(account.from).toLowerCase() === activeSenderEmail)
      );
      if (specialAccount) {
        filtered.push(specialAccount);
      }
    }

    return filtered;
  }, [campaignProjectFilter, senderAccounts, effectiveCampaignSender, selectedSenderAccountId]);
  const selectedCampaignSenderAccount = useMemo(() => (
    senderAccounts.find((account) => String(account.id) === String(effectiveCampaignSender || selectedSenderAccountId || '')) ||
    visibleCampaignSenderAccounts[0] ||
    null
  ), [effectiveCampaignSender, selectedSenderAccountId, senderAccounts, visibleCampaignSenderAccounts]);
  const campaignReplyToValue = campaignReplyTo || selectedCampaignSenderAccount?.id || effectiveCampaignSender || '';

  const workflowStepCount = workflowSteps?.length || DEFAULT_WORKFLOW_STEP_COUNT;
  const workflowCompletionChecks = useMemo(() => {
    const hasList = Boolean(selectedListId);
    const hasOverview = Array.isArray(previewRows) && previewRows.length > 0;
    const hasCampaignSetup = Boolean(String(effectiveCampaignName || '').trim());
    const hasDraft = Boolean(String(effectiveDraftSubject || '').trim() || String(effectiveDraftMessage || '').replace(/<[^>]*>/g, '').trim());
    const hasTestMail = workflowPosition > 6;
    const hasSchedule = sendMode === 'send_now' || Boolean(String(scheduledSlot || manualScheduledSlot || scheduledTimeValue || '').trim());

    return [
      hasList,
      hasOverview,
      hasCampaignSetup,
      // Draft data can prefill the editor, but only the workflow position can complete these steps.
      workflowPosition > 4 && hasDraft,
      workflowPosition > 5 && hasDraft,
      hasTestMail,
      workflowPosition > 7 && hasSchedule
    ];
  }, [
    selectedListId,
    previewRows,
    effectiveCampaignName,
    effectiveDraftSubject,
    effectiveDraftMessage,
    workflowPosition,
    sendMode,
    scheduledSlot,
    manualScheduledSlot,
    scheduledTimeValue
  ]);
  const activeWorkflowStep = getSequentialActiveWorkflowStep(workflowCompletionChecks, workflowStepCount);

  useEffect(() => {
    setSendMode(initialScheduleMode || 'send_now');
  }, [initialScheduleMode]);

  useEffect(() => {
    setScheduledDateValue(initialScheduledDateValue || '');
  }, [initialScheduledDateValue]);

  useEffect(() => {
    setScheduledTimeValue(initialScheduledTimeValue || '');
  }, [initialScheduledTimeValue]);

  useEffect(() => {
    setScheduleTimezone(initialScheduleTimezone || 'Asia/Kolkata');
  }, [initialScheduleTimezone]);

  useEffect(() => {
    setDurationUnit(normalizeDurationUnit(initialDurationUnit || 'seconds'));
  }, [initialDurationUnit]);

  useEffect(() => {
    if (!showSchedulePopup) return;
    if (sendMode === 'scheduled') return;
    setScheduledDateValue('');
    setScheduledTimeValue('');
  }, [sendMode, showSchedulePopup]);

  useEffect(() => {
    if (!showDraftTypeDropdown) return;

    const closeOnOutsideClick = (event) => {
      if (draftTypeDropdownRef.current?.contains(event.target)) return;
      setShowDraftTypeDropdown(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShowDraftTypeDropdown(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showDraftTypeDropdown]);

  useEffect(() => {
    const allowedTimezones = scheduleCountries[scheduleCountryKey] || scheduleCountries.India;
    if (!allowedTimezones.includes(scheduleTimezone)) {
      setScheduleTimezone(allowedTimezones[0] || 'Asia/Kolkata');
    }
  }, [scheduleCountryKey, scheduleTimezone]);

  const openAnchoredPopup = (key, setter) => (event) => {
    const workflowPopupKeys = new Set(['clientList', 'overview', 'campaign', 'selectDraft', 'testEmail', 'draftSummary', 'schedule']);
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    if (rect) {
      const viewportWidth = window.innerWidth;
      if (key === 'notifications') {
        const width = Math.min(viewportWidth - 32, 560);
        const height = Math.min(window.innerHeight - 32, 480);
        setPopupAnchors((current) => ({
          ...current,
          [key]: {
            top: window.innerHeight / 2,
            left: viewportWidth / 2,
            width,
            maxHeight: height,
            transform: 'translate(-50%, -50%)',
            anchor: 'center'
          }
        }));
        setter(true);
        return;
      }
      const workflowRect = workflowPopupKeys.has(key) ? workflowShellRef.current?.getBoundingClientRect?.() : null;
      const baseRect = workflowRect || rect;
      const desiredWidth = workflowRect
        ? Math.min(viewportWidth - 32, Math.max(400, baseRect.width * 0.72))
        : Math.min(viewportWidth - 32, Math.max(360, rect.width * 1.25));
      const centerX = baseRect.left + baseRect.width / 2 - (workflowRect ? 320 : 0);
      const left = Math.max(16 + desiredWidth / 2, Math.min(centerX, viewportWidth - 16 - desiredWidth / 2));
      const desiredHeight = workflowRect
        ? Math.min(window.innerHeight - 32, Math.max(280, baseRect.height + 280))
        : Math.min(window.innerHeight - 32, Math.max(280, window.innerHeight * 0.7));
      const top = workflowRect
        ? Math.max(16, baseRect.top + baseRect.height / 2 - 36)
        : Math.max(16, rect.top - 12);
      setPopupAnchors((current) => ({
        ...current,
        [key]: {
          top,
          left,
          width: desiredWidth,
          maxHeight: Math.max(280, desiredHeight),
          transform: 'translate(-50%, -50%)',
          anchor: workflowRect ? 'center' : 'above'
        }
      }));
    }
    setter(true);
  };

  const popupStyleFor = (key) => {
    const centeredKeys = new Set([
      'notifications',
      'clientList',
      'overview',
      'campaign',
      'selectDraft',
      'testEmail',
      'draftSummary',
      'schedule',
      'calendar',
      'day',
      'timeline',
      'logs'
    ]);
    if (centeredKeys.has(key)) {
      const sizeMap = {
        notifications: { width: 'min(92vw, 560px)', maxHeight: 'min(78vh, 480px)' },
        clientList: { width: '94vw', maxWidth: '1700px', height: 'min(900px, calc(100vh - 16px))', maxHeight: 'calc(100vh - 16px)' },
        overview: { width: '94vw', maxWidth: '1680px', height: 'calc(100vh - 16px)', maxHeight: 'calc(100vh - 16px)' },
        campaign: { width: '94vw', maxWidth: '1680px', height: 'calc(100vh - 16px)', maxHeight: 'calc(100vh - 16px)' },
        selectDraft: { width: '94vw', maxWidth: '1680px', height: 'calc(100vh - 16px)', maxHeight: 'calc(100vh - 16px)' },
        testEmail: { width: '94vw', maxWidth: '1680px', height: 'calc(100vh - 16px)', maxHeight: 'calc(100vh - 16px)' },
        draftSummary: { width: '94vw', maxWidth: '1680px', height: 'calc(100vh - 16px)', maxHeight: 'calc(100vh - 16px)' },
        schedule: { width: '94vw', maxWidth: '1680px', height: 'calc(100vh - 16px)', maxHeight: 'calc(100vh - 16px)' },
        calendar: { width: 'min(92vw, 620px)', maxHeight: 'min(82vh, 680px)' },
        day: { width: 'min(92vw, 560px)', maxHeight: 'min(82vh, 680px)' },
        timeline: { width: 'min(90vw, 740px)', maxHeight: 'min(78vh, 680px)' },
        logs: { width: 'min(90vw, 760px)', maxHeight: 'min(78vh, 680px)' }
      };
      const size = sizeMap[key] || { width: 'min(92vw, 820px)', maxHeight: 'min(82vh, 760px)' };
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: size.width,
        maxWidth: size.maxWidth,
        height: size.height,
        maxHeight: size.maxHeight,
        transform: 'translate(-50%, -50%)',
        zIndex: 140
      };
    }
    const anchor = popupAnchors[key];
    if (!anchor) return {};
    return {
      position: 'fixed',
      top: `${anchor.top}px`,
      left: `${anchor.left}px`,
      width: `${anchor.width}px`,
      maxHeight: `${anchor.maxHeight}px`,
      transform: anchor.transform,
      zIndex: 140
    };
  };

  const renderPortalPopup = (isOpen, node) => {
    if (!isOpen || typeof window === 'undefined') return null;
    return createPortal(node, document.body);
  };
  const openTagFilterMenu = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.max(170, Math.min(220, rect.width));
    setPopupAnchors((current) => ({
      ...current,
      tagFilter: {
        top: rect.bottom + 6,
        left: Math.min(window.innerWidth - width - 12, Math.max(12, rect.left)),
        width,
        maxHeight: Math.min(260, window.innerHeight - rect.bottom - 18),
        transform: 'none'
      }
    }));
    setShowTagFilterMenu((current) => !current);
  };
  const formatListMeta = (item) => {
    const contacts = `${Number(item?.leadCount || 0)} contacts`;
    const uploadedAt = item?.uploadedAt || item?.createdAt || item?.updatedAt || null;
    const when = uploadedAt ? new Date(uploadedAt).toLocaleString() : '';
    const sourceFile = String(item?.sourceFile || item?.fileName || item?.name || '').trim();
    const kind = String(item?.kind || 'uploaded').trim();
    const isCustom = ['custom', 'selected_client_sheet', 'custom_client_list'].includes(kind);
    const kindLabel = isCustom ? 'Custom' : 'Uploaded';
    return [kindLabel, contacts, when, sourceFile ? `File: ${sourceFile}` : '']
      .filter(Boolean)
      .join(' • ');
  };
  const normalizedClientLists = lists.length
    ? lists.map((item) => ({
        id: item._id,
        title: item.name || 'Saved list',
        meta: formatListMeta(item),
        uploadedAt: item?.uploadedAt || item?.createdAt || item?.updatedAt || null,
        sourceFile: item?.sourceFile || item?.fileName || item?.name || '',
        leadCount: Number(item?.leadCount || 0),
        kind: String(item?.kind || 'uploaded').trim()
      }))
    : [];
  const isCustomClientList = (item) => ['custom', 'selected_client_sheet', 'custom_client_list'].includes(String(item?.kind || '').trim());
  const effectiveUploadedLists = normalizedClientLists.length
    ? normalizedClientLists.filter((item) => !isCustomClientList(item))
    : uploadedLists;
  const effectiveCustomLists = normalizedClientLists.length
    ? normalizedClientLists.filter(isCustomClientList)
    : customLists;

  const normalizeCampaignListRow = (item = {}, source = 'workspace') => {
    const id = String(item._id || item.id || item.sheetId || item.listId || '').trim();
    const title = String(item.sheetName || item.name || item.title || item.sourceFile || item.sourceFileName || 'Untitled client sheet').trim();
    const rawKind = String(item.kind || item.type || source || '').trim().toLowerCase();
    const sourceFile = String(item.sourceFile || item.sourceFileName || item.fileName || '').trim();
    const sourceLabel = rawKind.includes('manual') || rawKind.includes('custom')
      ? 'Manual'
      : sourceFile.toLowerCase().endsWith('.csv')
        ? 'CSV Upload'
        : sourceFile.toLowerCase().endsWith('.xlsx') || sourceFile.toLowerCase().endsWith('.xls')
          ? 'Excel Upload'
          : rawKind.includes('paste')
            ? 'Paste'
            : rawKind.includes('import')
              ? 'Imported'
              : rawKind.includes('upload')
                ? 'Upload'
                : 'Manual';
    const createdAt = item.createdAt || item.uploadedAt || item.createdOn || item.date || item.updatedAt || null;
    const updatedAt = item.updatedAt || item.lastUsed || item.lastUsedAt || item.uploadedAt || createdAt || null;
    const projectRaw = String(item.project || item.projectName || item.projectId || '').trim();
    const normalizedProject = projectRaw.toLowerCase().includes('tut')
      ? 'TUT Project'
      : projectRaw.toLowerCase().includes('tec')
        ? 'TEC Project'
        : projectRaw
          ? projectRaw
          : 'Other Projects';
    const clientCount = Number(item.clientCount ?? item.selectedCount ?? item.leadCount ?? item.clients?.length ?? item.leads?.length ?? 0) || 0;
    return {
      id,
      title,
      subtitle: sourceFile && sourceFile !== title ? sourceFile : String(item.sector || item.description || item.meta || '').trim(),
      project: normalizedProject,
      projectKey: normalizedProject.toLowerCase().includes('tut') ? 'tut' : normalizedProject.toLowerCase().includes('tec') ? 'tec' : 'other',
      source: sourceLabel,
      sourceKey: sourceLabel.toLowerCase().includes('csv') ? 'csv' : sourceLabel.toLowerCase().includes('excel') ? 'excel' : sourceLabel.toLowerCase().includes('paste') ? 'paste' : sourceLabel.toLowerCase().includes('import') ? 'imported' : sourceLabel.toLowerCase().includes('upload') ? 'upload' : 'manual',
      clientCount,
      createdAt,
      updatedAt,
      lastUsed: item.lastUsed || item.lastUsedAt || item.updatedAt || item.uploadedAt || createdAt || null,
      createdBy: String(item.createdBy?.name || item.createdBy || item.ownerName || item.userName || 'Workspace').trim(),
      status: String(item.status || (item.autoDeleteAt ? 'Temporary' : 'Active')).trim(),
      kind: rawKind || 'sheet',
      repeatedCount: Number(item.repeatedCount ?? item.duplicateCount ?? item.duplicates ?? 0) || 0,
      contactedCount: Number(item.contactedCount ?? item.contacted ?? item.sentCount ?? 0) || 0,
      country: String(item.country || item.countries || '').trim(),
      sector: String(item.sector || item.industry || '').trim(),
      company: String(item.company || item.companyName || '').trim(),
      isFavorite: Boolean(item.favorite || item.isFavorite),
      isShared: Boolean(item.shared || item.isShared),
      raw: item
    };
  };

  const campaignListRows = useMemo(() => {
    const merged = [];
    const seen = new Set();
    const pushRow = (row) => {
      if (!row?.id || seen.has(row.id)) return;
      seen.add(row.id);
      merged.push(row);
    };
    clientListApiSheets.forEach((item) => pushRow(normalizeCampaignListRow(item, 'api')));
    normalizedClientLists.forEach((item) => pushRow(normalizeCampaignListRow(item, item.kind || 'workspace')));
    return merged;
  }, [clientListApiSheets, normalizedClientLists]);

  const campaignListStats = useMemo(() => campaignListRows.reduce((stats, item) => ({
    totalSheets: stats.totalSheets + 1,
    totalClients: stats.totalClients + (Number(item.clientCount) || 0),
    repeated: stats.repeated + (Number(item.repeatedCount) || 0),
    contacted: stats.contacted + (Number(item.contactedCount) || 0)
  }), { totalSheets: 0, totalClients: 0, repeated: 0, contacted: 0 }), [campaignListRows]);

  const campaignListProjectCounts = useMemo(() => campaignListRows.reduce((counts, item) => {
    counts.all += 1;
    counts[item.projectKey] = (counts[item.projectKey] || 0) + 1;
    return counts;
  }, { all: 0, tec: 0, tut: 0, other: 0 }), [campaignListRows]);

  const filteredCampaignListRows = useMemo(() => {
    const query = clientListSearch.trim().toLowerCase();
    const now = Date.now();
    const recentLimitDays = clientListRecentFilter === '7' ? 7 : clientListRecentFilter === '30' ? 30 : 0;
    const matchesProject = (row) => {
      const selectFilter = clientListProjectFilter === 'all' ? '' : clientListProjectFilter;
      const sidebarFilter = clientListSidebarProjectFilter === 'all' ? '' : clientListSidebarProjectFilter;
      return (!selectFilter || row.projectKey === selectFilter) && (!sidebarFilter || row.projectKey === sidebarFilter);
    };
    const filtered = campaignListRows.filter((row) => {
      const haystack = [row.title, row.subtitle, row.project, row.source, row.createdBy, row.country, row.sector, row.company].join(' ').toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (!matchesProject(row)) return false;
      if (clientListSourceFilter !== 'all') {
        const sourceMatches = clientListSourceFilter === 'upload'
          ? ['upload', 'excel', 'csv'].includes(row.sourceKey)
          : row.sourceKey === clientListSourceFilter;
        if (!sourceMatches) return false;
      }
      if (recentLimitDays) {
        const lastUsedMs = new Date(row.lastUsed || row.updatedAt || row.createdAt || 0).getTime();
        if (!Number.isFinite(lastUsedMs) || now - lastUsedMs > recentLimitDays * 86400000) return false;
      }
      if (clientListCategoryFilter === 'recent') {
        const lastUsedMs = new Date(row.lastUsed || row.updatedAt || row.createdAt || 0).getTime();
        if (!Number.isFinite(lastUsedMs) || now - lastUsedMs > 30 * 86400000) return false;
      }
      if (clientListCategoryFilter === 'favorites' && !row.isFavorite) return false;
      if (clientListCategoryFilter === 'shared' && !row.isShared) return false;
      if (clientListCategoryFilter === 'frequent' && row.clientCount < 1) return false;
      if (clientListCategoryFilter === 'trash' && row.status.toLowerCase() !== 'trash') return false;
      return true;
    });
    return filtered.sort((left, right) => {
      const direction = clientListSort.direction === 'asc' ? 1 : -1;
      const key = clientListSort.key;
      if (key === 'createdAt' || key === 'updatedAt' || key === 'lastUsed') {
        return ((new Date(left[key] || 0).getTime() || 0) - (new Date(right[key] || 0).getTime() || 0)) * direction;
      }
      const leftValue = key === 'clientCount' ? Number(left.clientCount || 0) : String(left[key] || '').toLowerCase();
      const rightValue = key === 'clientCount' ? Number(right.clientCount || 0) : String(right[key] || '').toLowerCase();
      if (leftValue > rightValue) return direction;
      if (leftValue < rightValue) return -direction;
      return 0;
    });
  }, [campaignListRows, clientListCategoryFilter, clientListProjectFilter, clientListRecentFilter, clientListSearch, clientListSidebarProjectFilter, clientListSort, clientListSourceFilter]);

  const campaignListPageSize = 8;
  const campaignListPageCount = Math.max(1, Math.ceil(filteredCampaignListRows.length / campaignListPageSize));
  const campaignListCurrentPage = Math.min(clientListPage, campaignListPageCount);
  const visibleCampaignListRows = filteredCampaignListRows.slice((campaignListCurrentPage - 1) * campaignListPageSize, campaignListCurrentPage * campaignListPageSize);

  const selectedCampaignListId = String(selectedUploadedList || selectedCustomList || selectedListId || uploadedListId || '').trim();

  const effectiveSavedDrafts = draftOptions.length
    ? draftOptions.map((draft) => ({
        id: draft._id || draft.id,
        title: draft.title,
        subject: draft.subject,
        body: draft.bodyHtml || draft.html || draft.body || draft.message || draft.content || '',
        bodyHtml: draft.bodyHtml || draft.html || draft.body || '',
        bodyText: draft.bodyText || '',
        html: draft.html || draft.bodyHtml || draft.body || '',
        sector: draft.sector || '',
        city: draft.city || '',
        project: draft.project || draft.projectName || '',
        campaignName: draft.campaignName || draft.campaign || '',
        category: inferDraftTypeFromDraft(draft),
        draftType: inferDraftTypeFromDraft(draft),
        savedDate: draft.updatedAt || draft.createdAt
          ? new Date(draft.updatedAt || draft.createdAt).toLocaleDateString()
          : 'No saved date',
        savedTime: draft.updatedAt || draft.createdAt
          ? new Date(draft.updatedAt || draft.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'No saved time',
        updated: draft.updatedAt || draft.createdAt
          ? new Date(draft.updatedAt || draft.createdAt).toLocaleString()
          : 'Saved draft'
      }))
    : savedDrafts;
  const builtInDraftTemplates = useMemo(
    () => draftTypeItems.map((item) => getTemplateForDraftType(item.value)).filter(Boolean),
    [draftTypeItems]
  );
  const effectiveDraftLibrary = useMemo(() => {
    const savedIds = new Set(effectiveSavedDrafts.map((draft) => String(draft.id || '')));
    return [
      ...effectiveSavedDrafts,
      ...builtInDraftTemplates.filter((draft) => !savedIds.has(String(draft.id || '')))
    ];
  }, [builtInDraftTemplates, effectiveSavedDrafts]);
  const filteredSavedDrafts = useMemo(() => {
    const query = String(selectDraftSearch || '').trim().toLowerCase();
    const rawTypeFilter = String(selectDraftTypeFilter || '').trim();
    const typeFilter = rawTypeFilter ? normalizeDraftType(rawTypeFilter) : '';
    const projectFilter = String(selectDraftProjectFilter || '').trim().toLowerCase();
    const campaignTypeFilter = String(selectDraftCampaignTypeFilter || '').trim().toLowerCase();
    const filtered = effectiveDraftLibrary.filter((draft) => {
      const draftType = inferDraftTypeFromDraft(draft);
      const draftProject = String(draft.project || draft.projectName || '').trim().toLowerCase();
      const campaignType = String(draft.campaignType || draft.type || draft.category || draftTypeLabel(draftType) || '').trim().toLowerCase();
      const blob = [
        draft.title,
        draft.subject,
        draftTypeLabel(draftType),
        draft.sector,
        draft.city,
        draft.project,
        draft.campaignName
      ].join(' ').toLowerCase();
      if (typeFilter && draftType !== typeFilter) return false;
      if (projectFilter && draftProject !== projectFilter) return false;
      if (campaignTypeFilter && campaignType !== campaignTypeFilter) return false;
      if (query && !blob.includes(query)) return false;
      return true;
    });
    return filtered.slice().sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.updated || left.savedDate || left.createdAt || 0).getTime() || 0;
      const rightTime = new Date(right.updatedAt || right.updated || right.savedDate || right.createdAt || 0).getTime() || 0;
      if (selectDraftSort === 'updated-asc') return leftTime - rightTime;
      if (selectDraftSort === 'title-asc') return String(left.title || '').localeCompare(String(right.title || ''));
      if (selectDraftSort === 'title-desc') return String(right.title || '').localeCompare(String(left.title || ''));
      return rightTime - leftTime;
    });
  }, [effectiveDraftLibrary, selectDraftCampaignTypeFilter, selectDraftProjectFilter, selectDraftSearch, selectDraftSort, selectDraftTypeFilter]);
  const draftTypeCounts = useMemo(() => {
    return draftTypeItems.reduce((counts, item) => {
      counts[item.value] = effectiveDraftLibrary.filter((draft) => inferDraftTypeFromDraft(draft) === item.value).length;
      return counts;
    }, {});
  }, [draftTypeItems, effectiveDraftLibrary]);
  const selectDraftProjectOptions = useMemo(() => (
    Array.from(new Set(effectiveDraftLibrary.map((draft) => String(draft.project || draft.projectName || '').trim()).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right))
  ), [effectiveDraftLibrary]);
  const selectDraftCampaignTypeOptions = useMemo(() => (
    Array.from(new Set(effectiveDraftLibrary.map((draft) => {
      const draftType = inferDraftTypeFromDraft(draft);
      return String(draft.campaignType || draft.type || draft.category || draftTypeLabel(draftType) || '').trim();
    }).filter(Boolean))).sort((left, right) => left.localeCompare(right))
  ), [effectiveDraftLibrary]);
  const selectDraftCategoryRows = useMemo(() => {
    const preferred = [
      ['all', 'All Drafts', 'ti-folder'],
      ['cover_story', 'Cover Story', 'ti-file-text'],
      ['reminder', 'Reminder', 'ti-refresh'],
      ['followup', 'Follow Up', 'ti-arrow-up'],
      ['updated_cost', 'Updated Cost', 'ti-currency-dollar'],
      ['final_cost', 'Final Call', 'ti-phone']
    ];
    const knownValues = new Set(draftTypeItems.map((item) => item.value));
    const rows = preferred.map(([value, label, icon]) => ({
      value,
      label,
      icon,
      count: value === 'all' ? effectiveDraftLibrary.length : Number(draftTypeCounts[value] || 0)
    }));
    draftTypeItems
      .filter((item) => !preferred.some(([value]) => value === item.value) && knownValues.has(item.value))
      .forEach((item) => rows.push({
        value: item.value,
        label: item.label,
        icon: 'ti-file-text',
        count: Number(draftTypeCounts[item.value] || 0)
      }));
    return rows;
  }, [draftTypeCounts, draftTypeItems, effectiveDraftLibrary.length]);
  const formatSelectDraftDate = (draft = {}) => {
    const value = draft.updatedAt || draft.createdAt || draft.savedAt || draft.savedDate || draft.updated || '';
    const date = value ? new Date(value) : null;
    if (date && !Number.isNaN(date.getTime())) {
      return date.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return [draft.savedDate, draft.savedTime].filter(Boolean).join(', ') || draft.updated || 'No date available';
  };
  const previewSelectDraftText = (draft = {}) => (
    String(draft.subject || draft.bodyText || draft.body || draft.bodyHtml || draft.html || 'No preview available.')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
  const draftSummaryVariables = ['{{FirstName}}', '{{LastName}}', '{{Company}}', '{{Designation}}', '{{Sector}}', '{{Country}}', '{{Email}}', '{{UnreadCount}}'];
  const draftSummaryWordCount = useMemo(() => (
    String(effectiveDraftMessage || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  ), [effectiveDraftMessage]);
  const draftSummaryCharacterCount = useMemo(() => (
    String(effectiveDraftMessage || '').replace(/<[^>]*>/g, ' ').trim().length
  ), [effectiveDraftMessage]);
  const draftSummaryRecipientCount = Number(overviewRows.length || previewRows.length || 0);
  const draftSummarySenderEmail = selectedCampaignSenderAccount?.from || selectedAccountLabel || 'Select Sender ID';
  const draftSummarySenderName = selectedCampaignSenderAccount?.name || selectedAccountLabel || 'Sender';
  const insertDraftSummaryVariable = (variable) => {
    const nextBody = `${effectiveDraftMessage || ''}${String(effectiveDraftMessage || '').trim() ? ' ' : ''}${variable}`;
    if (onDraftBodyChange) onDraftBodyChange(nextBody);
    else setDraftMessage(nextBody);
  };
  const handleDraftSummaryFiles = (files) => {
    const nextFiles = Array.from(files || []).filter(Boolean).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file)
    }));
    if (!nextFiles.length) return;
    setDraftSummaryAttachments((current) => [...current, ...nextFiles]);
    onShowMessage?.(`${nextFiles.length} attachment${nextFiles.length === 1 ? '' : 's'} added.`, 'success');
  };
  const removeDraftSummaryAttachment = (attachmentId) => {
    setDraftSummaryAttachments((current) => {
      const target = current.find((item) => item.id === attachmentId);
      if (target?.url) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.id !== attachmentId);
    });
  };
  const formatDraftSummaryFileSize = (bytes = 0) => {
    const value = Number(bytes || 0);
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    if (value >= 1024) return `${Math.ceil(value / 1024)} KB`;
    return `${value} B`;
  };
  const handleDraftSummaryNext = async () => {
    if (!hasCreateDraftReady) {
      onShowMessage?.(`Please fill: ${draftMissingFields.join(', ')}`, 'warning');
      return;
    }
    if (previewDirty) await onPreviewSave?.();
    setWorkflowPosition((current) => Math.max(current, 6));
    setShowDraftSummaryPopup(false);
    setShowTestEmailPopup(true);
  };
  const parseTestRecipients = (value = '') => (
    String(value || '')
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
  const allTestRecipients = useMemo(() => {
    const typed = parseTestRecipients(testRecipientText || testEmailTo || testEmailAddress);
    return Array.from(new Set([...testRecipients, ...typed].map((item) => item.trim()).filter(Boolean)));
  }, [testEmailAddress, testEmailTo, testRecipientText, testRecipients]);
  const validTestRecipients = useMemo(() => (
    allTestRecipients.filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ), [allTestRecipients]);
  const invalidTestRecipients = useMemo(() => (
    allTestRecipients.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ), [allTestRecipients]);
  const removeTestRecipient = (email) => {
    setTestRecipients((current) => current.filter((item) => item !== email));
    const nextTyped = parseTestRecipients(testRecipientText).filter((item) => item !== email).join(', ');
    setTestRecipientText(nextTyped);
  };
  const addTestRecipientsFromText = () => {
    const parsed = parseTestRecipients(testRecipientText);
    if (!parsed.length) return;
    setTestRecipients((current) => Array.from(new Set([...current, ...parsed])));
    onTestEmailToChange?.(parsed[0] || '');
  };
  const testPreviewHtml = useMemo(() => {
    if (!testVariablesPreview) return effectiveDraftMessage;
    return String(effectiveDraftMessage || '')
      .replaceAll('{{FirstName}}', 'Akshay')
      .replaceAll('{{LastName}}', 'More')
      .replaceAll('{{Company}}', 'TEC Magazine')
      .replaceAll('{{Sector}}', 'Technology')
      .replaceAll('{{Designation}}', 'Founder')
      .replaceAll('{{Country}}', 'India')
      .replaceAll('{{Email}}', validTestRecipients[0] || 'akshay.more@intellimail.com');
  }, [effectiveDraftMessage, testVariablesPreview, validTestRecipients]);
  const sendTestEmailFromV2 = async () => {
    const recipients = validTestRecipients.length ? validTestRecipients : parseTestRecipients(testEmailTo || testEmailAddress);
    if (!recipients.length) {
      setTestEmailError('Please enter at least one valid recipient.');
      onShowMessage?.('Please enter at least one valid recipient.', 'warning');
      return;
    }
    if (invalidTestRecipients.length) {
      setTestEmailError(`Invalid recipient: ${invalidTestRecipients[0]}`);
      onShowMessage?.(`Invalid recipient: ${invalidTestRecipients[0]}`, 'warning');
      return;
    }
    setTestEmailSent(false);
    setTestEmailError('');
    setTestEmailSending(true);
    const primaryRecipient = recipients[0];
    setTestEmailAddress(primaryRecipient);
    onTestEmailToChange?.(primaryRecipient);
    const result = await onSendTestEmail?.(primaryRecipient);
    const sent = typeof result === 'boolean' ? result : Boolean(result?.ok);
    setTestEmailSending(false);
    setTestEmailSent(sent);
    if (!sent) {
      setTestEmailError(result?.error || 'Test email was not sent. Check sender, recipient, subject, and body.');
    } else {
      onShowMessage?.('Test email sent successfully.', 'success');
    }
  };
  const selectedSavedDraft = useMemo(() => {
    const currentDraftId = selectedDraftId || activeDraftId;
    if (!currentDraftId) return null;
    return effectiveDraftLibrary.find(
      (draft) => String(draft.id || '') === String(currentDraftId)
    ) || null;
  }, [activeDraftId, effectiveDraftLibrary, selectedDraftId]);
  const selectedDraftTypeLabel = selectedDraftType ? draftTypeLabel(selectedDraftType) : 'Choose Draft Type';
  const templateDraftForSelectedType = useMemo(() => {
    if (!selectedDraftType || filteredSavedDrafts.length) return null;
    return getTemplateForDraftType(selectedDraftType);
  }, [filteredSavedDrafts.length, selectedDraftType]);
  const selectedPreviewDraft = selectedSavedDraft || templateDraftForSelectedType;
  const selectedDraftPreviewSubject = String(
    selectedPreviewDraft?.subject || ''
  ).trim();
  const selectedDraftPreviewBody = String(
    selectedPreviewDraft?.bodyHtml || selectedPreviewDraft?.html || selectedPreviewDraft?.body || ''
  ).trim();
  const relatedDraftsForSelectedType = useMemo(() => {
    const target = selectedDraftType ? normalizeDraftType(selectedDraftType) : '';
    if (!target) return [];
    return effectiveSavedDrafts.filter((item) => inferDraftTypeFromDraft(item) === target);
  }, [effectiveSavedDrafts, selectedDraftType]);
  useEffect(() => {
    if (!templateDraftForSelectedType) return;
    const hasDraftContent =
      Boolean(String(effectiveDraftSubject || '').trim()) ||
      Boolean(String(effectiveDraftMessage || '').replace(/<[^>]*>/g, '').trim());
    if (!hasDraftContent) {
      applyTemplateDraft(templateDraftForSelectedType.draftType);
    }
  }, [effectiveDraftMessage, effectiveDraftSubject, templateDraftForSelectedType]);
  const monthLabel = calendarCursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const daysInMonth = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0).getDate();
  const leadingDays = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 0).getDate();
  const startOffset = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1).getDay();
  const totalCells = Math.max(42, Math.ceil((startOffset + daysInMonth) / 7) * 7);
  const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const calendarCells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1;
    if (dayNumber <= 0) {
      return {
        key: `prev-${index}`,
        label: leadingDays + dayNumber,
        inMonth: false,
        date: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, leadingDays + dayNumber)
      };
    }
    if (dayNumber > daysInMonth) {
      return {
        key: `next-${index}`,
        label: dayNumber - daysInMonth,
        inMonth: false,
        date: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, dayNumber - daysInMonth)
      };
    }
    return {
      key: `day-${dayNumber}`,
      label: dayNumber,
      inMonth: true,
      date: new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), dayNumber)
    };
  });
  const today = useMemo(() => new Date(), []);
  useEffect(() => {
    const controller = new AbortController();
    const from = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
    const to = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 2, 0);

    const loadCalendarEvents = async () => {
      setCalendarLoading(true);
      try {
        const params = new URLSearchParams({
          from: formatDateInput(from),
          to: formatDateInput(to)
        });
        const response = await fetch(`/api/calendar/events?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || 'Failed to load calendar events');
        }
        setUserCalendarEvents((data.events || []).map((item) => ({
          ...item,
          id: item._id || item.id,
          date: parseEventDate(item.startDate),
          title: item.title,
          detail: item.description || item.notes || item.type,
          type: item.type || 'Reminder'
        })));
      } catch (error) {
        if (error?.name !== 'AbortError') {
          onShowMessage?.(error.message || 'Failed to load calendar events', 'error');
        }
      } finally {
        if (!controller.signal.aborted) setCalendarLoading(false);
      }
    };

    loadCalendarEvents();
    return () => controller.abort();
  }, [calendarCursor]);

  const getCalendarEventTone = (type) => {
    const normalized = String(type || '').toLowerCase();
    if (normalized.includes('mail')) return 'mail';
    if (normalized.includes('timeline')) return 'timeline';
    if (normalized.includes('campaign')) return 'campaign';
    return 'default';
  };
  const openEventForm = (date = selectedDate, eventItem = null) => {
    const itemId = String(eventItem?.id || eventItem?._id || '');
    if (eventItem && /^(notification|timeline|campaign)-/.test(itemId)) {
      onShowMessage?.('Open Add Event to create a saved calendar item from this dashboard activity.', 'info');
      return;
    }
    setEditingCalendarEvent(eventItem);
    setCalendarEventDraft(eventItem ? {
      id: eventItem.id || eventItem._id || '',
      title: eventItem.title || '',
      description: eventItem.description || eventItem.detail || '',
      startDate: formatDateInput(eventItem.startDate || eventItem.date || date),
      endDate: formatDateInput(eventItem.endDate || eventItem.startDate || eventItem.date || date),
      startTime: eventItem.startTime || '09:00',
      endTime: eventItem.endTime || '09:30',
      type: eventItem.type || 'Reminder',
      priority: eventItem.priority || 'Medium',
      reminder: eventItem.reminder || 'None',
      repeat: eventItem.repeat || 'None',
      notes: eventItem.notes || '',
      color: eventItem.color || CALENDAR_COLORS[0]
    } : buildCalendarEventDraft(date));
    setShowEventFormPopup(true);
  };
  const saveCalendarEvent = async () => {
    const title = String(calendarEventDraft.title || '').trim();
    if (!title) {
      onShowMessage?.('Add an event title before saving.', 'info');
      return;
    }
    if (
      calendarEventDraft.startDate &&
      calendarEventDraft.endDate &&
      calendarEventDraft.startDate === calendarEventDraft.endDate &&
      calendarEventDraft.startTime &&
      calendarEventDraft.endTime &&
      calendarEventDraft.endTime <= calendarEventDraft.startTime
    ) {
      onShowMessage?.('End time must be after start time for same-day events.', 'error');
      return;
    }
    setCalendarSaving(true);
    try {
      const eventId = editingCalendarEvent?.id || editingCalendarEvent?._id || calendarEventDraft.id;
      const response = await fetch(eventId ? `/api/calendar/events/${eventId}` : '/api/calendar/events', {
        method: eventId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calendarEventDraft)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to save event');
      }
      const saved = data.event;
      const normalized = {
        ...saved,
        id: saved._id || saved.id,
        date: parseEventDate(saved.startDate),
        detail: saved.description || saved.notes || saved.type
      };
      setUserCalendarEvents((current) => {
        const withoutCurrent = current.filter((item) => String(item.id || item._id) !== String(normalized.id));
        return [normalized, ...withoutCurrent].sort((a, b) => (a.date?.getTime?.() || 0) - (b.date?.getTime?.() || 0));
      });
      setSelectedDate(parseEventDate(saved.startDate) || selectedDate);
      setShowEventFormPopup(false);
      setShowDayPopup(false);
      onShowMessage?.(eventId ? 'Calendar event updated.' : 'Calendar event saved.', 'success');
    } catch (error) {
      onShowMessage?.(error.message || 'Failed to save event', 'error');
    } finally {
      setCalendarSaving(false);
    }
  };
  const deleteCalendarEvent = async (eventItem) => {
    const eventId = eventItem?.id || eventItem?._id;
    if (!eventId || String(eventId).startsWith('notification-') || String(eventId).startsWith('timeline-') || String(eventId).startsWith('campaign-')) {
      onShowMessage?.('Only saved calendar events can be deleted here.', 'info');
      return;
    }
    setCalendarSaving(true);
    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to delete event');
      }
      setUserCalendarEvents((current) => current.filter((item) => String(item.id || item._id) !== String(eventId)));
      setShowEventFormPopup(false);
      onShowMessage?.('Calendar event deleted.', 'success');
    } catch (error) {
      onShowMessage?.(error.message || 'Failed to delete event', 'error');
    } finally {
      setCalendarSaving(false);
    }
  };
  const selectedEvents = allCalendarEvents.filter((item) => sameDay(item.date, selectedDate));
  const todayCalendarEvents = allCalendarEvents.filter((item) => sameDay(item.date, today));
  const upcomingCalendarEvents = allCalendarEvents
    .filter((item) => item.date && item.date >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .sort((a, b) => a.date - b.date)
    .slice(0, 4);
  const upcomingTaskCount = upcomingCalendarEvents.filter((item) => /task|deadline|follow-up/i.test(String(item.type || ''))).length;
  const upcomingMeetingCount = upcomingCalendarEvents.filter((item) => /meeting|client call/i.test(String(item.type || ''))).length;
  const upcomingCampaignCount = upcomingCalendarEvents.filter((item) => /campaign/i.test(String(item.type || ''))).length;
  const selectedDateLabel = selectedDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const availableTags = useMemo(() => {
    return [
      'All Tags',
      'Queued',
      'Running',
      'Paused',
      'Completed',
      'Failed',
      ...new Set(
        performanceCampaigns
          .flatMap((item) => item.tags || [])
          .filter((tag) => tag && !['Queued', 'Running', 'Paused', 'Completed', 'Failed'].includes(tag))
      )
    ];
  }, [performanceCampaigns]);
  const selectedTagFilterLabel = selectedTagFilters.length
    ? selectedTagFilters.join(' + ')
    : 'All Tags';
  const toggleTagFilter = (tag) => {
    if (tag === 'All Tags') {
      setSelectedTagFilters([]);
      return;
    }
    setSelectedTagFilters((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  };
  const filteredCampaigns = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    const activeFilters = selectedTagFilters.filter((tag) => tag !== 'All Tags');
    const statusFilters = new Set(
      activeFilters
        .map((tag) => String(tag || '').toLowerCase())
        .filter((tag) => ['queued', 'running', 'paused', 'completed', 'failed'].includes(tag))
    );
    const tagFilters = new Set(
      activeFilters.filter((tag) => !['Queued', 'Running', 'Paused', 'Completed', 'Failed'].includes(tag))
    );
    return performanceCampaigns.filter((item) => {
      const statusValue = String(item.status || item.tag || '').toLowerCase();
      const itemTags = item.tags || [];
      const matchesTag =
        !activeFilters.length ||
        statusFilters.has(statusValue) ||
        itemTags.some((tag) => tagFilters.has(tag));
      const haystack = [
        item.srNo,
        item.name,
        item.publishDate,
        item.total,
        item.sent,
        item.pending,
        item.failed,
        item.open,
        item.bounced,
        item.spam,
        item.person,
        item.broadcast,
        item.country,
        item.sector,
        ...(item.tags || [])
      ].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesTag && matchesSearch;
    });
  }, [performanceCampaigns, selectedTagFilters, tableSearch]);
  const rowsPerPage = 7;
  const totalTablePages = Math.max(1, Math.ceil(filteredCampaigns.length / rowsPerPage));
  const paginatedCampaigns = useMemo(() => {
    const start = (currentTablePage - 1) * rowsPerPage;
    return filteredCampaigns.slice(start, start + rowsPerPage);
  }, [currentTablePage, filteredCampaigns]);

  useEffect(() => {
    if (!showCalendarPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCalendarPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCalendarPopup]);

  useEffect(() => {
    if (!showNotificationsPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowNotificationsPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showNotificationsPopup]);

  useEffect(() => {
    if (!showTimelinePopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowTimelinePopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showTimelinePopup]);

  useEffect(() => {
    if (!showNotesPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowNotesPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showNotesPopup]);

  useEffect(() => {
    if (!showLogsPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowLogsPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showLogsPopup]);

  useEffect(() => {
    if (!showSchedulePopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowSchedulePopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSchedulePopup]);

  useEffect(() => {
    if (!showDraftSummaryPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowDraftSummaryPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDraftSummaryPopup]);

  useEffect(() => {
    if (!showClientListPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowClientListPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showClientListPopup]);

  useEffect(() => {
    if (!showClientListPopup) return;
    let cancelled = false;
    const loadSheets = async () => {
      setClientListLoadingSheets(true);
      try {
        const response = await fetch('/api/client-data/sheets', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled) {
          const rows = Array.isArray(payload?.lists)
            ? payload.lists
            : Array.isArray(payload?.sheets)
              ? payload.sheets
              : Array.isArray(payload)
                ? payload
                : [];
          setClientListApiSheets(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setClientListApiSheets([]);
          onShowMessage?.(error?.message || 'Could not refresh saved client sheets.', 'error');
        }
      } finally {
        if (!cancelled) setClientListLoadingSheets(false);
      }
    };
    loadSheets();
    return () => {
      cancelled = true;
    };
  }, [clientListRefreshTick, onShowMessage, showClientListPopup]);

  useEffect(() => {
    setClientListPage(1);
  }, [clientListCategoryFilter, clientListProjectFilter, clientListRecentFilter, clientListSearch, clientListSidebarProjectFilter, clientListSourceFilter]);

  useEffect(() => {
    if (!showOverviewPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowOverviewPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showOverviewPopup]);

  useEffect(() => {
    if (!showCampaignPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowCampaignPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCampaignPopup]);

  useEffect(() => {
    if (!showSelectDraftPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowSelectDraftPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSelectDraftPopup]);

  useEffect(() => {
    if (!showTestEmailPopup) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowTestEmailPopup(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showTestEmailPopup]);

  useEffect(() => {
    const nextTimezone = scheduleCountries[scheduleCountryKey]?.[0] || scheduleCountries.India[0];
    if (nextTimezone) {
      setScheduleTimezone(nextTimezone);
    }
  }, [scheduleCountryKey]);

  useEffect(() => {
    setCurrentTablePage((current) => Math.min(current, totalTablePages));
  }, [totalTablePages]);

  useEffect(() => {
    setCurrentTablePage(1);
  }, [selectedTagFilters, tableSearch]);

  useEffect(() => {
    if (isBulkReplyMode) return;
    if (!previewRows.length) {
      if (!previewColumns.length && !reviewLocalColumns.length) {
        setColumnMappings([]);
        setOverviewRows([]);
        setSelectedOverviewRowIds([]);
      }
      return;
    }
    const columns = previewColumns.length
      ? previewColumns
      : Array.from(new Set(previewRows.flatMap((row) => Object.keys(row || {})).filter(Boolean)));
    const mergedColumns = Array.from(new Set([...columns, ...reviewLocalColumns]));
    setColumnMappings(
      mergedColumns.map((column) => {
        const isAddedColumn = reviewLocalColumns.includes(column);
        const mappedField = isAddedColumn
          ? 'Notes'
          : /email/i.test(column)
            ? 'Email'
            : /name/i.test(column)
              ? 'Name'
              : /company/i.test(column)
                ? 'Company'
                : /phone|mobile/i.test(column)
                  ? 'Phone'
                  : /city/i.test(column)
                    ? 'City'
                    : 'Ignore';
        return {
          sheetColumn: column,
          mappedField,
          sample: String(previewRows.find((row) => row?.[column])?.[column] || ''),
          status: mappedField === 'Ignore' ? 'warning' : 'success'
        };
      })
    );
    setOverviewRows(
      previewRows.map((row, index) => ({
        id: index + 1,
        ...Object.fromEntries(reviewLocalColumns.map((column) => [column, ''])),
        ...row
      }))
    );
  }, [previewColumns, previewRows, reviewLocalColumns]);


  useEffect(() => {
    if (selectDraftTab !== 'my-drafts') return;
    if (!filteredSavedDrafts.length) {
      setSelectedDraftId('');
      return;
    }
    const currentDraftId = selectedDraftId || activeDraftId;
    const hasVisibleSelection = filteredSavedDrafts.some(
      (draft) => String(draft.id || '') === String(currentDraftId || '')
    );
    if (!hasVisibleSelection) {
      setSelectedDraftId(filteredSavedDrafts[0].id);
    }
  }, [activeDraftId, filteredSavedDrafts, selectDraftTab, selectedDraftId]);

  useEffect(() => {
    if (!selectedDraftId) return;
    const selected = effectiveDraftLibrary.find(
      (draft) => String(draft.id || '') === String(selectedDraftId)
    );
    if (!selected) return;
    const selectedType = normalizeDraftType(selected.draftType || selected.category || selectedDraftType);
    onSelectedDraftTypeChange?.(selectedType);
    if (String(selected.id || '').startsWith('template:')) {
      applyTemplateDraft(selectedType);
      return;
    }
    onSelectSavedDraft?.(selected.id);
  }, [activeDraftId, effectiveDraftLibrary, onSelectSavedDraft, onSelectedDraftTypeChange, selectedDraftId, selectedDraftType]);

  const applyTemplateDraft = (draftType = '') => {
    const templateDraft = getTemplateForDraftType(draftType);
    if (!templateDraft) return false;
    onDraftSubjectChange ? onDraftSubjectChange(templateDraft.subject) : setDraftSubject(templateDraft.subject);
    onDraftBodyChange ? onDraftBodyChange(templateDraft.body) : setDraftMessage(templateDraft.body);
    setDraftUploadedText(String(templateDraft.body || '').replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
    setDraftUploadedFileName(templateDraft.title || 'Template draft');
    return true;
  };

  const handleDraftTypeSelect = (value = '') => {
    const nextValue = normalizeDraftType(value);
    const firstMatchingDraft = effectiveSavedDrafts.find((draft) => inferDraftTypeFromDraft(draft) === nextValue);
    setSelectDraftTab('my-drafts');
    setDraftTypeLibraryOpen(true);
    setSelectedDraftId(firstMatchingDraft?.id || '');
    onSelectedDraftTypeChange?.(nextValue);
    onSelectSavedDraft?.(firstMatchingDraft?.id || '');
    if (!firstMatchingDraft) {
      applyTemplateDraft(nextValue);
    }
    setShowDraftTypeDropdown(false);
  };

  const handleCreateDraftClick = () => {
    setDraftTypeLibraryOpen(false);
    setShowDraftTypeDropdown(false);
    setSelectDraftTab('create');
  };

  const loadDraftIntoEditor = (draft) => {
    if (!draft) return;
    onSelectedDraftTypeChange?.(normalizeDraftType(draft.draftType || draft.category || selectedDraftType));
    setSelectedDraftId(draft.id || '');
    onSelectSavedDraft?.(draft.id || '');
    if (onDraftSubjectChange) {
      onDraftSubjectChange(draft.subject || '');
    } else {
      setDraftSubject(draft.subject || '');
    }
    if (onDraftBodyChange) {
      onDraftBodyChange(draft.bodyHtml || draft.html || draft.body || '');
    } else {
      setDraftMessage(draft.bodyHtml || draft.html || draft.body || '');
    }
    setDraftUploadedText(String(draft.bodyText || draft.bodyHtml || draft.html || draft.body || '').replace(/<[^>]*>/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
    setDraftUploadedFileName(draft.title || 'Saved draft');
  };

  const handleDraftFileUpload = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    setSelectDraftTab('create');
    setSelectedDraftId('');
    onSelectSavedDraft?.('');
    setDraftUploadedFileName(file.name);
    setDraftUploadedText(`Reading ${file.name}...`);
    setDraftFileReading(true);
    try {
      const extension = getDraftFileExtension(file.name);
      let text = '';

      if (['txt', 'md', 'csv', 'html', 'htm'].includes(extension) || String(file.type || '').startsWith('text/')) {
        text = await file.text();
      } else {
        let apiError = null;
        try {
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetch('/api/draft-file-text', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
          });
          const rawResponseText = await response.text();
          let payload = {};
          try {
            payload = rawResponseText ? JSON.parse(rawResponseText) : {};
          } catch {
            payload = {};
          }
          if (!response.ok) {
            throw new Error(payload.error || `PDF text extraction failed (${response.status} ${response.statusText || 'Error'}).`);
          }
          text = payload.text || '';
        } catch (error) {
          apiError = error;
        }

        if (!text) {
          if (extension === 'pdf') {
            throw new Error(apiError?.message || 'No readable text was found in this PDF.');
          }
          try {
            text = await extractDraftFileTextInBrowser(file);
          } catch (fallbackError) {
            throw new Error(
              [
                fallbackError?.message ? `Browser reader: ${fallbackError.message}` : '',
                apiError?.message ? `Server reader: ${apiError.message}` : ''
              ].filter(Boolean).join('\n') || 'Could not read this file.'
            );
          }
        }
      }
      const previewText = normalizeDraftPreviewText(text);
      if (!previewText) {
        throw new Error('No readable text was found in this file.');
      }
      setDraftUploadedFileName(file.name);
      setDraftUploadedText(previewText);
      if (!String(effectiveDraftSubject || '').trim()) {
        const subjectFromName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        if (onDraftSubjectChange) {
          onDraftSubjectChange(subjectFromName);
        } else {
          setDraftSubject(subjectFromName);
        }
      }
      onShowMessage?.(`${file.name} uploaded to draft viewer.`, 'success');
    } catch (error) {
      const message = error?.message || 'Could not extract readable text from this file.';
      setDraftUploadedText(`Could not preview ${file.name}.\n\n${message}`);
      onShowMessage?.(message, 'warning');
    } finally {
      setDraftFileReading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleSaveDraft = async () => {
    const hasSummaryRequiredFields =
      Boolean(String(effectiveDraftSubject || '').trim()) &&
      Boolean(String(effectiveDraftMessage || '').replace(/<[^>]*>/g, '').trim()) &&
      Boolean(String(selectedDraftType || '').trim());

    if (!hasSummaryRequiredFields) {
      onShowMessage?.('Choose a draft type, subject, and message before saving.', 'warning');
      return false;
    }

    setDraftSaving(true);
    try {
      const result = await onSaveDraft?.();
      if (result?.ok === false) return false;
      setSelectDraftTab('my-drafts');
      onShowMessage?.('Draft saved. It is now available in My Drafts.', 'success');
      return true;
    } catch (error) {
      onShowMessage?.(error?.message || 'Failed to save draft.', 'error');
      return false;
    } finally {
      setDraftSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedListId) return;
    setSelectedUploadedList(selectedListId);
    setSelectedCustomList(selectedListId);
  }, [selectedListId]);

  useEffect(() => {
    let active = true;
    fetch('/api/profile', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (!active || !Array.isArray(data?.profile?.quickNotes)) return;
        setQuickNotes(
          [...data.profile.quickNotes]
            .map((note) => ({
              ...note,
              avatar: 'QN',
              name: note.topic || 'Quick Note',
              time: note.createdAt || ''
            }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const addQuickNote = async () => {
    const reminder = noteDraft.trim();
    const topic = noteTopic.trim();
    const tag = noteTag.trim();
    if (!reminder && !topic && !tag) {
      onShowMessage?.('Add a topic, tag, or reminder before saving it.', 'info');
      return;
    }
    const createdAt = new Date().toISOString();
    const nextNote = {
      id: `note-${Date.now()}`,
      avatar: 'QN',
      name: topic || 'Quick Note',
      time: createdAt,
      createdAt,
      text: reminder || 'No reminder text added.',
      topic: topic || 'General',
      tag: tag || 'Note'
    };
    const nextNotes = [nextNote, ...quickNotes].slice(0, 200);
    setQuickNotes(nextNotes);
    setNoteDraft('');
    setNoteTopic('');
    setNoteTag('');
    onShowMessage?.('Note saved to your dashboard.', 'success');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickNotes: nextNotes.map(({ id, topic: savedTopic, tag: savedTag, text, createdAt: savedAt }) => ({
            id,
            topic: savedTopic,
            tag: savedTag,
            text,
            createdAt: savedAt
          }))
        })
      });
      if (!response.ok) throw new Error('Failed to persist note.');
    } catch {
      onShowMessage?.('Note is visible now, but could not be saved permanently.', 'error');
    }
  };

  const toggleRowSelection = (id) => {
    setSelectedRows((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleAllRows = () => {
    const visibleIds = paginatedCampaigns.map((item) => item.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRows.includes(id));
    setSelectedRows((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  const handleWorkflowAction = (step, event) => {
    const stepIndex = Number(step?.index || 0);
    const stepAction = String(step?.action || '').trim().toLowerCase();
    const stepTitle = String(step?.title || '').trim().toLowerCase();
    closeWorkflowPopups();

    if (stepIndex === 1 || stepAction === 'upload list' || stepTitle === 'upload list') {
      setClientListTab('custom');
      openAnchoredPopup('clientList', setShowClientListPopup)(event);
      return;
    }
    if (stepIndex === 2 || stepAction === 'review list' || stepAction === 'review' || stepTitle === 'review list' || stepTitle === 'review') {
      openAnchoredPopup('overview', setShowOverviewPopup)(event);
      return;
    }
    if (stepIndex === 3 || stepAction === 'campaign' || stepTitle === 'campaign') {
      openAnchoredPopup('campaign', setShowCampaignPopup)(event);
      return;
    }
    if (stepIndex === 4 || stepAction === 'select draft' || stepAction === 'drafts' || stepTitle === 'select draft' || stepTitle === 'drafts') {
      openAnchoredPopup('selectDraft', setShowSelectDraftPopup)(event);
      return;
    }
    if (stepIndex === 6 || stepAction === 'test email' || stepTitle === 'test email') {
      openAnchoredPopup('testEmail', setShowTestEmailPopup)(event);
      return;
    }
    if (stepIndex === 5 || stepAction === 'draft summary' || stepTitle === 'draft summary' || stepTitle === 'summary') {
      openAnchoredPopup('draftSummary', setShowDraftSummaryPopup)(event);
      return;
    }
    if (stepIndex === 7 || stepAction === 'schedule' || stepAction === 'schedule sending' || stepTitle === 'schedule' || stepTitle === 'schedule sending') {
      openAnchoredPopup('schedule', setShowSchedulePopup)(event);
      onShowMessage?.('Set a schedule or start the campaign from here.', 'info');
    }
  };

  const showTableMessage = (message, tone = 'info') => {
    onShowMessage?.(message, tone);
  };

  const handleActionCenterClick = () => {
    if (!filteredCampaigns.length) {
      showTableMessage('No campaigns are loaded yet. Create or start a campaign to manage it here.', 'info');
      return;
    }
    if (!selectedRows.length) {
      showTableMessage('Select one or more campaigns to take action, or open the row menu for a single campaign.', 'info');
      return;
    }
    showTableMessage(
      `${selectedRows.length} campaign${selectedRows.length > 1 ? 's are' : ' is'} selected. Use the Campaign panel below for start, pause, stop, resume, and delete actions.`,
      'success'
    );
  };

  const handleSelectionSummaryClick = () => {
    if (!filteredCampaigns.length) {
      showTableMessage('No campaigns match the current search or tag filter.', 'info');
      return;
    }
    showTableMessage(
      selectedRows.length
        ? `${selectedRows.length} campaign${selectedRows.length > 1 ? 's are' : ' is'} selected on this page.`
        : `${filteredCampaigns.length} campaign${filteredCampaigns.length > 1 ? 's are' : ' is'} available in this view.`,
      'info'
    );
  };

  const handleViewCampaign = (campaign, replyTarget = null) => {
    if (onViewCampaignDetail) {
      onViewCampaignDetail(campaign.id || campaign._id, replyTarget);
      return;
    }
    const isActive = activeCampaign && String(activeCampaign._id || activeCampaign.id) === String(campaign.id);
    setTableSearch(campaign.name || '');
    setSelectedTagFilters([]);
    if (isActive) {
      setShowLogsPopup(true);
      showTableMessage(`Showing live logs for ${campaign.name}.`, 'success');
      return;
    }
    showTableMessage(`Filtered the table to ${campaign.name}. Use the Campaign and History panels below for full controls.`, 'info');
  };

  const handleEditTagsClick = (campaign) => {
    setTableSearch(campaign.name || '');
    showTableMessage(`Tags for ${campaign.name} come from real campaign data. Update them from the campaign source, then refresh this dashboard.`, 'info');
  };

  const handleDeleteCampaignClick = (campaign) => {
    setOpenActionMenu(null);
    if (!onDeleteCampaign) {
      showTableMessage('Delete action is not available in this view yet.', 'error');
      return;
    }
    onDeleteCampaign(campaign.id);
  };

  useEffect(() => {
    const handleOutsideActionMenu = (event) => {
      const target = event.target;
      const isBroadcastActionClick = Boolean(
        target?.closest?.('.broadcast-action-cell, .premium-table-action-cell, .premium-row-action-menu, .table-action-btn, .premium-row-action')
      );
      if (!isBroadcastActionClick && !actionMenuRef.current?.contains(target)) {
        setOpenActionMenu(null);
      }
      if (!tagFilterRef.current?.contains(target)) {
        setShowTagFilterMenu(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideActionMenu);
    return () => document.removeEventListener('pointerdown', handleOutsideActionMenu);
  }, []);

  const selectedClientListSummary = useMemo(() => {
    if (clientListTab === 'upload') {
      return {
        title: clientListName || 'New uploaded list',
        subtitle: 'Uploaded from Upload List step',
        detail: 'This file will continue to step 2: Review List.'
      };
    }
    if (clientListTab === 'uploaded') {
      const selected = effectiveUploadedLists.find((item) => item.id === selectedUploadedList);
      return {
        title: selected?.title || 'Uploaded list',
        subtitle: selected?.meta || 'Previously uploaded file selected',
        detail: 'This uploaded file will continue to step 2: Review List.'
      };
    }
    const selected = effectiveCustomLists.find((item) => item.id === selectedCustomList);
    return {
      title: selected?.title || 'Custom list',
      subtitle: selected?.meta || 'Saved list selected',
      detail: 'This custom list will continue to step 2: Review List.'
    };
  }, [clientListName, clientListTab, effectiveCustomLists, selectedCustomList, selectedUploadedList, effectiveUploadedLists]);
  const selectedCampaignListRow = useMemo(() => (
    campaignListRows.find((row) => String(row.id) === String(selectedListId || selectedUploadedList || selectedCustomList || '')) ||
    campaignListRows.find((row) => String(row.title || '').trim() === String(selectedListName || selectedClientListSummary.title || '').trim()) ||
    null
  ), [campaignListRows, selectedClientListSummary.title, selectedCustomList, selectedListId, selectedListName, selectedUploadedList]);
  const mappedFieldOptions = ['Name', 'Email', 'Company', 'Phone', 'City', 'Industry', 'Notes', 'Ignore'];
  const activeOverviewColumns = useMemo(
    () => columnMappings.filter((item) => item.mappedField !== 'Ignore'),
    [columnMappings]
  );
  const overviewGridTemplate = useMemo(
    () => `repeat(${Math.max(1, activeOverviewColumns.length)}, minmax(132px, 1fr))`,
    [activeOverviewColumns.length]
  );
  const emailMapping = useMemo(
    () => columnMappings.find((item) => item.mappedField === 'Email') || null,
    [columnMappings]
  );
  const nameMapping = useMemo(
    () => columnMappings.find((item) => item.mappedField === 'Name') || null,
    [columnMappings]
  );
  const rowIssues = useMemo(() => {
    const emailCounts = overviewRows.reduce((acc, row) => {
      const key = String(row?.[emailMapping?.sheetColumn] || '').trim().toLowerCase();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return overviewRows.reduce((acc, row) => {
      const issues = [];
      const emailValue = String(row?.[emailMapping?.sheetColumn] || '').trim();
      if (!emailValue) issues.push('missing');
      if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) issues.push('invalid');
      if (emailValue && emailCounts[emailValue.toLowerCase()] > 1) issues.push('duplicate');
      if (activeOverviewColumns.some((item) => item.mappedField !== 'Ignore' && !String(row?.[item.sheetColumn] ?? '').trim())) {
        issues.push('missing-value');
      }
      acc[row.id] = issues;
      return acc;
    }, {});
  }, [activeOverviewColumns, columnMappings, emailMapping, overviewRows]);
  const missingValueCount = useMemo(() => (
    overviewRows.reduce((total, row) => (
      total + activeOverviewColumns.filter((item) => (
        item.mappedField !== 'Ignore' && !String(row?.[item.sheetColumn] ?? '').trim()
      )).length
    ), 0)
  ), [activeOverviewColumns, overviewRows]);
  const summaryStats = useMemo(() => {
    const validEmails = overviewRows.filter((row) => {
      const emailValue = String(row?.[emailMapping?.sheetColumn] || '').trim();
      return emailValue && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
    }).length;
    const validEmailPercent = overviewRows.length ? Math.round((validEmails / overviewRows.length) * 100) : 0;
    return [
      { label: 'File Name', value: selectedClientListSummary.title || 'clients_april.xlsx' },
      { label: 'Total Records', value: String(overviewRows.length) },
      { label: 'Columns Detected', value: String(columnMappings.length) },
      { label: 'Valid Email', value: `${validEmails} (${validEmailPercent}%)` },
      { label: 'Missing Values', value: String(missingValueCount) }
    ];
  }, [columnMappings.length, emailMapping, missingValueCount, overviewRows, selectedClientListSummary.title]);
  const filteredOverviewRows = useMemo(() => {
    const query = overviewSearch.trim().toLowerCase();
    return overviewRows.filter((row) => {
      const issues = rowIssues[row.id] || [];
      const matchesFilter =
        overviewFilter === 'all' ||
        (overviewFilter === 'errors' && issues.includes('invalid')) ||
        (overviewFilter === 'missing' && (issues.includes('missing') || issues.includes('missing-value'))) ||
        (overviewFilter === 'duplicates' && issues.includes('duplicate'));
      const matchesSearch = !query || Object.values(row || {}).join(' ').toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [overviewFilter, overviewRows, overviewSearch, rowIssues]);
  const visibleOverviewRowIds = filteredOverviewRows.map((row) => row.id);
  const allVisibleOverviewRowsSelected =
    visibleOverviewRowIds.length > 0 && visibleOverviewRowIds.every((id) => selectedOverviewRowIds.includes(id));

  const toggleOverviewRowSelection = (rowId) => {
    setSelectedOverviewRowIds((current) =>
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]
    );
  };

  const toggleAllOverviewRows = () => {
    setSelectedOverviewRowIds((current) =>
      allVisibleOverviewRowsSelected
        ? current.filter((id) => !visibleOverviewRowIds.includes(id))
        : Array.from(new Set([...current, ...visibleOverviewRowIds]))
    );
  };

  const deleteSelectedOverviewRows = () => {
    if (!selectedOverviewRowIds.length) return;
    [...selectedOverviewRowIds]
      .sort((left, right) => right - left)
      .forEach((rowId) => onPreviewDeleteRow?.(rowId - 1));
    setSelectedOverviewRowIds([]);
  };

  const addOverviewRow = (afterRowId = null) => {
    const sourceIndex = Number.isFinite(Number(afterRowId)) ? Number(afterRowId) - 1 : null;
    const insertIndex = Number.isInteger(sourceIndex)
      ? Math.max(0, Math.min(overviewRows.length, sourceIndex + 1))
      : overviewRows.length;
    const blankRow = Object.fromEntries(activeOverviewColumns.map((column) => [column.sheetColumn, '']));

    // Keep the review grid responsive immediately, then delegate to the parent preview state for persistence.
    setOverviewRows((current) => {
      const nextRows = [...current.slice(0, insertIndex), blankRow, ...current.slice(insertIndex)];
      return nextRows.map((row, index) => ({ ...row, id: index + 1 }));
    });
    onPreviewAddRow?.(sourceIndex);
  };

  const addOverviewColumn = () => {
    const existingColumns = columnMappings.map((item) => item.sheetColumn);
    let nextIndex = existingColumns.length + 1;
    let nextName = `Column${nextIndex}`;
    while (existingColumns.includes(nextName)) {
      nextIndex += 1;
      nextName = `Column${nextIndex}`;
    }
    const nextMapping = {
      sheetColumn: nextName,
      mappedField: 'Notes',
      sample: '',
      status: 'success'
    };

    // Update local mapping and rows before the parent preview props round-trip back into this modal.
    setReviewLocalColumns((current) => current.includes(nextName) ? current : [...current, nextName]);
    setColumnMappings((current) =>
      current.some((item) => item.sheetColumn === nextName) ? current : [...current, nextMapping]
    );
    setOverviewRows((current) => current.map((row) => ({ ...row, [nextName]: '' })));
    onPreviewAddColumn?.(nextName);
  };

  const renameOverviewColumn = (currentName) => {
    const nextName = window.prompt('Rename column', currentName);
    if (!nextName || !nextName.trim() || nextName.trim() === currentName) return;
    const normalizedName = nextName.trim();
    setColumnMappings((current) =>
      current.map((entry) => entry.sheetColumn === currentName ? { ...entry, sheetColumn: normalizedName } : entry)
    );
    setOverviewRows((current) =>
      current.map((row) => {
        const updated = { ...row, [normalizedName]: row?.[currentName] ?? '' };
        delete updated[currentName];
        return updated;
      })
    );
    onPreviewRenameColumn?.(currentName, normalizedName);
  };

  useEffect(() => {
    const columnNames = new Set(activeOverviewColumns.map((column) => column.sheetColumn));
    setSelectedOverviewColumns((current) => current.filter((name) => columnNames.has(name)));
  }, [activeOverviewColumns]);

  useEffect(() => {
    const rowIds = new Set(overviewRows.map((row) => row.id));
    setSelectedOverviewRowIds((current) => current.filter((id) => rowIds.has(id)));
  }, [overviewRows]);

  const fallbackSelectedCampaignRowId = String(clientListMultiSelectedIds[0] || '').trim();
  const canContinueClientList =
    clientListTab === 'upload'
      ? Boolean(selectedListId || uploadedListId)
      : clientListTab === 'uploaded'
        ? Boolean(selectedUploadedList || fallbackSelectedCampaignRowId)
        : Boolean(selectedCustomList || fallbackSelectedCampaignRowId);
  const hasPickedUploadFile = Boolean(String(selectedUploadFileName || clientListName || '').trim());
  const clientListActionReady = canContinueClientList || clientListUploading;
  const displayedClientListName = selectedListName || selectedUploadFileName || clientListName || 'No file selected yet';

  const markCampaignListUsed = async (listId, row = null) => {
    const selectedId = String(listId || '').trim();
    if (!selectedId) return { ok: false };
    try {
      const response = await fetch('/api/client-data/use-for-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: selectedId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || 'Failed to select sheet for campaign.');
      }
      setClientListApiSheets((current) => current.map((item) => {
        const itemId = String(item._id || item.id || item.sheetId || item.listId || '');
        return itemId === selectedId
          ? { ...item, lastUsed: payload.lastUsed || new Date().toISOString(), updatedAt: payload.lastUsed || item.updatedAt }
          : item;
      }));
      if (row?.title || payload?.name) {
        onShowMessage?.(`${row?.title || payload.name} selected for campaign.`, 'success');
      }
      return { ok: true, ...payload };
    } catch (error) {
      onShowMessage?.(error?.message || 'Failed to select sheet for campaign.', 'error');
      return { ok: false, error };
    }
  };
  const handleClientListNext = async () => {
    if (clientListUploading) {
      setShowClientListSelectionNote(true);
      onShowMessage?.('File upload is still finishing. Please wait a moment.', 'info');
      return;
    }

    const selectedList =
      clientListTab === 'upload'
        ? (selectedListId || uploadedListId)
        : clientListTab === 'uploaded'
          ? (selectedUploadedList || fallbackSelectedCampaignRowId)
        : clientListTab === 'custom'
          ? (selectedCustomList || fallbackSelectedCampaignRowId)
          : '';

    if (!selectedList) {
      setShowClientListSelectionNote(true);
      onShowMessage?.('No client list selected yet. Please select or upload a file first.', 'warning');
      return;
    }
    setShowClientListSelectionNote(false);
    setOverviewRows([]);
    setColumnMappings([]);
    setSelectedOverviewRowIds([]);
    setSelectedOverviewColumns([]);
    setReviewLocalColumns([]);
    setOverviewSearch('');
    setOverviewFilter('all');
    setEditingCell(null);
    const selectedRow = campaignListRows.find((row) => row.id === selectedList) || null;
    if (selectedRow) {
      const isCustom = ['custom', 'selected_client_sheet', 'custom_client_list', 'manual'].includes(String(selectedRow.kind || '').trim());
      setClientListTab(isCustom ? 'custom' : 'uploaded');
      if (isCustom) {
        setSelectedCustomList(selectedRow.id);
        setSelectedUploadedList('');
      } else {
        setSelectedUploadedList(selectedRow.id);
        setSelectedCustomList('');
      }
    }
    const useResult = await markCampaignListUsed(selectedList, selectedRow);
    if (!useResult.ok) return;
    onSelectList?.(selectedList);
    setClientListRefreshTick((current) => current + 1);
    setWorkflowPosition((current) => Math.max(current, 2));
    setShowClientListPopup(false);
    setShowOverviewPopup(true);
  };

  const formatCampaignListDate = (value, includeTime = false) => {
    if (!value) return 'Not used yet';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not used yet';
    return includeTime
      ? date.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const toggleCampaignListSort = (key) => {
    setClientListSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const selectCampaignListForWorkflow = async (row, options = {}) => {
    if (!row?.id) return;
    const isCustom = ['custom', 'selected_client_sheet', 'custom_client_list', 'manual'].includes(String(row.kind || '').trim());
    setClientListTab(isCustom ? 'custom' : 'uploaded');
    if (isCustom) {
      setSelectedCustomList(row.id);
      setSelectedUploadedList('');
    } else {
      setSelectedUploadedList(row.id);
      setSelectedCustomList('');
    }
    setShowClientListSelectionNote(false);
    const useResult = await markCampaignListUsed(row.id, row);
    if (!useResult.ok) return;
    onSelectList?.(row.id);
    if (options.proceed) {
      setOverviewRows([]);
      setColumnMappings([]);
      setSelectedOverviewRowIds([]);
      setSelectedOverviewColumns([]);
      setReviewLocalColumns([]);
      setOverviewSearch('');
      setOverviewFilter('all');
      setEditingCell(null);
      setClientListRefreshTick((current) => current + 1);
      setWorkflowPosition((current) => Math.max(current, 2));
      setShowClientListPopup(false);
      setShowOverviewPopup(true);
    }
  };

  const handleCampaignListDelete = async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Move "${row.title}" to Trash?`)) return;
    try {
      const response = await fetch(`/api/lists/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || 'Failed to delete sheet.');
      setClientListRefreshTick((current) => current + 1);
      if (selectedCampaignListId === row.id) {
        setSelectedUploadedList('');
        setSelectedCustomList('');
        onSelectList?.('');
      }
      onShowMessage?.(`${row.title} moved to Trash.`, 'success');
    } catch (error) {
      onShowMessage?.(error?.message || 'Failed to delete sheet.', 'error');
    }
  };

  const toggleCampaignListMultiSelect = (rowId) => {
    setClientListMultiSelectedIds((current) => (
      current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]
    ));
    const row = campaignListRows.find((item) => item.id === rowId);
    if (row) {
      const isCustom = ['custom', 'selected_client_sheet', 'custom_client_list', 'manual'].includes(String(row.kind || '').trim());
      setClientListTab(isCustom ? 'custom' : 'uploaded');
      if (isCustom) {
        setSelectedCustomList(row.id);
        setSelectedUploadedList('');
      } else {
        setSelectedUploadedList(row.id);
        setSelectedCustomList('');
      }
      setShowClientListSelectionNote(false);
    }
  };

  const allVisibleCampaignRowsSelected = visibleCampaignListRows.length > 0 && visibleCampaignListRows.every((row) => clientListMultiSelectedIds.includes(row.id));

  const toggleVisibleCampaignRows = () => {
    setClientListMultiSelectedIds((current) => {
      const visibleIds = visibleCampaignListRows.map((row) => row.id);
      return allVisibleCampaignRowsSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleClientListSkip = () => {
    setSelectedUploadedList('');
    setSelectedCustomList('');
    if (!hasShownProceedWithoutListNoteRef.current) {
      hasShownProceedWithoutListNoteRef.current = true;
      setShowProceedWithoutListNote(true);
    }
    setShowClientListPopup(false);
    setShowOverviewPopup(true);
    onShowMessage?.('Proceeding without a client list. You can continue exploring the workflow and choose a list later.', 'info');
  };
  const hasOverviewData = overviewRows.length > 0;
  const reviewDataLoading = Boolean(previewLoading && !hasOverviewData);
  const handleOverviewConfirm = () => {
    if (reviewDataLoading) {
      onShowMessage?.('Selected list data is still loading. Please wait a moment.', 'info');
      return;
    }
    if (!overviewRows.length) {
      if (!hasShownOverviewWarningRef.current) {
        hasShownOverviewWarningRef.current = true;
        setShowOverviewNotice(true);
      } else {
        setShowOverviewNotice(false);
      }
      onShowMessage?.('No data found yet. Please select or upload a client list before continuing.', 'warning');
      return;
    }
    setShowOverviewNotice(false);
    const targetStep = (isNextProcessMode || isBulkReplyMode) ? 4 : 3;
    setWorkflowPosition((current) => Math.max(current, targetStep));
    setShowOverviewPopup(false);
    if (targetStep === 4) {
      setShowSelectDraftPopup(true);
    } else {
      setShowCampaignPopup(true);
    }
  };
  const handleOverviewBack = () => {
    setShowOverviewPopup(false);
    setShowClientListPopup(true);
  };
  const handleOverviewReupload = () => {
    setSelectedUploadedList('');
    setSelectedCustomList('');
    setShowClientListSelectionNote(false);
    setClientListTab('custom');
    setShowOverviewPopup(false);
    setShowClientListPopup(true);
  };
  const handleOverviewNext = () => {
    setShowOverviewNotice(false);
    const targetStep = (isNextProcessMode || isBulkReplyMode) ? 4 : 3;
    setWorkflowPosition((current) => Math.max(current, targetStep));
    setShowOverviewPopup(false);
    if (targetStep === 4) {
      setShowSelectDraftPopup(true);
    } else {
      setShowCampaignPopup(true);
    }
  };
    const campaignMissingFields = [
      !String(effectiveCampaignName || '').trim() ? 'Campaign Name is empty' : null,
      !String(effectiveCampaignSender || '').trim() ? 'Sender is empty' : null
    ].filter(Boolean);
    const hasCampaignRequiredFields = campaignMissingFields.length === 0;
    const draftMissingFields = [
      !String(effectiveDraftSubject || '').trim() ? 'Subject is empty' : null,
      !String(effectiveDraftMessage || '').replace(/<[^>]*>/g, '').trim() ? 'Message is empty' : null,
      !String(selectedDraftType || '').trim() ? 'Draft type is not selected' : null
    ].filter(Boolean);
    const hasSavedDraftSelected = Boolean(activeDraftId || selectedDraftId);
    const hasCreateDraftReady = draftMissingFields.length === 0;
    const hasDraftRequiredFields = selectDraftTab === 'create' ? hasCreateDraftReady : (hasSavedDraftSelected || hasCreateDraftReady);
    const draftContinueHint = selectDraftTab === 'create'
      ? `Please fill: ${draftMissingFields.join(', ')}`
      : hasSavedDraftSelected
        ? ''
        : 'Select required draft first.';
  useEffect(() => {
    if (showDraftContinueWarning && hasDraftRequiredFields) {
      setShowDraftContinueWarning(false);
    }
  }, [hasDraftRequiredFields, showDraftContinueWarning]);
  const normalizedScheduleCountry = String(scheduledCountry || 'India').trim() || 'India';
  const userFacingDurationUnit = normalizeDurationUnit(durationUnit === 'seconds' ? 'minutes' : durationUnit);
  const delayInputLimit = getDelayInputLimit(userFacingDurationUnit);
  const rawDisplayedDelayInterval = durationUnit === 'seconds'
    ? Math.max(1, Math.ceil(Number(delaySeconds || 60) / 60))
    : Number(delaySeconds);
  const displayedDelayInterval = normalizeDelayInputValue(
    rawDisplayedDelayInterval,
    userFacingDurationUnit
  );
  const normalizedRowRange = rowLimitMode === 'custom' ? String(rowRange || '').trim() : '';
  const parsedRowRange = parseRowRangeInput(normalizedRowRange);
  const rowRangeStartValue = parsedRowRange.start || '1';
  const rowRangeEndValue = parsedRowRange.end || rowRangeStartValue;
  useEffect(() => {
    setRowLimitMode(String(rowRange || '').trim() ? 'custom' : 'all');
  }, [rowRange]);
  const handleRowLimitModeChange = (value) => {
    const nextMode = value === 'custom' ? 'custom' : 'all';
    setRowLimitMode(nextMode);
    if (nextMode === 'all') {
      onRowRangeChange?.('');
      return;
    }
    if (!String(rowRange || '').trim()) {
      onRowRangeChange?.('1-1');
    }
  };
  const handleRowRangePartChange = (part, value) => {
    const nextNumber = Math.max(1, Math.floor(Number(value) || 1));
    const currentStart = Math.max(1, Math.floor(Number(rowRangeStartValue) || 1));
    const currentEnd = Math.max(1, Math.floor(Number(rowRangeEndValue) || currentStart));
    let nextStart = part === 'start' ? nextNumber : currentStart;
    let nextEnd = part === 'end' ? nextNumber : currentEnd;
    if (nextStart > nextEnd) {
      if (part === 'start') nextEnd = nextStart;
      else nextStart = nextEnd;
    }
    onRowRangeChange?.(`${nextStart}-${nextEnd}`);
  };
  const scheduleDraftPayload = useMemo(() => {
    const normalizedMode = sendMode === 'scheduled' ? 'scheduled' : 'send_now';
    const normalizedUnit = normalizeDurationUnit(durationUnit === 'seconds' ? 'minutes' : durationUnit);
    const numericBatchSize = Math.max(1, Math.floor(Number(batchSize) || 1));
    const numericDelayInterval = Math.min(
      getDelayInputLimit(normalizedUnit),
      Math.max(
        1,
        Math.floor(durationUnit === 'seconds' ? Math.ceil(Number(delaySeconds || 60) / 60) : Number(delaySeconds) || 1)
      )
    );
    const normalizedScheduledDate = normalizeScheduleDateValue(scheduledDateValue);
    const scheduledAt = normalizedMode === 'scheduled'
      ? buildScheduledDateTimeInZone(normalizedScheduledDate, scheduledTimeValue, scheduleTimezone)
      : null;
    return {
      scheduleMode: normalizedMode,
      batchSize: numericBatchSize,
      rowRange: normalizedRowRange,
      delayInterval: numericDelayInterval,
      durationUnit: normalizedUnit,
      scheduledDate: normalizedScheduledDate,
      scheduledTime: scheduledTimeValue,
      country: normalizedScheduleCountry,
      timezone: scheduleTimezone,
      scheduledAt,
      tracking: {
        enabled: Boolean(campaignTracking.opens || campaignTracking.clicks || campaignTracking.replies),
        opens: Boolean(campaignTracking.opens),
        clicks: Boolean(campaignTracking.clicks),
        replies: Boolean(campaignTracking.replies),
        abTesting: Boolean(campaignAbTesting)
      }
    };
  }, [
    batchSize,
    campaignAbTesting,
    campaignTracking.clicks,
    campaignTracking.opens,
    campaignTracking.replies,
    delaySeconds,
    durationUnit,
    normalizedRowRange,
    scheduleTimezone,
    scheduledCountry,
    scheduledDateValue,
    scheduledTimeValue,
    sendMode
  ]);
  const scheduleMissingFields = [
    !String(batchSize || '').trim() ? 'Batch size is empty' : null,
    Number(batchSize) < 1 ? 'Batch size must be at least 1' : null,
    rowLimitMode === 'custom' && !normalizedRowRange ? 'Sheet row range is empty' : null,
    normalizedRowRange && !isRowRangeInputValid(normalizedRowRange) ? 'Sheet row range must use format like 10-20' : null,
    !String(delaySeconds || '').trim() ? 'Delay interval is empty' : null,
    Number(delaySeconds) < 1 ? 'Delay interval must be at least 1' : null,
    Number(rawDisplayedDelayInterval) > delayInputLimit ? `Delay interval cannot be more than ${delayInputLimit} ${userFacingDurationUnit}` : null,
    !['seconds', 'minutes', 'hours'].includes(normalizeDurationUnit(durationUnit)) ? 'Duration unit is invalid' : null,
    !String(scheduledCountry || '').trim() ? 'Country is empty' : null,
    !String(scheduleTimezone || '').trim() ? 'Time zone is empty' : null,
    sendMode === 'scheduled' && !String(scheduledDateValue || '').trim() ? 'Scheduled date is empty' : null,
    sendMode === 'scheduled' && !String(scheduledTimeValue || '').trim() ? 'Scheduled time is empty' : null,
    sendMode === 'scheduled' && (!scheduleDraftPayload.scheduledAt || !isFutureScheduledDate(scheduleDraftPayload.scheduledAt))
      ? 'Scheduled time must be in future'
      : null
  ].filter(Boolean);
  const hasScheduleRequiredFields = scheduleMissingFields.length === 0;
  const hasScheduleDateAndTime = String(scheduleDraftPayload.scheduledDate || '').trim() && String(scheduleDraftPayload.scheduledTime || '').trim();
  const canAttemptScheduleAction = hasScheduleRequiredFields || Boolean(hasScheduleDateAndTime);
  const scheduleActionLabel = scheduleDraftPayload.scheduleMode === 'scheduled' ? 'Schedule' : 'START';
  const scheduleSaveLabel = 'Save Schedule';
  const scheduleContinueHint = `Please fill: ${scheduleMissingFields.join(', ')} before continuing.`;
  const [showScheduleContinueWarning, setShowScheduleContinueWarning] = useState(false);
  useEffect(() => {
    if (showScheduleContinueWarning && hasScheduleRequiredFields) {
      setShowScheduleContinueWarning(false);
    }
  }, [hasScheduleRequiredFields, showScheduleContinueWarning]);
  useEffect(() => {
    if (!showScheduleSuccessPopup) return undefined;
    const redirectTimer = window.setTimeout(() => {
      setShowScheduleSuccessPopup(false);
      router.push('/dashboard/broadcasts');
    }, 2000);
    return () => window.clearTimeout(redirectTimer);
  }, [router, showScheduleSuccessPopup]);
  const getScheduleValidationError = () => {
    if (!String(effectiveCampaignName || '').trim()) {
      return 'Please enter a campaign name before scheduling.';
    }
    if (!String(selectedListId || uploadedListId || '').trim()) {
      return 'Please select a client list before scheduling.';
    }
    if (!String(selectedSenderAccountId || '').trim()) {
      return 'Please select a sender account before scheduling.';
    }
    if (!String(selectedDraftType || effectiveDraftSubject || '').trim()) {
      return 'Please select a draft before scheduling.';
    }
    if (!String(effectiveDraftSubject || '').trim()) {
      return 'Please enter a draft subject before scheduling.';
    }
    if (!String(effectiveDraftMessage || '').replace(/<[^>]*>/g, ' ').trim()) {
      return 'Please enter draft content before scheduling.';
    }
    if (scheduleDraftPayload.scheduleMode === 'scheduled' && !String(scheduledDateValue || '').trim()) {
      return 'Please select a schedule date before scheduling.';
    }
    if (scheduleDraftPayload.scheduleMode === 'scheduled' && !String(scheduledTimeValue || '').trim()) {
      return 'Please select a schedule time before scheduling.';
    }
    if (scheduleMissingFields.length) {
      return scheduleContinueHint;
    }
    return '';
  };
  const buildScheduleSuccessDetails = (result = {}) => {
    const scheduledValue = scheduleDraftPayload.scheduledAt
      ? new Date(scheduleDraftPayload.scheduledAt).toLocaleString()
      : scheduleDraftPayload.scheduleMode === 'scheduled'
        ? [scheduleDraftPayload.scheduledDate, scheduleDraftPayload.scheduledTime].filter(Boolean).join(' ')
        : 'Send now';
    const recipientCount = Number(
      result?.recipients ||
      result?.recipientCount ||
      result?.data?.recipientCount ||
      result?.data?.pendingCount ||
      overviewRows.length ||
      previewRows.length ||
      0
    );

    return {
      campaignName: String(effectiveCampaignName || result?.campaign?.name || 'Campaign').trim() || 'Campaign',
      project: String(project || 'No project').trim() || 'No project',
      recipients: recipientCount,
      scheduledFor: scheduledValue,
      status: scheduleDraftPayload.scheduleMode === 'scheduled' ? 'Scheduled' : 'Queued'
    };
  };
  const handleScheduleSave = async () => {
    setScheduleInlineNotice(null);
    const validationError = getScheduleValidationError();
    if (validationError) {
      setShowScheduleContinueWarning(true);
      setScheduleInlineNotice({ tone: 'warning', message: validationError });
      onShowMessage?.(validationError, 'warning');
      return;
    }

    try {
      setScheduleInlineNotice({ tone: 'info', message: 'Saving schedule...' });
      onShowMessage?.('Saving schedule...', 'info');
      const result = await onSaveSchedule?.(scheduleDraftPayload);
      if (result?.ok === false) {
        const message = result?.error || result?.message || 'Schedule could not be saved. Please check the required details.';
        setScheduleInlineNotice({ tone: 'error', message });
        onShowMessage?.(message, 'error');
        return;
      }

      const message = scheduleDraftPayload.scheduleMode === 'scheduled'
        ? 'Schedule saved successfully.'
        : 'Send-now settings saved successfully.';
      setScheduleInlineNotice({ tone: 'success', message });
      onShowMessage?.(
        message,
        'success'
      );
    } catch (error) {
      const message = error?.message || 'Failed to save schedule.';
      setScheduleInlineNotice({ tone: 'error', message });
      onShowMessage?.(message, 'error');
    }
  };
  const resetWorkflowAfterCampaignStart = () => {
    // 1. Reset workflow navigation and UI popups
    setWorkflowPosition(1);
    setShowSchedulePopup(false);
    setShowScheduleSuccessPopup(false);
    setShowScheduleContinueWarning(false);
    setScheduleInlineNotice(null);
    setShowCampaignNotice(false);
    setShowClientListPopup(false);
    setShowOverviewPopup(false);
    setShowCampaignPopup(false);
    setShowSelectDraftPopup(false);
    setShowDraftSummaryPopup(false);
    setShowTestEmailPopup(false);
    setSelectedDraftId('');
    setTestEmailSent(false);
    setTestEmailError('');

    // 2. Reset process modes and refs
    setIsNextProcessMode(false);
    setIsBulkReplyMode(false);
    if (pendingSenderEmailRef) pendingSenderEmailRef.current = null;
    if (pendingSenderIdRef) pendingSenderIdRef.current = null;

    // 3. Reset list/upload states
    setSelectedUploadedList('');
    setSelectedCustomList('');
    setClientListName('');
    setSelectedUploadFileName('');
    setUploadedListId('');
    onSelectList?.('');

    // 4. Reset review / spreadsheet states
    setOverviewRows([]);
    setSelectedOverviewRowIds([]);
    setReviewLocalColumns([]);

    // 5. Reset campaign setup states
    setCampaignName('');
    onCampaignNameChange?.('');
    setCampaignDescription('');
    setCampaignTags([]);
    setCampaignTagDraft('');
    setCampaignProjectFilter('');
    onSelectProject?.('');
    setCampaignSender('');
    onSelectSenderAccount?.('');

    // 6. Reset draft / template states
    onSelectedDraftTypeChange?.('');
    onDraftSubjectChange?.('');
    onDraftBodyChange?.('');
    setDraftSubject('');
    setDraftMessage('');

    // 7. Reset schedule states
    setSendMode('send_now');
    setScheduledDateValue('');
    setScheduledTimeValue('');
  };
  const handleScheduleStart = async () => {
    setScheduleInlineNotice(null);
    const validationError = getScheduleValidationError();
    if (validationError) {
      setShowScheduleContinueWarning(true);
      setScheduleInlineNotice({ tone: 'warning', message: validationError });
      onShowMessage?.(validationError, 'warning');
      return;
    }

    try {
      const settings = JSON.parse(window.localStorage.getItem('mailpilot:workspace-settings') || '{}');
      if (settings.confirmBeforeStart !== false) {
        const action = scheduleDraftPayload.scheduleMode === 'scheduled' ? 'schedule this campaign' : 'start sending this campaign now';
        if (!window.confirm(`Are you sure you want to ${action}?`)) {
          setScheduleInlineNotice({ tone: 'info', message: 'Campaign start cancelled.' });
          return;
        }
      }
    } catch {
      // Continue with the normal start flow when browser storage is unavailable.
    }

    try {
      setScheduleInlineNotice({
        tone: 'info',
        message: scheduleDraftPayload.scheduleMode === 'scheduled'
          ? 'Scheduling campaign...'
          : 'Starting campaign...'
      });
      onShowMessage?.(
        scheduleDraftPayload.scheduleMode === 'scheduled'
          ? 'Scheduling campaign...'
          : 'Starting campaign...',
        'info'
      );
      const result = await onStartCampaign?.(scheduleDraftPayload);
      if (result?.ok === false) {
        const message = result?.error || result?.message || 'Campaign could not be scheduled. Please check the required details.';
        setScheduleInlineNotice({ tone: 'error', message });
        onShowMessage?.(message, 'error');
        return;
      }

      const details = buildScheduleSuccessDetails(result);
      setScheduleSuccessDetails(details);
      resetWorkflowAfterCampaignStart();
      onCampaignStartSuccess?.(result);
      onShowMessage?.(
        scheduleDraftPayload.scheduleMode === 'scheduled'
          ? `Campaign Scheduled Successfully - Your campaign has been scheduled. Campaign: ${details.campaignName}. Scheduled Time: ${details.scheduledFor}. Recipients: ${details.recipients}.`
          : `Campaign started successfully. Campaign: ${details.campaignName}. Recipients: ${details.recipients}.`,
        'success'
      );

      // Auto-refresh and completely end the process by redirecting to the clean dashboard URL
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard/user';
        }
      }, 1500);
    } catch (error) {
      const message = error?.message || 'Failed to schedule campaign.';
      setScheduleInlineNotice({ tone: 'error', message });
      onShowMessage?.(message, 'error');
    }
  };
  const handleCampaignContinue = () => {
    if (!hasCampaignRequiredFields) {
      if (!hasShownCampaignMissingWarningRef.current) {
        hasShownCampaignMissingWarningRef.current = true;
        setShowCampaignNotice(true);
      } else {
        setShowCampaignNotice(false);
      }
      onShowMessage?.(`Please fill: ${campaignMissingFields.join(', ')} before continuing.`, 'warning');
      return;
    }
    setShowCampaignNotice(false);
    setWorkflowPosition((current) => Math.max(current, 4));
    setShowCampaignPopup(false);
    setShowSelectDraftPopup(true);
  };

  const closeWorkflowPopups = () => {
    setShowCampaignNotice(false);
    setShowClientListPopup(false);
    setShowOverviewPopup(false);
    setShowCampaignPopup(false);
    setShowSelectDraftPopup(false);
    setShowDraftSummaryPopup(false);
    setShowTestEmailPopup(false);
    setShowSchedulePopup(false);
  };

  const openWorkflowStep = (stepValue) => {
    closeWorkflowPopups();
    const step = Number(stepValue || 0);
    if (step <= 1) {
      setShowClientListPopup(true);
      return;
    }
    if (step === 2) {
      setShowOverviewPopup(true);
      return;
    }
    if (step === 3) {
      setShowCampaignPopup(true);
      return;
    }
    if (step === 4) {
      setShowDraftContinueWarning(false);
      setShowSelectDraftPopup(true);
      return;
    }
    if (step === 5) {
      setShowDraftSummaryPopup(true);
      return;
    }
    if (step === 6) {
      setShowTestEmailPopup(true);
      return;
    }
    setShowSchedulePopup(true);
  };

  useEffect(() => {
    const handleOpenWorkflowStep = (event) => {
      const rawStep = event?.detail?.step ?? event?.detail?.index ?? event?.detail;
      const step = Math.max(1, Math.min(workflowStepCount, Number(rawStep) || 1));
      setWorkflowPosition((current) => Math.max(current, step));
      openWorkflowStep(step);
    };

    window.addEventListener('dashboard:open-workflow-step', handleOpenWorkflowStep);
    return () => window.removeEventListener('dashboard:open-workflow-step', handleOpenWorkflowStep);
  }, [workflowStepCount]);
  const resumeCampaignDraft = (campaign) => {
    if (!campaign) return;
    const isNextProcess = Boolean(campaign.nextProcessMode);
    const isBulkReply = Boolean(campaign.isBulkReply);
    const nextDraftType = normalizeDraftType(campaign.nextDraftType || campaign.draftType || campaign.type || '');
    const nextDraft = isNextProcess && nextDraftType
      ? effectiveSavedDrafts.find((draft) => normalizeDraftType(draft.draftType || draft.category || '') === nextDraftType)
      : null;
    const campaignSenderFrom = String(campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user || '').trim().toLowerCase();
    const rawSenderId = String(campaign.senderAccountId || campaign.senderAccount?._id || campaign.senderAccount?.id || '');

    // Store in refs to handle async loading of senderAccounts
    pendingSenderEmailRef.current = campaignSenderFrom || null;
    pendingSenderIdRef.current = rawSenderId || null;

    setIsNextProcessMode(isNextProcess);
    setIsBulkReplyMode(isBulkReply);
    setSourceCampaignId(campaign.sourceCampaignId || '');
    setThreadMetadata(campaign.threadMetadata || {});
    setSheetMissing(Boolean(campaign.sheetMissing));
    setCanReuseSheet(Boolean(campaign.canReuseSheet));
    setSenderActive(Boolean(campaign.senderActive !== false));
    setCanReuseSender(Boolean(campaign.canReuseSender !== false));
    setOriginalCampaignName(campaign.bulkReplySourceCampaignName || campaign.name || '');
    setOriginalSheetName(campaign.customSheetName || '');
    setOriginalRecipientCount(campaign.recipients?.length || 0);

    if (Array.isArray(campaign.recipients) && campaign.recipients.length > 0) {
      const recs = campaign.recipients.map((r, idx) => ({
        id: r.id || r._id || String(idx),
        Name: r.Name || r.name || '',
        Email: r.Email || r.email || '',
        Company: r.Company || r.company || '',
        Designation: r.Designation || r.designation || '',
        Sector: r.Sector || r.sector || '',
        Country: r.Country || r.country || '',
        ...r
      }));
      setOverviewRows(recs);
      
      const firstRec = recs[0];
      const cols = Array.from(new Set(Object.keys(firstRec).filter(k => k !== 'id' && k !== '_id')));
      setColumnMappings(
        cols.map((column) => {
          return {
            sheetColumn: column,
            mappedField: /email/i.test(column)
              ? 'Email'
              : /name/i.test(column)
                ? 'Name'
                : /company/i.test(column)
                  ? 'Company'
                  : /designation|title/i.test(column)
                    ? 'Designation'
                    : /sector/i.test(column)
                      ? 'Sector'
                      : /country/i.test(column)
                        ? 'Country'
                        : 'Ignore'
          };
        })
      );
    }

    const campaignProject = String(campaign.project || campaign.projectId || campaign.projectName || '').trim().toLowerCase();
    if (campaignProject) {
      onSelectProject?.(campaignProject);
      setCampaignProjectFilter(campaignProject);
    }

    const matchedSenderAccount = campaignSenderFrom
      ? senderAccounts.find((account) => String(account?.from || '').trim().toLowerCase() === campaignSenderFrom)
      : null;
    onCampaignNameChange?.(String(campaign.name || ''));
    onSelectList?.(String(campaign.listId || ''));
    
    const resolvedSenderId = matchedSenderAccount?.id || rawSenderId;
    onSelectSenderAccount?.(resolvedSenderId);
    onSelectedDraftTypeChange?.(nextDraftType);
    if (isNextProcess) {
      if (nextDraft) {
        loadDraftIntoEditor(nextDraft);
      } else if (!applyTemplateDraft(nextDraftType)) {
        onDraftSubjectChange?.('');
        onDraftBodyChange?.('');
      }
    } else {
      onDraftSubjectChange?.(String(campaign.inlineTemplate?.subject || ''));
      onDraftBodyChange?.(String(campaign.inlineTemplate?.bodyHtml || campaign.inlineTemplate?.body || ''));
    }
    onBatchSizeChange?.(String(campaign.options?.batchSize || '1'));
    onRowRangeChange?.(String(campaign.options?.rowRange || ''));
    onDelaySecondsChange?.(String(campaign.options?.delayInterval ?? campaign.options?.delaySeconds ?? '60'));
    setDurationUnit(normalizeDurationUnit(campaign.options?.durationUnit || 'seconds'));
    setCampaignTracking({
      opens: Boolean(campaign?.tracking?.opens),
      clicks: Boolean(campaign?.tracking?.clicks),
      replies: Boolean(campaign?.tracking?.replies)
    });
    setShowCampaignNotice(false);
    const resumeWorkflowStep = Math.max(
      1,
      Math.min(workflowStepCount + 1, Number(campaign.workflowOpenStep || campaign.workflowStep || 3) || 3)
    );
    setWorkflowPosition(resumeWorkflowStep);
    openWorkflowStep(resumeWorkflowStep);
    onShowMessage?.(
      isNextProcess
        ? `${campaign.workflowStepLabel || 'Next mail'} is ready. Review the draft and continue.`
        : `Resuming draft from ${campaign.workflowStepLabel || `Step ${campaign.workflowStep || 1}`}.`,
      'info'
    );
  };

  useEffect(() => {
    const handleResumeDraft = (event) => {
      const campaign = event?.detail?.campaign || event?.detail || null;
      if (!campaign) return;
      resumeCampaignDraft(campaign);
    };

    window.addEventListener('dashboard:resume-campaign-draft', handleResumeDraft);
    return () => window.removeEventListener('dashboard:resume-campaign-draft', handleResumeDraft);
  }, [
    onBatchSizeChange,
    onCampaignNameChange,
    onDelaySecondsChange,
    onDraftBodyChange,
    onDraftSubjectChange,
    onSelectSenderAccount,
    onSelectList,
    onSelectedDraftTypeChange,
    onShowMessage,
    effectiveSavedDrafts,
    senderAccounts,
    workflowStepCount
  ]);
  useEffect(() => {
    if (selectedListId) {
      setUploadedListId(selectedListId);
      setClientListUploading(false);
      setShowClientListSelectionNote(false);
      setReviewLocalColumns([]);
    }
  }, [selectedListId]);

  const handlePremiumShellUpload = async (event) => {
    const file = event.target?.files?.[0];
    if (file) {
      setSelectedUploadFileName(file.name);
      setClientListName((current) => current || file.name);
      setClientListUploading(true);
      setShowClientListSelectionNote(false);
      onShowMessage?.(`${file.name} selected.`, 'success');
    }
    try {
      const result = await Promise.resolve(onUploadFile?.(event));
      const nextListId = String(result?.listId || result?.id || result?._id || '').trim();
      if (nextListId) {
        setUploadedListId(nextListId);
        setSelectedUploadedList(nextListId);
        setSelectedCustomList('');
        setClientListTab('uploaded');
        setClientListRefreshTick((current) => current + 1);
        onSelectList?.(nextListId);
        setShowClientListSelectionNote(false);
      } else if (result?.ok === false) {
        setUploadedListId('');
        setShowClientListSelectionNote(true);
      }
    } finally {
      setClientListUploading(false);
    }
  };
  const handleCampaignListDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    setClientListTab('upload');
    handlePremiumShellUpload({ target: { files: [file], value: '' } });
  };
  const updateOverviewCell = (rowId, field, value) => {
    setOverviewRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };
  const reviewColumnKeyMap = useMemo(() => {
    const availableColumns = new Set([
      ...columnMappings.map((item) => item.sheetColumn),
      ...overviewRows.flatMap((row) => Object.keys(row || {}))
    ]);
    return REVIEW_TABLE_COLUMNS.reduce((acc, column) => {
      const matched = [column.key, ...(column.aliases || [])].find((alias) => availableColumns.has(alias));
      acc[column.key] = matched || column.key;
      return acc;
    }, {});
  }, [columnMappings, overviewRows]);
  const reviewNormalizedRows = useMemo(() => overviewRows.map((row) => {
    const normalized = { id: row.id };
    REVIEW_TABLE_COLUMNS.forEach((column) => {
      normalized[column.key] = row?.[reviewColumnKeyMap[column.key]] ?? row?.[column.key] ?? '';
    });
    return normalized;
  }), [overviewRows, reviewColumnKeyMap]);
  const reviewIssueMap = useMemo(() => {
    const fromApi = {};
    (reviewValidation?.rowIssues || []).forEach((item) => {
      fromApi[item.rowNumber] = item.issues || [];
    });
    if (Object.keys(fromApi).length) return fromApi;
    const emailCounts = reviewNormalizedRows.reduce((acc, row) => {
      const email = String(row.Email || '').trim().toLowerCase();
      if (email) acc[email] = (acc[email] || 0) + 1;
      return acc;
    }, {});
    return reviewNormalizedRows.reduce((acc, row, index) => {
      const issues = [];
      const email = String(row.Email || '').trim().toLowerCase();
      if (!email) issues.push('missing-email');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) issues.push('invalid-email');
      if (email && emailCounts[email] > 1) issues.push('duplicate');
      if (REVIEW_REQUIRED_COLUMNS.some((field) => !String(row[field] || '').trim())) issues.push('missing-required');
      acc[index + 1] = issues;
      return acc;
    }, {});
  }, [reviewNormalizedRows, reviewValidation]);
  const reviewStats = useMemo(() => {
    if (reviewValidation?.ok) return reviewValidation;
    const totalRecords = reviewNormalizedRows.length;
    const duplicateRows = reviewNormalizedRows.filter((_, index) => (reviewIssueMap[index + 1] || []).includes('duplicate')).length;
    const missingEmails = reviewNormalizedRows.filter((_, index) => (reviewIssueMap[index + 1] || []).includes('missing-email')).length;
    const invalidEmails = reviewNormalizedRows.filter((_, index) => (reviewIssueMap[index + 1] || []).includes('invalid-email')).length;
    const otherMissing = reviewNormalizedRows.filter((_, index) => (reviewIssueMap[index + 1] || []).includes('missing-required')).length;
    return {
      ok: true,
      totalRecords,
      validRecords: Math.max(0, totalRecords - missingEmails - invalidEmails - duplicateRows - otherMissing),
      missingEmails,
      duplicates: duplicateRows,
      invalidEmails,
      otherMissing,
      processedPercent: totalRecords ? 100 : 0,
      columnCounts: {},
      checks: {
        emailFormat: { valid: Math.max(0, totalRecords - missingEmails - invalidEmails), invalid: invalidEmails },
        duplicateEmail: { duplicates: duplicateRows },
        requiredFields: { missing: missingEmails + otherMissing },
        dataConsistency: { ok: true }
      }
    };
  }, [reviewIssueMap, reviewNormalizedRows, reviewValidation]);
  const campaignAudienceSummary = useMemo(() => {
    const total = Number(reviewStats.totalRecords || overviewRows.length || previewRows.length || 0);
    const valid = Number(reviewStats.validRecords || Math.max(0, total - Number(reviewStats.missingEmails || 0) - Number(reviewStats.duplicates || 0) - Number(reviewStats.invalidEmails || 0)));
    const missing = Number(reviewStats.missingEmails || 0);
    const duplicates = Number(reviewStats.duplicates || 0);
    const invalid = Number(reviewStats.invalidEmails || 0);
    const blocked = Math.max(0, Number(reviewStats.otherMissing || 0) - missing);
    const bounceRisk = Math.max(0, invalid + Math.ceil(duplicates * 0.25));
    const percent = (value) => total ? `${((Number(value || 0) / total) * 100).toFixed(2)}%` : '0%';
    return { total, valid, missing, duplicates, invalid, blocked, bounceRisk, percent };
  }, [overviewRows.length, previewRows.length, reviewStats]);
  const campaignAudienceChart = useMemo(() => {
    const total = Math.max(1, campaignAudienceSummary.total);
    const valid = (campaignAudienceSummary.valid / total) * 100;
    const missing = valid + (campaignAudienceSummary.missing / total) * 100;
    const duplicate = missing + (campaignAudienceSummary.duplicates / total) * 100;
    const invalid = duplicate + (campaignAudienceSummary.invalid / total) * 100;
    return `conic-gradient(#16a34a 0 ${valid}%, #f97316 ${valid}% ${missing}%, #ef4444 ${missing}% ${duplicate}%, #dc2626 ${duplicate}% ${invalid}%, #64748b ${invalid}% 100%)`;
  }, [campaignAudienceSummary]);
  const campaignSelectedListMeta = useMemo(() => {
    const updatedRaw = selectedCampaignListRow?.updatedAt || selectedCampaignListRow?.lastUsed || selectedCampaignListRow?.createdAt || '';
    const updatedDate = updatedRaw ? new Date(updatedRaw) : null;
    const updatedLabel = updatedDate && !Number.isNaN(updatedDate.getTime())
      ? updatedDate.toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Not available';
    return {
      title: selectedCampaignListRow?.title || selectedClientListSummary.title || selectedListName || 'Selected client list',
      project: selectedCampaignListRow?.project || project || campaignProjectFilter || 'Project',
      source: selectedCampaignListRow?.source || selectedCampaignListRow?.sourceType || selectedClientListSummary.subtitle || 'Saved List',
      updatedLabel
    };
  }, [campaignProjectFilter, project, selectedCampaignListRow, selectedClientListSummary.subtitle, selectedClientListSummary.title, selectedListName]);
  const campaignSenderHealth = useMemo(() => {
    if (!selectedCampaignSenderAccount) return { label: 'Warmup Required', tone: 'warn', score: 62, spamRisk: 'Medium' };
    const rawStatus = String(selectedCampaignSenderAccount.status || selectedCampaignSenderAccount.health || '').toLowerCase();
    const isHealthy = rawStatus.includes('active') || rawStatus.includes('healthy') || selectedCampaignSenderAccount.connected !== false;
    return isHealthy
      ? { label: 'Healthy', tone: 'good', score: 94, spamRisk: 'Low' }
      : { label: 'Warmup Required', tone: 'warn', score: 58, spamRisk: 'Medium' };
  }, [selectedCampaignSenderAccount]);
  const campaignEstimatedDailyLimit = Math.max(1, Number(batchSize || 1));
  const campaignEstimatedDelay = Math.max(1, Number(displayedDelayInterval || 1));
  const campaignEstimatedDays = Math.max(1, Math.ceil((campaignAudienceSummary.valid || 1) / campaignEstimatedDailyLimit));
  const campaignEstimatedDurationLabel = `${campaignEstimatedDays} day${campaignEstimatedDays === 1 ? '' : 's'}`;
  const campaignEstimatedCredits = Math.max(0, campaignAudienceSummary.valid);
  const campaignBatchRecommendation = Math.max(10, Math.min(500, Math.ceil((campaignAudienceSummary.valid || campaignEstimatedDailyLimit || 1) / Math.max(1, campaignEstimatedDays))));
  const scheduleReadyCount = Math.max(0, Number(campaignAudienceSummary.valid || 0));
  const scheduleInvalidCount = Math.max(
    0,
    Number(campaignAudienceSummary.missing || 0) + Number(campaignAudienceSummary.invalid || 0) + Number(campaignAudienceSummary.duplicates || 0)
  );
  const scheduleDelayMinutes = userFacingDurationUnit === 'hours'
    ? Math.max(1, Number(displayedDelayInterval || 1)) * 60
    : Math.max(1, Number(displayedDelayInterval || 1));
  const scheduleBatchDelayMinutes = scheduleDelayBatchUnit === 'hours'
    ? Math.max(0, Number(scheduleDelayBetweenBatches || 0)) * 60
    : Math.max(0, Number(scheduleDelayBetweenBatches || 0));
  const scheduleDailyLimitNumber = Math.max(1, Number(scheduleDailyLimit || campaignEstimatedDailyLimit || 1));
  const scheduleBatchCount = Math.max(1, Math.ceil((scheduleReadyCount || 1) / Math.max(1, Number(batchSize) || 1)));
  const scheduleTotalMinutes = Math.max(
    1,
    Math.ceil((scheduleReadyCount || 1) * scheduleDelayMinutes + Math.max(0, scheduleBatchCount - 1) * scheduleBatchDelayMinutes)
  );
  const scheduleLimitDays = Math.max(1, Math.ceil((scheduleReadyCount || 1) / scheduleDailyLimitNumber));
  const scheduleDurationHours = Math.floor(scheduleTotalMinutes / 60);
  const scheduleDurationRemainder = scheduleTotalMinutes % 60;
  const scheduleDurationLabel = scheduleLimitDays > 1
    ? `${scheduleLimitDays} days`
    : `${scheduleDurationHours} hours ${scheduleDurationRemainder} minutes`;
  const scheduleProjectLabel = campaignSelectedListMeta.project || campaignProjectFilter || project || 'No project';
  const scheduleDraftLabel = selectedSavedDraft?.title || selectedDraftTypeLabel || effectiveDraftSubject || 'Selected draft';
  const scheduleSenderLabel = `${draftSummarySenderName} <${draftSummarySenderEmail}>`;
  const openScheduleFullPreview = () => {
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(testPreviewHtml || effectiveDraftMessage || '<p>No preview available.</p>');
      win.document.close();
    }
  };
  const runReviewValidation = useCallback(async (rows = overviewRows) => {
    if (!showOverviewPopup && rows === overviewRows) return;
    setReviewValidationLoading(true);
    try {
      const response = await fetch('/api/client-data/validate-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId: selectedListId, rows })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || 'Validation failed.');
      setReviewValidation(payload);
      return payload;
    } catch (error) {
      onShowMessage?.(error?.message || 'Failed to validate list.', 'error');
      return null;
    } finally {
      setReviewValidationLoading(false);
    }
  }, [onShowMessage, overviewRows, selectedListId, showOverviewPopup]);
  useEffect(() => {
    if (!showOverviewPopup) return undefined;
    const timer = window.setTimeout(() => {
      runReviewValidation(overviewRows);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [overviewRows, runReviewValidation, showOverviewPopup]);
  useEffect(() => {
    setReviewPage(1);
  }, [overviewSearch, reviewRowsPerPage, reviewTab, reviewColumnFilter]);
  const reviewFilteredRows = useMemo(() => {
    const query = overviewSearch.trim().toLowerCase();
    return reviewNormalizedRows.filter((row, index) => {
      const issues = reviewIssueMap[index + 1] || [];
      const matchesTab =
        reviewTab === 'all' ||
        (reviewTab === 'invalid' && issues.some((issue) => ['missing-email', 'invalid-email', 'missing-required'].includes(issue))) ||
        (reviewTab === 'duplicates' && issues.includes('duplicate'));
      const searchableValues = reviewColumnFilter === 'all'
        ? REVIEW_TABLE_COLUMNS.map((column) => row[column.key])
        : [row[reviewColumnFilter]];
      const matchesSearch = !query || searchableValues.join(' ').toLowerCase().includes(query);
      return matchesTab && matchesSearch;
    });
  }, [overviewSearch, reviewColumnFilter, reviewIssueMap, reviewNormalizedRows, reviewTab]);
  const reviewTotalPages = Math.max(1, Math.ceil(reviewFilteredRows.length / reviewRowsPerPage));
  const reviewCurrentPage = Math.min(reviewPage, reviewTotalPages);
  const reviewPagedRows = useMemo(() => {
    const start = (reviewCurrentPage - 1) * reviewRowsPerPage;
    return reviewFilteredRows.slice(start, start + reviewRowsPerPage);
  }, [reviewCurrentPage, reviewFilteredRows, reviewRowsPerPage]);
  const reviewVisibleRowIds = reviewPagedRows.map((row) => row.id);
  const allReviewVisibleRowsSelected =
    reviewVisibleRowIds.length > 0 && reviewVisibleRowIds.every((id) => selectedOverviewRowIds.includes(id));
  const getReviewFieldKey = (columnKey) => reviewColumnKeyMap[columnKey] || columnKey;
  const handleReviewCellChange = (rowId, columnKey, value) => {
    const field = getReviewFieldKey(columnKey);
    updateOverviewCell(rowId, field, value);
    onPreviewCellChange?.(rowId - 1, field, value);
  };
  const toggleAllReviewVisibleRows = () => {
    setSelectedOverviewRowIds((current) =>
      allReviewVisibleRowsSelected
        ? current.filter((id) => !reviewVisibleRowIds.includes(id))
        : Array.from(new Set([...current, ...reviewVisibleRowIds]))
    );
  };
  const handleDeleteReviewRow = (rowId) => {
    onPreviewDeleteRow?.(rowId - 1);
    setOverviewRows((current) => current.filter((row) => row.id !== rowId).map((row, index) => ({ ...row, id: index + 1 })));
    setSelectedOverviewRowIds((current) => current.filter((id) => id !== rowId));
  };
  const handleQuickAddClient = () => {
    const email = quickClientDraft.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      onShowMessage?.('Enter a valid email before adding the client.', 'warning');
      return;
    }
    const nextRow = {
      [getReviewFieldKey('Name')]: quickClientDraft.firstName.trim(),
      [getReviewFieldKey('Surname')]: quickClientDraft.lastName.trim(),
      [getReviewFieldKey('Email')]: email,
      [getReviewFieldKey('Company Name')]: quickClientDraft.company.trim(),
      [getReviewFieldKey('Source')]: 'Manual'
    };
    const nextId = overviewRows.length + 1;
    setOverviewRows((current) => [...current, { id: nextId, ...nextRow }]);
    onPreviewAddRow?.(null, nextRow);
    setQuickClientDraft({ firstName: '', lastName: '', email: '', company: '' });
    onShowMessage?.('Client added to the selected list. Save changes to persist it.', 'success');
  };
  const handleBulkEditSelected = () => {
    if (!selectedOverviewRowIds.length || !reviewBulkColumn || !reviewBulkValue.trim()) return;
    const field = getReviewFieldKey(reviewBulkColumn);
    selectedOverviewRowIds.forEach((rowId) => {
      updateOverviewCell(rowId, field, reviewBulkValue);
      onPreviewCellChange?.(rowId - 1, field, reviewBulkValue);
    });
    setReviewBulkValue('');
    onShowMessage?.('Selected rows updated. Save changes to persist them.', 'success');
  };
  const parseReviewCsv = (text = '') => {
    const rows = text.split(/\r?\n/).filter((line) => line.trim());
    if (rows.length < 2) return [];
    const parseLine = (line) => line.match(/("([^"]|"")*"|[^,]+)/g)?.map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) || [];
    const headers = parseLine(rows[0]);
    return rows.slice(1).map((line) => {
      const values = parseLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    });
  };
  const handleReviewImportRows = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const importedRows = parseReviewCsv(text);
    if (!importedRows.length) {
      onShowMessage?.('No rows found in the imported file.', 'warning');
      return;
    }
    setOverviewRows((current) => [
      ...current,
      ...importedRows.map((row, index) => ({ id: current.length + index + 1, ...row }))
    ]);
    importedRows.forEach((row) => onPreviewAddRow?.(null, row));
    onShowMessage?.(`${importedRows.length} rows imported. Save changes to persist them.`, 'success');
  };
  const handleReviewExportRows = () => {
    const columns = REVIEW_TABLE_COLUMNS.map((column) => column.key);
    const lines = [
      columns.join(','),
      ...reviewNormalizedRows.map((row) => columns.map((column) => `"${String(row[column] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedClientListSummary.title || 'review-list'}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const handleReviewSave = async () => {
    await onPreviewSave?.();
    await runReviewValidation(overviewRows);
  };
  const campaignTagSuggestions = useMemo(() => {
    const normalizeSearchText = (value = '') => String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const query = normalizeSearchText(campaignTagDraft);
    const queryParts = query.split(/\s+/).filter(Boolean);
    if (!queryParts.length) return [];

    const allowedFields = ['Sector', 'Country'];
    const rows = overviewRows.length ? overviewRows : previewRows;
    const selectedTags = new Set(campaignTags.map((tag) => String(tag || '').trim().toLowerCase()));
    const blockedUiSuggestionValues = new Set([
      'client data',
      'upload file',
      'customize list',
      'bin storage',
      'client list',
      'choose xlsx / csv',
      'saved sheets',
      'paste extracted data',
      'close',
      'save pasted data',
      'create row',
      'add column',
      'rename column',
      'delete column',
      'create custom list/sheet',
      'delete selected rows',
      'clear all'
    ]);
    const directKeyAliases = {
      Sector: ['Sector', 'sector', 'Industry', 'industry'],
      Country: ['Country', 'country', 'Country Name', 'countryName', 'Nation', 'nation', 'Location', 'location', 'Region', 'region']
    };

    const readFieldValue = (row, label) => {
      const mappedColumn = columnMappings.find((item) => String(item.mappedField || '').toLowerCase() === label.toLowerCase());
      const mappedValue = mappedColumn ? row?.[mappedColumn.sheetColumn] : '';
      if (String(mappedValue || '').trim()) return String(mappedValue).trim();
      for (const key of directKeyAliases[label] || [label]) {
        if (String(row?.[key] || '').trim()) return String(row[key]).trim();
      }
      return '';
    };

    const suggestions = [];
    const seen = new Set();
    const addSuggestion = (label, value, aliases = []) => {
      const cleanValue = String(value || '').trim();
      const searchableValue = normalizeSearchText([cleanValue, ...aliases].join(' '));
      if (!cleanValue || !queryParts.every((part) => searchableValue.includes(part))) return;
      if (blockedUiSuggestionValues.has(cleanValue.toLowerCase())) return;
      const key = `${label}:${cleanValue}`.toLowerCase();
      if (seen.has(key) || selectedTags.has(cleanValue.toLowerCase())) return;
      seen.add(key);
      suggestions.push({ label, value: cleanValue });
    };

    for (const row of rows) {
      for (const label of allowedFields) {
        addSuggestion(label, readFieldValue(row, label));
      }
    }
    for (const sector of MAGAZINE_SECTORS) {
      addSuggestion('Sector', sector);
    }
    for (const [index, country] of CAMPAIGN_COUNTRIES.entries()) {
      addSuggestion('Country', country, [COUNTRY_CODES[index]]);
    }
    return suggestions.sort((left, right) => {
      const labelOrder = { Sector: 0, Country: 1 };
      if (left.label !== right.label) return labelOrder[left.label] - labelOrder[right.label];
      const leftStarts = normalizeSearchText(left.value).startsWith(query);
      const rightStarts = normalizeSearchText(right.value).startsWith(query);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return left.value.localeCompare(right.value);
    });
  }, [campaignTagDraft, campaignTags, columnMappings, overviewRows, previewRows]);
  useEffect(() => {
    if (activeCampaignTagSuggestion < 0) return;
    campaignTagSuggestionsRef.current
      ?.querySelector(`[data-suggestion-index="${activeCampaignTagSuggestion}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeCampaignTagSuggestion, campaignTagSuggestions.length]);
  useEffect(() => {
    const closeCampaignTagSuggestions = (event) => {
      if (!campaignTagsRef.current?.contains(event.target)) {
        setShowCampaignTagSuggestions(false);
        setActiveCampaignTagSuggestion(-1);
      }
    };
    document.addEventListener('mousedown', closeCampaignTagSuggestions);
    return () => document.removeEventListener('mousedown', closeCampaignTagSuggestions);
  }, []);
  const removeCampaignTag = (tagToRemove) => {
    setCampaignTags((current) => current.filter((tag) => tag !== tagToRemove));
  };
  const addCampaignTag = (value = campaignTagDraft) => {
    const nextTag = String(value || '').trim();
    if (!nextTag) return;
    if (!campaignTags.includes(nextTag)) {
      setCampaignTags((current) => [...current, nextTag]);
    }
    setCampaignTagDraft('');
    setShowCampaignTagSuggestions(false);
    setActiveCampaignTagSuggestion(-1);
  };
  const importDraftToEditor = () => {
    const html = String(draftViewerText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br/>');
    const next = html ? `<div style="font-family:Inter, 'Segoe UI', Arial, sans-serif;font-size:15px;line-height:1.6;">${html}</div>` : '';
    if (onDraftBodyChange) {
      onDraftBodyChange(next);
      return;
    }
    setDraftMessage(next);
  };
  const handleProgressFilterSelect = (value) => {
    setShowProgressFilterDropdown(false);
    if (value === 'customize') {
      onOpenReportRangePopup?.();
      return;
    }
    onApplyReportRange?.(value);
    onShowMessage?.(`Selected ${ProgressFilterOptionLabel(value)} filter.`, 'info');
  };

  const handleAddProgressFilterOption = () => {
    const label = String(window.prompt('Enter filter label', '') || '').trim();
    if (!label) return;
    const value = String(window.prompt('Enter filter value key', label.toLowerCase().replace(/\s+/g, '-')) || '').trim();
    if (!value) return;
    setProgressFilterOptions((prev) => (prev.some((item) => item.value === value) ? prev : [...prev, { label, value }]));
    onShowMessage?.(`Added ${label} filter option.`, 'success');
  };

  const referenceWorkflowSteps = [
    { index: 1, title: 'Upload List', action: 'Upload List', button: 'Upload List', icon: 'ti-upload' },
    { index: 2, title: 'Review', action: 'Review List', button: 'Review List', icon: 'ti-users' },
    { index: 3, title: 'Campaign', action: 'Campaign', button: 'Campaign', icon: 'ti-megaphone' },
    { index: 4, title: 'Drafts', action: 'Select Draft', button: 'Select Draft', icon: 'ti-file-text' },
    { index: 5, title: 'Draft Summary', action: 'Draft Summary', button: 'Summary', icon: 'ti-layout-list' },
    { index: 6, title: 'Test Email', action: 'Test Email', button: 'Test Email', icon: 'ti-mail-check' },
    { index: 7, title: 'Schedule', action: 'Schedule', button: 'Schedule', icon: 'ti-calendar-event' }
  ];

  const referenceCampaignRows = [
    { id: 'robotics-leaders', name: 'Robotics Leaders Outreach', type: 'Cold Email', project: 'TEC', status: 'Running', recipients: '500', sent: '320', openRate: '48.2%', replyRate: '6.8%', scheduledOn: '12 Jun 2026, 09:00 AM' },
    { id: 'ai-startups-follow-up', name: 'AI Startups - Follow Up', type: 'Follow Up', project: 'TEC', status: 'Scheduled', recipients: '300', sent: '0', openRate: '-', replyRate: '-', scheduledOn: '20 Jun 2026, 09:00 AM' },
    { id: 'healthcare-executives', name: 'Healthcare Executives', type: 'Cold Email', project: 'TUT', status: 'Running', recipients: '450', sent: '210', openRate: '41.1%', replyRate: '5.2%', scheduledOn: '11 Jun 2026, 02:00 PM' },
    { id: 'investors-vcs-pitch', name: 'Investors & VCs - Pitch', type: 'Cold Email', project: 'TEC', status: 'Paused', recipients: '250', sent: '120', openRate: '44.0%', replyRate: '4.0%', scheduledOn: '10 Jun 2026, 11:00 AM' },
    { id: 'saas-companies-intro', name: 'SaaS Companies - Intro', type: 'Cold Email', project: 'TEC', status: 'Draft', recipients: '-', sent: '-', openRate: '-', replyRate: '-', scheduledOn: '-' }
  ];

  const referenceTodos = [
    { title: 'Follow up with Robotics sector leads', time: 'Today, 10:30 AM', priority: 'High' },
    { title: 'Prepare draft for AI Startups list', time: 'Tomorrow, 11:00 AM', priority: 'Medium' },
    { title: 'Team meeting for campaign review', time: '22 Jun 2026, 03:00 PM', priority: 'Medium' },
    { title: 'Add new sender ID for warm-up', time: '23 Jun 2026, 09:30 AM', priority: 'Low' }
  ];

  const referenceSchedules = [
    { time: '09:00 AM', date: '20 Jun 2026', title: 'Robotics Leaders Outreach', meta: 'TEC Project  -  500 Recipients' },
    { time: '10:30 AM', date: '21 Jun 2026', title: 'AI Startups - Follow Up', meta: 'TEC Project  -  300 Recipients' },
    { time: '02:00 PM', date: '22 Jun 2026', title: 'Healthcare Executives', meta: 'TUT Project  -  450 Recipients' }
  ];

  const referenceActivities = [
    { time: '11:45 AM', date: '12 Jun 2026', title: "Campaign 'Robotics Leaders Outreach' sent", meta: '500 emails sent successfully', icon: 'ti-send', tone: 'green' },
    { time: '10:30 AM', date: '12 Jun 2026', title: "Draft 'Follow Up - Reminder 1' created", meta: 'By Akshay More', icon: 'ti-pencil', tone: 'blue' },
    { time: '09:15 AM', date: '12 Jun 2026', title: "Client list 'CTO - Robotics Companies' uploaded", meta: '236 contacts added', icon: 'ti-users', tone: 'red' },
    { time: '08:20 PM', date: '11 Jun 2026', title: 'Sender ID akshay.more@intellimail.com connected', meta: 'Connection successful', icon: 'ti-link', tone: 'slate' },
    { time: '07:45 PM', date: '11 Jun 2026', title: 'Warm-up for akshay.more@intellimail.com completed', meta: 'All warm-up emails sent', icon: 'ti-check', tone: 'green' }
  ];

  return (
    <>
    <div className="page-body reference-page-body">
      <section className="reference-welcome-row">
        <div>
          <h1>Welcome back, Akshay! <span aria-hidden="true">👋</span></h1>
          <p>Here's what's happening with your campaigns today.</p>
        </div>
      </section>

      <section className="reference-stat-strip" aria-label="Dashboard metrics">
        {[
          { label: 'Total Sent', value: '12,450', meta: '18.6%  vs last 7 days', icon: 'ti-send', tone: 'purple' },
          { label: 'Delivered', value: '11,245', meta: '90.3%  delivery rate', icon: 'ti-circle-check-filled', tone: 'green' },
          { label: 'Pending', value: '325', meta: 'campaigns in queue', icon: 'ti-clock-filled', tone: 'orange' },
          { label: 'Failed', value: '185', meta: '1.48%  failure rate', icon: 'ti-circle-x-filled', tone: 'red' },
          { label: 'Bounced', value: '243', meta: '1.95%  bounce rate', icon: 'ti-shield-filled', tone: 'blue' },
          { label: 'Spam Complaints', value: '12', meta: '0.10%  complaint rate', icon: 'ti-alert-triangle-filled', tone: 'amber' }
        ].map((item) => (
          <article key={item.label} className={`reference-stat-card tone-${item.tone}`}>
            <span className="reference-stat-icon"><i className={`ti ${item.icon}`} aria-hidden="true" /></span>
            <div>
              <span className="reference-stat-label">{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.meta}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="reference-dashboard-grid">
        <div className="reference-dashboard-maincol">
          <section className="reference-card reference-workflow-card" ref={workflowShellRef}>
            <div className="reference-card-head">
              <div>
                <h3>Campaign Workflow Progress</h3>
                <p>Complete each step to launch your campaign</p>
              </div>
            </div>
            <div className="reference-workflow-track">
              {referenceWorkflowSteps.map((step, index) => {
                const isActive = index === 0;
                return (
                  <div key={step.title} className={`reference-workflow-step ${isActive ? 'active' : ''}`}>
                    {index < referenceWorkflowSteps.length - 1 ? <span className="reference-workflow-line" aria-hidden="true" /> : null}
                    <button
                      type="button"
                      className="reference-workflow-circle"
                      onClick={(event) => handleWorkflowAction(step, event)}
                      aria-label={step.title}
                    >
                      <i className={`ti ${step.icon}`} aria-hidden="true" />
                      <em>{step.index}</em>
                    </button>
                    <strong>{step.title}</strong>
                    <button type="button" className="reference-workflow-action" onClick={(event) => handleWorkflowAction(step, event)}>
                      {step.button}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="reference-chart-row">
            <section className="reference-card reference-line-card">
              <div className="reference-card-head">
                <h3>Email Sent Overview <i className="ti ti-info-circle" aria-hidden="true" /></h3>
                <button type="button" className="reference-select-pill">Last 10 Days</button>
              </div>
              <div className="reference-line-chart" aria-label="Email sent overview">
                <svg viewBox="0 0 640 230" role="img" aria-hidden="true">
                  <defs><linearGradient id="sentArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" /><stop offset="100%" stopColor="#4f46e5" stopOpacity="0" /></linearGradient></defs>
                  {[40,80,120,160,200].map((y) => <line key={y} x1="35" x2="620" y1={y} y2={y} stroke="#eef2f7" strokeWidth="1" />)}
                  <path d="M42 155 C88 180 115 180 148 154 C188 125 215 99 250 112 C295 129 311 93 350 73 C395 48 430 78 462 103 C502 136 520 168 560 145 C585 130 604 136 620 126 L620 210 L42 210 Z" fill="url(#sentArea)" />
                  <path d="M42 155 C88 180 115 180 148 154 C188 125 215 99 250 112 C295 129 311 93 350 73 C395 48 430 78 462 103 C502 136 520 168 560 145 C585 130 604 136 620 126" fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
                  {[42,148,250,350,462,560,620].map((x, i) => <circle key={x} cx={x} cy={[155,154,112,73,103,145,126][i]} r="5" fill="#4f46e5" />)}
                </svg>
                <div className="reference-chart-labels"><span>09 Jun</span><span>10 Jun</span><span>11 Jun</span><span>12 Jun</span><span>13 Jun</span><span>14 Jun</span><span>15 Jun</span><span>16 Jun</span><span>17 Jun</span><span>18 Jun</span></div>
              </div>
            </section>
            <section className="reference-card reference-donut-card">
              <div className="reference-card-head"><h3>Campaign Status</h3></div>
              <div className="reference-donut-layout">
                <div className="reference-donut" />
                <div className="reference-donut-legend">
                  {[["Running", "#10b981", 8, "38.1%"], ["Scheduled", "#2563eb", 7, "33.3%"], ["Paused", "#f59e0b", 4, "19.0%"], ["Draft", "#cbd5e1", 2, "9.5%"]].map(([label, color, count, pct]) => <div key={label}><span style={{ background: color }} /><strong>{label}</strong><em>{count} ({pct})</em></div>)}
                </div>
              </div>
              <div className="reference-total-row"><span>Total Campaigns</span><strong>{paginatedCampaigns.length || 21}</strong></div>
            </section>
          </div>

          <section className="reference-card reference-recent-table" id="all-broadcast-performance" ref={broadcastPerformanceRef}>
            <div className="reference-card-head">
              <h3>Recent Campaigns</h3>
              <button type="button" onClick={handleActionCenterClick}>View All</button>
            </div>
            <div className="reference-table-wrap"><table><thead><tr><th>Campaign Name</th><th>Project</th><th>Status</th><th>Recipients</th><th>Sent</th><th>Open Rate</th><th>Reply Rate</th><th>Scheduled On</th><th>Actions</th></tr></thead><tbody>
              {referenceCampaignRows.map((campaign) => { const normalizedStatus = String(campaign.status || 'Draft').toLowerCase(); return <tr key={campaign.id}><td><button type="button" className="reference-campaign-link" onClick={() => handleViewCampaign(campaign)}>{campaign.name}</button><small>{campaign.type}</small></td><td><span className="reference-project-badge">{campaign.project}</span></td><td><span className={`reference-status-badge ${normalizedStatus}`}>{campaign.status}</span></td><td>{campaign.recipients}</td><td>{campaign.sent}</td><td>{campaign.openRate}</td><td>{campaign.replyRate}</td><td>{campaign.scheduledOn}</td><td className="reference-actions"><button type="button" onClick={() => handleViewCampaign(campaign)} aria-label="Open analytics"><i className="ti ti-chart-bar" /></button><button type="button" onClick={() => setOpenActionMenu(openActionMenu === campaign.id ? null : campaign.id)} aria-label="Campaign actions"><i className="ti ti-dots" /></button></td></tr>; })}
            </tbody></table></div>
          </section>
        </div>

        <aside className="reference-dashboard-sidecol">
          <section className="reference-card reference-todo-card">
            <div className="reference-card-head"><h3>My Notes, Tasks & To-Do</h3><button type="button" onClick={() => setShowNotesPopup(true)}>+ Add New</button></div>
            <div className="reference-tabs"><button>Notes</button><button>Tasks</button><button>Reminders</button><button className="active">To-Do</button></div>
            <div className="reference-todo-stats"><span>All Tasks<strong>7</strong></span><span>Pending<strong>4</strong></span><span>Completed<strong>2</strong></span><span>Overdue<strong>1</strong></span></div>
            <div className="reference-todo-title-row"><strong>To-Do List</strong><button type="button" onClick={() => setShowTimelinePopup(true)}>View All</button></div>
            <div className="reference-todo-list">{referenceTodos.map((item, index) => <button key={item.title} type="button" onClick={() => setShowTimelinePopup(true)}><span className={`reference-timeline-dot ${index === 3 ? 'done' : ''}`} /><strong>{item.title}</strong><small>{item.time}</small><em className={`priority-${item.priority.toLowerCase()}`}>{item.priority}</em></button>)}</div>
          </section>
          <section className="reference-card reference-schedule-card"><div className="reference-card-head"><h3>Upcoming Schedules</h3><button type="button" onClick={(event) => openAnchoredPopup('calendar', setShowCalendarPopup)(event)}>View All</button></div><div className="reference-schedule-timeline">{referenceSchedules.map((item) => <button type="button" key={item.title} onClick={() => openEventForm(today, item)}><time>{item.time}<small>{item.date}</small></time><span><i className="ti ti-calendar-event" aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.meta}</small></div></button>)}</div></section>
          <section className="reference-card reference-activity-card"><div className="reference-card-head"><h3>Recent Activity</h3><button type="button" onClick={() => setShowTimelinePopup(true)}>View All</button></div><div className="reference-activity-list">{referenceActivities.map((item) => <button key={item.title} type="button" onClick={() => setShowTimelinePopup(true)}><time>{item.time}<small>{item.date}</small></time><span className={`reference-activity-icon tone-${item.tone}`}><i className={`ti ${item.icon}`} aria-hidden="true" /></span><div><strong>{item.title}</strong><small>{item.meta}</small></div></button>)}</div></section>
        </aside>
      </section>

      <div className="reference-tip"><i className="ti ti-bulb" aria-hidden="true" /> <strong>Tip:</strong> Complete all workflow steps to ensure smooth campaign execution and better deliverability.</div>
      <footer className="reference-footer"><span>© 2026 IntelliMailPilot. All rights reserved.</span><nav><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Service</a><a href="/help">Help Center</a></nav></footer>
    </div>

      {renderPortalPopup(
        showTagFilterMenu,
        <div
          className="premium-broadcast-tag-filter-menu"
          style={popupStyleFor('tagFilter')}
          role="listbox"
          aria-label="Filter broadcast tags"
          ref={tagFilterRef}
        >
          {availableTags.map((tag) => (
            <label key={tag} className="premium-broadcast-tag-filter-option">
              <input
                type="checkbox"
                checked={tag === 'All Tags' ? selectedTagFilters.length === 0 : selectedTagFilters.includes(tag)}
                onChange={() => toggleTagFilter(tag)}
              />
              <span>{tag}</span>
            </label>
          ))}
        </div>
      )}

      {renderPortalPopup(
        showCalendarPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowCalendarPopup(false)}>
          <div className="premium-calendar-modal" style={popupStyleFor('calendar')} onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <h3>Events on {selectedDate.toLocaleDateString('en-GB')}</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowCalendarPopup(false)}>
                ×
              </button>
            </div>
            <div className="premium-calendar-modal-list">
              {selectedEvents.map((item) => (
                <div key={item.id} className="premium-calendar-event" style={{ '--event-color': item.color || '#2563eb' }}>
                  <span>{item.type}</span>
                  <p>{item.title}</p>
                  <small>{item.startTime || 'All day'}{item.endTime ? ` - ${item.endTime}` : ''} • {item.priority || 'Medium'}</small>
                  {item.detail ? <small>{item.detail}</small> : null}
                  <div className="premium-calendar-event-actions">
                    <button type="button" className="ghost subtle" onClick={() => openEventForm(selectedDate, item)}>Edit</button>
                    <button type="button" className="ghost subtle danger" onClick={() => deleteCalendarEvent(item)}>Delete</button>
                  </div>
                </div>
              ))}
              {!selectedEvents.length ? <div className="premium-empty-state">No events for this date.</div> : null}
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showDayPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowDayPopup(false)}>
          <div className="premium-calendar-modal premium-day-modal" style={popupStyleFor('day')} onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <div>
                <h3>{selectedDateLabel}</h3>
                <p>Daily activity, events, and quick actions for this date.</p>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowDayPopup(false)}>
                ×
              </button>
            </div>
            <div className="premium-day-modal-summary">
              <div>
                <strong>{selectedEvents.length || 0}</strong>
                <span>Events today</span>
              </div>
              <div>
                <strong>{allCalendarEvents.filter((item) => sameDay(item.date, today)).length}</strong>
                <span>Today in calendar</span>
              </div>
            </div>
            <div className="premium-calendar-modal-list">
              {selectedEvents.length ? (
                selectedEvents.map((item) => (
                  <div key={item.id} className="premium-calendar-event" style={{ '--event-color': item.color || '#2563eb' }}>
                    <span>{item.type}</span>
                    <p>{item.title}</p>
                    <small>{item.startTime || 'All day'}{item.endTime ? ` - ${item.endTime}` : ''} • {item.priority || 'Medium'}</small>
                    {item.detail ? <small>{item.detail}</small> : null}
                    <div className="premium-calendar-event-actions">
                      <button type="button" className="ghost subtle" onClick={() => openEventForm(selectedDate, item)}>Edit</button>
                      <button type="button" className="ghost subtle danger" onClick={() => deleteCalendarEvent(item)}>Delete</button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="premium-empty-state">No events for this date yet.</div>
              )}
            </div>
            <div className="premium-day-modal-actions">
              <div className="premium-day-modal-footer">
                <small>Add structured events with reminders, repeat settings, priority, and color tags.</small>
                <button
                  type="button"
                  onClick={() => openEventForm(selectedDate)}
                >
                  Add Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showEventFormPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowEventFormPopup(false)}>
          <div className="premium-calendar-modal premium-event-form-modal" onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <div>
                <h3>{editingCalendarEvent ? 'Edit Event' : 'Add Event'}</h3>
                <p>Plan campaigns, calls, tasks, and reminders in your dashboard calendar.</p>
              </div>
              <div className="premium-event-form-head-actions">
                <button type="button" className="ghost subtle" disabled={calendarSaving} onClick={() => setShowEventFormPopup(false)}>Cancel</button>
                <button type="button" disabled={calendarSaving} onClick={saveCalendarEvent}>
                  {calendarSaving ? 'Saving...' : 'Save Event'}
                </button>
                <button type="button" className="ghost subtle" onClick={() => setShowEventFormPopup(false)} aria-label="Close event modal">
                  ×
                </button>
              </div>
            </div>
            <div className="premium-event-form-grid">
              <label>
                <span>Event title</span>
                <input value={calendarEventDraft.title} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                <span>Event type</span>
                <select value={calendarEventDraft.type} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, type: event.target.value }))}>
                  {CALENDAR_EVENT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="wide">
                <span>Description</span>
                <textarea rows={3} value={calendarEventDraft.description} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <label>
                <span>Start date</span>
                <input type="date" value={calendarEventDraft.startDate} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, startDate: event.target.value, endDate: current.endDate || event.target.value }))} />
              </label>
              <label>
                <span>End date</span>
                <input type="date" value={calendarEventDraft.endDate} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, endDate: event.target.value }))} />
              </label>
              <label>
                <span>Start time</span>
                <input type="time" value={calendarEventDraft.startTime} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, startTime: event.target.value }))} />
              </label>
              <label>
                <span>End time</span>
                <input type="time" value={calendarEventDraft.endTime} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, endTime: event.target.value }))} />
              </label>
              <label>
                <span>Priority</span>
                <select value={calendarEventDraft.priority} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, priority: event.target.value }))}>
                  {CALENDAR_PRIORITIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Reminder</span>
                <select value={calendarEventDraft.reminder} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, reminder: event.target.value }))}>
                  {CALENDAR_REMINDERS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Repeat event</span>
                <select value={calendarEventDraft.repeat} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, repeat: event.target.value }))}>
                  {CALENDAR_REPEATS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Color</span>
                <div className="premium-event-color-row">
                  {CALENDAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={calendarEventDraft.color === color ? 'active' : ''}
                      style={{ background: color }}
                      onClick={() => setCalendarEventDraft((current) => ({ ...current, color }))}
                      aria-label={`Use color ${color}`}
                    />
                  ))}
                </div>
              </label>
              <label className="wide">
                <span>Notes</span>
                <textarea rows={3} value={calendarEventDraft.notes} onChange={(event) => setCalendarEventDraft((current) => ({ ...current, notes: event.target.value }))} />
              </label>
            </div>
            <div className="premium-event-form-actions">
              {editingCalendarEvent ? (
                <button type="button" className="ghost subtle danger" disabled={calendarSaving} onClick={() => deleteCalendarEvent(editingCalendarEvent)}>
                  Delete
                </button>
              ) : <span />}
              <div>
                <button type="button" className="ghost subtle" disabled={calendarSaving} onClick={() => setShowEventFormPopup(false)}>Cancel</button>
                <button type="button" disabled={calendarSaving} onClick={saveCalendarEvent}>
                  {calendarSaving ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showNotificationsPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowNotificationsPopup(false)}>
          <div className="premium-calendar-modal premium-notifications-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head premium-modal-head-actions-only">
              <button type="button" className="ghost subtle" onClick={() => setShowNotificationsPopup(false)}>×</button>
            </div>
            <div className="premium-calendar-modal-list">
              {replyNotificationCards.length ? (
                replyNotificationCards.map((item, index) => (
                  <NotificationItem key={`${item.name}-popup-${index}`} item={item} onClick={() => openInboxMail(item)} />
                ))
              ) : (
                <div className="premium-empty-state">No reply notifications yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showNotesPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowNotesPopup(false)}>
          <div className="premium-calendar-modal premium-quick-notes-modal" style={popupStyleFor('notes')} onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <div>
                <span className="premium-section-kicker">Notes</span>
                <h3>All Quick Notes</h3>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowNotesPopup(false)}>×</button>
            </div>
            <div className="premium-calendar-modal-list premium-notes-history">
              {quickNotes.length ? (
                quickNotes.map((item) => (
                  <QuickNoteItem key={`${item.id}-popup`} item={item} />
                ))
              ) : (
                <div className="premium-empty-state premium-note-empty-state">
                  <strong>No notes yet.</strong>
                  <p>Write a short reminder in the note box to pin it here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showTimelinePopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowTimelinePopup(false)}>
          <div className="premium-calendar-modal" style={popupStyleFor('timeline')} onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <h3>All Activity Timeline Events</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowTimelinePopup(false)}>×</button>
            </div>
            <div className="premium-calendar-modal-list">
              {selectedTimelineTask ? (
                <div className="premium-timeline-detail-card">
                  <span className="premium-timeline-detail-kicker">Selected Task</span>
                  <strong>{selectedTimelineTask.title}</strong>
                  <p>{selectedTimelineTask.text}</p>
                  <small>
                    {selectedTimelineTask.date}
                    {selectedTimelineTask.time ? ` • ${selectedTimelineTask.time}` : ''}
                  </small>
                </div>
              ) : null}
              {Object.entries(timelinePopupGroups).map(([label, items]) => (
                <div key={label} className="premium-timeline-group">
                  <div className="premium-timeline-divider">
                    <span>{label}</span>
                    {label === 'Completed' ? (
                      <button
                        type="button"
                        className="premium-timeline-group-toggle"
                        onClick={() => setShowCompletedTimelineGroup((value) => !value)}
                      >
                        {showCompletedTimelineGroup ? 'Hide' : `Show (${items.length})`}
                      </button>
                    ) : null}
                  </div>
                  {label === 'Completed' && !showCompletedTimelineGroup ? null : items.map((item, index) => (
                    <TimelineItem
                      key={item.id || `${item.date}-popup-${index}`}
                      item={item}
                      checked={Boolean(timelineCompletionMap[item.id || `${item.date}-${index}`])}
                      onToggle={(checked) => {
                        const key = item.id || `${item.date}-${index}`;
                        setTimelineCompletionMap((current) => {
                          const next = { ...current, [key]: checked };
                          onTimelineTaskStatesChange?.(next);
                          return next;
                        });
                      }}
                      onOpen={() => setSelectedTimelineTask(item)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showTimelineAddPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowTimelineAddPopup(false)}>
          <div className="premium-calendar-modal" style={popupStyleFor('timeline')} onClick={(event) => event.stopPropagation()}>
            <div className="section-header">
              <h3>Add Timeline Task</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowTimelineAddPopup(false)}>×</button>
            </div>
            <div className="premium-timeline-add-form">
                <input
                  type="text"
                  ref={timelineTaskTitleRef}
                  value={timelineTaskDraft.title}
                  onChange={(event) => setTimelineTaskDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Task title"
                />
              <div className="premium-timeline-add-grid">
                <input
                  type="date"
                  value={timelineTaskDraft.date}
                  onChange={(event) => setTimelineTaskDraft((current) => ({ ...current, date: event.target.value }))}
                />
                <input
                  type="time"
                  value={timelineTaskDraft.time}
                  onChange={(event) => setTimelineTaskDraft((current) => ({ ...current, time: event.target.value }))}
                />
              </div>
              <div className="premium-timeline-add-grid">
                  <select
                    value={timelineTaskDraft.type}
                    onChange={(event) => {
                      const nextType = event.target.value;
                      const defaults = buildTimelineDraftDefaults(nextType, timelineTaskDraft.time);
                      setTimelineTaskDraft((current) => ({
                        ...current,
                        type: nextType,
                        title: defaults.title,
                        text: defaults.text
                      }));
                    }}
                  >
                    <option value="Reminder">Reminder</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Appointment">Appointment</option>
                  </select>
                <input
                  type="text"
                  value={timelineTaskDraft.text}
                  onChange={(event) => setTimelineTaskDraft((current) => ({ ...current, text: event.target.value }))}
                  placeholder="Task note"
                />
              </div>
              <div className="premium-timeline-add-actions">
                <button
                  type="button"
                  className="ghost subtle"
                  onClick={() => setShowTimelineAddPopup(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    const title = String(timelineTaskDraft.title || '').trim();
                    const date = String(timelineTaskDraft.date || '').trim();
                    if (!title || !date) return;
                    const nextTask = {
                      id: `custom-${Date.now()}`,
                      date,
                      time: String(timelineTaskDraft.time || '').trim(),
                      title,
                      text: String(timelineTaskDraft.text || '').trim() || 'Planned for your timeline.',
                      type: String(timelineTaskDraft.type || 'Reminder').trim() || 'Reminder',
                      status: 'pending',
                      done: false
                    };
                    onTimelineCustomTaskAdd?.(nextTask);
                    setTimelineTaskDraft({ title: '', date: '', time: '', type: 'Reminder', text: '' });
                    setSelectedTimelineTask(nextTask);
                    setShowTimelineAddPopup(false);
                    setShowTimelinePopup(true);
                  }}
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showLogsPopup,
          <div className="premium-calendar-modal-backdrop" onClick={() => setShowLogsPopup(false)}>
            <div className="premium-calendar-modal" style={popupStyleFor('logs')} onClick={(event) => event.stopPropagation()}>
              <div className="section-header">
                <h3>System Monitor</h3>
                <button type="button" className="ghost subtle" onClick={() => setShowLogsPopup(false)}>×</button>
              </div>
              <div className="premium-calendar-modal-list">
                {Object.entries(logPopupGroups).map(([label, items]) => (
                  <div key={label} className="premium-timeline-group">
                    <div className="premium-timeline-divider">
                      <span>{label}</span>
                      <small>{items.length} item{items.length === 1 ? '' : 's'}</small>
                    </div>
                    <div className="premium-calendar-modal-section">
                      {items.map((log, index) => (
                        <LogItem key={`${label}-${log.time}-${index}`} item={log} detailed />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      {renderPortalPopup(
        showClientListPopup,
        <div className="wf-backdrop" onClick={() => setShowClientListPopup(false)}>
          <div className="premium-calendar-modal wf-modal pr-uploadlist-modal campaign-list-picker-modal" style={popupStyleFor('clientList')} onClick={(event) => event.stopPropagation()}>
            <div className="campaign-list-picker-header">
              <button type="button" className="campaign-list-picker-back" aria-label="Back" onClick={() => setShowClientListPopup(false)}>
                <i className="ti ti-chevron-left" aria-hidden="true" />
              </button>
              <div className="campaign-list-picker-heading">
                <span className="campaign-list-picker-icon"><i className="ti ti-folder" aria-hidden="true" /></span>
                <div>
                  <h3>Upload List</h3>
                  <p>Select a saved list or sheet to use for your campaign</p>
                </div>
              </div>
              <div className="campaign-list-picker-stepper" aria-label="Campaign workflow steps">
                {['Upload List', 'Review', 'Campaign', 'Select Draft', 'Draft Summary', 'Test Email', 'Schedule'].map((label, index) => (
                  <div key={label} className={`campaign-list-picker-step${index === 0 ? ' active' : ''}`}>
                    <span>{index + 1}</span>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <button type="button" className="campaign-list-picker-close" aria-label="Close" onClick={() => setShowClientListPopup(false)}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>

            <div className="campaign-list-picker-body workflow-popup-body">
              {isBulkReplyMode && (
                <div className={`campaign-list-picker-alert ${sheetMissing ? 'warning' : 'success'}`}>
                  <strong>{sheetMissing ? 'Original campaign sheet is missing.' : 'Preloaded recipient sheet is ready.'}</strong>
                  <span>
                    {sheetMissing
                      ? 'Please select or upload a client sheet to proceed with the reply campaign.'
                      : `Loaded sheet ${originalSheetName || 'Original List'} (${originalRecipientCount} contacts) from campaign ${originalCampaignName}.`}
                  </span>
                </div>
              )}

              <section className="campaign-list-picker-topline">
                <div className="campaign-list-picker-intro-card">
                  <span className="campaign-list-picker-intro-icon"><i className="ti ti-folders" aria-hidden="true" /></span>
                  <div>
                    <strong>Use an Existing List or Sheet</strong>
                    <p>Choose from your previously created client lists and sheets.</p>
                  </div>
                </div>
                <div className="campaign-list-picker-stats" aria-label="Client list statistics">
                  {[
                    ['Total Sheets', campaignListStats.totalSheets],
                    ['Total Clients', campaignListStats.totalClients],
                    ['Repeated', campaignListStats.repeated],
                    ['Contacted', campaignListStats.contacted]
                  ].map(([label, value]) => (
                    <div key={label} className={label === 'Repeated' ? 'danger' : label === 'Contacted' ? 'success' : ''}>
                      <strong>{Number(value || 0).toLocaleString()}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="campaign-list-picker-control-row">
                <label className="campaign-list-picker-search">
                  <span>Search</span>
                  <input
                    value={clientListSearch}
                    onChange={(event) => setClientListSearch(event.target.value)}
                    placeholder="Search lists or sheets..."
                    aria-label="Search lists"
                  />
                </label>
                <select value={clientListProjectFilter} onChange={(event) => setClientListProjectFilter(event.target.value)} aria-label="Filter by project">
                  <option value="all">All Projects</option>
                  <option value="tec">TEC Project</option>
                  <option value="tut">TUT Project</option>
                  <option value="other">Other Projects</option>
                </select>
                <select value={clientListSourceFilter} onChange={(event) => setClientListSourceFilter(event.target.value)} aria-label="Filter by source">
                  <option value="all">All Sources</option>
                  <option value="upload">Upload</option>
                  <option value="excel">Excel Upload</option>
                  <option value="csv">CSV Upload</option>
                  <option value="manual">Manual</option>
                  <option value="paste">Paste</option>
                  <option value="imported">Imported</option>
                </select>
                <select value={clientListRecentFilter} onChange={(event) => setClientListRecentFilter(event.target.value)} aria-label="Filter by recently used">
                  <option value="all">Recently Used</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                </select>
                <button type="button" className="campaign-list-picker-refresh" onClick={() => setClientListRefreshTick((current) => current + 1)} aria-label="Refresh lists">
                  <i className="ti ti-refresh" aria-hidden="true" />
                </button>
                <label htmlFor="campaign-list-picker-upload-input" className="campaign-list-picker-create-btn">
                  <i className="ti ti-square-plus" aria-hidden="true" /> Create New List
                </label>
              </div>

              <section className="campaign-list-picker-main">
                <aside className="campaign-list-picker-sidebar">
                  <div className="campaign-list-picker-side-panel">
                    <h4>My Lists & Sheets</h4>
                    {[
                      ['all', 'All Lists', campaignListProjectCounts.all],
                      ['recent', 'Recent', filteredCampaignListRows.length],
                      ['frequent', 'Frequently Used', campaignListRows.filter((row) => row.clientCount > 0).length],
                      ['favorites', 'Favorites', campaignListRows.filter((row) => row.isFavorite).length],
                      ['shared', 'Shared with Me', campaignListRows.filter((row) => row.isShared).length],
                      ['trash', 'Trash', campaignListRows.filter((row) => row.status.toLowerCase() === 'trash').length]
                    ].map(([key, label, count]) => (
                      <button key={key} type="button" className={clientListCategoryFilter === key ? 'active' : ''} onClick={() => setClientListCategoryFilter(key)}>
                        <span>{label}</span>
                        <small>{count}</small>
                      </button>
                    ))}
                    <hr />
                    <h4>Filter by Project</h4>
                    {[
                      ['all', 'All Projects', campaignListProjectCounts.all],
                      ['tec', 'TEC Project', campaignListProjectCounts.tec],
                      ['tut', 'TUT Project', campaignListProjectCounts.tut],
                      ['other', 'Other Projects', campaignListProjectCounts.other]
                    ].map(([key, label, count]) => (
                      <label key={key} className="campaign-list-picker-check">
                        <input
                          type="radio"
                          name="campaignListSidebarProject"
                          checked={clientListSidebarProjectFilter === key}
                          onChange={() => setClientListSidebarProjectFilter(key)}
                        />
                        <span>{label}</span>
                        <small>{count}</small>
                      </label>
                    ))}
                  </div>
                  <div className="campaign-list-picker-upload-card" onDragOver={(event) => event.preventDefault()} onDrop={handleCampaignListDrop}>
                    <strong>Need to create a new list?</strong>
                    <p>Upload a CSV or Excel file to create a new list.</p>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(event) => {
                        setClientListTab('upload');
                        handlePremiumShellUpload(event);
                      }}
                      style={{ display: 'none' }}
                      id="campaign-list-picker-upload-input"
                    />
                    <label htmlFor="campaign-list-picker-upload-input" className="campaign-list-picker-upload-btn">
                      {clientListUploading ? 'Uploading...' : 'Upload File'}
                    </label>
                  </div>
                </aside>

                <div className="campaign-list-picker-content">
                  <div className="campaign-list-picker-toolbar">
                    <div>
                      <h3>Saved Lists & Sheets</h3>
                      <p>{filteredCampaignListRows.length.toLocaleString()} saved sheet{filteredCampaignListRows.length === 1 ? '' : 's'} available</p>
                    </div>
                  </div>

                  <div className="campaign-list-picker-table-wrap">
                    <table className="campaign-list-picker-table">
                      <thead>
                        <tr>
                          <th className="check"><input type="checkbox" checked={allVisibleCampaignRowsSelected} onChange={toggleVisibleCampaignRows} aria-label="Select visible lists" /></th>
                          <th><button type="button" onClick={() => toggleCampaignListSort('title')}>List Name</button></th>
                          <th><button type="button" onClick={() => toggleCampaignListSort('project')}>Project</button></th>
                          <th><button type="button" onClick={() => toggleCampaignListSort('source')}>Source</button></th>
                          <th><button type="button" onClick={() => toggleCampaignListSort('clientCount')}>Client Count</button></th>
                          <th><button type="button" onClick={() => toggleCampaignListSort('createdAt')}>Created Date</button></th>
                          <th><button type="button" onClick={() => toggleCampaignListSort('lastUsed')}>Last Used</button></th>
                          <th>Created By</th>
                          <th>Status</th>
                          <th>Actions</th>
                          <th>Use For Campaign</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientListLoadingSheets ? (
                          Array.from({ length: 6 }).map((_, index) => (
                            <tr key={`campaign-list-skeleton-${index}`} className="campaign-list-picker-skeleton-row">
                              <td colSpan="11"><span /></td>
                            </tr>
                          ))
                        ) : visibleCampaignListRows.length ? visibleCampaignListRows.map((row) => {
                          const isSelected = selectedCampaignListId === row.id;
                          return (
                            <tr
                              key={row.id}
                              className={isSelected ? 'selected' : ''}
                              tabIndex={0}
                              onDoubleClick={() => selectCampaignListForWorkflow(row, { proceed: true })}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') selectCampaignListForWorkflow(row, { proceed: true });
                                if (event.key === ' ') {
                                  event.preventDefault();
                                  selectCampaignListForWorkflow(row);
                                }
                              }}
                            >
                              <td className="check"><input type="checkbox" checked={clientListMultiSelectedIds.includes(row.id)} onChange={() => toggleCampaignListMultiSelect(row.id)} aria-label={`Select ${row.title}`} /></td>
                              <td>
                                <div className="campaign-list-picker-name-cell">
                                  <span className="sheet-icon">Sheet</span>
                                  <div>
                                    <strong>{row.title}</strong>
                                    {row.subtitle ? <small>{row.subtitle}</small> : null}
                                  </div>
                                  {isSelected ? <em>Selected</em> : null}
                                </div>
                              </td>
                              <td><span className={`campaign-list-picker-project ${row.projectKey}`}>{row.project}</span></td>
                              <td>{row.source}</td>
                              <td><strong>{Number(row.clientCount || 0).toLocaleString()}</strong></td>
                              <td>{formatCampaignListDate(row.createdAt)}</td>
                              <td>{formatCampaignListDate(row.lastUsed)}</td>
                              <td>{row.createdBy}</td>
                              <td><span className="campaign-list-picker-status">{row.status}</span></td>
                              <td>
                                <button type="button" className="campaign-list-picker-row-action" onClick={() => handleCampaignListDelete(row)} aria-label={`Move ${row.title} to Trash`}>
                                  <i className="ti ti-trash" aria-hidden="true" />
                                </button>
                              </td>
                              <td>
                                <button type="button" className="campaign-list-picker-use" onClick={() => selectCampaignListForWorkflow(row)}>
                                  {isSelected ? 'Selected' : 'Use For Campaign'}
                                </button>
                              </td>
                            </tr>
                          );
                        }) : (
                          <tr className="campaign-list-picker-empty-row">
                            <td colSpan="11">
                              <strong>No Client Lists Found</strong>
                              <span>Go to Client Data to create a new sheet, or upload a file here.</span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="campaign-list-picker-table-footer">
                    <span>Showing {filteredCampaignListRows.length ? ((campaignListCurrentPage - 1) * campaignListPageSize) + 1 : 0} to {Math.min(campaignListCurrentPage * campaignListPageSize, filteredCampaignListRows.length)} of {filteredCampaignListRows.length} entries</span>
                    <div className="campaign-list-picker-pages">
                      <button type="button" disabled={campaignListCurrentPage <= 1} onClick={() => setClientListPage((page) => Math.max(1, page - 1))}>Prev</button>
                      {Array.from({ length: Math.min(3, campaignListPageCount) }).map((_, index) => {
                        const pageNumber = index + 1;
                        return <button key={pageNumber} type="button" className={campaignListCurrentPage === pageNumber ? 'active' : ''} onClick={() => setClientListPage(pageNumber)}>{pageNumber}</button>;
                      })}
                      <button type="button" disabled={campaignListCurrentPage >= campaignListPageCount} onClick={() => setClientListPage((page) => Math.min(campaignListPageCount, page + 1))}>Next</button>
                    </div>
                  </div>

                  <div className="campaign-list-picker-tip">
                    <span>i</span>
                    <p>Tip: You can create new lists, edit existing ones, or manage your data from the Client Data section.</p>
                    <button type="button" onClick={() => router.push('/dashboard/client-data')}>Go to Client Data</button>
                  </div>
                </div>
              </section>
            </div>

            <div className="campaign-list-picker-footer">
              <button type="button" className="campaign-list-picker-cancel" onClick={() => setShowClientListPopup(false)}>Cancel</button>
              <div>
                <button type="button" className="campaign-list-picker-back-footer" disabled>Back</button>
                <button
                  type="button"
                  className={`campaign-list-picker-next${clientListActionReady ? '' : ' is-disabled'}`}
                  onClick={handleClientListNext}
                  disabled={!clientListActionReady}
                >
                  {clientListUploading ? 'Uploading...' : 'Next ->'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showOverviewPopup,
        <div className="wf-backdrop review-list-v2-backdrop" onClick={() => setShowOverviewPopup(false)}>
          <div className="review-list-v2-modal" onClick={(event) => event.stopPropagation()}>
            <header className="review-list-v2-header">
              <div className="review-list-v2-titleblock">
                <span className="review-list-v2-stepicon"><i className="ti ti-file-spreadsheet" aria-hidden="true" /></span>
                <div>
                  <h3>2. Review List</h3>
                  <p>Review, validate and edit your client data before proceeding</p>
                </div>
              </div>
              <div className="review-list-v2-progress" aria-label="Campaign workflow progress">
                {[
                  ['1', 'Upload List', 'done'],
                  ['2', 'Review', 'active'],
                  ['3', 'Campaign', ''],
                  ['4', 'Select Draft', ''],
                  ['5', 'Draft Summary', ''],
                  ['6', 'Test Email', ''],
                  ['7', 'Schedule', '']
                ].map(([number, label, status], index, items) => (
                  <div key={number} className={`review-list-v2-progress-step ${status}`}>
                    <span>{status === 'done' ? <i className="ti ti-check" aria-hidden="true" /> : number}</span>
                    <small>{label}</small>
                    {index < items.length - 1 ? <b aria-hidden="true" /> : null}
                  </div>
                ))}
              </div>
              <button type="button" className="review-list-v2-close" onClick={() => setShowOverviewPopup(false)} aria-label="Close Review List">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </header>

            <main className="review-list-v2-body workflow-popup-body">
              <section className="review-list-v2-summary">
                <div className="review-list-v2-sheet">
                  <span><i className="ti ti-folder" aria-hidden="true" /></span>
                  <div>
                    <h4>{selectedClientListSummary.title || selectedListName || 'Selected client list'}</h4>
                    <p>
                      <strong>{selectedClientListSummary.subtitle || 'Saved List'}</strong>
                      <em>{project || 'Project'}</em>
                    </p>
                  </div>
                </div>
                <div className="review-list-v2-kpis">
                  {[
                    ['Total Records', reviewStats.totalRecords || 0, 'dark'],
                    ['Valid Records', reviewStats.validRecords || 0, 'green'],
                    ['Missing Emails', reviewStats.missingEmails || 0, 'orange'],
                    ['Duplicates', reviewStats.duplicates || 0, 'red'],
                    ['Processed', `${reviewStats.processedPercent || 0}%`, 'blue']
                  ].map(([label, value, tone]) => (
                    <article key={label} className={tone}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </article>
                  ))}
                </div>
              </section>

              <nav className="review-list-v2-tabs" aria-label="Review tabs">
                <button type="button" className={reviewTab === 'all' ? 'active' : ''} onClick={() => setReviewTab('all')}>Data Review</button>
                <button type="button" className={reviewTab === 'invalid' ? 'active' : ''} onClick={() => setReviewTab('invalid')}>
                  Missing & Invalid ({(reviewStats.missingEmails || 0) + (reviewStats.invalidEmails || 0) + (reviewStats.otherMissing || 0)})
                </button>
                <button type="button" className={reviewTab === 'duplicates' ? 'active' : ''} onClick={() => setReviewTab('duplicates')}>
                  Duplicates ({reviewStats.duplicates || 0})
                </button>
              </nav>

              <section className="review-list-v2-toolbar">
                <div className="review-list-v2-toolbar-left">
                  <label className="review-list-v2-search">
                    <i className="ti ti-search" aria-hidden="true" />
                    <input value={overviewSearch} onChange={(event) => setOverviewSearch(event.target.value)} placeholder="Search clients..." />
                  </label>
                  <select value={reviewColumnFilter} onChange={(event) => setReviewColumnFilter(event.target.value)} aria-label="Column filter">
                    <option value="all">All Columns</option>
                    {REVIEW_TABLE_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                  </select>
                  <button type="button" className="review-list-v2-ghost" onClick={() => setReviewTab('invalid')}>
                    <i className="ti ti-filter" aria-hidden="true" /> Filters
                  </button>
                  <button type="button" className="review-list-v2-ghost" onClick={() => runReviewValidation(overviewRows)} disabled={reviewValidationLoading}>
                    <i className="ti ti-checkbox" aria-hidden="true" /> {reviewValidationLoading ? 'Validating...' : 'Validate All'}
                  </button>
                </div>
                <div className="review-list-v2-toolbar-right">
                  <button type="button" className="review-list-v2-ghost" onClick={() => addOverviewRow()}>
                    <i className="ti ti-plus" aria-hidden="true" /> Add Row
                  </button>
                  <button type="button" className="review-list-v2-ghost" onClick={addOverviewColumn}>
                    <i className="ti ti-table-plus" aria-hidden="true" /> Add Column
                  </button>
                  <input ref={reviewImportInputRef} type="file" accept=".csv,text/csv" onChange={handleReviewImportRows} hidden />
                  <button type="button" className="review-list-v2-ghost" onClick={() => reviewImportInputRef.current?.click()}>
                    <i className="ti ti-upload" aria-hidden="true" /> Import Rows
                  </button>
                  <button type="button" className="review-list-v2-ghost" onClick={handleReviewExportRows}>
                    <i className="ti ti-download" aria-hidden="true" /> Export
                  </button>
                  <button type="button" className="review-list-v2-primary" onClick={handleReviewSave} disabled={!previewDirty && !overviewRows.length}>
                    <i className="ti ti-device-floppy" aria-hidden="true" /> Save Changes
                  </button>
                </div>
              </section>

              <section className="review-list-v2-table-card">
                <div className="review-list-v2-table-scroll">
                  <table className="review-list-v2-table">
                    <thead>
                      <tr>
                        <th className="select">
                          <input type="checkbox" checked={allReviewVisibleRowsSelected} onChange={toggleAllReviewVisibleRows} aria-label="Select visible rows" />
                        </th>
                        <th>#</th>
                        {REVIEW_TABLE_COLUMNS.map((column) => {
                          const counts = reviewStats.columnCounts?.[column.key] || {};
                          return (
                            <th key={column.key}>
                              <span><i className={column.type === 'email' ? 'ti ti-mail' : 'ti ti-text-size'} aria-hidden="true" /> {column.label}</span>
                              <small>
                                <b className="ok">OK {counts.valid ?? Math.max(0, reviewStats.totalRecords || 0)}</b>
                                {REVIEW_REQUIRED_COLUMNS.includes(column.key) && (counts.missing || counts.invalid || counts.duplicate) ? (
                                  <b className="warn">! {(counts.missing || 0) + (counts.invalid || 0) + (counts.duplicate || 0)}</b>
                                ) : null}
                              </small>
                            </th>
                          );
                        })}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewDataLoading ? (
                        Array.from({ length: 6 }).map((_, index) => (
                          <tr key={`skeleton-${index}`} className="review-list-v2-skeleton">
                            <td colSpan={REVIEW_TABLE_COLUMNS.length + 3}><span /></td>
                          </tr>
                        ))
                      ) : null}
                      {!reviewDataLoading && !reviewPagedRows.length ? (
                        <tr className="review-list-v2-empty">
                          <td colSpan={REVIEW_TABLE_COLUMNS.length + 3}>
                            <strong>No Client Lists Found</strong>
                            <span>Select a list in Step 1, import rows, or add a client below.</span>
                          </td>
                        </tr>
                      ) : null}
                      {!reviewDataLoading && reviewPagedRows.map((row) => {
                        const rowNumber = row.id;
                        const issues = reviewIssueMap[rowNumber] || [];
                        const rowClassName = [
                          issues.includes('duplicate') ? 'duplicate' : '',
                          issues.some((issue) => ['missing-email', 'invalid-email', 'missing-required'].includes(issue)) ? 'invalid' : '',
                          selectedOverviewRowIds.includes(row.id) ? 'selected' : ''
                        ].filter(Boolean).join(' ');
                        return (
                          <tr key={row.id} className={rowClassName}>
                            <td className="select">
                              <input
                                type="checkbox"
                                checked={selectedOverviewRowIds.includes(row.id)}
                                onChange={() => toggleOverviewRowSelection(row.id)}
                                aria-label={`Select row ${rowNumber}`}
                              />
                            </td>
                            <td>{rowNumber}</td>
                            {REVIEW_TABLE_COLUMNS.map((column) => {
                              const value = row[column.key] || '';
                              const cellIssues = [];
                              if (REVIEW_REQUIRED_COLUMNS.includes(column.key) && !String(value).trim()) cellIssues.push('missing');
                              if (column.key === 'Email' && issues.includes('invalid-email')) cellIssues.push('invalid');
                              if (column.key === 'Email' && issues.includes('missing-email')) cellIssues.push('missing');
                              if (column.key === 'Email' && issues.includes('duplicate')) cellIssues.push('duplicate');
                              return (
                                <td key={`${row.id}-${column.key}`} className={cellIssues.join(' ')}>
                                  <input
                                    value={value}
                                    placeholder={cellIssues.includes('missing') ? `-- Missing ${column.label} --` : column.label}
                                    onChange={(event) => handleReviewCellChange(row.id, column.key, event.target.value)}
                                  />
                                </td>
                              );
                            })}
                            <td className="actions">
                              {issues.includes('duplicate') ? <span className="review-list-v2-duplicate-badge">Duplicate</span> : null}
                              <button type="button" onClick={() => setEditingCell(`${row.id}-${REVIEW_TABLE_COLUMNS[0].key}`)} aria-label={`Edit row ${rowNumber}`}>
                                <i className="ti ti-pencil" aria-hidden="true" />
                              </button>
                              <button type="button" onClick={() => handleDeleteReviewRow(row.id)} aria-label={`Delete row ${rowNumber}`}>
                                <i className="ti ti-trash" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="review-list-v2-pagination">
                  <label>
                    Rows per page:
                    <select value={reviewRowsPerPage} onChange={(event) => setReviewRowsPerPage(Number(event.target.value))}>
                      {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                  <span>
                    Showing {reviewFilteredRows.length ? ((reviewCurrentPage - 1) * reviewRowsPerPage) + 1 : 0} to {Math.min(reviewCurrentPage * reviewRowsPerPage, reviewFilteredRows.length)} of {reviewFilteredRows.length} entries
                  </span>
                  <div>
                    <button type="button" onClick={() => setReviewPage(1)} disabled={reviewCurrentPage === 1}>{'<<'}</button>
                    <button type="button" onClick={() => setReviewPage((current) => Math.max(1, current - 1))} disabled={reviewCurrentPage === 1}>{'<'}</button>
                    {Array.from({ length: Math.min(5, reviewTotalPages) }).map((_, index) => {
                      const page = Math.min(reviewTotalPages, Math.max(1, reviewCurrentPage - 2) + index);
                      return <button key={page} type="button" className={page === reviewCurrentPage ? 'active' : ''} onClick={() => setReviewPage(page)}>{page}</button>;
                    })}
                    <button type="button" onClick={() => setReviewPage((current) => Math.min(reviewTotalPages, current + 1))} disabled={reviewCurrentPage === reviewTotalPages}>{'>'}</button>
                    <button type="button" onClick={() => setReviewPage(reviewTotalPages)} disabled={reviewCurrentPage === reviewTotalPages}>{'>>'}</button>
                  </div>
                </div>
              </section>

              <section className="review-list-v2-bottom-grid">
                <div className="review-list-v2-quick-panels">
                  <article className="review-list-v2-panel review-list-v2-quick-add">
                    <h4><i className="ti ti-user-plus" aria-hidden="true" /> Quick Add New Client</h4>
                    <div>
                      <input value={quickClientDraft.firstName} onChange={(event) => setQuickClientDraft((current) => ({ ...current, firstName: event.target.value }))} placeholder="First Name" />
                      <input value={quickClientDraft.lastName} onChange={(event) => setQuickClientDraft((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last Name" />
                      <input value={quickClientDraft.email} onChange={(event) => setQuickClientDraft((current) => ({ ...current, email: event.target.value }))} placeholder="Email Address" />
                      <input value={quickClientDraft.company} onChange={(event) => setQuickClientDraft((current) => ({ ...current, company: event.target.value }))} placeholder="Company Name" />
                      <button type="button" onClick={handleQuickAddClient}>+ Add Client</button>
                    </div>
                  </article>
                  <article className="review-list-v2-panel review-list-v2-bulk">
                    <h4><i className="ti ti-users" aria-hidden="true" /> Bulk Edit Selected ({selectedOverviewRowIds.length} row{selectedOverviewRowIds.length === 1 ? '' : 's'} selected)</h4>
                    <div>
                      <select value={reviewBulkColumn} onChange={(event) => setReviewBulkColumn(event.target.value)}>
                        {REVIEW_TABLE_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                      </select>
                      <input value={reviewBulkValue} onChange={(event) => setReviewBulkValue(event.target.value)} placeholder="Enter value" />
                      <button type="button" onClick={handleBulkEditSelected} disabled={!selectedOverviewRowIds.length || !reviewBulkValue.trim()}>Apply</button>
                    </div>
                  </article>
                </div>
                <article className="review-list-v2-panel review-list-v2-quality">
                  <h4>Data Quality Summary</h4>
                  <div className="review-list-v2-quality-cards">
                    <span className="green"><strong>{reviewStats.validRecords || 0}</strong>Valid Records</span>
                    <span className="orange"><strong>{reviewStats.missingEmails || 0}</strong>Missing Emails</span>
                    <span className="red"><strong>{reviewStats.duplicates || 0}</strong>Duplicates</span>
                    <span className="blue"><strong>{reviewStats.otherMissing || 0}</strong>Other Missing</span>
                  </div>
                  <ul>
                    <li><i className="ti ti-circle-check" aria-hidden="true" /> Email format validation <span>{reviewStats.checks?.emailFormat?.valid || 0} valid, {reviewStats.checks?.emailFormat?.invalid || 0} invalid</span></li>
                    <li><i className="ti ti-alert-circle" aria-hidden="true" /> Duplicate email check <span>{reviewStats.checks?.duplicateEmail?.duplicates || 0} duplicates found</span></li>
                    <li><i className="ti ti-alert-triangle" aria-hidden="true" /> Required fields check <span>{reviewStats.checks?.requiredFields?.missing || 0} fields missing</span></li>
                    <li><i className="ti ti-circle-check" aria-hidden="true" /> Data consistency check <span>{reviewStats.checks?.dataConsistency?.ok ? 'All good' : 'Review needed'}</span></li>
                  </ul>
                </article>
                <article className="review-list-v2-panel review-list-v2-rules">
                  <i className="ti ti-bulb" aria-hidden="true" />
                  <ul>
                    <li>Review all missing and invalid data before proceeding.</li>
                    <li>You can add, edit, or delete rows as needed.</li>
                    <li>Use Save Changes to update your list.</li>
                    <li>Only valid records will be used for your campaign.</li>
                  </ul>
                </article>
              </section>
            </main>

            <footer className="review-list-v2-footer">
              <button type="button" className="review-list-v2-footer-secondary" onClick={() => setShowOverviewPopup(false)}>Cancel</button>
              <div>
                <button type="button" className="review-list-v2-footer-secondary" onClick={handleOverviewBack}>
                  <i className="ti ti-arrow-left" aria-hidden="true" /> Back
                </button>
                <button
                  type="button"
                  className={`review-list-v2-footer-primary${hasOverviewData && !reviewDataLoading ? '' : ' disabled'}`}
                  onClick={handleOverviewConfirm}
                  disabled={!hasOverviewData || reviewDataLoading}
                  title={(reviewStats.missingEmails || reviewStats.invalidEmails || reviewStats.duplicates) ? 'This list has warnings. Existing workflow allows continuing after review.' : 'Continue'}
                >
                  Next <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {renderPortalPopup(
        false && showOverviewPopup,
        <div className="wf-backdrop" onClick={() => setShowOverviewPopup(false)}>
          <div className="premium-calendar-modal wf-modal premium-review-modal" style={popupStyleFor('overview')} onClick={(event) => event.stopPropagation()}>
            <div className="wf-header">
              <span className="wf-header-badge">2</span>
              <h3 className="wf-header-title">Step 2: Review List</h3>
              <small className="wf-header-step">Step 2 of 7</small>
              <button type="button" className="wf-header-close" onClick={() => setShowOverviewPopup(false)}>×</button>
            </div>
            <div className="wf-body premium-review-body">
              {showProceedWithoutListNote ? (
                <p className="premium-review-inline-note premium-review-inline-note-warning">
                  Proceeding without a client list. You can continue exploring the workflow and choose a list later.
                </p>
              ) : null}
              {reviewDataLoading ? (
                <p className="premium-review-inline-note">
                  Loading selected uploaded list data...
                </p>
              ) : null}
              <div className="premium-review-summary">
                <h4>File Summary</h4>
                {summaryStats.map((item) => (
                  <article key={item.label} className={`premium-review-stat ${item.label === 'Missing Values' ? 'alert' : ''}`}>
                    <span className="premium-review-stat-icon" aria-hidden="true"></span>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              <section className="premium-review-block">
                <div className="premium-review-block-head">
                  <div>
                    <h4>Column Mapping</h4>
                  </div>
                  <button type="button" className="ghost subtle" onClick={() => setMappingCollapsed((current) => !current)}>
                    {mappingCollapsed ? 'Show Mapping' : 'Minimize'}
                  </button>
                </div>
                {!mappingCollapsed ? <div className="premium-review-mapping">
                  <div className="premium-review-mapping-head">
                    <span>Sheet Column Name</span>
                    <span>Mapped Field</span>
                    <span>Sample Value / Preview</span>
                  </div>
                  {columnMappings.map((item) => (
                    <div key={item.sheetColumn} className="premium-review-mapping-row">
                      <strong>{item.sheetColumn}</strong>
                      <div className={`premium-review-status ${item.status}`}>
                        <span>{item.status === 'success' ? '✓' : item.status === 'warning' ? '!' : '✕'}</span>
                        <select
                          value={item.mappedField}
                          onChange={(event) =>
                            setColumnMappings((current) =>
                              current.map((entry) =>
                                entry.sheetColumn === item.sheetColumn
                                  ? { ...entry, mappedField: event.target.value, status: event.target.value === 'Ignore' ? 'warning' : 'success' }
                                  : entry
                              )
                            )
                          }
                        >
                          {mappedFieldOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span>{item.sample}</span>
                    </div>
                  ))}
                </div> : null}
              </section>

              <section className="premium-review-block">
                <div className="premium-review-block-head premium-review-block-head-table">
                  <div>
                    <h4>Data Preview</h4>
                    <p>Review and edit your sheet in a spreadsheet-style grid before saving.</p>
                  </div>
                  <div className="premium-review-tablebar">
                    <div className="premium-review-toolbar-group">
                      <span className="premium-review-toolbar-label">Search</span>
                      <input
                        type="search"
                        value={overviewSearch}
                        onChange={(event) => setOverviewSearch(event.target.value)}
                        placeholder="Search rows"
                      />
                    </div>
                    <div className="premium-review-toolbar-group">
                      <span className="premium-review-toolbar-label">Filter</span>
                      <select value={overviewFilter} onChange={(event) => setOverviewFilter(event.target.value)}>
                        <option value="all">All rows</option>
                        <option value="errors">Errors only</option>
                        <option value="missing">Missing only</option>
                        <option value="duplicates">Duplicates only</option>
                      </select>
                    </div>
                    <div className="premium-review-toolbar-actions">
                      <button type="button" className="ghost subtle" onClick={() => addOverviewRow()}>
                        Add Row
                      </button>
                      <button type="button" className="ghost subtle" onClick={addOverviewColumn}>
                        Add Column
                      </button>
                      <button type="button" className="ghost subtle" onClick={toggleAllOverviewRows} disabled={!filteredOverviewRows.length}>
                        {allVisibleOverviewRowsSelected ? 'Clear Selection' : 'Select All'}
                      </button>
                      <button type="button" className="ghost subtle danger" onClick={deleteSelectedOverviewRows} disabled={!selectedOverviewRowIds.length}>
                        Delete Selected
                      </button>
                      <button type="button" className="ghost primary" onClick={() => onPreviewSave?.()} disabled={!previewDirty}>Save</button>
                    </div>
                  </div>
                </div>

                <div className="premium-review-tablewrap">
                  <div className="premium-review-table premium-review-table-head" style={{ gridTemplateColumns: `48px 56px ${overviewGridTemplate}` }}>
                    <span className="premium-review-select-cell">
                      <input
                        type="checkbox"
                        checked={allVisibleOverviewRowsSelected}
                        onChange={toggleAllOverviewRows}
                        aria-label="Select all visible rows"
                      />
                    </span>
                    <span>#</span>
                    {activeOverviewColumns.map((item) => (
                      <span
                        key={`head-${item.sheetColumn}`}
                        className="premium-review-head-cell"
                        onDoubleClick={() => renameOverviewColumn(item.sheetColumn)}
                        title="Double-click to rename"
                      >
                        {item.sheetColumn}
                      </span>
                    ))}
                  </div>
                  <div className="premium-review-table-body">
                    {!filteredOverviewRows.length ? (
                      <div className="premium-review-empty-row">
                        {reviewDataLoading ? 'Loading selected list rows...' : 'No rows to show yet.'}
                      </div>
                    ) : null}
                    {filteredOverviewRows.map((row, index) => {
                      const issues = rowIssues[row.id] || [];
                      return (
                        <div key={row.id} className="premium-review-table premium-review-table-row" style={{ gridTemplateColumns: `48px 56px ${overviewGridTemplate}` }}>
                          <span className="premium-review-select-cell">
                            <input
                              type="checkbox"
                              checked={selectedOverviewRowIds.includes(row.id)}
                              onChange={() => toggleOverviewRowSelection(row.id)}
                              aria-label={`Select row ${index + 1}`}
                            />
                          </span>
                          <span>{index + 1}</span>
                          {activeOverviewColumns.map((mapping) => {
                            const field = mapping.sheetColumn;
                            const cellKey = `${row.id}-${field}`;
                            const isActive = editingCell === cellKey;
                            const value = row?.[field] || '';
                            const className = [
                              'premium-review-cell',
                              mapping.mappedField === 'Email' && issues.includes('invalid') ? 'invalid' : '',
                              !value ? 'missing' : '',
                              mapping.mappedField === 'Email' && issues.includes('duplicate') ? 'duplicate' : ''
                            ].filter(Boolean).join(' ');
                            return (
                              <label
                                key={cellKey}
                                className={className}
                                onClick={() => setEditingCell(cellKey)}
                              >
                                {isActive ? (
                                  <input
                                    autoFocus
                                    value={value}
                                    onChange={(event) => {
                                      updateOverviewCell(row.id, field, event.target.value);
                                      onPreviewCellChange?.(row.id - 1, field, event.target.value);
                                    }}
                                    onBlur={() => setEditingCell(null)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') setEditingCell(null);
                                    }}
                                  />
                                ) : (
                                  <>
                                    <span>{value || 'Missing value'}</span>
                                    <i>?</i>
                                  </>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="premium-review-validation">
                <div className="premium-review-validation-col">
                  <div className="success">
                    <span>?</span>
                    <p>Email column detected</p>
                  </div>
                  <div className="success">
                    <span>?</span>
                    <p>Name column detected</p>
                  </div>
                  <div className="success">
                    <span>?</span>
                    <p>{activeOverviewColumns.length} mapped fields ready</p>
                  </div>
                </div>
                <div className="premium-review-validation-col">
                  <div className={missingValueCount ? 'warning' : 'success'}>
                    <div>
                      <span>{missingValueCount ? '!' : '?'}</span>
                      <p>{missingValueCount} missing values found</p>
                    </div>
                    <button type="button" onClick={() => setOverviewFilter('missing')}>View</button>
                  </div>
                  <div className="warning">
                    <div>
                      <span>!</span>
                      <p>{overviewRows.filter((row) => !String(row?.[emailMapping?.sheetColumn] || "").trim()).length} rows missing email</p>
                    </div>
                    <button type="button" onClick={() => setOverviewFilter('missing')}>View</button>
                  </div>
                  <div className="warning">
                    <div>
                      <span>!</span>
                      <p>{overviewRows.filter((row) => rowIssues[row.id]?.includes('duplicate')).length} duplicate contacts found</p>
                    </div>
                    <button type="button" onClick={() => setOverviewFilter('duplicates')}>View</button>
                  </div>
                  <div className="error">
                    <div>
                      <span>✕</span>
                      <p>{overviewRows.filter((row) => rowIssues[row.id]?.includes('invalid')).length} invalid email formats found</p>
                    </div>
                    <button type="button" onClick={() => setOverviewFilter('errors')}>View</button>
                  </div>
                </div>
              </section>
            </div>

            <div className="wf-footer">
              <div className="wf-footer-left">
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={handleOverviewBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={handleOverviewReupload}
                >
                  Re-upload
                </button>
              </div>
              {showOverviewNotice && !hasOverviewData && !reviewDataLoading ? (
                <div className="premium-review-inline-note">
                  No data yet. Please select or upload a client list before continuing.
                </div>
              ) : null}
              <button
                type="button"
                className={`wf-btn-primary${hasOverviewData && !reviewDataLoading ? '' : ' is-disabled'}`}
                onClick={handleOverviewConfirm}
              >
                {reviewDataLoading ? 'Loading list...' : hasOverviewData ? 'Continue' : 'Select required file first'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showSchedulePopup,
        <div className="wf-backdrop schedule-v2-backdrop" onClick={() => setShowSchedulePopup(false)}>
          <div className="schedule-v2-modal" onClick={(event) => event.stopPropagation()}>
            <header className="schedule-v2-header">
              <div className="schedule-v2-title">
                <span><i className="ti ti-calendar-event" aria-hidden="true" /></span>
                <div>
                  <h3>7. Schedule Campaign</h3>
                  <p>Choose when and how your campaign should be sent</p>
                </div>
              </div>
              <div className="schedule-v2-stepper" aria-label="Campaign workflow progress">
                {['Upload List', 'Review', 'Campaign', 'Select Draft', 'Draft Summary', 'Test Email', 'Schedule'].map((label, index, items) => (
                  <div key={label} className={`schedule-v2-step ${index < 6 ? 'done' : 'active'}`}>
                    <span>{index < 6 ? <i className="ti ti-check" aria-hidden="true" /> : index + 1}</span>
                    <b>{label}</b>
                    {index < items.length - 1 ? <em /> : null}
                  </div>
                ))}
              </div>
              <button type="button" className="schedule-v2-close" onClick={() => setShowSchedulePopup(false)} aria-label="Close schedule popup">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </header>

            <main className="schedule-v2-main workflow-popup-body">
              <section className="schedule-v2-left">
                <article className="schedule-v2-card schedule-v2-type-card">
                  <header>
                    <h4>Schedule Type</h4>
                    <p>Choose when to send your campaign</p>
                  </header>
                  <div className="schedule-v2-type-grid">
                    <label className={`schedule-v2-type-option ${sendMode === 'send_now' ? 'selected' : ''}`}>
                      <input type="radio" name="schedule-v2-send-mode" checked={sendMode === 'send_now'} onChange={() => setSendMode('send_now')} />
                      <span className="schedule-v2-radio" />
                      <i className="ti ti-send" aria-hidden="true" />
                      <strong>Send Now</strong>
                      <small>Start sending immediately</small>
                    </label>
                    <label className={`schedule-v2-type-option ${sendMode === 'scheduled' ? 'selected' : ''}`}>
                      <input type="radio" name="schedule-v2-send-mode" checked={sendMode === 'scheduled'} onChange={() => setSendMode('scheduled')} />
                      <span className="schedule-v2-radio" />
                      <i className="ti ti-calendar-time" aria-hidden="true" />
                      <strong>Schedule for Later</strong>
                      <small>Choose a specific date and time</small>
                    </label>
                  </div>
                </article>

                <article className="schedule-v2-card">
                  <header>
                    <h4>Sending Configuration</h4>
                  </header>
                  <div className="schedule-v2-form-grid">
                    <label className="schedule-v2-field">
                      <span>Batch Size (Emails per batch)<sup>*</sup></span>
                      <input type="number" min="1" value={batchSize} onChange={(event) => onBatchSizeChange?.(event.target.value)} />
                      <small>Recommended: 50 - 200</small>
                    </label>
                    <label className="schedule-v2-field">
                      <span>Delay Between Emails<sup>*</sup></span>
                      <div className="schedule-v2-split-input">
                        <input
                          type="number"
                          min="1"
                          max={delayInputLimit}
                          value={displayedDelayInterval}
                          onChange={(event) => {
                            const nextUnit = userFacingDurationUnit === 'hours' ? 'hours' : 'minutes';
                            const nextValue = normalizeDelayInputValue(event.target.value, nextUnit);
                            setDurationUnit(nextUnit);
                            onDelaySecondsChange?.(nextValue);
                          }}
                          onBlur={(event) => {
                            const nextValue = normalizeDelayInputValue(event.target.value, userFacingDurationUnit) || '1';
                            onDelaySecondsChange?.(nextValue);
                          }}
                        />
                        <select
                          value={userFacingDurationUnit}
                          onChange={(event) => {
                            const nextUnit = normalizeDurationUnit(event.target.value);
                            setDurationUnit(nextUnit);
                            onDelaySecondsChange?.(normalizeDelayInputValue(displayedDelayInterval, nextUnit));
                          }}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                        </select>
                      </div>
                      <small>Recommended: 60 - 120 seconds</small>
                    </label>
                    <label className="schedule-v2-field">
                      <span>Delay Between Batches</span>
                      <div className="schedule-v2-split-input">
                        <input type="number" min="0" value={scheduleDelayBetweenBatches} onChange={(event) => setScheduleDelayBetweenBatches(event.target.value)} />
                        <select value={scheduleDelayBatchUnit} onChange={(event) => setScheduleDelayBatchUnit(event.target.value)}>
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                        </select>
                      </div>
                      <small>Time to wait before next batch</small>
                    </label>
                    <label className="schedule-v2-field">
                      <span>Daily Sending Limit</span>
                      <input type="number" min="1" value={scheduleDailyLimit} onChange={(event) => setScheduleDailyLimit(event.target.value)} />
                      <small>Maximum emails to send per day</small>
                    </label>
                  </div>
                </article>

                <article className="schedule-v2-card">
                  <header>
                    <h4>Schedule Settings</h4>
                    <p>Select date, time and timezone for your campaign</p>
                  </header>
                  <div className="schedule-v2-form-grid three">
                    <label className="schedule-v2-field">
                      <span>Start Date<sup>*</sup></span>
                      <div className="schedule-v2-icon-input">
                        <i className="ti ti-calendar" aria-hidden="true" />
                        <input type="date" value={scheduledDateValue} onChange={(event) => setScheduledDateValue(event.target.value)} disabled={sendMode !== 'scheduled'} />
                      </div>
                    </label>
                    <label className="schedule-v2-field">
                      <span>Start Time<sup>*</sup></span>
                      <div className="schedule-v2-icon-input">
                        <i className="ti ti-clock" aria-hidden="true" />
                        <input type="time" value={scheduledTimeValue} onChange={(event) => setScheduledTimeValue(event.target.value)} disabled={sendMode !== 'scheduled'} />
                      </div>
                    </label>
                    <label className="schedule-v2-field">
                      <span>Time Zone<sup>*</sup></span>
                      <select value={scheduleTimezone} onChange={(event) => setScheduleTimezone(event.target.value)}>
                        {(scheduleCountries[scheduleCountryKey] || scheduleCountries.India).map((timezone) => (
                          <option key={timezone} value={timezone}>{timezone}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="schedule-v2-toggle-line">
                    <input type="checkbox" checked={scheduleBusinessDaysOnly} onChange={(event) => setScheduleBusinessDaysOnly(event.target.checked)} />
                    <span />
                    <strong>Send only on business days</strong>
                    <small>Monday to Friday</small>
                  </label>
                </article>

                <article className="schedule-v2-card">
                  <header>
                    <h4>Advanced Options</h4>
                    <p>Additional settings for advanced users</p>
                  </header>
                  <div className="schedule-v2-advanced">
                    {[
                      ['Stop on Reply', 'Pause this campaign when a recipient replies', scheduleStopOnReply, setScheduleStopOnReply, 'ti-message-reply'],
                      ['Stop on Bounce', 'Pause if bounce rate exceeds threshold', scheduleStopOnBounce, setScheduleStopOnBounce, 'ti-mail-x'],
                      ['Resume on Next Day', 'Automatically resume if stopped', scheduleResumeNextDay, setScheduleResumeNextDay, 'ti-player-play'],
                      ['Smart Sending', 'Send at best time for each recipient', scheduleSmartSending, setScheduleSmartSending, 'ti-sparkles']
                    ].map(([title, text, checked, setter, icon]) => (
                      <div key={title} className="schedule-v2-advanced-card">
                        <i className={`ti ${icon}`} aria-hidden="true" />
                        <strong>{title}</strong>
                        <p>{text}</p>
                        {title === 'Stop on Bounce' ? (
                          <div className="schedule-v2-threshold">
                            <input type="number" min="1" value={scheduleBounceThreshold} onChange={(event) => setScheduleBounceThreshold(event.target.value)} />
                            <span>%</span>
                          </div>
                        ) : null}
                        <button type="button" className={`schedule-v2-switch ${checked ? 'on' : ''}`} onClick={() => setter(!checked)} aria-pressed={checked}>
                          <span />
                        </button>
                      </div>
                    ))}
                  </div>
                </article>

                <div className="schedule-v2-note" role="note">
                  <i className="ti ti-info-circle" aria-hidden="true" />
                  <div>
                    <strong>Important Note</strong>
                    <p>Once scheduled, your campaign will be added to the sending queue. You can pause, resume or stop it anytime from the Campaigns dashboard.</p>
                  </div>
                </div>

                {showScheduleContinueWarning && !hasScheduleRequiredFields ? (
                  <p className="schedule-v2-warning">{scheduleContinueHint}</p>
                ) : null}
                {scheduleInlineNotice ? (
                  <div className={`schedule-v2-inline-notice ${scheduleInlineNotice.tone || 'info'}`} role="status" aria-live="polite">
                    <strong>
                      {scheduleInlineNotice.tone === 'success'
                        ? 'Success'
                        : scheduleInlineNotice.tone === 'error'
                          ? 'Action failed'
                          : scheduleInlineNotice.tone === 'warning'
                            ? 'Check details'
                            : 'Notification'}
                    </strong>
                    <p>{scheduleInlineNotice.message}</p>
                  </div>
                ) : null}
              </section>

              <aside className="schedule-v2-right">
                <article className="schedule-v2-card schedule-v2-summary">
                  <header>
                    <h4>Campaign Summary</h4>
                    <button type="button" onClick={() => { setShowSchedulePopup(false); setShowCampaignPopup(true); }}>
                      <i className="ti ti-pencil" aria-hidden="true" /> Edit
                    </button>
                  </header>
                  {[
                    ['Campaign Name', effectiveCampaignName || 'Campaign', 'ti-send'],
                    ['Project', scheduleProjectLabel, 'ti-briefcase'],
                    ['Total Recipients', campaignAudienceSummary.total.toLocaleString(), 'ti-users'],
                    ['Valid Emails', `${scheduleReadyCount.toLocaleString()} (${campaignAudienceSummary.percent(scheduleReadyCount)})`, 'ti-shield-check', 'good'],
                    ['Invalid Emails', `${scheduleInvalidCount.toLocaleString()} (${campaignAudienceSummary.percent(scheduleInvalidCount)})`, 'ti-alert-triangle', 'bad'],
                    ['Draft Used', scheduleDraftLabel, 'ti-file-text'],
                    ['Campaign Type', campaignType || 'Cold Email', 'ti-send'],
                    ['Sender', scheduleSenderLabel, 'ti-mail'],
                    ['Reply To', campaignReplyToValue || draftSummarySenderEmail, 'ti-arrow-back-up']
                  ].map(([label, value, icon, tone]) => (
                    <div key={label} className={`schedule-v2-summary-row ${tone || ''}`}>
                      <i className={`ti ${icon}`} aria-hidden="true" />
                      <span>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </article>

                <article className="schedule-v2-card schedule-v2-preview">
                  <header>
                    <h4>Email Preview</h4>
                    <button type="button" onClick={openScheduleFullPreview}>
                      <i className="ti ti-eye" aria-hidden="true" /> Preview Full Email <i className="ti ti-external-link" aria-hidden="true" />
                    </button>
                  </header>
                  <div className="schedule-v2-preview-box">
                    <div className="schedule-v2-preview-subject">
                      <span>Subject:</span>
                      <strong>{effectiveDraftSubject || 'No draft subject yet'}</strong>
                    </div>
                    <div className="schedule-v2-preview-body">
                      <EmailRenderer html={testPreviewHtml || effectiveDraftMessage} empty={<p>Your selected draft preview will appear here.</p>} />
                    </div>
                  </div>
                </article>

                <article className="schedule-v2-duration">
                  <i className="ti ti-clock-hour-4" aria-hidden="true" />
                  <div>
                    <strong>Estimated Campaign Duration</strong>
                    <p>Based on your settings, this campaign will take approximately</p>
                    <b>{scheduleDurationLabel}</b>
                  </div>
                </article>
              </aside>
            </main>

            <footer className="schedule-v2-footer">
              <button type="button" className="schedule-v2-secondary" onClick={() => setShowSchedulePopup(false)}>Cancel</button>
              <div>
                <button
                  type="button"
                  className="schedule-v2-secondary"
                  onClick={() => {
                    setShowSchedulePopup(false);
                    setShowTestEmailPopup(true);
                  }}
                >
                  <i className="ti ti-arrow-left" aria-hidden="true" /> Back
                </button>
                <button
                  type="button"
                  className={`schedule-v2-primary${canAttemptScheduleAction ? '' : ' is-disabled'}`}
                  aria-disabled={!canAttemptScheduleAction}
                  onClick={handleScheduleStart}
                >
                  Schedule Campaign <i className="ti ti-calendar-plus" aria-hidden="true" />
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {renderPortalPopup(
        false && showSchedulePopup,
        <div className="wf-backdrop" onClick={() => setShowSchedulePopup(false)}>
          <div className={`premium-calendar-modal wf-modal premium-schedule-modal${sendMode === 'scheduled' ? ' is-scheduled-mode' : ''}`} style={popupStyleFor('schedule')} onClick={(event) => event.stopPropagation()}>
            <div className="wf-header">
              <span className="wf-header-badge">7</span>
              <h3 className="wf-header-title">Step 7: Schedule</h3>
              <small className="wf-header-step">Step 7 of 7</small>
              <button type="button" className="wf-header-close" onClick={() => setShowSchedulePopup(false)}>×</button>
            </div>

            <div className="wf-body premium-schedule-body">
              <div className="premium-schedule-mode">
                <label className={sendMode === 'send_now' ? 'active' : ''}>
                  <input
                    type="radio"
                    name="sendMode"
                    checked={sendMode === 'send_now'}
                    onChange={() => setSendMode('send_now')}
                  />
                  <i className="ti ti-send" aria-hidden="true" />
                  <span>Send now</span>
                </label>
                <label className={sendMode === 'scheduled' ? 'active' : ''}>
                  <input
                    type="radio"
                    name="sendMode"
                    checked={sendMode === 'scheduled'}
                    onChange={() => setSendMode('scheduled')}
                  />
                  <i className="ti ti-clock" aria-hidden="true" />
                  <span>Send at scheduled time</span>
                </label>
              </div>

              <div className="premium-schedule-section">
                <div className="premium-schedule-section-head">
                  <i className="ti ti-adjustments-horizontal" aria-hidden="true" />
                  <span>Delivery settings</span>
                </div>
                <div className="premium-schedule-grid premium-schedule-grid-3">
                  <label className="premium-schedule-field">
                    <span>Batch size</span>
                    <input type="number" min="1" value={batchSize} onChange={(event) => onBatchSizeChange?.(event.target.value)} />
                  </label>
                  <label className="premium-schedule-field">
                    <span>Send rows</span>
                    <select value={rowLimitMode} onChange={(event) => handleRowLimitModeChange(event.target.value)}>
                      <option value="all">All rows</option>
                      <option value="custom">Select range</option>
                    </select>
                  </label>
                  <label className="premium-schedule-field">
                    <span>From row</span>
                    <input
                      type="number"
                      min="1"
                      value={rowRangeStartValue}
                      disabled={rowLimitMode !== 'custom'}
                      onChange={(event) => handleRowRangePartChange('start', event.target.value)}
                    />
                  </label>
                  <label className="premium-schedule-field">
                    <span>To row</span>
                    <input
                      type="number"
                      min="1"
                      value={rowRangeEndValue}
                      disabled={rowLimitMode !== 'custom'}
                      onChange={(event) => handleRowRangePartChange('end', event.target.value)}
                    />
                  </label>
                  <label className="premium-schedule-field">
                    <span>Delay interval</span>
                    <input
                      type="number"
                      min="1"
                      max={delayInputLimit}
                      value={displayedDelayInterval}
                      onChange={(event) => {
                        const nextUnit = userFacingDurationUnit === 'hours' ? 'hours' : 'minutes';
                        const nextValue = normalizeDelayInputValue(event.target.value, nextUnit);
                        setDurationUnit(nextUnit);
                        onDelaySecondsChange?.(nextValue);
                      }}
                      onBlur={(event) => {
                        const nextValue = normalizeDelayInputValue(event.target.value, userFacingDurationUnit) || '1';
                        onDelaySecondsChange?.(nextValue);
                      }}
                    />
                  </label>
                  <label className="premium-schedule-field">
                    <span>Duration unit</span>
                    <select
                      value={userFacingDurationUnit}
                      onChange={(event) => {
                        const nextUnit = event.target.value;
                        setDurationUnit(nextUnit);
                        onDelaySecondsChange?.(normalizeDelayInputValue(delaySeconds, nextUnit) || '1');
                      }}
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                    </select>
                  </label>
                </div>
              </div>

              {sendMode === 'scheduled' ? (
              <div className="premium-schedule-section premium-schedule-section-timing">
                <div className="premium-schedule-section-head">
                  <i className="ti ti-calendar-time" aria-hidden="true" />
                  <span>Schedule details</span>
                </div>
                <div className="premium-schedule-grid premium-schedule-grid-2">
                  <label className="premium-schedule-field">
                    <span>Scheduled date</span>
                    <input
                      type="date"
                      value={scheduledDateValue}
                      onChange={(event) => setScheduledDateValue(event.target.value)}
                    />
                  </label>
                  <label className="premium-schedule-field">
                    <span>Scheduled time</span>
                    <input
                      type="time"
                      value={scheduledTimeValue}
                      onChange={(event) => setScheduledTimeValue(event.target.value)}
                    />
                  </label>
                  <label className="premium-schedule-field">
                    <span>Country</span>
                    <select value={scheduledCountry} onChange={(event) => onScheduledCountryChange?.(event.target.value)}>
                      {Object.keys(scheduleCountries).map((country) => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </label>
                  <label className="premium-schedule-field">
                    <span>Time zone</span>
                    <select value={scheduleTimezone} onChange={(event) => setScheduleTimezone(event.target.value)}>
                      {(scheduleCountries[scheduleCountryKey] || scheduleCountries.India).map((timezone) => (
                        <option key={timezone} value={timezone}>{timezone}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="premium-schedule-inline-actions">
                  <button
                    type="button"
                    className={`wf-btn-secondary${canAttemptScheduleAction ? '' : ' is-disabled'}`}
                    aria-disabled={!canAttemptScheduleAction}
                    onClick={handleScheduleSave}
                  >
                    <i className="ti ti-device-floppy" aria-hidden="true" />
                    {scheduleSaveLabel}
                  </button>
                </div>
              </div>
              ) : null}

              {showScheduleContinueWarning && !hasScheduleRequiredFields ? (
                <p className="premium-select-draft-warning">
                  {scheduleContinueHint}
                </p>
              ) : null}
              {scheduleInlineNotice ? (
                <div className={`premium-schedule-inline-notice ${scheduleInlineNotice.tone || 'info'}`} role="status" aria-live="polite">
                  <strong>
                    {scheduleInlineNotice.tone === 'success'
                      ? 'Success'
                      : scheduleInlineNotice.tone === 'error'
                        ? 'Action failed'
                        : scheduleInlineNotice.tone === 'warning'
                          ? 'Check details'
                          : 'Notification'}
                  </strong>
                  <p>{scheduleInlineNotice.message}</p>
                  {scheduleInlineNotice.tone === 'success' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowSchedulePopup(false);
                        router.push('/dashboard/broadcasts');
                      }}
                    >
                      View Broadcasts
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="wf-footer">
              <div className="wf-footer-left">
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={() => {
                    setShowSchedulePopup(false);
                    setShowTestEmailPopup(true);
                  }}
                >
                  Back
                </button>
              </div>
              <button
                type="button"
                className={`wf-btn-primary${canAttemptScheduleAction ? '' : ' is-disabled'}`}
                aria-disabled={!canAttemptScheduleAction}
                onClick={handleScheduleStart}
              >
                {scheduleActionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showCampaignPopup,
        <div className="wf-backdrop campaign-v2-backdrop" onClick={() => setShowCampaignPopup(false)}>
          <div className="campaign-v2-modal" onClick={(event) => event.stopPropagation()}>
            <header className="campaign-v2-header">
              <div className="campaign-v2-title">
                <span><i className="ti ti-send" aria-hidden="true" /></span>
                <div>
                  <h3>3. Campaign</h3>
                  <p>Configure your campaign settings and sending preferences</p>
                </div>
              </div>
              <div className="campaign-v2-stepper" aria-label="Campaign workflow progress">
                {[
                  ['Upload List', 'done'],
                  ['Review', 'done'],
                  ['Campaign', 'active'],
                  ['Select Draft', ''],
                  ['Draft Summary', ''],
                  ['Test Email', ''],
                  ['Schedule', '']
                ].map(([label, status], index, items) => (
                  <div key={label} className={`campaign-v2-step ${status}`}>
                    <span>{status === 'done' ? <i className="ti ti-check" aria-hidden="true" /> : index + 1}</span>
                    <small>{label}</small>
                    {index < items.length - 1 ? <b aria-hidden="true" /> : null}
                  </div>
                ))}
              </div>
              <button type="button" className="campaign-v2-close" onClick={() => setShowCampaignPopup(false)} aria-label="Close Campaign">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </header>

            <main className="campaign-v2-body workflow-popup-body">
              <section className="campaign-v2-list-card">
                <div className="campaign-v2-list-left">
                  <span className="campaign-v2-excel"><i className="ti ti-file-spreadsheet" aria-hidden="true" /></span>
                  <div>
                    <h4>{campaignSelectedListMeta.title}</h4>
                    <p>
                      <strong>{campaignSelectedListMeta.project}</strong>
                      <em>{campaignAudienceSummary.total} Records</em>
                      <em>{campaignAudienceSummary.valid} Valid</em>
                      <em>{campaignAudienceSummary.missing} Missing Emails</em>
                      <em>{campaignAudienceSummary.duplicates} Duplicates</em>
                    </p>
                  </div>
                </div>
                <div className="campaign-v2-list-meta">
                  <article>
                    <i className="ti ti-database" aria-hidden="true" />
                    <span>Source</span>
                    <strong>{campaignSelectedListMeta.source}</strong>
                  </article>
                  <article>
                    <i className="ti ti-refresh" aria-hidden="true" />
                    <span>Last Updated</span>
                    <strong>{campaignSelectedListMeta.updatedLabel}</strong>
                  </article>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCampaignPopup(false);
                      setShowOverviewPopup(true);
                    }}
                  >
                    View / Edit List
                  </button>
                </div>
              </section>

              <section className="campaign-v2-grid">
                <div className="campaign-v2-left">
                  <article className="campaign-v2-card campaign-v2-details">
                    <header>
                      <h4>Campaign Details</h4>
                      <p>Basic information about your campaign</p>
                    </header>
                    <div className="campaign-v2-form-grid">
                      <label>
                        <span>Campaign Name <b>*</b></span>
                        <input
                          value={effectiveCampaignName}
                          onChange={(event) => onCampaignNameChange ? onCampaignNameChange(event.target.value) : setCampaignName(event.target.value)}
                          placeholder="Campaign name"
                          aria-invalid={!String(effectiveCampaignName || '').trim()}
                        />
                      </label>
                      <label>
                        <span>Project <b>*</b></span>
                        <select
                          value={campaignProjectFilter}
                          onChange={(event) => setCampaignProjectFilter(event.target.value)}
                          disabled={isNextProcessMode || isBulkReplyMode}
                        >
                          <option value="">Select project</option>
                          {projectOptions.map((item) => (
                            <option key={item} value={item}>{String(item).toUpperCase()} Project</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Campaign Type <b>*</b></span>
                        <select value={campaignType} onChange={(event) => setCampaignType(event.target.value)}>
                          <option>Cold Email</option>
                          <option>Follow Up</option>
                          <option>Warm-up</option>
                          <option>Newsletter</option>
                          <option>Re-engagement</option>
                        </select>
                      </label>
                      <label>
                        <span>Selected Client List <b>*</b></span>
                        <div className="campaign-v2-input-action">
                          <input value={campaignSelectedListMeta.title} readOnly />
                          <button
                            type="button"
                            onClick={() => {
                              setShowCampaignPopup(false);
                              setShowClientListPopup(true);
                            }}
                          >
                            Change List
                          </button>
                        </div>
                      </label>
                    </div>
                    <label className="campaign-v2-description">
                      <span>Campaign Description</span>
                      <textarea
                        maxLength={500}
                        value={campaignDescription}
                        onChange={(event) => setCampaignDescription(event.target.value)}
                        placeholder="Describe this campaign"
                      />
                      <small>{campaignDescription.length}/500</small>
                    </label>
                    <div className="campaign-v2-autosave">
                      <i className="ti ti-cloud-check" aria-hidden="true" />
                      <span>{previewDirty ? 'Unsaved list changes detected' : 'Auto Save ready'}</span>
                    </div>
                  </article>

                  <article className="campaign-v2-card campaign-v2-sendprefs">
                    <header>
                      <h4>Sending Preferences</h4>
                      <p>Set how your campaign emails will be sent</p>
                    </header>
                    {isBulkReplyMode && !senderActive ? (
                      <div className="campaign-v2-warning">
                        <strong>Original sender account is disconnected.</strong>
                        <span>Please choose an active approved Sender ID from the dropdown below.</span>
                      </div>
                    ) : null}
                    <div className="campaign-v2-pref-grid">
                      <label className="campaign-v2-pref-card">
                        <span><i className="ti ti-mail" aria-hidden="true" /> From (Sender ID) <b>*</b></span>
                        {visibleCampaignSenderAccounts.length ? (
                          <select
                            value={effectiveCampaignSender}
                            onChange={(event) => {
                              setCampaignSender(event.target.value);
                              onSelectSenderAccount?.(event.target.value);
                            }}
                            disabled={(isNextProcessMode || isBulkReplyMode) && senderActive}
                          >
                            <option value="">Select sender</option>
                            {visibleCampaignSenderAccounts.map((account) => (
                              <option key={account.id} value={account.id}>{account.from}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="campaign-v2-empty-sender">{campaignProjectFilter ? senderEmptyMessage : 'Select a project first.'}</div>
                        )}
                        <small className={campaignSenderHealth.tone}>{campaignSenderHealth.label}</small>
                      </label>
                      <label className="campaign-v2-pref-card">
                        <span><i className="ti ti-arrow-back-up" aria-hidden="true" /> Reply To <b>*</b></span>
                        <select value={campaignReplyToValue} onChange={(event) => setCampaignReplyTo(event.target.value)}>
                          <option value="">Select reply-to</option>
                          {visibleCampaignSenderAccounts.map((account) => (
                            <option key={account.id} value={account.id}>{account.from}</option>
                          ))}
                        </select>
                        <small className={campaignSenderHealth.tone}>{campaignSenderHealth.label}</small>
                      </label>
                      <div className="campaign-v2-pref-card campaign-v2-toggle-card">
                        <span><i className="ti ti-activity" aria-hidden="true" /> Tracking</span>
                        <label className="campaign-v2-switch">
                          <input type="checkbox" checked={campaignTracking.opens || campaignTracking.clicks} onChange={(event) => {
                            setCampaignTracking((current) => ({ ...current, opens: event.target.checked, clicks: event.target.checked }));
                            setCampaignOpenTracking(event.target.checked);
                            setCampaignClickTracking(event.target.checked);
                          }} />
                          <i />
                        </label>
                        <small>Track opens and clicks</small>
                      </div>
                      <div className="campaign-v2-pref-card campaign-v2-toggle-card">
                        <span><i className="ti ti-shield" aria-hidden="true" /> Unsubscribe Link</span>
                        <label className="campaign-v2-switch">
                          <input type="checkbox" checked={campaignUnsubscribe} onChange={(event) => setCampaignUnsubscribe(event.target.checked)} />
                          <i />
                        </label>
                        <small>Add unsubscribe option</small>
                      </div>
                    </div>
                    <div className="campaign-v2-tracking-row">
                      {[
                        ['Open Tracking', campaignOpenTracking, setCampaignOpenTracking],
                        ['Click Tracking', campaignClickTracking, setCampaignClickTracking],
                        ['Smart Sending', campaignSmartSending, setCampaignSmartSending]
                      ].map(([label, value, setter]) => (
                        <label key={label}>
                          <input type="checkbox" checked={value} onChange={(event) => setter(event.target.checked)} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="campaign-v2-tags-row">
                      <span>Custom Tags</span>
                      <div className="premium-campaign-tags campaign-v2-tags" ref={campaignTagsRef}>
                        {campaignTags.map((tag) => (
                          <button key={tag} type="button" className="premium-campaign-tag" onClick={() => removeCampaignTag(tag)}>
                            {tag} <i>x</i>
                          </button>
                        ))}
                        <input
                          type="text"
                          value={campaignTagDraft}
                          onChange={(event) => {
                            setCampaignTagDraft(event.target.value);
                            setShowCampaignTagSuggestions(Boolean(event.target.value.trim()));
                            setActiveCampaignTagSuggestion(-1);
                          }}
                          onFocus={() => setShowCampaignTagSuggestions(Boolean(campaignTagDraft.trim()))}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowDown' && campaignTagSuggestions.length) {
                              event.preventDefault();
                              setShowCampaignTagSuggestions(true);
                              setActiveCampaignTagSuggestion((current) => current >= campaignTagSuggestions.length - 1 ? 0 : current + 1);
                              return;
                            }
                            if (event.key === 'ArrowUp' && campaignTagSuggestions.length) {
                              event.preventDefault();
                              setShowCampaignTagSuggestions(true);
                              setActiveCampaignTagSuggestion((current) => current <= 0 ? campaignTagSuggestions.length - 1 : current - 1);
                              return;
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setShowCampaignTagSuggestions(false);
                              setActiveCampaignTagSuggestion(-1);
                              return;
                            }
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              const selectedSuggestion = campaignTagSuggestions[activeCampaignTagSuggestion];
                              addCampaignTag(selectedSuggestion?.value || campaignTagDraft);
                            }
                          }}
                          placeholder="Enter tags (e.g. Robotics, CTO, Magazine)"
                        />
                        {showCampaignTagSuggestions && campaignTagSuggestions.length ? (
                          <div id="campaign-tag-suggestions" ref={campaignTagSuggestionsRef} className="premium-campaign-tag-suggestions" role="listbox">
                            {['Sector', 'Country'].map((label) => {
                              const groupedSuggestions = campaignTagSuggestions.map((suggestion, index) => ({ ...suggestion, index })).filter((suggestion) => suggestion.label === label);
                              if (!groupedSuggestions.length) return null;
                              return (
                                <div className="premium-campaign-tag-suggestion-group" key={label}>
                                  <div className="premium-campaign-tag-suggestion-heading">{label === 'Sector' ? 'Magazine sectors' : 'Countries'}</div>
                                  {groupedSuggestions.map((suggestion) => (
                                    <button
                                      id={`campaign-tag-suggestion-${suggestion.index}`}
                                      key={`${suggestion.label}-${suggestion.value}`}
                                      type="button"
                                      role="option"
                                      aria-selected={activeCampaignTagSuggestion === suggestion.index}
                                      className={activeCampaignTagSuggestion === suggestion.index ? 'is-active' : ''}
                                      onMouseEnter={() => setActiveCampaignTagSuggestion(suggestion.index)}
                                      onClick={() => addCampaignTag(suggestion.value)}
                                    >
                                      <strong>{suggestion.value}</strong>
                                    </button>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="campaign-v2-health-row">
                      <span className={campaignSenderHealth.tone}>{campaignSenderHealth.label}</span>
                      <span>Spam Risk: {campaignSenderHealth.spamRisk}</span>
                      <span>Live Status: {selectedCampaignSenderAccount ? 'Connected' : 'Sender required'}</span>
                    </div>
                  </article>
                </div>

                <div className="campaign-v2-right">
                  <article className="campaign-v2-card campaign-v2-audience">
                    <header>
                      <h4>Audience Summary</h4>
                      <p>Overview of your selected audience</p>
                    </header>
                    <div className="campaign-v2-audience-content">
                      <div className="campaign-v2-donut" style={{ background: campaignAudienceChart }}><span /></div>
                      <div className="campaign-v2-legend">
                        {[
                          ['Valid Emails', campaignAudienceSummary.valid, campaignAudienceSummary.percent(campaignAudienceSummary.valid), 'green'],
                          ['Missing Emails', campaignAudienceSummary.missing, campaignAudienceSummary.percent(campaignAudienceSummary.missing), 'orange'],
                          ['Duplicates', campaignAudienceSummary.duplicates, campaignAudienceSummary.percent(campaignAudienceSummary.duplicates), 'red'],
                          ['Invalid Emails', campaignAudienceSummary.invalid, campaignAudienceSummary.percent(campaignAudienceSummary.invalid), 'darkred'],
                          ['Blocked', campaignAudienceSummary.blocked, campaignAudienceSummary.percent(campaignAudienceSummary.blocked), 'gray'],
                          ['Bounce Risk', campaignAudienceSummary.bounceRisk, campaignAudienceSummary.percent(campaignAudienceSummary.bounceRisk), 'blue']
                        ].map(([label, value, pct, tone]) => (
                          <div key={label}>
                            <span className={tone} />
                            <strong>{label}</strong>
                            <b>{value} ({pct})</b>
                          </div>
                        ))}
                        <div className="campaign-v2-total">
                          <strong>Total Records</strong>
                          <b>{campaignAudienceSummary.total}</b>
                        </div>
                      </div>
                    </div>
                  </article>

                  <div className="campaign-v2-right-bottom">
                    <article className="campaign-v2-card campaign-v2-settings">
                      <header>
                        <span><i className="ti ti-settings" aria-hidden="true" /></span>
                        <div>
                          <h4>Campaign Settings</h4>
                          <p>Set limits and behavior for your campaign</p>
                        </div>
                      </header>
                      <label>
                        <span>Daily Sending Limit</span>
                        <input type="number" min="1" value={batchSize} onChange={(event) => onBatchSizeChange?.(event.target.value)} />
                        <em>emails per day per sender</em>
                      </label>
                      <div className="campaign-v2-settings-grid">
                        <label>
                          <span>Delay Between Emails</span>
                          <input
                            type="number"
                            min="1"
                            max={delayInputLimit}
                            value={displayedDelayInterval}
                            onChange={(event) => {
                              const nextUnit = userFacingDurationUnit === 'hours' ? 'hours' : 'minutes';
                              const nextValue = normalizeDelayInputValue(event.target.value, nextUnit);
                              setDurationUnit(nextUnit);
                              onDelaySecondsChange?.(nextValue);
                            }}
                          />
                        </label>
                        <label>
                          <span>Delay Unit</span>
                          <select
                            value={userFacingDurationUnit}
                            onChange={(event) => {
                              const nextUnit = normalizeDurationUnit(event.target.value);
                              setDurationUnit(nextUnit);
                              onDelaySecondsChange?.(normalizeDelayInputValue(displayedDelayInterval, nextUnit));
                            }}
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                          </select>
                        </label>
                      </div>
                      <label>
                        <span>Time Zone</span>
                        <select value={scheduleTimezone} onChange={(event) => setScheduleTimezone(event.target.value)}>
                          <option value="Asia/Kolkata">(GMT+05:30) Asia/Kolkata</option>
                          <option value="UTC">(GMT+00:00) UTC</option>
                          <option value="America/New_York">(GMT-05:00) America/New_York</option>
                          <option value="Europe/London">(GMT+00:00) Europe/London</option>
                        </select>
                      </label>
                      <div className="campaign-v2-settings-grid">
                        <label>
                          <span>Start Time</span>
                          <input type="time" value={campaignStartTime} onChange={(event) => setCampaignStartTime(event.target.value)} />
                        </label>
                        <label>
                          <span>End Time</span>
                          <input type="time" value={campaignEndTime} onChange={(event) => setCampaignEndTime(event.target.value)} />
                        </label>
                        <label>
                          <span>Maximum Retry</span>
                          <input type="number" min="0" max="10" value={campaignMaxRetry} onChange={(event) => setCampaignMaxRetry(event.target.value)} />
                        </label>
                        <label>
                          <span>Priority</span>
                          <select value={campaignPriority} onChange={(event) => setCampaignPriority(event.target.value)}>
                            <option>Normal</option>
                            <option>High</option>
                            <option>Urgent</option>
                          </select>
                        </label>
                      </div>
                      <div className="campaign-v2-checks">
                        {[
                          ['Smart Sending', campaignSmartSending, setCampaignSmartSending],
                          ['Skip Contacted Clients', campaignSkipContacted, setCampaignSkipContacted],
                          ['Auto Pause', campaignAutoPause, setCampaignAutoPause]
                        ].map(([label, value, setter]) => (
                          <label key={label}>
                            <input type="checkbox" checked={value} onChange={(event) => setter(event.target.checked)} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </article>

                    <article className="campaign-v2-card campaign-v2-ai">
                      <header>
                        <i className="ti ti-bulb" aria-hidden="true" />
                        <h4>AI Recommendation</h4>
                      </header>
                      <div className="campaign-v2-ai-grid">
                        <span><b>{campaignBatchRecommendation}</b>Recommended Batch Size</span>
                        <span><b>{campaignEstimatedDelay} {userFacingDurationUnit}</b>Recommended Delay</span>
                        <span><b>{campaignEstimatedDurationLabel}</b>Estimated Delivery Time</span>
                        <span><b>{campaignSenderHealth.score}/100</b>Inbox Score</span>
                        <span><b>{campaignSenderHealth.spamRisk}</b>Spam Risk</span>
                        <span><b>{campaignSenderHealth.label}</b>Sender Health</span>
                        <span><b>{campaignStartTime} - {campaignEndTime}</b>Best Sending Time</span>
                        <span><b>{campaignEstimatedDurationLabel}</b>Estimated Completion</span>
                      </div>
                      <ul>
                        <li>Increase delay to improve inbox placement.</li>
                        <li>Current sender health is {campaignSenderHealth.label.toLowerCase()}.</li>
                        <li>Use Smart Sending for cleaner pacing.</li>
                      </ul>
                    </article>
                  </div>
                </div>
              </section>

              <section className="campaign-v2-info">
                <i className="ti ti-info-circle" aria-hidden="true" />
                <strong>Campaign Summary</strong>
                <span>Records Ready: {campaignAudienceSummary.valid}</span>
                <span>Missing: {campaignAudienceSummary.missing + campaignAudienceSummary.invalid}</span>
                <span>Duplicate: {campaignAudienceSummary.duplicates}</span>
                <span>Estimated Credits: {campaignEstimatedCredits}</span>
                <span>Estimated Duration: {campaignEstimatedDurationLabel}</span>
              </section>
              {showCampaignNotice && !hasCampaignRequiredFields ? (
                <p className="campaign-v2-inline-warning">
                  {campaignMissingFields.map((field) => <span key={field}>{field}</span>)}
                </p>
              ) : null}
            </main>

            <footer className="campaign-v2-footer">
              <button type="button" onClick={() => setShowCampaignPopup(false)}>Cancel</button>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCampaignPopup(false);
                    setShowOverviewPopup(true);
                  }}
                >
                  <i className="ti ti-arrow-left" aria-hidden="true" /> Back
                </button>
                <button type="button" className={hasCampaignRequiredFields ? 'primary' : 'primary disabled'} onClick={handleCampaignContinue}>
                  {hasCampaignRequiredFields ? 'Next' : 'Complete required details'} <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {renderPortalPopup(
        false && showCampaignPopup,
        <div className="wf-backdrop" onClick={() => setShowCampaignPopup(false)}>
          <div className="premium-calendar-modal wf-modal premium-campaign-modal" style={popupStyleFor('campaign')} onClick={(event) => event.stopPropagation()}>
            <div className="wf-header">
              <span className="wf-header-badge">3</span>
              <h3 className="wf-header-title">Step 3: Create Campaign</h3>
              <small className="wf-header-step">Step 3 of 7</small>
              <button type="button" className="wf-header-close" onClick={() => setShowCampaignPopup(false)}>×</button>
            </div>

            <div className="wf-body premium-campaign-body">
              <label className="premium-campaign-field premium-campaign-name-field">
                <span>Campaign Name *</span>
                <input
                  type="text"
                  value={effectiveCampaignName}
                  onChange={(event) => onCampaignNameChange ? onCampaignNameChange(event.target.value) : setCampaignName(event.target.value)}
                />
              </label>

              <div className="premium-campaign-field premium-campaign-tags-field">
                <span>Tags</span>
                <div className="premium-campaign-tags" ref={campaignTagsRef}>
                  {campaignTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="premium-campaign-tag"
                      onClick={() => removeCampaignTag(tag)}
                    >
                      {tag} <i>×</i>
                    </button>
                  ))}
                  <input
                    type="text"
                    value={campaignTagDraft}
                    onChange={(event) => {
                      setCampaignTagDraft(event.target.value);
                      setShowCampaignTagSuggestions(Boolean(event.target.value.trim()));
                      setActiveCampaignTagSuggestion(-1);
                    }}
                    onFocus={() => setShowCampaignTagSuggestions(Boolean(campaignTagDraft.trim()))}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowDown' && campaignTagSuggestions.length) {
                        event.preventDefault();
                        setShowCampaignTagSuggestions(true);
                        setActiveCampaignTagSuggestion((current) =>
                          current >= campaignTagSuggestions.length - 1 ? 0 : current + 1
                        );
                        return;
                      }
                      if (event.key === 'ArrowUp' && campaignTagSuggestions.length) {
                        event.preventDefault();
                        setShowCampaignTagSuggestions(true);
                        setActiveCampaignTagSuggestion((current) =>
                          current <= 0 ? campaignTagSuggestions.length - 1 : current - 1
                        );
                        return;
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setShowCampaignTagSuggestions(false);
                        setActiveCampaignTagSuggestion(-1);
                        return;
                      }
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        const selectedSuggestion = campaignTagSuggestions[activeCampaignTagSuggestion];
                        addCampaignTag(selectedSuggestion?.value || campaignTagDraft);
                      }
                    }}
                    placeholder="Search sector or country..."
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showCampaignTagSuggestions && Boolean(campaignTagSuggestions.length)}
                    aria-controls="campaign-tag-suggestions"
                    aria-activedescendant={
                      activeCampaignTagSuggestion >= 0
                        ? `campaign-tag-suggestion-${activeCampaignTagSuggestion}`
                        : undefined
                    }
                  />
                  {showCampaignTagSuggestions && campaignTagSuggestions.length ? (
                    <div
                      id="campaign-tag-suggestions"
                      ref={campaignTagSuggestionsRef}
                      className="premium-campaign-tag-suggestions"
                      role="listbox"
                    >
                      {['Sector', 'Country'].map((label) => {
                        const groupedSuggestions = campaignTagSuggestions
                          .map((suggestion, index) => ({ ...suggestion, index }))
                          .filter((suggestion) => suggestion.label === label);
                        if (!groupedSuggestions.length) return null;
                        return (
                          <div className="premium-campaign-tag-suggestion-group" key={label}>
                            <div className="premium-campaign-tag-suggestion-heading">
                              {label === 'Sector' ? 'Magazine sectors' : 'Countries'}
                            </div>
                            {groupedSuggestions.map((suggestion) => (
                              <button
                                id={`campaign-tag-suggestion-${suggestion.index}`}
                                key={`${suggestion.label}-${suggestion.value}`}
                                type="button"
                                role="option"
                                aria-selected={activeCampaignTagSuggestion === suggestion.index}
                                data-suggestion-index={suggestion.index}
                                className={activeCampaignTagSuggestion === suggestion.index ? 'is-active' : ''}
                                onMouseEnter={() => setActiveCampaignTagSuggestion(suggestion.index)}
                                onClick={() => addCampaignTag(suggestion.value)}
                              >
                                <strong>{suggestion.value}</strong>
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <label className="premium-campaign-field premium-campaign-description-field">
                <span>Description (optional)</span>
                <textarea
                  value={campaignDescription}
                  onChange={(event) => setCampaignDescription(event.target.value)}
                />
              </label>

              {isBulkReplyMode && !senderActive && (
                <div className="campaign-alert campaign-alert-warning" style={{ margin: '0 0 16px 0', padding: '12px 16px', borderRadius: '8px', border: '1px solid #f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <div>
                    <strong>Original sender account is disconnected.</strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', opacity: 0.9 }}>The original sender <strong>{pendingSenderEmailRef.current || 'original sender'}</strong> is currently unavailable. Please choose an active approved Sender ID from the dropdown below.</p>
                  </div>
                </div>
              )}
              {isBulkReplyMode && !senderActive && (
                <div className="campaign-alert campaign-alert-warning" style={{ margin: '0 0 16px 0', padding: '12px 16px', borderRadius: '8px', border: '1px solid #f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.08)', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px', boxSizing: 'border-box' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <div>
                    <strong>Original sender account is disconnected.</strong>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', opacity: 0.9 }}>The original sender <strong>{pendingSenderEmailRef.current || 'original sender'}</strong> is currently unavailable. Please choose an active approved Sender ID from the dropdown below.</p>
                  </div>
                </div>
              )}
              <div className="premium-campaign-grid premium-campaign-grid-main">
                <label className="premium-campaign-field">
                  <span>Project</span>
                  <select
                    value={campaignProjectFilter}
                    onChange={(event) => setCampaignProjectFilter(event.target.value)}
                    aria-label="Select project"
                    disabled={isNextProcessMode || isBulkReplyMode}
                  >
                    <option value="">Select project</option>
                    {projectOptions.map((item) => (
                      <option key={item} value={item}>{String(item).toUpperCase()}</option>
                    ))}
                  </select>
                </label>
                <div className="premium-campaign-field premium-campaign-sender-field">
                  <span>Sender</span>
                  {visibleCampaignSenderAccounts.length ? (
                    <select
                      value={effectiveCampaignSender}
                      onChange={(event) => {
                        setCampaignSender(event.target.value);
                        onSelectSenderAccount?.(event.target.value);
                      }}
                      aria-label="Select sender ID"
                      disabled={(isNextProcessMode || isBulkReplyMode) && senderActive}
                    >
                      <option value="">Select sender</option>
                      {visibleCampaignSenderAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.from} - {String(account.provider || '').includes('graph') ? 'Microsoft Graph' : account.provider || 'Mail'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="premium-campaign-sender-empty">
                      {campaignProjectFilter ? senderEmptyMessage : 'Select a project first.'}
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="wf-footer">
              <div className="wf-footer-left">
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={() => {
                    setShowCampaignPopup(false);
                    setShowOverviewPopup(true);
                  }}
                >
                  Back
                </button>
              </div>
              <button
                type="button"
                className={`wf-btn-primary${hasCampaignRequiredFields ? '' : ' is-disabled'}`}
                onClick={handleCampaignContinue}
              >
                {hasCampaignRequiredFields ? 'Continue' : 'Complete required details first'}
              </button>
            </div>
            {showCampaignNotice && !hasCampaignRequiredFields ? (
              <p className="premium-campaign-hint premium-campaign-hint-warning">
                {campaignMissingFields.map((field) => (
                  <span key={field} className="premium-campaign-warning-item">
                    • {field}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {renderPortalPopup(
        showSelectDraftPopup,
        <div className="wf-backdrop select-draft-v2-backdrop" onClick={() => setShowSelectDraftPopup(false)}>
          <div className="select-draft-v2-modal" onClick={(event) => event.stopPropagation()}>
            <header className="select-draft-v2-header">
              <div className="select-draft-v2-title">
                <span><i className="ti ti-clipboard-text" aria-hidden="true" /></span>
                <div>
                  <h3>4. Select Draft</h3>
                  <p>Choose a draft for your campaign</p>
                </div>
              </div>
              <div className="select-draft-v2-stepper" aria-label="Campaign workflow progress">
                {['Upload List', 'Review', 'Campaign', 'Select Draft', 'Draft Summary', 'Test Email', 'Schedule'].map((label, index, items) => {
                  const status = index < 3 ? 'done' : index === 3 ? 'active' : '';
                  return (
                    <div key={label} className={`select-draft-v2-step ${status}`}>
                      <span>{status === 'done' ? <i className="ti ti-check" aria-hidden="true" /> : index + 1}</span>
                      <small>{label}</small>
                      {index < items.length - 1 ? <b aria-hidden="true" /> : null}
                    </div>
                  );
                })}
              </div>
              <button type="button" className="select-draft-v2-close" onClick={() => setShowSelectDraftPopup(false)} aria-label="Close Select Draft">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </header>

            <main className="select-draft-v2-main">
              <aside className="select-draft-v2-sidebar">
                <h4>Filters</h4>
                <label className="select-draft-v2-search">
                  <i className="ti ti-search" aria-hidden="true" />
                  <input
                    type="search"
                    value={selectDraftSearch}
                    onChange={(event) => setSelectDraftSearch(event.target.value)}
                    placeholder="Search drafts..."
                  />
                </label>
                <label className="select-draft-v2-filter">
                  <i className="ti ti-folder" aria-hidden="true" />
                  <select value={selectDraftTypeFilter} onChange={(event) => setSelectDraftTypeFilter(event.target.value)}>
                    <option value="">All Categories</option>
                    {draftTypeItems.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="select-draft-v2-filter">
                  <i className="ti ti-briefcase" aria-hidden="true" />
                  <select value={selectDraftProjectFilter} onChange={(event) => setSelectDraftProjectFilter(event.target.value)}>
                    <option value="">All Projects</option>
                    {selectDraftProjectOptions.map((item) => <option key={item} value={item}>{String(item).toUpperCase()} Project</option>)}
                  </select>
                </label>
                <label className="select-draft-v2-filter">
                  <i className="ti ti-target" aria-hidden="true" />
                  <select value={selectDraftCampaignTypeFilter} onChange={(event) => setSelectDraftCampaignTypeFilter(event.target.value)}>
                    <option value="">All Campaign Types</option>
                    {selectDraftCampaignTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>

                <section className="select-draft-v2-categories">
                  <h4>Categories</h4>
                  {selectDraftCategoryRows.map((item) => {
                    const active = item.value === 'all'
                      ? !selectDraftTypeFilter
                      : normalizeDraftType(selectDraftTypeFilter) === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        className={active ? 'active' : ''}
                        onClick={() => setSelectDraftTypeFilter(item.value === 'all' ? '' : item.value)}
                      >
                        <span><i className={`ti ${item.icon}`} aria-hidden="true" /> {item.label}</span>
                        <b>{item.count}</b>
                      </button>
                    );
                  })}
                </section>

                <article className="select-draft-v2-tip">
                  <i className="ti ti-bulb" aria-hidden="true" />
                  <div>
                    <strong>Tip</strong>
                    <p>Select an existing draft or create a new one from the draft library.</p>
                  </div>
                </article>
              </aside>

              <section className="select-draft-v2-content workflow-popup-body">
                <div className="select-draft-v2-toolbar">
                  <h4>All Drafts <span>({filteredSavedDrafts.length})</span></h4>
                  <div>
                    <label>
                      <span>Sort by:</span>
                      <select value={selectDraftSort} onChange={(event) => setSelectDraftSort(event.target.value)}>
                        <option value="updated-desc">Updated (Latest)</option>
                        <option value="updated-asc">Updated (Oldest)</option>
                        <option value="title-asc">Title (A-Z)</option>
                        <option value="title-desc">Title (Z-A)</option>
                      </select>
                    </label>
                    <button type="button" className={selectDraftView === 'grid' ? 'active' : ''} onClick={() => setSelectDraftView('grid')} aria-label="Grid view">
                      <i className="ti ti-layout-grid" aria-hidden="true" />
                    </button>
                    <button type="button" className={selectDraftView === 'list' ? 'active' : ''} onClick={() => setSelectDraftView('list')} aria-label="List view">
                      <i className="ti ti-list" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className={`select-draft-v2-grid ${selectDraftView === 'list' ? 'list' : ''}`}>
                  {filteredSavedDrafts.length ? (
                    filteredSavedDrafts.map((draft) => {
                      const draftId = String(draft.id || '');
                      const draftType = normalizeDraftType(draft.draftType || draft.category || selectedDraftType);
                      const isSelected = String(selectedDraftId || activeDraftId || '') === draftId;
                      const projectLabel = draft.project ? `${String(draft.project).toUpperCase()} Project` : 'No Project';
                      const previewText = previewSelectDraftText(draft);
                      const categoryLabel = draftTypeLabel(draftType);
                      const categoryTone = draftType === 'cover_story' ? 'purple' : draftType === 'reminder' ? 'blue' : draftType === 'followup' ? 'green' : draftType === 'updated_cost' ? 'orange' : 'red';
                      const iconClass = draftType === 'cover_story' ? 'ti-clipboard-text' : draftType === 'reminder' ? 'ti-refresh' : draftType === 'followup' ? 'ti-arrow-up' : draftType === 'updated_cost' ? 'ti-currency-dollar' : 'ti-phone';
                      return (
                        <label key={draft.id} className={`select-draft-v2-card ${isSelected ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="savedDraft"
                            checked={isSelected}
                            onChange={() => {
                              setSelectDraftTab('my-drafts');
                              setDraftTypeLibraryOpen(true);
                              setShowDraftTypeDropdown(false);
                              setSelectedDraftId(draft.id);
                              onSelectedDraftTypeChange?.(draftType);
                              if (draftId.startsWith('template:')) {
                                applyTemplateDraft(draftType);
                              } else {
                                onSelectSavedDraft?.(draft.id);
                              }
                            }}
                          />
                          <div className={`select-draft-v2-icon ${categoryTone}`}>
                            <i className={`ti ${iconClass}`} aria-hidden="true" />
                          </div>
                          {isSelected ? <span className="select-draft-v2-check"><i className="ti ti-check" aria-hidden="true" /></span> : <span className="select-draft-v2-radio" />}
                          <button type="button" className="select-draft-v2-menu" aria-label={`Open actions for ${draft.title || 'draft'}`}>
                            <i className="ti ti-dots-vertical" aria-hidden="true" />
                          </button>
                          <strong>{draft.title || draft.subject || 'Untitled Draft'}</strong>
                          <p>{previewText}</p>
                          <div className="select-draft-v2-tags">
                            <span className={categoryTone}>{categoryLabel}</span>
                            <span className="project">{projectLabel}</span>
                          </div>
                          <footer>
                            <i className="ti ti-calendar" aria-hidden="true" />
                            <span>{formatSelectDraftDate(draft)}</span>
                          </footer>
                        </label>
                      );
                    })
                  ) : templateDraftForSelectedType ? (
                    <label className="select-draft-v2-card selected">
                      <input type="radio" name="savedDraft" checked readOnly onChange={() => applyTemplateDraft(templateDraftForSelectedType.draftType)} />
                      <div className="select-draft-v2-icon purple"><i className="ti ti-clipboard-text" aria-hidden="true" /></div>
                      <span className="select-draft-v2-check"><i className="ti ti-check" aria-hidden="true" /></span>
                      <button type="button" className="select-draft-v2-menu" aria-label="Open draft actions"><i className="ti ti-dots-vertical" aria-hidden="true" /></button>
                      <strong>{templateDraftForSelectedType.title}</strong>
                      <p>{templateDraftForSelectedType.subject}</p>
                      <div className="select-draft-v2-tags">
                        <span className="purple">{draftTypeLabel(templateDraftForSelectedType.draftType)}</span>
                        <span className="project">Template</span>
                      </div>
                      <footer><i className="ti ti-calendar" aria-hidden="true" /><span>{templateDraftForSelectedType.updated}</span></footer>
                    </label>
                  ) : (
                    <div className="select-draft-v2-empty">
                      <strong>No saved drafts yet</strong>
                      <p>Create and save a draft once, then it will appear here for future campaigns.</p>
                      <button type="button" onClick={handleCreateDraftClick}>Create New Draft</button>
                    </div>
                  )}
                </div>
              </section>
            </main>

            <footer className="select-draft-v2-footer">
              <button type="button" onClick={() => setShowSelectDraftPopup(false)}>Cancel</button>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSelectDraftPopup(false);
                    if (isNextProcessMode || isBulkReplyMode) {
                      setShowOverviewPopup(true);
                    } else {
                      setShowCampaignPopup(true);
                    }
                  }}
                >
                  <i className="ti ti-arrow-left" aria-hidden="true" /> Back
                </button>
                <button
                  type="button"
                  className={hasDraftRequiredFields ? 'primary' : 'primary disabled'}
                  onClick={async () => {
                    if (!hasDraftRequiredFields) {
                      setShowDraftContinueWarning(true);
                      onShowMessage?.(draftContinueHint, 'warning');
                      return;
                    }
                    setShowDraftContinueWarning(false);
                    setWorkflowPosition((current) => Math.max(current, 5));
                    setShowSelectDraftPopup(false);
                    setShowDraftSummaryPopup(true);
                  }}
                  disabled={!hasDraftRequiredFields}
                >
                  Next <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              </div>
              {showDraftContinueWarning && !hasDraftRequiredFields ? (
                <p>{draftContinueHint}</p>
              ) : null}
            </footer>
          </div>
        </div>
      )}

      {renderPortalPopup(
        false && showSelectDraftPopup,
        <div className="wf-backdrop" onClick={() => setShowSelectDraftPopup(false)}>
          <div
            className="premium-calendar-modal wf-modal premium-select-draft-modal"
            style={popupStyleFor('selectDraft')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="wf-header">
              <span className="wf-header-badge">4</span>
              <h3 className="wf-header-title">Step 4: Select Draft</h3>
              <small className="wf-header-step">Step 4 of 7</small>
              <button type="button" className="wf-header-close" onClick={() => setShowSelectDraftPopup(false)}>×</button>
            </div>

            <div className="premium-select-draft-tabs" style={{ background: 'transparent' }}>
              <button
                type="button"
                className={selectDraftTab === 'my-drafts' ? 'active' : ''}
                onClick={() => {
                  setSelectDraftTab('my-drafts');
                  setDraftTypeLibraryOpen(true);
                  setShowDraftTypeDropdown(false);
                }}
              >
                My Drafts
              </button>
              <button
                type="button"
                className={selectDraftTab === 'create' ? 'active' : ''}
                onClick={handleCreateDraftClick}
              >
                Create New Draft
              </button>
            </div>

            {selectDraftTab === 'my-drafts' ? (
              <div className="wf-body premium-select-draft-library premium-select-draft-library-types">
                <div className="premium-select-draft-list">
                  <div className="premium-select-draft-type-page-head">
                    <strong>Previously Used Drafts</strong>
                    <small>{filteredSavedDrafts.length} drafts available</small>
                  </div>
                  <div className="premium-select-draft-filters">
                    <input
                      type="search"
                      value={selectDraftSearch}
                      onChange={(event) => setSelectDraftSearch(event.target.value)}
                      placeholder="Search draft name, type, sector, city, project, campaign"
                    />
                    <select
                      value={selectDraftTypeFilter}
                      onChange={(event) => setSelectDraftTypeFilter(event.target.value)}
                    >
                      <option value="">All draft types</option>
                      {draftTypeItems.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </div>
                  {filteredSavedDrafts.length ? (
                    filteredSavedDrafts.map((draft) => (
                      <label
                        key={draft.id}
                        className={`premium-select-draft-item ${
                          String(selectedDraftId || activeDraftId || '') === String(draft.id || '') ? 'selected' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="savedDraft"
                          checked={String(selectedDraftId || activeDraftId || '') === String(draft.id || '')}
                          onChange={() => {
                            const draftId = String(draft.id || '');
                            const draftType = normalizeDraftType(draft.draftType || draft.category || selectedDraftType);
                            setSelectedDraftId(draft.id);
                            onSelectedDraftTypeChange?.(draftType);
                            if (draftId.startsWith('template:')) {
                              applyTemplateDraft(draftType);
                            } else {
                              onSelectSavedDraft?.(draft.id);
                            }
                          }}
                        />
                        <div>
                          <strong>{draft.title}</strong>
                          <small>{draftTypeLabel(draft.draftType || draft.category)} Draft</small>
                          <p>Subject: {draft.subject}</p>
                          <div className="premium-select-draft-meta">
                            <span>Campaign: {draft.campaignName || 'No campaign'}</span>
                            <span>Sector: {draft.sector || 'No sector'}</span>
                            <span>City: {draft.city || 'No city'}</span>
                            <span>Project: {draft.project ? String(draft.project).toUpperCase() : 'No project'}</span>
                            <span>Saved Date: {draft.savedDate || 'No saved date'}</span>
                            <span>Saved Time: {draft.savedTime || 'No saved time'}</span>
                          </div>
                          <small>{draft.updated}</small>
                        </div>
                      </label>
                    ))
                  ) : templateDraftForSelectedType ? (
                    <label className="premium-select-draft-item selected">
                      <input
                        type="radio"
                        name="savedDraft"
                        checked
                        readOnly
                        onChange={() => applyTemplateDraft(templateDraftForSelectedType.draftType)}
                      />
                      <div>
                        <strong>{templateDraftForSelectedType.title}</strong>
                        <small>{draftTypeLabel(templateDraftForSelectedType.draftType)} Draft</small>
                        <p>Subject: {templateDraftForSelectedType.subject}</p>
                        <div className="premium-select-draft-meta">
                          <span>Campaign: No campaign</span>
                          <span>Sector: No sector</span>
                          <span>City: No city</span>
                          <span>Project: No project</span>
                        </div>
                        <small>{templateDraftForSelectedType.updated}</small>
                      </div>
                    </label>
                  ) : (
                    <div className="premium-select-draft-empty">
                      <strong>No saved drafts yet</strong>
                      <p>Create and save a draft once, then it will appear here for future campaigns.</p>
                    </div>
                  )}
                </div>
                <aside className="premium-select-draft-preview">
                  <div className="premium-select-draft-preview-body">
                    {selectedDraftPreviewSubject || selectedDraftPreviewBody ? (
                      <>
                        <div className="premium-select-draft-preview-subject">
                          <span>Subject</span>
                          <strong>{selectedDraftPreviewSubject || 'No subject available'}</strong>
                        </div>
                        <EmailRenderer
                          html={selectedDraftPreviewBody || '<p>No message available.</p>'}
                          className="premium-select-draft-preview-message"
                        />
                      </>
                    ) : (
                      <div className="premium-select-draft-empty premium-select-draft-empty-preview">
                        <strong>No draft selected</strong>
                        <p>Select any saved draft and its full content will appear here.</p>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            ) : (
              <div className="wf-body premium-select-draft-create">
                <div className="premium-select-draft-create-top">
                  <label className="premium-template-field">
                    <span>Draft Type</span>
                    <select
                      value={selectedDraftType || ''}
                      onChange={(event) => onSelectedDraftTypeChange?.(event.target.value)}
                    >
                      <option value="">Select draft type</option>
                      {draftTypeItems.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="premium-select-draft-upload">
                  <input
                    ref={draftFileInputRef}
                    type="file"
                    accept=".txt,.html,.htm,.md,.csv,.doc,.docx,.pdf,text/*"
                    className="premium-select-draft-file-input"
                    onChange={handleDraftFileUpload}
                  />
                  <button
                    type="button"
                    className="premium-select-draft-uploadbox"
                    disabled={draftFileReading}
                    onClick={() => draftFileInputRef.current?.click()}
                  >
                    <span className="premium-clientlist-uploadicon">＋</span>
                    <strong>{draftFileReading ? 'Reading uploaded file...' : 'Upload Word, PDF, or TXT file'}</strong>
                    <small>{draftFileReading ? `Extracting text from ${draftUploadedFileName}` : (draftUploadedFileName || 'Supported formats: DOCX, PDF, TXT')}</small>
                  </button>
                </div>

                <div className="premium-select-draft-split">
                  <section className="premium-select-draft-viewer">
                    <div className="premium-select-draft-panelhead">
                      <strong>Document Viewer</strong>
                      <button type="button" className="ghost subtle" onClick={importDraftToEditor}>
                        Import to Editor
                      </button>
                    </div>
                    <textarea
                      className="premium-select-draft-doc premium-select-draft-doc-editable"
                      value={draftViewerText}
                      onChange={(event) => setDraftUploadedText(event.target.value)}
                      placeholder="Uploaded file content or copied text will appear here. You can edit it before importing to the email editor."
                    />
                  </section>

                  <section className="premium-select-draft-editor">
                    <label className="premium-template-field">
                      <span>Subject</span>
                      <input
                        type="text"
                        value={effectiveDraftSubject}
                        onChange={(event) => onDraftSubjectChange ? onDraftSubjectChange(event.target.value) : setDraftSubject(event.target.value)}
                        placeholder="Enter subject"
                      />
                    </label>
                    <div className="premium-template-editor compact">
                      <RichTextEditor
                        value={effectiveDraftMessage}
                        onChange={(next) => onDraftBodyChange ? onDraftBodyChange(next) : setDraftMessage(next)}
                        placeholder="Write your email draft..."
                      />
                    </div>
                  </section>
                </div>
                {selectedDraftType ? (
                  <section className="premium-select-draft-related">
                    <div className="premium-select-draft-type-page-head">
                      <strong>{selectedDraftTypeLabel} Saved Drafts</strong>
                      <small>{relatedDraftsForSelectedType.length} related drafts</small>
                    </div>
                    <div className="premium-select-draft-related-list">
                      {relatedDraftsForSelectedType.length ? (
                        relatedDraftsForSelectedType.map((draft) => (
                          <button key={draft.id} type="button" onClick={() => loadDraftIntoEditor(draft)}>
                            <strong>{draft.title}</strong>
                            <span>{draft.subject}</span>
                            <small>{[draft.campaignName || 'No campaign', draft.sector || 'No sector', draft.city || 'No city'].join(' · ')}</small>
                          </button>
                        ))
                      ) : (
                        <p>No saved drafts for this type yet.</p>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            <div className="wf-footer">
              <div className="wf-footer-left">
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={() => {
                    setShowSelectDraftPopup(false);
                    if (isNextProcessMode || isBulkReplyMode) {
                      setShowOverviewPopup(true);
                    } else {
                      setShowCampaignPopup(true);
                    }
                  }}
                >
                  Back
                </button>
                {selectDraftTab === 'create' ? (
                  <button
                    type="button"
                    className="wf-btn-secondary"
                    onClick={handleSaveDraft}
                    disabled={draftSaving}
                  >
                    {draftSaving ? 'Saving...' : 'Save Draft'}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className={`wf-btn-primary${hasDraftRequiredFields ? '' : ' is-disabled'}`}
                onClick={async () => {
                  if (!hasDraftRequiredFields) {
                    setShowDraftContinueWarning(true);
                    onShowMessage?.(draftContinueHint, 'warning');
                    return;
                  }
                  setShowDraftContinueWarning(false);
                  setWorkflowPosition((current) => Math.max(current, 5));
                  setShowSelectDraftPopup(false);
                  setShowDraftSummaryPopup(true);
                }}
                disabled={!hasDraftRequiredFields}
              >
                {hasDraftRequiredFields ? 'Continue' : 'Select required draft first'}
              </button>
            </div>
            {showDraftContinueWarning && !hasDraftRequiredFields ? (
              <p className="premium-select-draft-warning">
                {draftContinueHint}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {renderPortalPopup(
        showScheduleSuccessPopup,
        <div className="wf-backdrop" onClick={() => setShowScheduleSuccessPopup(false)}>
          <div className="premium-calendar-modal wf-modal premium-schedule-success-modal" style={popupStyleFor('schedule')} onClick={(event) => event.stopPropagation()}>
            <div className="wf-header">
              <span className="wf-header-badge">✓</span>
              <h3 className="wf-header-title">Campaign Scheduled Successfully</h3>
              <small className="wf-header-step">Your campaign has been scheduled</small>
              <button type="button" className="wf-header-close" onClick={() => setShowScheduleSuccessPopup(false)}>×</button>
            </div>

            <div className="wf-body premium-schedule-success-body">
              <div className="premium-schedule-success-grid">
                <article>
                  <span>Campaign Name</span>
                  <strong>{scheduleSuccessDetails?.campaignName || campaignName || 'Campaign'}</strong>
                </article>
                <article>
                  <span>Project</span>
                  <strong>{scheduleSuccessDetails?.project || project || 'No project'}</strong>
                </article>
                <article>
                  <span>Recipients</span>
                  <strong>{Number(scheduleSuccessDetails?.recipients || 0).toLocaleString()}</strong>
                </article>
                <article>
                  <span>Scheduled For</span>
                  <strong>{scheduleSuccessDetails?.scheduledFor || 'Scheduled'}</strong>
                </article>
                <article>
                  <span>Status</span>
                  <strong>{scheduleSuccessDetails?.status || 'Scheduled'}</strong>
                </article>
              </div>
            </div>

            <div className="wf-footer">
              <div className="wf-footer-left">
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={() => setShowScheduleSuccessPopup(false)}
                >
                  Close
                </button>
              </div>
              <button
                type="button"
                className="wf-btn-primary"
                onClick={() => {
                  setShowScheduleSuccessPopup(false);
                  router.push('/dashboard/broadcasts');
                }}
              >
                View Broadcasts
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showTestEmailPopup,
        <div className="wf-backdrop test-email-v2-backdrop" onClick={() => setShowTestEmailPopup(false)}>
          <div className="test-email-v2-modal" onClick={(event) => event.stopPropagation()}>
            <header className="test-email-v2-header">
              <div className="test-email-v2-title">
                <span><i className="ti ti-mail" aria-hidden="true" /></span>
                <div>
                  <h3>6. Test Email</h3>
                  <p>Send a test email and verify before scheduling</p>
                </div>
              </div>
              <div className="test-email-v2-stepper" aria-label="Campaign workflow progress">
                {['Upload List', 'Review', 'Campaign', 'Select Draft', 'Draft Summary', 'Test Email', 'Schedule'].map((label, index, items) => {
                  const status = index < 5 ? 'done' : index === 5 ? 'active' : '';
                  return (
                    <div key={label} className={`test-email-v2-step ${status}`}>
                      <span>{status === 'done' ? <i className="ti ti-check" aria-hidden="true" /> : index + 1}</span>
                      <small>{label}</small>
                      {index < items.length - 1 ? <b aria-hidden="true" /> : null}
                    </div>
                  );
                })}
              </div>
              <button type="button" className="test-email-v2-close" onClick={() => setShowTestEmailPopup(false)} aria-label="Close Test Email">x</button>
            </header>

            <main className="test-email-v2-main workflow-popup-body">
              <section className="test-email-v2-left">
                <article className="test-email-v2-card test-email-v2-recipients">
                  <header>
                    <div>
                      <h4>Test Recipients</h4>
                      <p>Add email addresses to send test emails</p>
                    </div>
                    <button type="button" onClick={() => onShowMessage?.('Contact selector uses your existing contacts page.', 'info')}>
                      <i className="ti ti-user-plus" aria-hidden="true" /> Add from Contacts
                    </button>
                  </header>
                  <label>
                    <span>To (Email Address)</span>
                    <textarea
                      value={testRecipientText}
                      onChange={(event) => {
                        setTestRecipientText(event.target.value);
                        const first = parseTestRecipients(event.target.value)[0] || '';
                        setTestEmailAddress(first);
                        onTestEmailToChange?.(first);
                      }}
                      onBlur={addTestRecipientsFromText}
                      placeholder="Enter email addresses separated by commas or new lines"
                    />
                  </label>
                  <div className={`test-email-v2-valid ${invalidTestRecipients.length ? 'invalid' : ''}`}>
                    <i className={`ti ${invalidTestRecipients.length ? 'ti-alert-circle' : 'ti-circle-check'}`} aria-hidden="true" />
                    <span>{invalidTestRecipients.length ? `${invalidTestRecipients.length} invalid email address` : `${validTestRecipients.length} email addresses added`}</span>
                  </div>
                  <div className="test-email-v2-chips">
                    {(allTestRecipients.length ? allTestRecipients : ['akshay.more@intellimail.com']).map((email) => (
                      <span key={email} className={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'invalid' : ''}>
                        <b>{email.slice(0, 1).toUpperCase()}</b>
                        {email}
                        <button type="button" onClick={() => removeTestRecipient(email)} aria-label={`Remove ${email}`}>x</button>
                      </span>
                    ))}
                  </div>
                </article>

                <article className="test-email-v2-card test-email-v2-sender">
                  <header>
                    <h4>Sender Information</h4>
                    <button type="button" onClick={() => setShowCampaignPopup(true)}>
                      <i className="ti ti-pencil" aria-hidden="true" /> Change Sender
                    </button>
                  </header>
                  <div><span>From</span><strong>{draftSummarySenderName} &lt;{draftSummarySenderEmail}&gt;</strong></div>
                  <div><span>Reply To</span><strong>{draftSummarySenderEmail}</strong></div>
                  <div><span>Sender ID</span><strong>{draftSummarySenderEmail}</strong><b>Verified</b></div>
                </article>

                <article className="test-email-v2-card test-email-v2-options">
                  <h4>Test Options</h4>
                  {[
                    ['Send tracking-enabled test email', 'Track opens and clicks for test emails', includeTracking, setIncludeTracking, ''],
                    ['Include all attachments', 'Send test email with attachments', testIncludeAttachments, setTestIncludeAttachments, ''],
                    ['Send from different email address', 'Choose a different sender for test email', testDifferentSender, setTestDifferentSender, ''],
                    ['Spam test', 'Check if email goes to spam folder', testSpamPremium, setTestSpamPremium, 'Premium']
                  ].map(([label, description, checked, setter, badge]) => (
                    <label key={label}>
                      <input type="checkbox" checked={checked} onChange={(event) => setter(event.target.checked)} />
                      <span><strong>{label}</strong>{badge ? <b>{badge}</b> : null}<small>{description}</small></span>
                    </label>
                  ))}
                </article>

                <article className="test-email-v2-info">
                  <i className="ti ti-info-circle" aria-hidden="true" />
                  <span>Test emails will not consume campaign credits.</span>
                </article>
              </section>

              <section className="test-email-v2-right">
                <article className="test-email-v2-preview-card">
                  <header>
                    <h4>Email Preview</h4>
                    <div>
                      {['desktop', 'mobile'].map((mode) => (
                        <button key={mode} type="button" className={testPreviewMode === mode ? 'active' : ''} onClick={() => setTestPreviewMode(mode)}>
                          <i className={`ti ${mode === 'desktop' ? 'ti-device-desktop' : 'ti-device-mobile'}`} aria-hidden="true" /> {mode[0].toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                      <button type="button" onClick={() => {
                        const win = window.open('', '_blank');
                        if (win) win.document.write(testPreviewHtml || '<p>No preview</p>');
                      }}>
                        Preview in New Tab <i className="ti ti-external-link" aria-hidden="true" />
                      </button>
                    </div>
                  </header>
                  <div className="test-email-v2-meta">
                    <span>Subject:</span><strong>{effectiveDraftSubject || 'No draft subject yet'}</strong>
                    <span>From:</span><strong>{draftSummarySenderName} &lt;{draftSummarySenderEmail}&gt;</strong>
                  </div>
                  <div className={`test-email-v2-preview-window ${testPreviewMode}`}>
                    <EmailRenderer html={testPreviewHtml} empty={<p>Your test preview will appear here after you add a draft message.</p>} />
                  </div>
                </article>

                <article className="test-email-v2-warning">
                  <i className="ti ti-info-circle" aria-hidden="true" />
                  <span>This is a preview of how your email will look to the recipients. Personalization variables will be replaced with sample data.</span>
                  <label>
                    <input type="checkbox" checked={testVariablesPreview} onChange={(event) => setTestVariablesPreview(event.target.checked)} />
                    Preview Variables
                  </label>
                </article>

                <article className="test-email-v2-history">
                  <h4>Recent Test History</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Sent To</th>
                        <th>Sent By</th>
                        <th>Status</th>
                        <th>Opened</th>
                        <th>Clicks</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{new Date().toLocaleString([], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>{validTestRecipients.length || 1} recipients</td>
                        <td>{draftSummarySenderEmail}</td>
                        <td><span className={testEmailSent ? 'delivered' : 'draft'}>{testEmailSent ? 'Delivered' : 'Ready'}</span></td>
                        <td>{testEmailSent ? '1 (100%)' : '-'}</td>
                        <td>{testEmailSent ? '0 (0%)' : '-'}</td>
                        <td><button type="button"><i className="ti ti-eye" aria-hidden="true" /></button><button type="button" onClick={sendTestEmailFromV2}><i className="ti ti-send" aria-hidden="true" /></button></td>
                      </tr>
                    </tbody>
                  </table>
                  {testEmailError ? <p className="test-email-v2-error">{testEmailError}</p> : null}
                  {testEmailSent ? <p className="test-email-v2-success">Test email sent successfully. Check your inbox.</p> : null}
                </article>
              </section>
            </main>

            <footer className="test-email-v2-footer">
              <button type="button" onClick={() => setShowTestEmailPopup(false)}>Cancel</button>
              <div>
                <button type="button" onClick={() => {
                  setShowTestEmailPopup(false);
                  setShowDraftSummaryPopup(true);
                }}>
                  <i className="ti ti-arrow-left" aria-hidden="true" /> Back
                </button>
                <button type="button" className="primary" disabled={testEmailSending} onClick={sendTestEmailFromV2}>
                  {testEmailSending ? 'Sending...' : testEmailSent ? 'Sent Successfully' : 'Send Test Email'} <i className="ti ti-send" aria-hidden="true" />
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {renderPortalPopup(
        false && showTestEmailPopup,
        <div className="wf-backdrop" onClick={() => setShowTestEmailPopup(false)}>
          <div className="premium-calendar-modal wf-modal premium-test-email-modal" style={popupStyleFor('testEmail')} onClick={(event) => event.stopPropagation()}>
            <div className="wf-header">
              <span className="wf-header-badge">6</span>
              <h3 className="wf-header-title">Step 6: Test Email</h3>
              <small className="wf-header-step">Step 6 of 7</small>
              <button type="button" className="wf-header-close" onClick={() => setShowTestEmailPopup(false)}>×</button>
            </div>

            <div className="wf-body premium-test-email-body">
              <section className="premium-test-email-preview">
                <div className="premium-test-email-preview-top">
                  <div>
                    <strong>Subject: {effectiveDraftSubject || 'No draft subject yet'}</strong>
                  </div>
                  <div className="premium-test-email-device-toggle">
                    <button
                      type="button"
                      className={testPreviewMode === 'desktop' ? 'active' : ''}
                      onClick={() => setTestPreviewMode('desktop')}
                      title="Desktop Preview"
                    >
                      🖥
                    </button>
                    <button
                      type="button"
                      className={testPreviewMode === 'tablet' ? 'active' : ''}
                      onClick={() => setTestPreviewMode('tablet')}
                      title="Tablet Preview"
                    >
                      ▭
                    </button>
                    <button
                      type="button"
                      className={testPreviewMode === 'mobile' ? 'active' : ''}
                      onClick={() => setTestPreviewMode('mobile')}
                      title="Mobile Preview"
                    >
                      📱
                    </button>
                  </div>
                </div>
                <div className="premium-test-email-preview-label">Full Email Preview</div>
                <div className={`premium-test-email-message ${testPreviewMode}`}>
                  <EmailRenderer
                    html={effectiveDraftMessage}
                    empty={<p>Your test preview will appear here after you add a draft message.</p>}
                  />
                </div>
              </section>

              <div className="premium-test-email-sendrow">
                <label className="premium-test-email-field">
                  <input
                    type="email"
                    value={testEmailTo || testEmailAddress}
                    onChange={(event) => {
                      setTestEmailAddress(event.target.value);
                      onTestEmailToChange?.(event.target.value);
                    }}
                    placeholder="Send test to"
                  />
                </label>
                <button
                  type="button"
                  className="premium-test-email-send"
                  disabled={testEmailSending}
                  onClick={async () => {
                    const recipient = String(testEmailTo || testEmailAddress || '').trim();
                    setTestEmailSent(false);
                    setTestEmailError('');
                    setTestEmailSending(true);
                    const result = await onSendTestEmail?.(recipient);
                    const sent = typeof result === 'boolean' ? result : Boolean(result?.ok);
                    setTestEmailSending(false);
                    setTestEmailSent(sent);
                    if (!sent) {
                      setTestEmailError(result?.error || 'Test email was not sent. Check sender, recipient, subject, and body.');
                    }
                  }}
                >
                  {testEmailSending ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>

              {testEmailError ? (
                <div className="premium-test-email-error">
                  <span>!</span>
                  <p>{testEmailError}</p>
                </div>
              ) : null}

              {testEmailSent ? (
                <div className="premium-test-email-success">
                  <span>✔</span>
                  <p>Test email sent successfully! Check your inbox.</p>
                </div>
              ) : null}

            </div>

            <div className="wf-footer">
              <div className="wf-footer-left">
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={() => {
                    setShowTestEmailPopup(false);
                    setShowDraftSummaryPopup(true);
                  }}
                >
                  Back
                </button>
              </div>
              <label className="premium-test-email-check premium-test-email-footer-track">
                <input
                  type="checkbox"
                  checked={includeTracking}
                  onChange={() => setIncludeTracking((current) => !current)}
                />
                <span>Include tracking?</span>
              </label>
              <button
                type="button"
                className="wf-btn-primary"
                onClick={async () => {
                  setWorkflowPosition((current) => Math.max(current, 7));
                  setShowTestEmailPopup(false);
                  setShowSchedulePopup(true);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showDraftSummaryPopup,
        <div className="wf-backdrop draft-summary-v2-backdrop" onClick={() => setShowDraftSummaryPopup(false)}>
          <div className="draft-summary-v2-modal" onClick={(event) => event.stopPropagation()}>
            <header className="draft-summary-v2-header">
              <div className="draft-summary-v2-title">
                <span><i className="ti ti-file-text" aria-hidden="true" /></span>
                <div>
                  <h3>5. Draft Summary</h3>
                  <p>Review and customize your email draft</p>
                </div>
              </div>
              <div className="draft-summary-v2-stepper" aria-label="Campaign workflow progress">
                {['Upload List', 'Review', 'Campaign', 'Select Draft', 'Draft Summary', 'Test Email', 'Schedule'].map((label, index, items) => {
                  const status = index < 4 ? 'done' : index === 4 ? 'active' : '';
                  return (
                    <div key={label} className={`draft-summary-v2-step ${status}`}>
                      <span>{status === 'done' ? <i className="ti ti-check" aria-hidden="true" /> : index + 1}</span>
                      <small>{label}</small>
                      {index < items.length - 1 ? <b aria-hidden="true" /> : null}
                    </div>
                  );
                })}
              </div>
              <button type="button" className="draft-summary-v2-close" onClick={() => setShowDraftSummaryPopup(false)} aria-label="Close Draft Summary">x</button>
            </header>

            <main className="draft-summary-v2-main workflow-popup-body">
              <aside className="draft-summary-v2-sidebar">
                <section className="draft-summary-v2-card draft-summary-v2-details">
                  <header>
                    <h4>Draft Details</h4>
                    <button type="button" onClick={() => {
                      setShowDraftSummaryPopup(false);
                      setShowSelectDraftPopup(true);
                    }}>
                      <i className="ti ti-pencil" aria-hidden="true" /> Edit
                    </button>
                  </header>
                  {[
                    ['Draft Name', selectedSavedDraft?.title || selectedDraftTypeLabel || effectiveCampaignName || 'Selected Draft'],
                    ['Subject Line', effectiveDraftSubject || selectedDraftPreviewSubject || 'No subject'],
                    ['Category', selectedDraftTypeLabel || draftTypeLabel(selectedSavedDraft?.draftType || selectedSavedDraft?.category)],
                    ['Project', campaignSelectedListMeta.project || project || 'No project'],
                    ['Campaign Type', campaignType || 'Cold Email'],
                    ['Created By', draftSummarySenderName],
                    ['Created On', formatSelectDraftDate(selectedSavedDraft || {})]
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong className={label === 'Campaign Type' ? 'pill' : ''}>{value}</strong>
                    </div>
                  ))}
                </section>

                <section className="draft-summary-v2-card draft-summary-v2-variables">
                  <h4>Merge Variables <i className="ti ti-info-circle" aria-hidden="true" /></h4>
                  <p>Insert variables to personalize your email.</p>
                  <div>
                    {draftSummaryVariables.map((variable) => (
                      <button key={variable} type="button" onClick={() => insertDraftSummaryVariable(variable)}>
                        {variable}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="draft-summary-v2-add-variable" onClick={() => {
                    const variable = window.prompt('Add custom variable', '{{CustomVariable}}');
                    if (variable) insertDraftSummaryVariable(variable);
                  }}>
                    + Add Custom Variable
                  </button>
                </section>
              </aside>

              <section className="draft-summary-v2-content">
                <section className="draft-summary-v2-overview">
                  <h4>Email Overview</h4>
                  <div>
                    <article>
                      <span>From</span>
                      <strong>{draftSummarySenderName}</strong>
                      <small>{draftSummarySenderEmail}</small>
                    </article>
                    <article>
                      <span>Sender ID</span>
                      <strong>{draftSummarySenderEmail}</strong>
                      <b>Verified</b>
                    </article>
                    <article>
                      <span>Reply To</span>
                      <strong>{draftSummarySenderEmail}</strong>
                    </article>
                    <article>
                      <span>Recipients</span>
                      <strong>{draftSummaryRecipientCount.toLocaleString()}</strong>
                      <em>Valid Emails</em>
                    </article>
                    <article>
                      <span>Estimated Credits</span>
                      <strong>{draftSummaryRecipientCount.toLocaleString()}</strong>
                      <small>1 credit per email</small>
                    </article>
                  </div>
                </section>

                <label className="draft-summary-v2-subject">
                  <span>Subject Line</span>
                  <div>
                    <input
                      value={effectiveDraftSubject}
                      onChange={(event) => onDraftSubjectChange ? onDraftSubjectChange(event.target.value) : setDraftSubject(event.target.value)}
                      placeholder="Enter subject line"
                    />
                    <button type="button" onClick={() => insertDraftSummaryVariable('{{FirstName}}')}>
                      <i className="ti ti-user-plus" aria-hidden="true" /> Personalize
                    </button>
                  </div>
                </label>

                <section className="draft-summary-v2-editor">
                  <h4>Email Body</h4>
                  <div className="draft-summary-v2-editor-shell">
                    <RichTextEditor
                      value={effectiveDraftMessage}
                      onChange={(next) => onDraftBodyChange ? onDraftBodyChange(next) : setDraftMessage(next)}
                      placeholder="Write your email draft..."
                    />
                    <footer>
                      <span>Words: {draftSummaryWordCount}</span>
                      <span>Characters: {draftSummaryCharacterCount}</span>
                    </footer>
                  </div>
                </section>

                <section className="draft-summary-v2-bottom">
                  <article className="draft-summary-v2-upload">
                    <h4>Attachments (Optional)</h4>
                    <input
                      ref={draftSummaryFileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx"
                      hidden
                      onChange={(event) => {
                        handleDraftSummaryFiles(event.target.files);
                        event.target.value = '';
                      }}
                    />
                    <div
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDraftSummaryFiles(event.dataTransfer.files);
                      }}
                    >
                      <strong>Drag & drop files here or</strong>
                      <button type="button" onClick={() => draftSummaryFileInputRef.current?.click()}>Choose Files</button>
                      <small>Supported formats: PDF, DOC, DOCX (Max size: 10MB)</small>
                    </div>
                  </article>

                  <article className="draft-summary-v2-attachment">
                    {draftSummaryAttachments.length ? draftSummaryAttachments.slice(-1).map((attachment) => (
                      <div key={attachment.id}>
                        <i className="ti ti-file" aria-hidden="true" />
                        <div>
                          <strong>{attachment.name}</strong>
                          <span>{attachment.name.split('.').pop()?.toUpperCase() || 'FILE'} - {formatDraftSummaryFileSize(attachment.size)}</span>
                        </div>
                        <a href={attachment.url} download={attachment.name} title="Download attachment"><i className="ti ti-download" aria-hidden="true" /></a>
                        <button type="button" onClick={() => removeDraftSummaryAttachment(attachment.id)} aria-label={`Remove ${attachment.name}`}>x</button>
                      </div>
                    )) : (
                      <div>
                        <i className="ti ti-file" aria-hidden="true" />
                        <div>
                          <strong>No attachment uploaded</strong>
                          <span>Choose files to attach media kit or documents</span>
                        </div>
                      </div>
                    )}
                  </article>

                  <article className="draft-summary-v2-spam">
                    <h4>Spam Check</h4>
                    <div>
                      <i className="ti ti-shield-check" aria-hidden="true" />
                      <div>
                        <strong>No spam issues found</strong>
                        <span>Your email content is good to go!</span>
                      </div>
                    </div>
                  </article>
                </section>
              </section>
            </main>

            <footer className="draft-summary-v2-footer">
              <button type="button" onClick={() => setShowDraftSummaryPopup(false)}>Cancel</button>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDraftSummaryPopup(false);
                    setShowSelectDraftPopup(true);
                  }}
                >
                  <i className="ti ti-arrow-left" aria-hidden="true" /> Back
                </button>
                <button type="button" className="primary" onClick={handleDraftSummaryNext}>
                  Next <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {renderPortalPopup(
        false && showDraftSummaryPopup,
        <div className="wf-backdrop" onClick={() => setShowDraftSummaryPopup(false)}>
          <div className="premium-calendar-modal wf-modal premium-template-modal" style={popupStyleFor('draftSummary')} onClick={(event) => event.stopPropagation()}>
            <div className="wf-header">
              <span className="wf-header-badge">5</span>
              <h3 className="wf-header-title">Step 5: Draft Summary</h3>
              <small className="wf-header-step">Step 5 of 7</small>
              <button type="button" className="wf-header-close" onClick={() => setShowDraftSummaryPopup(false)}>×</button>
            </div>

            <div className="wf-body premium-template-body">
              <section className="premium-draft-summary-meta">
                <article>
                  <span>From</span>
                  <strong>{selectedAccountLabel || 'Select Sender ID'}</strong>
                </article>
                <article>
                  <span>Sender ID</span>
                  <strong>{selectedSenderAccountId || 'Not selected'}</strong>
                </article>
                <article>
                  <span>Project</span>
                  <strong>{project || 'No project'}</strong>
                </article>
                <article>
                  <span>Recipient Count</span>
                  <strong>{Number(overviewRows.length || previewRows.length || 0).toLocaleString()}</strong>
                </article>
                <article>
                  <span>Draft Name</span>
                  <strong>{selectedDraftTypeLabel || selectedDraftType || 'Draft'}</strong>
                </article>
              </section>

              <label className="premium-draft-summary-subject">
                <input
                  type="text"
                  value={effectiveDraftSubject}
                  onChange={(event) => onDraftSubjectChange ? onDraftSubjectChange(event.target.value) : setDraftSubject(event.target.value)}
                  placeholder="Subject"
                />
              </label>

              <div className="premium-template-field premium-template-message-head">
                <span>Message</span>
              </div>
              <div className="premium-template-editor premium-summary-message-editor">
                <RichTextEditor
                  value={effectiveDraftMessage}
                  onChange={(next) => onDraftBodyChange ? onDraftBodyChange(next) : setDraftMessage(next)}
                  placeholder="Write your template message..."
                  collapsibleToolbar
                />
              </div>

              <section className="premium-draft-full-preview">
                <div className="premium-draft-full-preview-head">
                  <span>Full Email Preview</span>
                  <strong>{effectiveDraftSubject || 'No subject'}</strong>
                </div>
                <EmailRenderer
                  html={effectiveDraftMessage}
                  className="premium-draft-full-preview-body"
                  empty={<p>Your full email preview will appear here after you add draft content.</p>}
                />
              </section>

            </div>
            <div className="wf-footer">
              <div className="wf-footer-left">
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={() => {
                    setShowDraftSummaryPopup(false);
                    setShowSelectDraftPopup(true);
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="wf-btn-secondary"
                  onClick={handleSaveDraft}
                  disabled={draftSaving}
                >
                  {draftSaving ? 'Saving...' : 'Save Draft'}
                </button>
              </div>
              <button
                type="button"
                className="wf-btn-primary"
                onClick={async () => {
                  const hasSummaryRequiredFields =
                    Boolean(String(effectiveDraftSubject || '').trim()) &&
                    Boolean(String(effectiveDraftMessage || '').replace(/<[^>]*>/g, '').trim());
                  if (!hasSummaryRequiredFields) {
                    onShowMessage?.('Complete required details first.', 'warning');
                    return;
                  }
                  setWorkflowPosition((current) => Math.max(current, 6));
                  setShowDraftSummaryPopup(false);
                  setShowTestEmailPopup(true);
                }}
              >
                {String(effectiveDraftSubject || '').trim() && String(effectiveDraftMessage || '').replace(/<[^>]*>/g, '').trim()
                  ? 'Continue'
                  : 'Complete required details first'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
