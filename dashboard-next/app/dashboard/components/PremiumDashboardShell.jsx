'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
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


const MAX_SCHEDULE_DELAY_MINUTES = 1440;
const MAX_SCHEDULE_DELAY_HOURS = 24;
const MAX_SCHEDULE_DELAY_SECONDS = 86400;
const DEFAULT_WORKFLOW_STEP_COUNT = 7;
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
  const [overviewFilter, setOverviewFilter] = useState('all');
  const [overviewSearch, setOverviewSearch] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [columnMappings, setColumnMappings] = useState([]);
  const [overviewRows, setOverviewRows] = useState([]);
  const [reviewLocalColumns, setReviewLocalColumns] = useState([]);
  const [selectedOverviewRowIds, setSelectedOverviewRowIds] = useState([]);
  const [selectedOverviewColumns, setSelectedOverviewColumns] = useState([]);
  const [mappingCollapsed, setMappingCollapsed] = useState(false);
  const [showClientListSelectionNote, setShowClientListSelectionNote] = useState(false);
  const [showCampaignNotice, setShowCampaignNotice] = useState(false);
  const [showProceedWithoutListNote, setShowProceedWithoutListNote] = useState(false);
  const hasShownProceedWithoutListNoteRef = useRef(false);
  const hasShownCampaignMissingWarningRef = useRef(false);
  const hasShownOverviewWarningRef = useRef(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [durationUnit, setDurationUnit] = useState(normalizeDurationUnit(initialDurationUnit || 'seconds'));
  const [scheduleTimezone, setScheduleTimezone] = useState(initialScheduleTimezone || 'Asia/Kolkata');
  const [scheduledDateValue, setScheduledDateValue] = useState(initialScheduledDateValue || '');
  const [scheduledTimeValue, setScheduledTimeValue] = useState(initialScheduledTimeValue || '');
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
  const [draftUploadedFileName, setDraftUploadedFileName] = useState('');
  const [draftUploadedText, setDraftUploadedText] = useState('');
  const [draftFileReading, setDraftFileReading] = useState(false);
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
  const visibleCampaignSenderAccounts = useMemo(() => {
    const selectedProject = String(campaignProjectFilter || '').trim().toLowerCase();
    if (!selectedProject) return [];
    return senderAccounts.filter((account) => {
      const from = String(account?.from || '').trim().toLowerCase();
      const accountProject = String(account?.project || '').trim().toLowerCase();
      if (accountProject === selectedProject) return true;
      if (selectedProject === 'tec') return from.endsWith('@theentrepreneurialchronicle.com');
      if (selectedProject === 'tut') return from.endsWith('@theunicorntimes.com');
      return false;
    });
  }, [campaignProjectFilter, senderAccounts]);
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
        clientList: { width: 'min(90vw, 780px)', maxHeight: 'min(90vh, 760px)' },
        overview: { width: 'min(90vw, 780px)', maxHeight: 'min(90vh, 760px)' },
        campaign: { width: 'min(90vw, 780px)', maxHeight: 'min(90vh, 760px)' },
        selectDraft: { width: 'min(90vw, 780px)', maxHeight: 'min(90vh, 760px)' },
        testEmail: { width: 'min(90vw, 780px)', maxHeight: 'min(90vh, 760px)' },
        draftSummary: { width: 'min(90vw, 780px)', maxHeight: 'min(90vh, 760px)' },
        schedule: { width: 'min(90vw, 780px)', maxHeight: 'min(90vh, 760px)' },
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
    return effectiveDraftLibrary.filter((draft) => {
      const draftType = inferDraftTypeFromDraft(draft);
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
      if (query && !blob.includes(query)) return false;
      return true;
    });
  }, [effectiveDraftLibrary, selectDraftSearch, selectDraftTypeFilter]);
  const draftTypeCounts = useMemo(() => {
    return draftTypeItems.reduce((counts, item) => {
      counts[item.value] = effectiveDraftLibrary.filter((draft) => inferDraftTypeFromDraft(draft) === item.value).length;
      return counts;
    }, {});
  }, [draftTypeItems, effectiveDraftLibrary]);
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
    if (step.action === 'Upload List' || step.title === 'Upload List') {
      setClientListTab('custom');
      openAnchoredPopup('clientList', setShowClientListPopup)(event);
      return;
    }
    if (step.action === 'Review List' || step.title === 'Review List') {
      openAnchoredPopup('overview', setShowOverviewPopup)(event);
      return;
    }
    if (step.action === 'Campaign' || step.title === 'Campaign') {
      openAnchoredPopup('campaign', setShowCampaignPopup)(event);
      return;
    }
    if (step.action === 'Select Draft' || step.title === 'Select Draft') {
      openAnchoredPopup('selectDraft', setShowSelectDraftPopup)(event);
      return;
    }
    if (step.index === 6 || step.action === 'Test Email' || step.title === 'Test Email') {
      openAnchoredPopup('testEmail', setShowTestEmailPopup)(event);
      return;
    }
    if (step.action === 'Draft Summary' || step.title === 'Draft Summary' || step.title === 'Summary') {
      openAnchoredPopup('draftSummary', setShowDraftSummaryPopup)(event);
      return;
    }
    if (step.action === 'Schedule' || step.title === 'Schedule') {
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

  const handleViewCampaign = (campaign) => {
    if (onViewCampaignDetail) {
      onViewCampaignDetail(campaign.id || campaign._id);
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

  const canContinueClientList =
    clientListTab === 'upload'
      ? Boolean(selectedListId || uploadedListId)
      : clientListTab === 'uploaded'
        ? Boolean(selectedUploadedList)
        : Boolean(selectedCustomList);
  const hasPickedUploadFile = Boolean(String(selectedUploadFileName || clientListName || '').trim());
  const clientListActionReady = canContinueClientList || clientListUploading;
  const displayedClientListName = selectedListName || selectedUploadFileName || clientListName || 'No file selected yet';

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
          ? selectedUploadedList
        : clientListTab === 'custom'
          ? selectedCustomList
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
    onSelectList?.(selectedList);
    setWorkflowPosition((current) => Math.max(current, 2));
    setShowClientListPopup(false);
    setShowOverviewPopup(true);
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
    setWorkflowPosition((current) => Math.max(current, 3));
    setShowOverviewPopup(false);
    setShowCampaignPopup(true);
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
    setWorkflowPosition((current) => Math.max(current, 3));
    setShowOverviewPopup(false);
    setShowCampaignPopup(true);
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

  const resumeCampaignDraft = (campaign) => {
    if (!campaign) return;
    const isNextProcess = Boolean(campaign.nextProcessMode);
    const nextDraftType = normalizeDraftType(campaign.nextDraftType || campaign.draftType || campaign.type || '');
    const nextDraft = isNextProcess && nextDraftType
      ? effectiveSavedDrafts.find((draft) => normalizeDraftType(draft.draftType || draft.category || '') === nextDraftType)
      : null;
    const campaignSenderFrom = String(campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user || '').trim().toLowerCase();
    const matchedSenderAccount = campaignSenderFrom
      ? senderAccounts.find((account) => String(account?.from || '').trim().toLowerCase() === campaignSenderFrom)
      : null;
    onCampaignNameChange?.(String(campaign.name || ''));
    onSelectList?.(String(campaign.listId || ''));
    onSelectSenderAccount?.(String(campaign.senderAccountId || campaign.senderAccount?._id || campaign.senderAccount?.id || matchedSenderAccount?.id || ''));
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
  const updateOverviewCell = (rowId, field, value) => {
    setOverviewRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
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

  return (
    <>
    <div className="page-body">
      <StatStrip stats={reportMetricCards} />

      <Workflow
        workflowSteps={workflowSteps}
        activeWorkflowStep={activeWorkflowStep}
        handleWorkflowAction={handleWorkflowAction}
        selectedDraftType={selectedDraftType}
        onSelectedDraftTypeChange={onSelectedDraftTypeChange}
        workflowShellRef={workflowShellRef}
      />

      <MainPanels
        targetMode={targetMode}
        setTargetMode={setTargetMode}
        customTargetStart={customTargetStart}
        setCustomTargetStart={setCustomTargetStart}
        customTargetEnd={customTargetEnd}
        setCustomTargetEnd={setCustomTargetEnd}
        targetLimit={targetLimit}
        targetSentCount={targetSentCount}
        targetRemaining={targetRemaining}
        targetPercent={targetPercent}
        targetWindowLabel={targetWindowLabel}
        targetAchieved={targetAchieved}
        targetResetText={targetResetText}
        targetStatusTone={targetStatusTone}
        targetApprovalLabel={targetApprovalLabel}
        targetApprovalReviewedAt={targetApprovalReviewedAt}
        targetApprovalRequestNote={targetApprovalRequestNote}
        targetPeriodValue={targetPeriodValue}
        targetDailyCount={targetDailyCount}
        setTargetApprovalStatusState={setTargetApprovalStatusState}
        onShowMessage={onShowMessage}
        monthLabel={monthLabel}
        setCalendarCursor={setCalendarCursor}
        calendarViewMode={calendarViewMode}
        weekdayLabels={weekdayLabels}
        calendarCells={calendarCells}
        allCalendarEvents={allCalendarEvents}
        sameDay={sameDay}
        getCalendarEventTone={getCalendarEventTone}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        openAnchoredPopup={openAnchoredPopup}
        setShowDayPopup={setShowDayPopup}
        setShowCalendarPopup={setShowCalendarPopup}
        calendarLoading={calendarLoading}
        selectedEvents={selectedEvents}
        openEventForm={openEventForm}
        todayCalendarEvents={todayCalendarEvents}
        upcomingTaskCount={upcomingTaskCount}
        upcomingCampaignCount={upcomingCampaignCount}
        upcomingMeetingCount={upcomingMeetingCount}
        upcomingCalendarEvents={upcomingCalendarEvents}
        today={today}
        setShowNotificationsPopup={setShowNotificationsPopup}
        notificationCards={notificationCards}
        openInboxMail={openInboxMail}
        noteTopic={noteTopic}
        setNoteTopic={setNoteTopic}
        noteTag={noteTag}
        setNoteTag={setNoteTag}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        setShowNotesPopup={setShowNotesPopup}
        addQuickNote={addQuickNote}
        quickNotes={quickNotes}
        broadcastPerformanceRef={broadcastPerformanceRef}
        onRefreshCampaigns={onRefreshCampaigns}
        campaignRefreshing={campaignRefreshing}
        selectedRows={selectedRows}
        handleSelectionSummaryClick={handleSelectionSummaryClick}
        tagFilterRef={tagFilterRef}
        openTagFilterMenu={openTagFilterMenu}
        showTagFilterMenu={showTagFilterMenu}
        selectedTagFilterLabel={selectedTagFilterLabel}
        tableSearch={tableSearch}
        setTableSearch={setTableSearch}
        handleActionCenterClick={handleActionCenterClick}
        paginatedCampaigns={paginatedCampaigns}
        openActionMenu={openActionMenu}
        setOpenActionMenu={setOpenActionMenu}
        resumeCampaignDraft={resumeCampaignDraft}
        handleViewCampaign={handleViewCampaign}
        toggleRowSelection={toggleRowSelection}
        actionMenuRef={actionMenuRef}
        handleEditTagsClick={handleEditTagsClick}
        onPauseCampaign={onPauseCampaign}
        onStopCampaign={onStopCampaign}
        onResumeCampaign={onResumeCampaign}
        handleDeleteCampaignClick={handleDeleteCampaignClick}
        toggleAllRows={toggleAllRows}
        currentTablePage={currentTablePage}
        setCurrentTablePage={setCurrentTablePage}
        totalTablePages={totalTablePages}
      />

      <BottomGrid
        inlineTimelineCards={inlineTimelineCards}
        timelineDateLabel={timelineDateLabel}
        timelineCompletionMap={timelineCompletionMap}
        setTimelineCompletionMap={setTimelineCompletionMap}
        onTimelineTaskStatesChange={onTimelineTaskStatesChange}
        setSelectedTimelineTask={setSelectedTimelineTask}
        setShowTimelinePopup={setShowTimelinePopup}
        workspaceOverviewItems={workspaceOverviewItems}
        openAnchoredPopup={openAnchoredPopup}
        setShowLogsPopup={setShowLogsPopup}
        onShowMessage={onShowMessage}
      />
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
          <div className="premium-calendar-modal wf-modal pr-uploadlist-modal" style={popupStyleFor('clientList')} onClick={(event) => event.stopPropagation()}>
            <div className="wf-header">
              <span className="wf-header-badge">1</span>
              <h3 className="wf-header-title">Step 1: Upload List</h3>
              <small className="wf-header-step">Step 1 of 7</small>
              <button type="button" className="wf-header-close" onClick={() => setShowClientListPopup(false)}>×</button>
            </div>

            <div className="wf-body pr-uploadlist-body pr-uploadlist-split pr-uploadlist-always">
              <section className="pr-uploadlist-pane">
                <div className="pr-uploadlist-section-copy">
                  <strong>Customize List</strong>
                </div>
                <div className="pr-uploadlist-list">
                  {effectiveCustomLists.length ? effectiveCustomLists.map((item) => (
                    <label key={item.id} className={`pr-uploadlist-item ${selectedCustomList === item.id ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="customListFresh"
                        checked={selectedCustomList === item.id}
                        onChange={() => {
                          setClientListTab('custom');
                          setSelectedCustomList(item.id);
                          setSelectedUploadedList('');
                          onSelectList?.(item.id);
                        }}
                      />
                      <div className="pr-uploadlist-item-content">
                        <div className="pr-uploadlist-item-title">
                          <strong>{item.title}</strong>
                          <span className="pr-uploadlist-kind-badge">Custom</span>
                        </div>
                        <div className="pr-uploadlist-item-meta">
                          <span><strong>{item.leadCount || 0}</strong> contacts</span>
                          {item.uploadedAt ? (
                            <span>
                              Saved {(() => {
                                const d = new Date(item.uploadedAt);
                                return isNaN(d.getTime()) ? 'recently' : d.toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                });
                              })()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  )) : (
                    <div className="pr-uploadlist-empty">
                      <strong>No saved client lists yet.</strong>
                      <p>Your saved lists will appear here.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="pr-uploadlist-pane">
                <div className="pr-uploadlist-section-copy">
                  <strong>Upload Sheet</strong>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(event) => {
                    setClientListTab('upload');
                    handlePremiumShellUpload(event);
                  }}
                  style={{ display: 'none' }}
                  id="premium-shell-upload-input-fresh"
                />
                <label className="pr-uploadlist-uploadbox" htmlFor="premium-shell-upload-input-fresh">
                  {clientListUploading ? (
                    <>
                      <div className="pr-uploadlist-spinner"></div>
                      <div className="pr-uploadlist-uploadbox-text">
                        <strong>Uploading...</strong>
                        <span>Please wait while we process your sheet.</span>
                      </div>
                    </>
                  ) : (selectedListName || selectedUploadFileName || clientListName) ? (
                    (() => {
                      const fileName = selectedListName || selectedUploadFileName || clientListName;
                      const fileExt = String(fileName).split('.').pop()?.toUpperCase() || 'FILE';
                      return (
                        <>
                          <div className="pr-uploadlist-uploadicon success">✓</div>
                          <div className="pr-uploadlist-uploadbox-text">
                            <div className="pr-uploadlist-fileinfo-row">
                              <strong className="pr-uploadlist-filename">{fileName}</strong>
                              <span className="pr-uploadlist-filetype-badge">{fileExt}</span>
                            </div>
                            <div className="pr-uploadlist-status-row">
                              <span className="pr-uploadlist-status-dot"></span>
                              <span className="pr-uploadlist-status-text">Ready to import</span>
                            </div>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <div className="pr-uploadlist-uploadicon">+</div>
                      <div className="pr-uploadlist-uploadbox-text">
                        <strong>Upload Excel or CSV</strong>
                        <span>Click to browse your sheet.</span>
                      </div>
                    </>
                  )}
                </label>

                <div className="pr-uploadlist-uploaded-box">
                  <div className="pr-uploadlist-uploaded-headline">
                    <strong>Uploaded Lists ({effectiveUploadedLists.length})</strong>
                    <label htmlFor="premium-shell-upload-input-fresh">Change</label>
                  </div>
                  <div className="pr-uploadlist-list pr-uploadlist-uploaded-scroll">
                    {effectiveUploadedLists.length ? effectiveUploadedLists.map((item) => (
                      <label key={item.id} className={`pr-uploadlist-item compact ${selectedUploadedList === item.id || selectedListId === item.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="uploadedListFresh"
                          checked={selectedUploadedList === item.id || selectedListId === item.id}
                          onChange={() => {
                            setClientListTab('uploaded');
                            setSelectedUploadedList(item.id);
                            setSelectedCustomList('');
                            onSelectList?.(item.id);
                          }}
                        />
                        <div className="pr-uploadlist-item-content">
                          <div className="pr-uploadlist-item-title">
                            <strong>{item.title}</strong>
                            <span className="pr-uploadlist-kind-badge">Sheet</span>
                          </div>
                          <div className="pr-uploadlist-item-meta">
                            <span><strong>{item.leadCount || 0}</strong> contacts</span>
                          </div>
                        </div>
                      </label>
                    )) : (
                      <div className="pr-uploadlist-empty compact">
                        <p>No uploaded lists yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="pr-uploadlist-tabs">
              <div className="pr-uploadlist-tabs-container">
                <button type="button" className={clientListTab === 'custom' ? 'active' : ''} onClick={() => setClientListTab('custom')}>
                  Customize List
                </button>
                <button type="button" className={clientListTab === 'upload' ? 'active' : ''} onClick={() => setClientListTab('upload')}>
                  Upload Sheet
                </button>
              </div>
            </div>

            {clientListTab === 'upload' ? (
              <div className="wf-body pr-uploadlist-body pr-uploadlist-split">
                <section className="pr-uploadlist-pane">
                  <div className="pr-uploadlist-section-copy">
                    <strong>Upload Sheet</strong>
                    <p>Choose one sheet, then continue to the review step.</p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handlePremiumShellUpload}
                    style={{ display: 'none' }}
                    id="premium-shell-upload-input"
                  />
                  <label className="pr-uploadlist-uploadbox" htmlFor="premium-shell-upload-input">
                    {clientListUploading ? (
                      <>
                        <div className="pr-uploadlist-spinner"></div>
                        <div className="pr-uploadlist-uploadbox-text">
                          <strong>Uploading...</strong>
                          <span>Please wait while we process your sheet</span>
                        </div>
                      </>
                    ) : (selectedListName || selectedUploadFileName || clientListName) ? (
                      (() => {
                        const fileName = selectedListName || selectedUploadFileName || clientListName;
                        const fileExt = String(fileName).split('.').pop()?.toUpperCase() || 'FILE';
                        return (
                          <>
                            <div className="pr-uploadlist-uploadicon success">✓</div>
                            <div className="pr-uploadlist-uploadbox-text">
                              <div className="pr-uploadlist-fileinfo-row">
                                <strong className="pr-uploadlist-filename">{fileName}</strong>
                                <span className="pr-uploadlist-filetype-badge">{fileExt}</span>
                              </div>
                              <div className="pr-uploadlist-status-row">
                                <span className="pr-uploadlist-status-dot"></span>
                                <span className="pr-uploadlist-status-text">Ready to import</span>
                              </div>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <>
                        <div className="pr-uploadlist-uploadicon">+</div>
                        <div className="pr-uploadlist-uploadbox-text">
                          <strong>Choose a sheet to import</strong>
                          <span>Click here to browse Excel or CSV files (Max 10MB)</span>
                        </div>
                      </>
                    )}
                  </label>
                </section>
                <section className="pr-uploadlist-pane">
                  <div className="pr-uploadlist-section-copy">
                    <strong>Uploaded Files</strong>
                    <p>All uploaded sheets are available here.</p>
                  </div>
                  <div className="pr-uploadlist-list">
                    {effectiveUploadedLists.length ? effectiveUploadedLists.map((item) => (
                      <label key={item.id} className={`pr-uploadlist-item ${selectedUploadedList === item.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="uploadedListFromUpload"
                          checked={selectedUploadedList === item.id}
                          onChange={() => {
                            setSelectedUploadedList(item.id);
                            onSelectList?.(item.id);
                          }}
                        />
                        <div className="pr-uploadlist-item-content">
                          <div className="pr-uploadlist-item-title">
                            <strong>{item.title}</strong>
                            <span className="pr-uploadlist-kind-badge">Sheet</span>
                          </div>
                          <div className="pr-uploadlist-item-meta">
                            <span className="pr-uploadlist-meta-count">
                              <strong>{item.leadCount || 0}</strong> contacts
                            </span>
                            {item.uploadedAt && (
                              <span className="pr-uploadlist-meta-date">
                                • Uploaded {(() => {
                                  const d = new Date(item.uploadedAt);
                                  return isNaN(d.getTime()) ? 'recently' : d.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) + ', ' + d.toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    )) : (
                      <div className="pr-uploadlist-empty">
                        <strong>No uploaded files yet.</strong>
                        <p>Upload a sheet first, and it will appear here for everyone in this workflow.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {clientListTab === 'uploaded' ? (
              <div className="wf-body pr-uploadlist-body">
                <section className="pr-uploadlist-pane">
                  <div className="pr-uploadlist-section-copy">
                    <strong>Uploaded Files</strong>
                    <p>Choose any sheet you&apos;ve already uploaded.</p>
                  </div>
                  <div className="pr-uploadlist-list" style={{ maxHeight: '360px' }}>
                    {effectiveUploadedLists.length ? effectiveUploadedLists.map((item) => (
                      <label key={item.id} className={`pr-uploadlist-item ${selectedUploadedList === item.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="uploadedList"
                          checked={selectedUploadedList === item.id}
                          onChange={() => {
                            setSelectedUploadedList(item.id);
                            onSelectList?.(item.id);
                          }}
                        />
                        <div className="pr-uploadlist-item-content">
                          <div className="pr-uploadlist-item-title">
                            <strong>{item.title}</strong>
                            <span className="pr-uploadlist-kind-badge">Sheet</span>
                          </div>
                          <div className="pr-uploadlist-item-meta">
                            <span className="pr-uploadlist-meta-count">
                              <strong>{item.leadCount || 0}</strong> contacts
                            </span>
                            {item.uploadedAt && (
                              <span className="pr-uploadlist-meta-date">
                                • Uploaded {(() => {
                                  const d = new Date(item.uploadedAt);
                                  return isNaN(d.getTime()) ? 'recently' : d.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) + ', ' + d.toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                })()}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    )) : (
                      <div className="pr-uploadlist-empty">
                        <strong>No uploaded lists yet.</strong>
                        <p>Upload a file first, and the file name, date, time, and contact count will appear here.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            {clientListTab === 'custom' ? (
              <div className="wf-body pr-uploadlist-body">
                <section className="pr-uploadlist-pane">
                  <div className="pr-uploadlist-section-copy">
                    <strong>Customize List</strong>
                    <p>Use a client list created in your workspace.</p>
                  </div>
                  <div className="pr-uploadlist-list" style={{ maxHeight: '360px' }}>
                    {effectiveCustomLists.length ? effectiveCustomLists.map((item) => (
                      <label key={item.id} className={`pr-uploadlist-item ${selectedCustomList === item.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="customList"
                          checked={selectedCustomList === item.id}
                          onChange={() => {
                            setSelectedCustomList(item.id);
                            onSelectList?.(item.id);
                          }}
                        />
                        <div className="pr-uploadlist-item-content">
                          <div className="pr-uploadlist-item-title">
                            <strong>{item.title}</strong>
                            <span className="pr-uploadlist-kind-badge">Custom</span>
                          </div>
                          <div className="pr-uploadlist-item-meta">
                            <span className="pr-uploadlist-meta-count">
                              <strong>{item.leadCount || 0}</strong> contacts
                            </span>
                            {item.uploadedAt && (
                              <span className="pr-uploadlist-meta-date">
                                • Saved {(() => {
                                  const d = new Date(item.uploadedAt);
                                  return isNaN(d.getTime()) ? 'recently' : d.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  }) + ', ' + d.toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                })()}
                              </span>
                            )}
                            {item.sourceFile && item.sourceFile !== item.title && (
                              <span className="pr-uploadlist-meta-file">
                                • File: {item.sourceFile}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    )) : (
                      <div className="pr-uploadlist-empty">
                        <strong>No saved client lists yet.</strong>
                        <p>Your stored files will show up here with their details and contact count.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}

            <div className="wf-footer">
              <div className="wf-footer-left"></div>
              <button
                type="button"
                className={`wf-btn-primary${clientListActionReady ? '' : ' is-disabled'}`}
                onClick={handleClientListNext}
              >
                {clientListUploading ? 'Uploading...' : canContinueClientList ? 'Continue' : 'Select required list first'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showOverviewPopup,
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
                    className={`premium-schedule-next${canAttemptScheduleAction ? '' : ' is-disabled'}`}
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

              <div className="premium-campaign-grid premium-campaign-grid-main">
                <label className="premium-campaign-field">
                  <span>Project</span>
                  <select
                    value={campaignProjectFilter}
                    onChange={(event) => setCampaignProjectFilter(event.target.value)}
                    aria-label="Select project"
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
                    setShowCampaignPopup(true);
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
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowScheduleSuccessPopup(false)}>
          <div className="premium-calendar-modal premium-schedule-success-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-schedule-success-head">
              <span className="premium-popup-step-badge">✓</span>
              <div>
                <h3>Campaign Scheduled Successfully</h3>
                <p>Your campaign has been scheduled.</p>
              </div>
            </div>
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
            <div className="premium-schedule-success-actions">
              <button
                type="button"
                className="premium-schedule-next"
                onClick={() => {
                  setShowScheduleSuccessPopup(false);
                  router.push('/dashboard/broadcasts');
                }}
              >
                View Broadcasts
              </button>
              <button type="button" className="ghost subtle" onClick={() => setShowScheduleSuccessPopup(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showTestEmailPopup,
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

