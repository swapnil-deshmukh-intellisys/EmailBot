'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RichTextEditor from './RichTextEditor';

function clampPercent(value) {
  const numeric = Number(value || 0);
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function MetricCard({ item }) {
  const percent = clampPercent(item.percent);
  return (
    <article className={`premium-kpi-card premium-kpi-${item.tone || 'neutral'}`}>
      <div className="premium-kpi-copy">
        {item.icon ? <span className="premium-kpi-icon">{item.icon}</span> : null}
        <p>{item.title}</p>
        <strong>{item.value}</strong>
        <span>{item.meta}</span>
      </div>
      <div
        className="premium-kpi-ring"
        style={{
          '--kpi-ring-color': item.color || 'var(--accent)',
          '--kpi-ring-percent': `${percent}%`
        }}
      >
        <span>{percent}%</span>
      </div>
    </article>
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
  const stepChipTone = {
    1: 'upload',
    2: 'review',
    3: 'campaign',
    4: 'draft',
    5: 'summary',
    6: 'test',
    7: 'schedule'
  };
  const stepIcons = {
    1: '⬆',
    2: '◫',
    3: '✦',
    4: '◫',
    5: '▣',
    6: '✉',
    7: '⏱'
  };
  const statusClass = `is-${status}`;
  const actionButtonStyle = {
    color: 'var(--button-text)',
    background: 'var(--button-bg)',
    border: '1px solid var(--button-border)',
    ...(isOverviewStep ? { fontSize: '10px', fontWeight: 700, lineHeight: 1.1, paddingLeft: '10px', paddingRight: '10px' } : {})
  };
  return (
    <article
      className={`premium-step-card premium-step-tone-${step.index} ${statusClass}`}
      style={{ color: 'var(--text-primary)' }}
    >
      <div className="premium-step-track">
        <span className="premium-step-index">{step.index}</span>
        {!isLast ? <i /> : null}
      </div>
      <strong style={{ color: 'var(--text-primary)' }}>
        {stepIcons[step.index] ? <span className="premium-step-title-icon">{stepIcons[step.index]}</span> : null}
        <span>{step.title}</span>
      </strong>
      <span className={`premium-step-chip premium-step-chip-${stepChipTone[step.index] || 'default'}`}>
        {stepLabels[step.index] || `Step ${step.index}`}
      </span>
      {isDraftStep ? (
        <button
          type="button"
          className={`premium-step-action premium-step-action-${step.index}`}
          onClick={(event) => onAction?.(step, event)}
          style={actionButtonStyle}
        >
          Drafts
        </button>
      ) : (
        <button
          type="button"
          className={`premium-step-action premium-step-action-${step.index}`}
          onClick={(event) => onAction?.(step, event)}
          style={actionButtonStyle}
        >
          {step.action}
        </button>
      )}
    </article>
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
        {onClick ? <span className="premium-list-item-cue">Click to open</span> : null}
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
  return (
    <div className="premium-note-item">
      <div className="premium-note-item-head">
        <div className="premium-avatar premium-note-avatar">{item.avatar || 'QN'}</div>
        <div>
          <strong>{item.name}</strong>
          <small>{item.time}</small>
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
  calendarDays,
  selectedAccountLabel,
  senderAccounts = [],
  selectedSenderAccountId = '',
  onSelectSenderAccount,
  project,
  barChartMetrics,
  logs,
  activeCampaign = null,
  activeCampaignProgressText = '0/0 emails sent',
  lists = [],
  selectedListId = '',
  selectedListName = '',
  previewRows = [],
  previewColumns = [],
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
  delaySeconds = 60,
  onDelaySecondsChange,
  onCreateCampaign,
  scheduledCountry = 'india',
  onScheduledCountryChange,
  scheduledSlot = '',
  onScheduledSlotChange,
  manualScheduledSlot = '',
  onManualScheduledSlotChange,
  onApplyManualScheduledSlot,
  onStartCampaign,
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
  targetApprovalRequestNote = ''
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
    return `/master-inbox${query ? `?${query}` : ''}`;
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
  const [customCalendarEvents, setCustomCalendarEvents] = useState([]);
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
    () => [...calendarEvents, ...customCalendarEvents].filter((item) => item.date),
    [calendarEvents, customCalendarEvents]
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
    const combinedCards = [...(timelineCards || []), ...(timelineCustomTasks || [])];
    return combinedCards.sort((a, b) => {
      const aTime = parseEventDate(`${a.date} ${a.time || ''}`)?.getTime?.() || parseEventDate(a.date)?.getTime?.() || 0;
      const bTime = parseEventDate(`${b.date} ${b.time || ''}`)?.getTime?.() || parseEventDate(b.date)?.getTime?.() || 0;
      return aTime - bTime;
    });
  }, [timelineCards, timelineCustomTasks]);
  const groupedTimelineCards = useMemo(() => {
    return timelineSortedCards.reduce((groups, item) => {
      const label = timelineDateLabel(item.date);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
      return groups;
    }, {});
  }, [timelineSortedCards]);
  const inlineTimelineCards = useMemo(() => {
    const pendingCards = timelineSortedCards.filter((item, index) => {
      const key = item.id || `${item.date}-${index}`;
      return !Boolean(timelineCompletionMap[key]);
    });
    return pendingCards.slice(0, 7);
  }, [timelineCompletionMap, timelineSortedCards]);
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
  const [showDraftSummaryPopup, setShowDraftSummaryPopup] = useState(false);
  const [showClientListPopup, setShowClientListPopup] = useState(false);
  const [showOverviewPopup, setShowOverviewPopup] = useState(false);
  const [showOverviewNotice, setShowOverviewNotice] = useState(false);
  const [showCampaignPopup, setShowCampaignPopup] = useState(false);
  const [showSelectDraftPopup, setShowSelectDraftPopup] = useState(false);
  const [showTestEmailPopup, setShowTestEmailPopup] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState(false);
  const [showDraftContinueWarning, setShowDraftContinueWarning] = useState(false);
  const [popupAnchors, setPopupAnchors] = useState({});
  const [dayEventDraft, setDayEventDraft] = useState('');
  const [dayEventTitleDraft, setDayEventTitleDraft] = useState('');
  const [dayEventDetailDraft, setDayEventDetailDraft] = useState('');
  const [dayEventTypeDraft, setDayEventTypeDraft] = useState('Reminder');
  const [tableSearch, setTableSearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('All Tags');
  const [selectedRows, setSelectedRows] = useState([]);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const actionMenuRef = useRef(null);
  const [isBroadcastPerformanceMinimized, setIsBroadcastPerformanceMinimized] = useState(false);
  const [currentTablePage, setCurrentTablePage] = useState(1);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteTag, setNoteTag] = useState('');
  const [quickNotes, setQuickNotes] = useState([]);
  const [sendMode, setSendMode] = useState('scheduled');
  const [clientListTab, setClientListTab] = useState('upload');
  const [clientListName, setClientListName] = useState('');
  const [selectedUploadedList, setSelectedUploadedList] = useState('');
  const [selectedCustomList, setSelectedCustomList] = useState('');
  const [overviewFilter, setOverviewFilter] = useState('all');
  const [overviewSearch, setOverviewSearch] = useState('');
  const [editingCell, setEditingCell] = useState(null);
  const [columnMappings, setColumnMappings] = useState([]);
  const [overviewRows, setOverviewRows] = useState([]);
  const [showClientListSelectionNote, setShowClientListSelectionNote] = useState(false);
  const [showCampaignNotice, setShowCampaignNotice] = useState(false);
  const [showProceedWithoutListNote, setShowProceedWithoutListNote] = useState(false);
  const hasShownProceedWithoutListNoteRef = useRef(false);
  const hasShownCampaignMissingWarningRef = useRef(false);
  const hasShownOverviewWarningRef = useRef(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [durationUnit, setDurationUnit] = useState('Minutes');
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Kolkata');
  const [scheduledDateValue, setScheduledDateValue] = useState('');
  const [scheduledTimeValue, setScheduledTimeValue] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [campaignTags, setCampaignTags] = useState([]);
  const [campaignTagDraft, setCampaignTagDraft] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignGoal, setCampaignGoal] = useState('Lead Generation');
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
  const [includeTracking, setIncludeTracking] = useState(false);
  const workflowShellRef = useRef(null);
  const draftTypeItems = [
    { value: '', label: 'All Draft Types' },
    { value: 'cover_story', label: 'Cover Story' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'follow_up', label: 'Follow Up' },
    { value: 'updated_cost', label: 'Updated Cost' },
    { value: 'final_cost', label: 'Final Cost' }
  ];
  const uploadedLists = [];
  const customLists = [];
  const savedDrafts = [];
  const draftViewerText = '';
  const effectiveDraftSubject = controlledDraftSubject ?? draftSubject;
  const effectiveDraftMessage = controlledDraftBody ?? draftMessage;
  const effectiveCampaignName = controlledCampaignName ?? campaignName;
  const effectiveCampaignSender = onSelectSenderAccount ? (selectedSenderAccountId || '') : campaignSender;
  const completedWorkflowSteps = useMemo(() => {
    const hasList = Boolean(selectedListId);
    const hasOverview = Array.isArray(previewRows) && previewRows.length > 0;
    const hasCampaignSetup = Boolean(String(effectiveCampaignName || '').trim());
    const hasDraft = Boolean(String(effectiveDraftSubject || '').trim() || String(effectiveDraftMessage || '').replace(/<[^>]*>/g, '').trim());
    const hasDraftSummary = hasDraft;
    const hasTestMail = Boolean(String(testEmailTo || '').trim());
    const hasSchedule = Boolean(String(scheduledSlot || manualScheduledSlot || '').trim());

    return [
      hasList,
      hasOverview,
      hasCampaignSetup,
      hasDraft,
      hasDraftSummary,
      hasTestMail,
      hasSchedule
    ];
  }, [
    selectedListId,
    previewRows,
    effectiveCampaignName,
    effectiveDraftSubject,
    effectiveDraftMessage,
    testEmailTo,
    scheduledSlot,
    manualScheduledSlot
  ]);
  const activeWorkflowStep = Math.max(1, Math.min(
    workflowSteps.length,
    completedWorkflowSteps.findIndex((done) => !done) + 1 || workflowSteps.length
  ));
  const completedWorkflowCount = completedWorkflowSteps.filter(Boolean).length;

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
      'timeline',
      'logs'
    ]);
    if (centeredKeys.has(key)) {
      const sizeMap = {
        notifications: { width: 'min(92vw, 560px)', maxHeight: 'min(78vh, 480px)' },
        clientList: { width: 'min(92vw, 860px)', maxHeight: 'min(82vh, 760px)' },
        overview: { width: 'min(94vw, 980px)', maxHeight: 'min(86vh, 860px)' },
        campaign: { width: 'min(90vw, 900px)', maxHeight: 'min(84vh, 820px)' },
        selectDraft: { width: 'min(94vw, 980px)', maxHeight: 'min(86vh, 860px)' },
        testEmail: { width: 'min(90vw, 920px)', maxHeight: 'min(84vh, 820px)' },
        draftSummary: { width: 'min(92vw, 940px)', maxHeight: 'min(84vh, 820px)' },
        schedule: { width: 'min(90vw, 860px)', maxHeight: 'min(82vh, 760px)' },
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
  const formatListMeta = (item) => {
    const contacts = `${Number(item?.leadCount || 0)} contacts`;
    const uploadedAt = item?.uploadedAt || item?.createdAt || item?.updatedAt || null;
    const when = uploadedAt ? new Date(uploadedAt).toLocaleString() : '';
    const sourceFile = String(item?.sourceFile || item?.fileName || item?.name || '').trim();
    const kind = String(item?.kind || 'uploaded').trim();
    const kindLabel = kind === 'custom' ? 'Custom' : 'Uploaded';
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
  const effectiveUploadedLists = normalizedClientLists.length
    ? normalizedClientLists.filter((item) => item.kind !== 'custom')
    : uploadedLists;
  const effectiveCustomLists = normalizedClientLists.length
    ? normalizedClientLists.filter((item) => item.kind === 'custom')
    : customLists;
  const effectiveSavedDrafts = draftOptions.length
    ? draftOptions.map((draft) => ({
        id: draft._id || draft.id,
        title: draft.title,
        subject: draft.subject,
        body: draft.body || draft.message || draft.html || draft.content || '',
        category: draft.category || '',
        updated: 'Saved draft'
      }))
    : savedDrafts;
  const filteredSavedDrafts = useMemo(() => {
    const target = String(selectedDraftType || '').toLowerCase();
    if (!target) return effectiveSavedDrafts;
    return effectiveSavedDrafts.filter((item) => String(item.category || '').toLowerCase() === target);
  }, [effectiveSavedDrafts, selectedDraftType]);
  const selectedSavedDraft = useMemo(() => {
    const currentDraftId = activeDraftId || selectedDraftId;
    if (!currentDraftId) return null;
    return effectiveSavedDrafts.find((draft) => draft.id === currentDraftId) || null;
  }, [activeDraftId, effectiveSavedDrafts, selectedDraftId]);
  const selectedDraftPreviewSubject = String(
    selectedSavedDraft?.subject || effectiveDraftSubject || ''
  ).trim();
  const selectedDraftPreviewBody = String(
    selectedSavedDraft?.body || effectiveDraftMessage || ''
  ).trim();
  const monthLabel = calendarCursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
  const daysInMonth = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 0).getDate();
  const leadingDays = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 0).getDate();
  const startOffset = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1).getDay();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
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
  const getCalendarEventTone = (type) => {
    const normalized = String(type || '').toLowerCase();
    if (normalized.includes('mail')) return 'mail';
    if (normalized.includes('timeline')) return 'timeline';
    if (normalized.includes('campaign')) return 'campaign';
    return 'default';
  };
  const selectedEvents = allCalendarEvents.filter((item) => sameDay(item.date, selectedDate));
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
  const filteredCampaigns = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    return performanceCampaigns.filter((item) => {
      const statusValue = String(item.status || item.tag || '').toLowerCase();
      const selectedStatus = String(selectedTagFilter || '').toLowerCase();
      const isStatusFilter = ['queued', 'running', 'paused', 'completed', 'failed'].includes(selectedStatus);
      const matchesTag = selectedTagFilter === 'All Tags'
        || (isStatusFilter ? statusValue === selectedStatus : (item.tags || []).includes(selectedTagFilter));
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
  }, [performanceCampaigns, selectedTagFilter, tableSearch]);
  const rowsPerPage = 5;
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
  }, [selectedTagFilter, tableSearch]);

  useEffect(() => {
    if (!previewRows.length) return;
    const columns = previewColumns.length
      ? previewColumns
      : Array.from(new Set(previewRows.flatMap((row) => Object.keys(row || {})).filter(Boolean)));
    setColumnMappings(
      columns.map((column) => ({
        sheetColumn: column,
        mappedField: /email/i.test(column)
          ? 'Email'
          : /name/i.test(column)
            ? 'Name'
            : /company/i.test(column)
              ? 'Company'
              : /phone|mobile/i.test(column)
                ? 'Phone'
                : /city/i.test(column)
                  ? 'City'
                  : 'Ignore',
        sample: String(previewRows.find((row) => row?.[column])?.[column] || ''),
        status: /email|name|company|phone|city/i.test(column) ? 'success' : 'warning'
      }))
    );
    setOverviewRows(
      previewRows.map((row, index) => ({
        id: index + 1,
        ...row
      }))
    );
  }, [previewColumns, previewRows]);


  useEffect(() => {
    if (!draftOptions.length) {
      setSelectedDraftId('');
    }
  }, [draftOptions, selectedDraftId]);

  useEffect(() => {
    if (selectDraftTab !== 'my-drafts') return;
    if (!filteredSavedDrafts.length) {
      setSelectedDraftId('');
      return;
    }
    const currentDraftId = activeDraftId || selectedDraftId;
    const hasVisibleSelection = filteredSavedDrafts.some((draft) => draft.id === currentDraftId);
    if (!hasVisibleSelection) {
      setSelectedDraftId(filteredSavedDrafts[0].id);
    }
  }, [activeDraftId, filteredSavedDrafts, selectDraftTab, selectedDraftId]);

  useEffect(() => {
    if (!selectedListId) return;
    setSelectedUploadedList(selectedListId);
    setSelectedCustomList(selectedListId);
  }, [selectedListId]);

  const addQuickNote = () => {
    const reminder = noteDraft.trim();
    const topic = noteTopic.trim();
    const tag = noteTag.trim();
    if (!reminder && !topic && !tag) {
      onShowMessage?.('Add a topic, tag, or reminder before saving it.', 'info');
      return;
    }
    const today = new Date().toLocaleDateString('en-GB');
    setQuickNotes((current) => [
      {
        id: `note-local-${Date.now()}`,
        avatar: 'QN',
        name: topic || 'Quick Note',
        time: today,
        text: reminder || 'No reminder text added.',
        topic: topic || 'General',
        tag: tag || 'Note'
      },
      ...current
    ]);
    setNoteDraft('');
    setNoteTopic('');
    setNoteTag('');
    onShowMessage?.('Note saved to your dashboard.', 'success');
  };

  const toggleRowSelection = (id) => {
    setSelectedRows((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleAllRows = () => {
    setSelectedRows((current) =>
      current.length === paginatedCampaigns.length ? [] : paginatedCampaigns.map((item) => item.id)
    );
  };

  const handleWorkflowAction = (step, event) => {
    if (step.action === 'Upload List' || step.title === 'Upload List') {
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
    const isActive = activeCampaign && String(activeCampaign._id || activeCampaign.id) === String(campaign.id);
    setTableSearch(campaign.name || '');
    setSelectedTagFilter('All Tags');
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

  const handleShowAllBroadcastPerformance = () => {
    setTableSearch('');
    setSelectedTagFilter('All Tags');
    setCurrentTablePage(1);
    showTableMessage('Showing all broadcast performance rows.', 'success');
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
      if (!actionMenuRef.current?.contains(event.target)) {
        setOpenActionMenu(null);
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
  const summaryStats = useMemo(() => {
    const validEmails = overviewRows.filter((row) => {
      const emailValue = String(row?.[emailMapping?.sheetColumn] || '').trim();
      return emailValue && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
    }).length;
    const missingValues = overviewRows.filter((row) => rowIssues[row.id]?.includes('missing') || rowIssues[row.id]?.includes('missing-value')).length;
    return [
      { label: 'File Name', value: selectedClientListSummary.title || 'clients_april.xlsx' },
      { label: 'Total Records', value: String(overviewRows.length) },
      { label: 'Columns Detected', value: String(columnMappings.length) },
      { label: 'Valid Emails', value: String(validEmails) },
      { label: 'Missing Values', value: String(missingValues) }
    ];
  }, [columnMappings.length, emailMapping, overviewRows, rowIssues, selectedClientListSummary.title]);
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

  const canContinueClientList =
    clientListTab === 'upload'
      ? Boolean(selectedListId)
      : clientListTab === 'uploaded'
        ? Boolean(selectedUploadedList)
        : Boolean(selectedCustomList);

  const handleClientListNext = async () => {
    const selectedList =
      clientListTab === 'upload'
        ? selectedListId
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
    onSelectList?.(selectedList);
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
  const handleOverviewConfirm = () => {
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
    setClientListTab('upload');
    setShowOverviewPopup(false);
    setShowClientListPopup(true);
  };
  const handleOverviewNext = () => {
    setShowOverviewNotice(false);
    setShowOverviewPopup(false);
    setShowCampaignPopup(true);
  };
  const hasOverviewData = overviewRows.length > 0;
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
    const hasDraftRequiredFields = hasSavedDraftSelected || hasCreateDraftReady;
    const draftContinueHint = hasSavedDraftSelected
      ? ''
      : 'Select required draft first.';
  useEffect(() => {
    if (showDraftContinueWarning && hasDraftRequiredFields) {
      setShowDraftContinueWarning(false);
    }
  }, [hasDraftRequiredFields, showDraftContinueWarning]);
  const scheduleMissingFields = [
    sendMode === 'scheduled' && !String(scheduledDateValue || '').trim() ? 'Scheduled date is empty' : null,
    sendMode === 'scheduled' && !String(scheduledTimeValue || '').trim() ? 'Scheduled time is empty' : null,
    !String(batchSize || '').trim() ? 'Batch size is empty' : null,
    !String(delaySeconds || '').trim() ? 'Delay interval is empty' : null,
    !String(durationUnit || '').trim() ? 'Duration unit is empty' : null,
    !String(scheduledCountry || '').trim() ? 'Country is empty' : null,
    !String(scheduleTimezone || '').trim() ? 'Time zone is empty' : null
  ].filter(Boolean);
  const hasScheduleRequiredFields = scheduleMissingFields.length === 0;
  const scheduleContinueHint = `Please fill: ${scheduleMissingFields.join(', ')} before continuing.`;
  const [showScheduleContinueWarning, setShowScheduleContinueWarning] = useState(false);
  useEffect(() => {
    if (showScheduleContinueWarning && hasScheduleRequiredFields) {
      setShowScheduleContinueWarning(false);
    }
  }, [hasScheduleRequiredFields, showScheduleContinueWarning]);
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
    if (step <= 1) return;
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
    onCampaignNameChange?.(String(campaign.name || ''));
    onSelectList?.(String(campaign.listId || ''));
    onSelectedDraftTypeChange?.(String(campaign.draftType || campaign.type || ''));
    onDraftSubjectChange?.(String(campaign.inlineTemplate?.subject || ''));
    onDraftBodyChange?.(String(campaign.inlineTemplate?.body || ''));
    onBatchSizeChange?.(String(campaign.options?.batchSize || '1'));
    onDelaySecondsChange?.(String(campaign.options?.delaySeconds || '60'));
    setCampaignTracking({
      opens: Boolean(campaign?.tracking?.opens),
      clicks: Boolean(campaign?.tracking?.clicks),
      replies: Boolean(campaign?.tracking?.replies)
    });
    setShowCampaignNotice(false);
    openWorkflowStep(campaign.workflowStep || 3);
    onShowMessage?.(
      `Resuming draft from ${campaign.workflowStepLabel || `Step ${campaign.workflowStep || 1}`}.`,
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
    onSelectList,
    onSelectedDraftTypeChange,
    onShowMessage
  ]);
  const handlePremiumShellUpload = (event) => {
    const file = event.target?.files?.[0];
    if (file) {
      setClientListName((current) => current || file.name);
      onShowMessage?.(`${file.name} selected.`, 'success');
    }
    onUploadFile?.(event);
  };
  const updateOverviewCell = (rowId, field, value) => {
    setOverviewRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };
  const removeCampaignTag = (tagToRemove) => {
    setCampaignTags((current) => current.filter((tag) => tag !== tagToRemove));
  };
  const addCampaignTag = () => {
    const nextTag = campaignTagDraft.trim();
    if (!nextTag) return;
    if (!campaignTags.includes(nextTag)) {
      setCampaignTags((current) => [...current, nextTag]);
    }
    setCampaignTagDraft('');
  };
  const importDraftToEditor = () => {
    const html = String(draftViewerText || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '<br/>');
    const next = html ? `<div style="font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">${html}</div>` : '';
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
    <section className="premium-dashboard-shell">
      <div className="premium-kpi-row">
        {reportMetricCards.map((item) => (
          <MetricCard key={item.title} item={item} />
        ))}
      </div>

      <section className="premium-stepper-shell">
        <div
          className="premium-stepper-row"
          ref={workflowShellRef}
          style={{ color: 'var(--text-primary)', '--workflow-progress': completedWorkflowCount }}
        >
          <div className="premium-workflow-title">
            <h3>Campaign Workflow</h3>
          </div>
          {workflowSteps.map((step, index) => (
            (() => {
              const stepNumber = Number(step?.index || index + 1);
              const isCompleted = Boolean(completedWorkflowSteps[stepNumber - 1]);
              const status = isCompleted ? 'completed' : 'pending';
              return (
                <WorkflowStep
                  key={step.index}
                  step={step}
                  isLast={index === workflowSteps.length - 1}
                  status={status}
                  onAction={handleWorkflowAction}
                  selectedDraftType={selectedDraftType}
                  onSelectedDraftTypeChange={onSelectedDraftTypeChange}
                />
              );
            })()
          ))}
          <button
            type="button"
            className="premium-stepper-start"
            onClick={() => {
              onShowMessage?.('Starting the campaign from the workflow stepper.', 'info');
              onStartCampaign?.();
            }}
            style={{ color: '#ffffff', background: 'linear-gradient(180deg, #22c55e, #15803d)', border: '1px solid #166534' }}
          >
            START
          </button>
        </div>
      </section>

        <div className="premium-content-grid">
            <div className="premium-gauge-card premium-card-with-tabs premium-campaign-health-panel">
                <div className="premium-panel-head">
                  <div>
                    <span className="premium-section-kicker">Campaign health</span>
                    <h3>Target</h3>
                  </div>
                  <div className="premium-target-filter-row">
                    <select
                      className="premium-target-filter"
                      value={targetMode}
                      onChange={(event) => setTargetMode(event.target.value)}
                      aria-label="Target review period"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="custom">Custom</option>
                    </select>
                    {targetMode === 'custom' ? (
                      <div className="premium-target-custom-row">
                        <input
                          type="date"
                          value={customTargetStart}
                          onChange={(event) => setCustomTargetStart(event.target.value)}
                          aria-label="Custom target start date"
                        />
                        <input
                          type="date"
                          value={customTargetEnd}
                          onChange={(event) => setCustomTargetEnd(event.target.value)}
                          aria-label="Custom target end date"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

              <div className="premium-health-summary-row" aria-label="Campaign progress summary">
                <div className="premium-health-metric done">
                  <span>Target</span>
                  <strong>{targetLimit}</strong>
                </div>
                <div className="premium-health-metric pending">
                  <span>Sent</span>
                  <strong>{targetSentCount}</strong>
                </div>
                <div className="premium-health-metric failed">
                  <span>Remaining</span>
                  <strong>{targetRemaining}</strong>
                </div>
              </div>

              <div className="premium-credit-summary-row" aria-label="Target summary">
                <div className="premium-credit-metric">
                  <span>Progress</span>
                  <strong>{targetPercent}%</strong>
                </div>
                <div className="premium-credit-metric">
                  <span>Mailed</span>
                  <strong>{targetSentCount}</strong>
                </div>
                <div className="premium-credit-metric">
                  <span>Left</span>
                  <strong>{targetRemaining}</strong>
                </div>
                <div className="premium-credit-metric usage">
                  <span>Period</span>
                  <strong>{targetWindowLabel}</strong>
                </div>
              </div>

              <div className="premium-arc-wrap">
                  <div className="premium-arc-track">
                      <div
                        className="premium-arc-ring"
                        style={{
                          background: `conic-gradient(from 180deg, #22c55e 0 ${targetPercent * 3.6}deg, #f59e0b ${targetPercent * 3.6}deg ${Math.min(360, (targetPercent * 3.6) + 24)}deg, #ef4444 ${Math.min(360, (targetPercent * 3.6) + 24)}deg 360deg)`,
                          boxShadow: targetAchieved ? '0 0 0 1px rgba(245, 158, 11, 0.12), 0 0 14px rgba(245, 158, 11, 0.1)' : undefined
                        }}
                      >
                      <div className="premium-arc-ring-inner" aria-hidden="true" />
                    </div>
                </div>
                  <div className="premium-arc-copy">
                      <strong className={targetAchieved ? 'premium-target-goal-reached' : ''}>{targetAchieved ? 'Goal reached' : 'Goal pending'}</strong>
                      <span className="premium-arc-copy-sub">
                        {targetWindowLabel} target: {targetSentCount} / {targetLimit} mails
                      </span>
                      <span className="premium-arc-copy-sub">
                        {targetAchieved ? 'Daily target completed • soft warning only' : `${targetRemaining} mails left`} • {targetResetText}
                      </span>
                      {targetAchieved ? (
                        <span className="premium-arc-copy-sub premium-target-soft-warning">
                          You can keep sending, but the daily goal is already reached.
                        </span>
                      ) : null}
                      <span className={`premium-arc-copy-sub premium-target-approval-pill ${targetStatusTone}`}>
                        {targetApprovalLabel}
                      </span>
                      {targetApprovalReviewedAt ? (
                        <span className="premium-arc-copy-sub">
                          Last reviewed: {targetApprovalReviewedAt}
                        </span>
                      ) : null}
                      {targetApprovalRequestNote ? (
                        <span className="premium-arc-copy-sub">
                          Note: {targetApprovalRequestNote}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="ghost subtle premium-target-approval-btn"
                        onClick={async () => {
                          setTargetApprovalStatusState('pending');
                          try {
                            await fetch('/api/target-approval', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                              period: targetPeriodValue,
                              dailyTarget: targetDailyCount,
                              status: 'pending',
                              note: 'Daily mail target approval requested from dashboard.'
                            })
                          });
                          } catch (error) {
                            // Keep the UI responsive even if persistence fails.
                          }
                          onShowMessage?.('Target approval request sent to your team lead.', 'info');
                        }}
                      >
                        Request approval
                      </button>
                  </div>
                </div>

          </div>

        <div className="premium-calendar-card premium-card-with-tabs">
          <div className="premium-panel-head">
            <div>
              <span className="premium-section-kicker">Calendar</span>
              <h3>{monthLabel}</h3>
            </div>
            <div className="premium-calendar-nav">
              <button
                type="button"
                className="ghost subtle"
                onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <button
                type="button"
                className="ghost subtle"
                onClick={() => setCalendarCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
          </div>
          <div className="premium-calendar-grid">
            {weekdayLabels.map((label) => (
              <span key={label} className="premium-calendar-weekday">
                {label}
              </span>
            ))}
            {calendarCells.map((day) => (
              (() => {
                const dayEvents = allCalendarEvents.filter((item) => sameDay(item.date, day.date));
                const dotTone = dayEvents.length ? getCalendarEventTone(dayEvents[0].type) : '';
                return (
              <button
                key={day.key}
                type="button"
                className={`premium-calendar-day ${day.inMonth ? 'current' : 'adjacent'} ${sameDay(day.date, selectedDate) ? 'selected' : ''} ${sameDay(day.date, today) ? 'today' : ''} ${dayEvents.length ? 'has-events' : ''}`}
                onClick={() => {
                  setSelectedDate(day.date);
                  openAnchoredPopup('day', setShowDayPopup)(event);
                }}
                data-tone={dotTone}
              >
                <span>{day.label}</span>
                {dayEvents.length ? <i aria-hidden="true" /> : null}
              </button>
                );
              })()
            ))}
          </div>
          <div className="premium-calendar-events">
            <div className="premium-calendar-events-head">
              <strong>{selectedDate.toLocaleDateString('en-GB')}</strong>
              {selectedEvents.length ? (
                <button
                  type="button"
                  className="premium-calendar-more"
                  onClick={(event) => openAnchoredPopup('calendar', setShowCalendarPopup)(event)}
                >
                  See more ({selectedEvents.length})
                </button>
              ) : null}
            </div>
            {selectedEvents.length ? (
              null
            ) : (
              <p>No events for this date.</p>
            )}
          </div>
        </div>

        <section className="premium-panel premium-main-notification-panel">
          <div className="premium-panel-head">
            <div>
              <span className="premium-section-kicker">Inbox</span>
              <h3>Inbox</h3>
            </div>
            <button type="button" className="ghost" onClick={(event) => openAnchoredPopup('notifications', setShowNotificationsPopup)(event)}>
              See All
            </button>
          </div>
          <div className="premium-list-stack">
            {notificationCards.map((item, index) => (
              <NotificationItem key={`${item.name}-${index}`} item={item} onClick={() => openInboxMail(item)} />
            ))}
          </div>
        </section>

        <section className="premium-panel premium-side-notification-panel">
          <div className="premium-panel-head">
            <div>
              <span className="premium-section-kicker">Notes</span>
              <h3>Write Note</h3>
            </div>
          </div>
          <div className="premium-note-compose">
            <div className="premium-note-tile-grid">
              <input
                type="text"
                value={noteTopic}
                onChange={(event) => setNoteTopic(event.target.value)}
                placeholder="Topic"
              />
              <input
                type="text"
                value={noteTag}
                onChange={(event) => setNoteTag(event.target.value)}
                placeholder="Tag"
              />
            </div>
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Write a quick note..."
              rows={8}
            />
            <div className="premium-note-compose-footer">
              <small>{[noteTopic, noteTag, noteDraft].map((value) => value.trim()).filter(Boolean).length} fields filled</small>
              <div className="premium-note-actions">
                <button type="button" className="ghost" onClick={() => setShowNotesPopup(true)}>
                  Show Notes
                </button>
                <button type="button" className="ghost" onClick={addQuickNote}>Save Note</button>
              </div>
            </div>
          </div>
        </section>

        <section className="premium-panel premium-panel-span-3">
          <div className="premium-panel-head">
            <div>
              <span className="premium-section-kicker">Broadcast table</span>
              <h3>All Broadcast Performance</h3>
            </div>
            <div className="premium-panel-head-actions">
              <button type="button" className="ghost" onClick={handleShowAllBroadcastPerformance}>Show</button>
              <button
                type="button"
                className="ghost"
                onClick={() => setIsBroadcastPerformanceMinimized((value) => !value)}
              >
                {isBroadcastPerformanceMinimized ? 'Expand' : 'Minimize'}
              </button>
            </div>
          </div>
          {!isBroadcastPerformanceMinimized ? (
            <>
              <div className="premium-table-actions">
                <button type="button" onClick={handleSelectionSummaryClick}>{selectedRows.length ? `${selectedRows.length} Selected` : 'All Campaign'}</button>
                <select className="premium-broadcast-tag-filter" value={selectedTagFilter} onChange={(event) => setSelectedTagFilter(event.target.value)}>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Search campaigns, person, country, sector, tags..."
                />
                <button type="button" className="subtle" onClick={handleActionCenterClick}>{selectedRows.length ? 'Take Action' : 'Action Center'}</button>
              </div>
              <div className="premium-table-wrap">
                <div className="premium-table premium-table-head">
                  {['', 'Sr. No.', 'Campaign', 'Publish Date', 'Total Mails', 'Sent', 'Pending', 'Fail', 'Open', 'Bounce', 'Spam', 'Tags', 'Action'].map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
                {paginatedCampaigns.length ? paginatedCampaigns.map((campaign, index) => (
                  <div
                    key={campaign.id || campaign._id || index}
                    className={`premium-table premium-table-row ${openActionMenu === campaign.id ? 'premium-table-row-menu-open' : ''}`}
                  >
                    <span data-label="Select">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(campaign.id)}
                        onChange={() => toggleRowSelection(campaign.id)}
                        aria-label={`Select ${campaign.name}`}
                      />
                    </span>
                    <span data-label="Sr. No.">{campaign.srNo}</span>
                    <span className="premium-table-campaign" data-label="Campaign">
                      {(() => {
                        const normalizedStatus = String(campaign.status || campaign.tag || '').toLowerCase();
                        const isDraftCampaign = normalizedStatus === 'draft';
                        const isQueuedCampaign = normalizedStatus === 'queued';
                        return (
                          <>
                      <strong>{campaign.name}</strong>
                      {isDraftCampaign ? (
                        <button
                          type="button"
                          className="campaign-resume-badge"
                          onClick={() => resumeCampaignDraft(campaign)}
                        >
                          Resume from: {campaign.workflowStepLabel || `Step ${campaign.workflowStep || 1}`}
                        </button>
                      ) : null}
                      {isQueuedCampaign ? (
                        <button
                          type="button"
                          className="campaign-resume-badge"
                          onClick={() => handleViewCampaign(campaign)}
                        >
                          Queued for worker
                        </button>
                      ) : null}
                      <small>{[campaign.person, campaign.broadcast].filter(Boolean).join(' | ') || 'Campaign details available below'}</small>
                      <small>{[campaign.country, campaign.sector].filter(Boolean).join(' | ') || 'Location and sector not set'}</small>
                          </>
                        );
                      })()}
                    </span>
                    <span data-label="Publish Date">{campaign.publishDate || '-'}</span>
                    <span data-label="Total Mails">{campaign.total}</span>
                    <span data-label="Sent">{campaign.sent}</span>
                    <span data-label="Pending">{campaign.pending}</span>
                    <span data-label="Fail">{campaign.failed}</span>
                    <span data-label="Open">{campaign.open}</span>
                    <span data-label="Bounce">{campaign.bounced}</span>
                    <span data-label="Spam">{campaign.spam}</span>
                    <span className="premium-tag-stack" data-label="Tags">
                      {(campaign.tags || []).slice(0, 2).map((tag) => (
                        <em key={tag}>{tag}</em>
                      ))}
                    </span>
                    <span className="premium-table-action-cell" data-label="Action" ref={openActionMenu === campaign.id ? actionMenuRef : null}>
                      <button
                        type="button"
                        className="premium-row-action"
                        onClick={() => setOpenActionMenu(openActionMenu === campaign.id ? null : campaign.id)}
                        aria-label={`Open actions for ${campaign.name}`}
                      >
                        ⋮
                      </button>
                      {openActionMenu === campaign.id ? (() => {
                        const normalizedStatus = String(campaign.status || campaign.tag || '').toLowerCase();
                        const isDraftCampaign = normalizedStatus === 'draft';
                        const canPauseCampaign = ['queued', 'running'].includes(normalizedStatus);
                        const canStopCampaign = ['queued', 'running', 'paused'].includes(normalizedStatus);
                        const canResumeCampaign = normalizedStatus === 'paused';
                        return (
                        <div className="premium-row-action-menu">
                          <button type="button" onClick={() => handleViewCampaign(campaign)}>View</button>
                          <button type="button" onClick={() => handleEditTagsClick(campaign)}>Edit Tags</button>
                          {isDraftCampaign ? (
                            <button type="button" onClick={() => { setOpenActionMenu(null); resumeCampaignDraft(campaign); }}>
                              Resume Draft
                            </button>
                          ) : null}
                          {canPauseCampaign ? (
                            <button type="button" onClick={() => { setOpenActionMenu(null); onPauseCampaign?.(campaign.id); }}>Pause</button>
                          ) : null}
                          {canStopCampaign ? (
                            <button type="button" onClick={() => { setOpenActionMenu(null); onStopCampaign?.(campaign.id); }}>Stop</button>
                          ) : null}
                          {canResumeCampaign ? (
                            <button type="button" onClick={() => { setOpenActionMenu(null); onResumeCampaign?.(campaign.id); }}>Resume</button>
                          ) : null}
                          <button type="button" onClick={() => handleDeleteCampaignClick(campaign)}>Delete</button>
                        </div>
                        );
                      })() : null}
                    </span>
                  </div>
                )) : (
                  <>
                    {Array.from({ length: 7 }, (_, index) => (
                      <div key={`empty-row-${index}`} className="premium-table premium-table-row premium-table-row-empty">
                        <span data-label="Select">
                          <input
                            type="checkbox"
                            disabled
                            aria-label="No row available"
                          />
                        </span>
                        <span>{index + 1}</span>
                        <span data-label="Campaign">—</span>
                        <span data-label="Publish Date">—</span>
                        <span data-label="Total Mails">—</span>
                        <span data-label="Sent">—</span>
                        <span data-label="Pending">—</span>
                        <span data-label="Fail">—</span>
                        <span data-label="Open">—</span>
                        <span data-label="Bounce">—</span>
                        <span data-label="Spam">—</span>
                        <span className="premium-tag-stack" data-label="Tags">
                          <em className="premium-table-empty-tag">No data</em>
                        </span>
                        <span className="premium-table-action-cell" data-label="Action">
                          <button type="button" className="premium-row-action" disabled aria-label="No actions available">
                            ⋮
                          </button>
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="premium-table-footer">
                <label className="premium-table-bulk">
                  <input
                    type="checkbox"
                    checked={paginatedCampaigns.length > 0 && selectedRows.length === paginatedCampaigns.length}
                    onChange={toggleAllRows}
                  />
                  <span>Select all visible rows</span>
                </label>
                <div className="premium-table-pagination">
                  <button
                    type="button"
                    onClick={() => setCurrentTablePage((page) => Math.max(1, page - 1))}
                    disabled={currentTablePage === 1}
                  >
                    ‹ Back
                  </button>
                  {Array.from({ length: totalTablePages }, (_, index) => (
                    <button
                      key={index + 1}
                      type="button"
                      className={currentTablePage === index + 1 ? 'active' : ''}
                      onClick={() => setCurrentTablePage(index + 1)}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentTablePage((page) => Math.min(totalTablePages, page + 1))}
                    disabled={currentTablePage === totalTablePages}
                  >
                    Next ›
                  </button>
                </div>
              </div>
          </>
          ) : null}
        </section>

        <section className="premium-panel premium-logs-panel">
          <div className="premium-logs-split">
            <div className="premium-logs-split-column">
              <div className="premium-panel-head">
                <h3>Activity Timeline</h3>
                <div className="premium-panel-head-actions">
                  <button type="button" className="ghost" onClick={() => setShowTimelineAddPopup(true)}>
                    Add Task
                  </button>
                  <button type="button" className="ghost" onClick={(event) => openAnchoredPopup('timeline', setShowTimelinePopup)(event)}>
                    See All
                  </button>
                </div>
              </div>
              <div className="premium-timeline-summary">
                <strong>{inlineTimelineCards.length} tasks remaining</strong>
                <span>Showing the next pending items only.</span>
              </div>
              <div className="premium-timeline-stack">
                {Object.entries(
                  inlineTimelineCards.reduce((groups, item, index) => {
                    const label = timelineDateLabel(item.date);
                    if (!groups[label]) groups[label] = [];
                    groups[label].push({ item, index });
                    return groups;
                  }, {})
                ).map(([label, entries]) => (
                  <div key={label} className="premium-timeline-group">
                    <div className="premium-timeline-divider">{label}</div>
                    {entries.map(({ item, index }) => (
                      <TimelineItem
                        key={item.id || `${item.date}-${index}`}
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
                        onOpen={() => {
                          setSelectedTimelineTask(item);
                          setShowTimelinePopup(true);
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="premium-logs-split-column">
                <div className="premium-panel-head">
                  <h3>Activity Feed</h3>
                  <button type="button" className="ghost" onClick={(event) => openAnchoredPopup('logs', setShowLogsPopup)(event)}>
                    See All
                  </button>
                </div>
                <div className="premium-logs-stack">
                  {Object.entries(logPopupGroups).map(([label, items]) => {
                    const firstItem = items[items.length - 1];
                    if (!firstItem) return null;
                    return (
                      <div key={label} className="premium-logs-preview-group">
                        <div className="premium-log-preview-label">{label}</div>
                        <LogItem item={firstItem} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

      {renderPortalPopup(
        showCalendarPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowCalendarPopup(false)}>
          <div className="premium-calendar-modal" style={popupStyleFor('calendar')} onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <h3>Events on {selectedDate.toLocaleDateString('en-GB')}</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowCalendarPopup(false)}>
                ×
              </button>
            </div>
            <div className="premium-calendar-modal-list">
              {selectedEvents.map((item) => (
                <div key={item.id} className="premium-calendar-event">
                  <span>{item.type}</span>
                  <p>{item.title}</p>
                  <small>{item.detail}</small>
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
            <div className="premium-panel-head">
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
                  <div key={item.id} className="premium-calendar-event">
                    <span>{item.type}</span>
                    <p>{item.title}</p>
                    <small>{item.detail}</small>
                  </div>
                ))
              ) : (
                <div className="premium-empty-state">No events for this date yet.</div>
              )}
            </div>
            <div className="premium-day-modal-actions">
              <input
                type="text"
                value={dayEventTitleDraft}
                onChange={(event) => setDayEventTitleDraft(event.target.value)}
                placeholder="Event title"
              />
              <textarea
                value={dayEventDetailDraft}
                onChange={(event) => setDayEventDetailDraft(event.target.value)}
                placeholder="About this event"
                rows={3}
              />
              <div className="premium-day-modal-row">
                <select value={dayEventTypeDraft} onChange={(event) => setDayEventTypeDraft(event.target.value)}>
                  <option value="Reminder">Reminder</option>
                  <option value="Note">Note</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Campaign">Campaign</option>
                </select>
                <input
                  type="text"
                  value={dayEventDraft}
                  onChange={(event) => setDayEventDraft(event.target.value)}
                  placeholder="Reminder note"
                />
              </div>
              <div className="premium-day-modal-footer">
                <small>You can use this for notes, reminders, or a quick plan for the day.</small>
                <button
                  type="button"
                  onClick={() => {
                    const title = dayEventTitleDraft.trim();
                    const detail = dayEventDetailDraft.trim();
                    const note = dayEventDraft.trim();
                    if (!title && !detail && !note) {
                      onShowMessage?.('Add an event title or note before saving it.', 'info');
                      return;
                    }
                    setCustomCalendarEvents((current) => [
                      {
                        id: `custom-${Date.now()}`,
                        date: new Date(selectedDate),
                        title: title || 'Custom event',
                        detail: detail || note || 'Planned for this day',
                        type: dayEventTypeDraft || 'Reminder'
                      },
                      ...current
                    ]);
                    onShowMessage?.(`Saved event for ${selectedDateLabel}.`, 'success');
                    setDayEventTitleDraft('');
                    setDayEventDetailDraft('');
                    setDayEventDraft('');
                    setShowDayPopup(false);
                  }}
                >
                  Save Event
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
            <div className="premium-panel-head">
              <h3>Inbox Preview</h3>
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
          <div className="premium-calendar-modal" style={popupStyleFor('notes')} onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <div>
                <span className="premium-section-kicker">Notes</span>
                <h3>All Quick Notes</h3>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowNotesPopup(false)}>×</button>
            </div>
            <div className="premium-calendar-modal-list">
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
            <div className="premium-panel-head">
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
            <div className="premium-panel-head">
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
              <div className="premium-panel-head">
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
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowClientListPopup(false)}>
          <div className="premium-calendar-modal premium-clientlist-modal premium-clientlist-modal-fit" style={popupStyleFor('clientList')} onClick={(event) => event.stopPropagation()}>
            <div className="premium-clientlist-head premium-review-head">
              <div>
                <span className="premium-popup-step-badge">1</span>
                <h3>Upload List</h3>
                <p>Upload a new list or select from your existing lists.</p>
                <small className="premium-clientlist-stepcopy">Step 1 of 7</small>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowClientListPopup(false)}>×</button>
            </div>

            <div className="premium-clientlist-summary">
              <div>
                <span>Current file</span>
                <strong>{selectedListName || clientListName || 'No file selected yet'}</strong>
              </div>
              <div>
                <span>Next step</span>
                <strong>Review List</strong>
              </div>
              <div>
                <span>Target use</span>
                <strong>Upload once, review once</strong>
              </div>
            </div>

            <div className="premium-clientlist-tabs">
              <button type="button" className={clientListTab === 'upload' ? 'active' : ''} onClick={() => setClientListTab('upload')}>
                Upload File
              </button>
              <button type="button" className={clientListTab === 'uploaded' ? 'active' : ''} onClick={() => setClientListTab('uploaded')}>
                My Uploaded Lists
              </button>
              <button type="button" className={clientListTab === 'custom' ? 'active' : ''} onClick={() => setClientListTab('custom')}>
                Custom Lists
              </button>
            </div>

            {clientListTab === 'upload' ? (
              <div className="premium-clientlist-body">
                <div className="premium-clientlist-section-copy">
                  <strong>Upload a client list</strong>
                  <p>Choose one file, name it, then continue to the review step.</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handlePremiumShellUpload}
                  style={{ display: 'none' }}
                  id="premium-shell-upload-input"
                />
                <label className="premium-clientlist-uploadbox" htmlFor="premium-shell-upload-input">
                  <div className="premium-clientlist-uploadicon">＋</div>
                  <strong>Drag & drop your file here</strong>
                  <span>or click to browse</span>
                  <small>Supported formats: CSV, XLSX</small>
                  <small>Max file size: 10MB</small>
                  {selectedListName || clientListName ? (
                    <small style={{ marginTop: 6, color: 'var(--success)', fontWeight: 700 }}>
                      Selected file: {selectedListName || clientListName}
                    </small>
                  ) : null}
                </label>
                <label className="premium-clientlist-field">
                  <span>List Name</span>
                  <input
                    type="text"
                    value={clientListName}
                    onChange={(event) => setClientListName(event.target.value)}
                    placeholder="Enter list name"
                  />
                </label>
              </div>
            ) : null}

            {clientListTab === 'uploaded' ? (
              <div className="premium-clientlist-body">
                <div className="premium-clientlist-section-copy">
                  <strong>Select from uploaded files</strong>
                  <p>Choose a file you&apos;ve already uploaded.</p>
                </div>
                <div className="premium-clientlist-list">
                  {effectiveUploadedLists.length ? effectiveUploadedLists.map((item) => (
                    <label key={item.id} className={`premium-clientlist-item ${selectedUploadedList === item.id ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="uploadedList"
                        checked={selectedUploadedList === item.id}
                        onChange={() => {
                          setSelectedUploadedList(item.id);
                          onSelectList?.(item.id);
                        }}
                      />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.meta}</p>
                      </div>
                    </label>
                  )) : (
                    <div className="premium-clientlist-empty">
                      <strong>No uploaded lists yet.</strong>
                      <p>Upload a file first, and the file name, date, time, and contact count will appear here.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {clientListTab === 'custom' ? (
              <div className="premium-clientlist-body">
                <div className="premium-clientlist-section-copy">
                  <strong>Select a saved list</strong>
                  <p>Use a client list created in your workspace.</p>
                </div>
                <div className="premium-clientlist-list">
                  {effectiveCustomLists.length ? effectiveCustomLists.map((item) => (
                    <label key={item.id} className={`premium-clientlist-item ${selectedCustomList === item.id ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="customList"
                        checked={selectedCustomList === item.id}
                        onChange={() => {
                          setSelectedCustomList(item.id);
                          onSelectList?.(item.id);
                        }}
                      />
                      <div>
                        <div className="premium-clientlist-item-title">
                          <strong>{item.title}</strong>
                          <span className="premium-clientlist-kind-badge">Custom</span>
                        </div>
                        <p>{item.meta}</p>
                        <small className="premium-clientlist-item-detail">
                          {item.uploadedAt ? `Saved ${item.uploadedAt}` : 'Saved custom list'}
                          {item.sourceFile ? ` • File: ${item.sourceFile}` : ''}
                        </small>
                      </div>
                    </label>
                  )) : (
                    <div className="premium-clientlist-empty">
                      <strong>No saved client lists yet.</strong>
                      <p>Your stored files will show up here with their details and contact count.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="premium-clientlist-actions">
              <button
                type="button"
                className={`premium-template-next${selectedListId || selectedUploadedList || selectedCustomList ? '' : ' is-disabled'}`}
                onClick={handleClientListNext}
              >
                {selectedListId || selectedUploadedList || selectedCustomList ? 'Continue' : 'Select required list first'}
              </button>
            </div>
            {showClientListSelectionNote ? (
              <p className="premium-review-inline-note premium-review-inline-note-warning">
                No file selected or uploaded yet. Please select a list first, then continue.
              </p>
            ) : null}
          </div>
        </div>
      )}

      {renderPortalPopup(
        showOverviewPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowOverviewPopup(false)}>
          <div className="premium-calendar-modal premium-review-modal" style={popupStyleFor('overview')} onClick={(event) => event.stopPropagation()}>
            <div className="premium-clientlist-head">
              <div>
                <span className="premium-popup-step-badge">2</span>
                <h3>Review List</h3>
                <p>Check mappings, fix issues, and confirm the data before moving on.</p>
                <small className="premium-review-stepcopy">Step 2 of 7</small>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowOverviewPopup(false)}>
                ×
              </button>
            </div>
            <div className="premium-review-body">
              {showProceedWithoutListNote ? (
                <p className="premium-review-inline-note premium-review-inline-note-warning">
                  Proceeding without a client list. You can continue exploring the workflow and choose a list later.
                </p>
              ) : null}
              <div className="premium-review-summary">
                {summaryStats.map((item) => (
                  <article key={item.label} className={`premium-review-stat ${item.label === 'Missing Values' ? 'alert' : ''}`}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              <section className="premium-review-block">
                <div className="premium-review-block-head">
                  <div>
                    <h4>Column Mapping</h4>
                    <p>Please make sure your columns are correctly mapped.</p>
                  </div>
                </div>
                <div className="premium-review-mapping">
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
                </div>
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
                      <button type="button" className="ghost subtle" onClick={() => onPreviewAddRow?.()}>+ Row</button>
                      <button type="button" className="ghost subtle" onClick={() => onPreviewAddColumn?.()}>+ Col</button>
                      <button type="button" className="ghost primary" onClick={() => onPreviewSave?.()} disabled={!previewDirty}>Save</button>
                    </div>
                  </div>
                </div>

                <div className="premium-review-tablewrap">
                  <div className="premium-review-table premium-review-table-head">
                    <span>#</span>
                    {activeOverviewColumns.map((item) => (
                      <span key={`head-${item.sheetColumn}`} className="premium-review-head-cell">
                        <input
                          value={item.sheetColumn}
                          onChange={(event) => onPreviewRenameColumn?.(item.sheetColumn, event.target.value)}
                          aria-label={`Rename ${item.sheetColumn}`}
                        />
                        <button type="button" className="ghost subtle premium-review-icon-btn danger" onClick={() => onPreviewDeleteColumn?.(item.sheetColumn)} aria-label={`Delete ${item.sheetColumn}`}>×</button>
                      </span>
                    ))}
                    <span className="premium-review-actions-head">Actions</span>
                  </div>
                  <div className="premium-review-table-body">
                    {filteredOverviewRows.map((row, index) => {
                      const issues = rowIssues[row.id] || [];
                      return (
                        <div key={row.id} className="premium-review-table premium-review-table-row">
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
                                    onChange={(event) => onPreviewCellChange?.(row.id - 1, field, event.target.value)}
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
                          <div className="premium-review-row-actions">
                            <button type="button" className="ghost subtle premium-review-icon-btn" onClick={() => onPreviewAddRow?.(row.id)} aria-label="Insert row after this row">＋</button><button type="button" className="ghost subtle premium-review-icon-btn danger" onClick={() => onPreviewDeleteRow?.(row.id - 1)} aria-label="Delete row">×</button>
                          </div>
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

            <div className="premium-clientlist-actions premium-review-actions">
              <div className="premium-review-actions-left">
                <button
                  type="button"
                  className="ghost subtle"
                  onClick={handleOverviewBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="ghost subtle"
                  onClick={handleOverviewReupload}
                >
                  Re-upload
                </button>
              </div>
              {showOverviewNotice && !hasOverviewData ? (
                <div className="premium-review-inline-note">
                  No data yet. Please select or upload a client list before continuing.
                </div>
              ) : null}
              <button
                type="button"
                className={`ghost subtle${hasOverviewData ? '' : ' is-disabled'}`}
                onClick={handleOverviewConfirm}
              >
                {hasOverviewData ? 'Continue' : 'Select required file first'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showSchedulePopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowSchedulePopup(false)}>
          <div className="premium-calendar-modal premium-schedule-modal" style={popupStyleFor('schedule')} onClick={(event) => event.stopPropagation()}>
            <div className="premium-schedule-head">
              <div>
                <span className="premium-popup-step-badge">7</span>
                <h3>Schedule</h3>
                <p>Configure your sending preferences.</p>
                <small className="premium-schedule-stepcopy">Step 7 of 7</small>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowSchedulePopup(false)}>×</button>
            </div>

            <div className="premium-schedule-body">
              <div className="premium-schedule-mode">
                <label>
                  <input
                    type="radio"
                    name="sendMode"
                    checked={sendMode === 'now'}
                    onChange={() => setSendMode('now')}
                  />
                  <span>Send now</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="sendMode"
                    checked={sendMode === 'scheduled'}
                    onChange={() => setSendMode('scheduled')}
                  />
                  <span>Send at scheduled time</span>
                </label>
              </div>

              <div className="premium-schedule-grid premium-schedule-grid-3">
                <label className="premium-schedule-field">
                  <span>Batch size</span>
                  <input type="number" value={batchSize} onChange={(event) => onBatchSizeChange?.(event.target.value)} />
                </label>
                <label className="premium-schedule-field">
                  <span>Delay interval</span>
                  <input type="number" value={delaySeconds} onChange={(event) => onDelaySecondsChange?.(event.target.value)} />
                </label>
                <label className="premium-schedule-field">
                  <span>Duration unit</span>
                  <select value={durationUnit} onChange={(event) => setDurationUnit(event.target.value)}>
                    <option>Minutes</option>
                    <option>Hours</option>
                    <option>Days</option>
                  </select>
                </label>
              </div>

              {sendMode === 'scheduled' ? (
                <div className="premium-schedule-grid premium-schedule-grid-2">
                  <label className="premium-schedule-field">
                    <span>Scheduled date</span>
                    <input type="date" value={scheduledDateValue} onChange={(event) => setScheduledDateValue(event.target.value)} />
                  </label>
                  <label className="premium-schedule-field">
                    <span>Scheduled time</span>
                    <input type="time" value={scheduledTimeValue} onChange={(event) => setScheduledTimeValue(event.target.value)} />
                  </label>
                </div>
              ) : null}

              <div className="premium-schedule-grid premium-schedule-grid-2">
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

              {showScheduleContinueWarning && !hasScheduleRequiredFields ? (
                <p className="premium-select-draft-warning">
                  {scheduleContinueHint}
                </p>
              ) : null}
            </div>

            <div className="premium-schedule-actions">
              <button
                type="button"
                className="ghost subtle"
                onClick={() => {
                  setShowSchedulePopup(false);
                  setShowTestEmailPopup(true);
                }}
              >
                Back
              </button>
              <button
                type="button"
                className={`premium-schedule-next${hasScheduleRequiredFields ? '' : ' is-disabled'}`}
                onClick={async () => {
                  if (!hasScheduleRequiredFields) {
                    setShowScheduleContinueWarning(true);
                    onShowMessage?.(scheduleContinueHint, 'warning');
                    return;
                  }
                  if (sendMode === 'scheduled') {
                    onApplyManualScheduledSlot?.(scheduledTimeValue);
                  }
                  onShowMessage?.('Schedule saved. You can start the campaign when ready.', 'success');
                  setShowSchedulePopup(false);
                }}
                disabled={!hasScheduleRequiredFields}
              >
                {hasScheduleRequiredFields ? 'Save Schedule' : 'Complete required details first'}
              </button>
              <button
                type="button"
                className={`premium-schedule-next${hasScheduleRequiredFields ? '' : ' is-disabled'}`}
                onClick={async () => {
                  if (!hasScheduleRequiredFields) {
                    setShowScheduleContinueWarning(true);
                    onShowMessage?.(scheduleContinueHint, 'warning');
                    return;
                  }
                  if (sendMode === 'scheduled') {
                    onApplyManualScheduledSlot?.(scheduledTimeValue);
                  }
                  onStartCampaign?.({ schedule: sendMode === 'scheduled', startAfterSchedule: true });
                  setShowSchedulePopup(false);
                }}
                disabled={!hasScheduleRequiredFields}
              >
                {hasScheduleRequiredFields ? 'START' : 'Complete required details first'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderPortalPopup(
        showCampaignPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowCampaignPopup(false)}>
          <div className="premium-calendar-modal premium-campaign-modal" style={popupStyleFor('campaign')} onClick={(event) => event.stopPropagation()}>
            <div className="premium-campaign-head">
              <div>
                <span className="premium-popup-step-badge">3</span>
                <h3>Create Campaign</h3>
                <p>Name the campaign, choose the sender, and set the tracking options.</p>
                <small className="premium-campaign-stepcopy">Step 3 of 7</small>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowCampaignPopup(false)}>
                ×
              </button>
            </div>

            <div className="premium-campaign-body">
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
                <div className="premium-campaign-tags">
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
                    onChange={(event) => setCampaignTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCampaignTag();
                      }
                    }}
                    placeholder="+ Add tag..."
                  />
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
                  <span>Campaign Goal</span>
                  <select value={campaignGoal} onChange={(event) => setCampaignGoal(event.target.value)}>
                    <option>Lead Generation</option>
                    <option>Product Demo</option>
                    <option>Brand Awareness</option>
                    <option>Follow-up</option>
                  </select>
                </label>
                <label className="premium-campaign-field">
                  <span>Sender</span>
                  <select
                    value={effectiveCampaignSender}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setCampaignSender(nextValue);
                      onSelectSenderAccount?.(nextValue);
                    }}
                  >
                    <option value="">{selectedAccountLabel || 'Select Mail ID'}</option>
                    {senderAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.from}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="premium-campaign-field">
                  <span>Folder</span>
                  <select value={campaignFolder} onChange={(event) => setCampaignFolder(event.target.value)}>
                    <option value="">Active</option>
                  </select>
                </label>
              </div>

              <div className="premium-campaign-grid premium-campaign-grid-bottom premium-campaign-settings">
                <div className="premium-campaign-field premium-campaign-settings-block">
                  <span>Tracking</span>
                  <div className="premium-campaign-checks">
                    {[
                      ['opens', 'Opens'],
                      ['clicks', 'Clicks'],
                      ['replies', 'Replies']
                    ].map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={campaignTracking[key]}
                          onChange={() =>
                            setCampaignTracking((current) => ({ ...current, [key]: !current[key] }))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="premium-campaign-field premium-campaign-toggle-field premium-campaign-settings-block">
                  <span>A/B Testing</span>
                  <button
                    type="button"
                    className={`premium-campaign-toggle ${campaignAbTesting ? 'active' : ''}`}
                    onClick={() => setCampaignAbTesting((current) => !current)}
                    aria-pressed={campaignAbTesting}
                  >
                    <i />
                  </button>
                </div>
              </div>

              <div className="premium-campaign-tracking-summary">
                <span
                  className={`master ${campaignTracking.opens || campaignTracking.clicks || campaignTracking.replies ? 'active' : ''}`}
                >
                  Tracking {campaignTracking.opens || campaignTracking.clicks || campaignTracking.replies ? 'On' : 'Off'}
                </span>
                {[
                  ['Opens', campaignTracking.opens],
                  ['Clicks', campaignTracking.clicks],
                  ['Replies', campaignTracking.replies],
                  ['A/B Testing', campaignAbTesting]
                ].map(([label, enabled]) => (
                  <span key={label} className={enabled ? 'active' : ''}>
                    {label} {enabled ? 'On' : 'Off'}
                  </span>
                ))}
              </div>

            </div>

            <div className="premium-campaign-actions">
              <button
                type="button"
                className="ghost subtle"
                onClick={() => {
                  setShowCampaignPopup(false);
                  setShowOverviewPopup(true);
                }}
              >
                Back
              </button>
              <button
                type="button"
                className={`premium-campaign-next${hasCampaignRequiredFields ? '' : ' is-disabled'}`}
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
            ) : (
              <p className="premium-campaign-hint">
                Saving the campaign keeps your setup ready. Mail sending begins only when you click <strong>START</strong> on the final step.
              </p>
            )}
          </div>
        </div>
      )}

      {renderPortalPopup(
        showSelectDraftPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowSelectDraftPopup(false)}>
          <div
            className="premium-calendar-modal premium-select-draft-modal"
            style={{
              ...popupStyleFor('selectDraft'),
              minHeight: 'min(86vh, 860px)',
              background: 'transparent'
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="premium-select-draft-head">
              <div>
                <span className="premium-popup-step-badge">4</span>
                <h3>Select Draft</h3>
                <p>Choose an existing draft or create a new one</p>
                <small className="premium-select-draft-stepcopy">Step 4 of 7</small>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowSelectDraftPopup(false)}>
                ×
              </button>
            </div>

            <div className="premium-select-draft-tabs" style={{ background: 'transparent' }}>
              <button
                type="button"
                className={selectDraftTab === 'my-drafts' ? 'active' : ''}
                onClick={() => setSelectDraftTab('my-drafts')}
              >
                My Drafts
              </button>
              <button
                type="button"
                className={selectDraftTab === 'create' ? 'active' : ''}
                onClick={() => setSelectDraftTab('create')}
              >
                Create New Draft
              </button>
              <div className="premium-select-draft-dropdown-wrap">
                <button
                  type="button"
                  className={showDraftTypeDropdown ? 'active' : ''}
                  onClick={() => setShowDraftTypeDropdown((current) => !current)}
                >
                  Draft Types
                </button>
                {showDraftTypeDropdown ? (
                  <div className="premium-select-draft-dropdown">
                    {draftTypeItems.map((item) => (
                      <button
                        key={item.value || 'all'}
                        type="button"
                        className={selectedDraftType === item.value ? 'active' : ''}
                        onClick={() => {
                          setSelectDraftTab('my-drafts');
                          onSelectedDraftTypeChange?.(item.value);
                          setShowDraftTypeDropdown(false);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {selectDraftTab === 'my-drafts' ? (
              <div className="premium-select-draft-library">
                <div className="premium-select-draft-list">
                  {filteredSavedDrafts.length ? (
                    filteredSavedDrafts.map((draft) => (
                      <label key={draft.id} className={`premium-select-draft-item ${activeDraftId === draft.id || selectedDraftId === draft.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="savedDraft"
                          checked={activeDraftId === draft.id || selectedDraftId === draft.id}
                          onChange={() => {
                            setSelectedDraftId(draft.id);
                            onSelectSavedDraft?.(draft.id);
                          }}
                        />
                        <div>
                          <strong>{draft.title}</strong>
                          <p>Subject: {draft.subject}</p>
                          <small>{draft.updated}</small>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="premium-select-draft-empty">
                      <strong>No matching drafts</strong>
                      <p>Choose another draft type or create a new draft for this category.</p>
                    </div>
                  )}
                </div>
                <aside className="premium-select-draft-preview">
                  <div className="premium-select-draft-preview-head">
                    <strong>Selected Draft Preview</strong>
                    <small>{selectedSavedDraft?.title || 'Choose a draft to preview it here'}</small>
                  </div>
                  <div className="premium-select-draft-preview-body">
                    {selectedDraftPreviewSubject || selectedDraftPreviewBody ? (
                      <>
                        <div className="premium-select-draft-preview-subject">
                          <span>Subject</span>
                          <strong>{selectedDraftPreviewSubject || 'No subject available'}</strong>
                        </div>
                        <div
                          className="premium-select-draft-preview-message"
                          dangerouslySetInnerHTML={{
                            __html: selectedDraftPreviewBody || '<p>No message available.</p>'
                          }}
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
              <div className="premium-select-draft-create">
                <div className="premium-select-draft-upload">
                  <div className="premium-select-draft-uploadbox">
                    <span className="premium-clientlist-uploadicon">＋</span>
                    <strong>Upload Word, PDF, or TXT file</strong>
                    <small>Supported formats: DOCX, PDF, TXT</small>
                  </div>
                </div>

                <div className="premium-select-draft-split">
                  <section className="premium-select-draft-viewer">
                    <div className="premium-select-draft-panelhead">
                      <strong>Document Viewer</strong>
                      <button type="button" className="ghost subtle" onClick={importDraftToEditor}>
                        Import to Editor
                      </button>
                    </div>
                    <div className="premium-select-draft-doc">
                      {draftViewerText.split('\n\n').map((block, index) => (
                        <p key={index}>{block}</p>
                      ))}
                    </div>
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
              </div>
            )}

            <div className="premium-popup-primary-row">
              <button
                type="button"
                className="ghost subtle"
                onClick={() => {
                  setShowSelectDraftPopup(false);
                  setShowCampaignPopup(true);
                }}
              >
                Back
              </button>
              <button
                type="button"
                className={`premium-template-next${hasDraftRequiredFields ? '' : ' is-disabled'}`}
                onClick={async () => {
                  if (!hasDraftRequiredFields) {
                    setShowDraftContinueWarning(true);
                    onShowMessage?.(draftContinueHint, 'warning');
                    return;
                  }
                  setShowDraftContinueWarning(false);
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
        showTestEmailPopup,
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowTestEmailPopup(false)}>
          <div className="premium-calendar-modal premium-test-email-modal" style={popupStyleFor('testEmail')} onClick={(event) => event.stopPropagation()}>
            <div className="premium-test-email-head">
              <div>
                <span className="premium-popup-step-badge">6</span>
                <div className="premium-test-email-title">
                  <h3>Test Email</h3>
                  <span>Optional</span>
                </div>
                <p>Send a test email to preview how it will look in inbox.</p>
                <small className="premium-test-email-stepcopy">Step 6 of 7</small>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowTestEmailPopup(false)}>
                ×
              </button>
            </div>

            <div className="premium-test-email-body">
              <section className="premium-test-email-preview">
                <div className="premium-test-email-preview-top">
                  <div>
                    <strong>Subject: {effectiveDraftSubject || 'No draft subject yet'}</strong>
                    <p>From: {selectedAccountLabel || 'Select Mail ID'}</p>
                  </div>
                  <div className="premium-test-email-device-toggle">
                    <button
                      type="button"
                      className={testPreviewMode === 'mobile' ? 'active' : ''}
                      onClick={() => setTestPreviewMode('mobile')}
                    >
                      📱
                    </button>
                    <button
                      type="button"
                      className={testPreviewMode === 'desktop' ? 'active' : ''}
                      onClick={() => setTestPreviewMode('desktop')}
                    >
                      🖥
                    </button>
                  </div>
                </div>
                <div className={`premium-test-email-message ${testPreviewMode}`}>
                  {effectiveDraftMessage ? (
                    <div dangerouslySetInnerHTML={{ __html: effectiveDraftMessage }} />
                  ) : (
                    <p>Your test preview will appear here after you add a draft message.</p>
                  )}
                </div>
              </section>

              <div className="premium-test-email-sendrow">
                <label className="premium-test-email-field">
                  <span>Send test to</span>
                  <input
                    type="email"
                    value={testEmailTo || testEmailAddress}
                    onChange={(event) => {
                      setTestEmailAddress(event.target.value);
                      onTestEmailToChange?.(event.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="premium-test-email-send"
                  onClick={async () => {
                    await onSendTestEmail?.();
                    setTestEmailSent(true);
                  }}
                >
                  Send Test Email
                </button>
              </div>

              {testEmailSent ? (
                <div className="premium-test-email-success">
                  <span>✔</span>
                  <p>Test email sent successfully! Check your inbox.</p>
                </div>
              ) : null}

              <label className="premium-test-email-check">
                <input
                  type="checkbox"
                  checked={includeTracking}
                  onChange={() => setIncludeTracking((current) => !current)}
                />
                <span>Include tracking?</span>
              </label>
            </div>

            <div className="premium-popup-primary-row">
              <button
                type="button"
                className="ghost subtle"
                onClick={() => {
                  setShowTestEmailPopup(false);
                  setShowDraftSummaryPopup(true);
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="premium-template-next"
                onClick={async () => {
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
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowDraftSummaryPopup(false)}>
          <div className="premium-calendar-modal premium-template-modal" style={popupStyleFor('draftSummary')} onClick={(event) => event.stopPropagation()}>
            <div className="premium-template-head">
              <span className="premium-popup-step-badge">5</span>
              <h3>Summary</h3>
              <p>Write your subject and message, then save it as a reusable draft.</p>
              <small className="premium-template-stepcopy">Step 5 of 7</small>
            </div>

            <div className="premium-template-body">
              <label className="premium-template-field">
                <span>Subject</span>
                <input
                  type="text"
                  value={effectiveDraftSubject}
                  onChange={(event) => onDraftSubjectChange ? onDraftSubjectChange(event.target.value) : setDraftSubject(event.target.value)}
                  placeholder="Effortless Email Sending for Your Lists - No Compromises"
                />
              </label>

              <div className="premium-template-field premium-template-message-head">
                <span>Message</span>
              </div>
              <div className="premium-template-editor">
                <RichTextEditor
                  value={effectiveDraftMessage}
                  onChange={(next) => onDraftBodyChange ? onDraftBodyChange(next) : setDraftMessage(next)}
                  placeholder="Write your template message..."
                />
              </div>

            </div>
            <div className="premium-template-actions">
              <button type="button" className="ghost subtle" onClick={() => setShowDraftSummaryPopup(false)}>×</button>
              <button
                type="button"
                className="ghost subtle"
                onClick={() => {
                  setShowDraftSummaryPopup(false);
                  setShowSelectDraftPopup(true);
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="premium-template-next"
                onClick={async () => {
                  const hasSummaryRequiredFields =
                    Boolean(String(effectiveDraftSubject || '').trim()) &&
                    Boolean(String(effectiveDraftMessage || '').replace(/<[^>]*>/g, '').trim());
                  if (!hasSummaryRequiredFields) {
                    onShowMessage?.('Complete required details first.', 'warning');
                    return;
                  }
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
    </section>
  );
}

