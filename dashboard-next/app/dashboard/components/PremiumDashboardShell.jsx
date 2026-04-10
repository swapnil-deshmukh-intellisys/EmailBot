'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

const draftTypeItems = [
  { value: '', label: 'Select draft type' },
  { value: 'reminder', label: 'rem' },
  { value: 'follow_up', label: 'followup' },
  { value: 'updated_cost', label: 'updated cost' },
  { value: 'final_cost', label: 'final cost' }
];

function WorkflowStep({ step, isLast, status = 'pending', onAction, selectedDraftType, onSelectedDraftTypeChange }) {
  const isDraftStep = Number(step?.index) === 4;
  const statusClass = `is-${status}`;
  return (
    <article
      className={`premium-step-card ${statusClass}`}
      style={{ color: 'var(--text-primary)' }}
    >
      <div className="premium-step-track">
        <span className="premium-step-index">{step.index}</span>
        {!isLast ? <i /> : null}
      </div>
      <strong style={{ color: 'var(--text-primary)' }}>{step.title}</strong>
      {isDraftStep ? (
        <button
          type="button"
          onClick={() => onAction?.(step)}
          style={{ color: 'var(--button-text)', background: 'var(--button-bg)', border: '1px solid var(--button-border)' }}
        >
          Drafts
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onAction?.(step)}
          style={{ color: 'var(--button-text)', background: 'var(--button-bg)', border: '1px solid var(--button-border)' }}
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

function NotificationItem({ item }) {
  return (
    <div className="premium-list-item">
      <div className="premium-avatar">{item.avatar || 'SS'}</div>
      <div>
        <strong>{item.name}</strong>
        <small>{item.time}</small>
        <p>{item.text}</p>
      </div>
    </div>
  );
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
      <p>{item.text}</p>
    </div>
  );
}

function TimelineItem({ item }) {
  return (
    <div className="premium-timeline-item">
      <span />
      <div>
        <strong>{item.date}</strong>
        <p>{item.title}</p>
        {item.text ? <small>{item.text}</small> : null}
      </div>
    </div>
  );
}

function LogItem({ item, detailed = false }) {
  const tagText = String(item?.tag || '').toLowerCase();
  const isSentLog = tagText === 'sent';
  return (
    <div className={`premium-log-item ${detailed ? 'detailed' : 'compact'} ${isSentLog ? 'sent' : ''}`}>
      <strong>{detailed ? item.time : item.tag}</strong>
      <div>
        <span>{detailed ? item.tag : 'Activity'}</span>
        <p>{item.msg}</p>
        {detailed && item.detail ? <small>{item.detail}</small> : null}
      </div>
    </div>
  );
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
  workflowSteps,
  completionRate,
  totalTrackedMails,
  notificationCards,
  timelineCards,
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
  onShowMessage
}) {
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
  const safeCompletion = clampPercent(completionRate);
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
  const [showCampaignPopup, setShowCampaignPopup] = useState(false);
  const [showSelectDraftPopup, setShowSelectDraftPopup] = useState(false);
  const [showTestEmailPopup, setShowTestEmailPopup] = useState(false);
  const [showDayPopup, setShowDayPopup] = useState(false);
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
  const uploadedLists = [];
  const customLists = [];
  const savedDrafts = [];
  const draftViewerText = '';
  const effectiveDraftSubject = controlledDraftSubject ?? draftSubject;
  const effectiveDraftMessage = controlledDraftBody ?? draftMessage;
  const effectiveCampaignName = controlledCampaignName ?? campaignName;
  const effectiveCampaignSender = selectedSenderAccountId || campaignSender;
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
  const effectiveUploadedLists = lists.length
    ? lists.map((item) => ({ id: item._id, title: item.name, meta: `${item.leadCount || 0} contacts` }))
    : uploadedLists;
  const effectiveCustomLists = lists.length
    ? lists.map((item) => ({ id: item._id, title: item.name, meta: `${item.leadCount || 0} contacts` }))
    : customLists;
  const effectiveSavedDrafts = draftOptions.length
    ? draftOptions.map((draft) => ({
        id: draft._id || draft.id,
        title: draft.title,
        subject: draft.subject,
        category: draft.category || '',
        updated: 'Saved draft'
      }))
    : savedDrafts;
  const filteredSavedDrafts = useMemo(() => {
    const target = String(selectedDraftType || '').toLowerCase();
    const matches = effectiveSavedDrafts.filter((item) => String(item.category || '').toLowerCase() === target);
    return matches.length ? matches : effectiveSavedDrafts;
  }, [effectiveSavedDrafts, selectedDraftType]);
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
      'Running',
      'Paused',
      'Completed',
      'Failed',
      ...new Set(
        performanceCampaigns
          .flatMap((item) => item.tags || [])
          .filter((tag) => tag && !['Running', 'Paused', 'Completed', 'Failed'].includes(tag))
      )
    ];
  }, [performanceCampaigns]);
  const filteredCampaigns = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    return performanceCampaigns.filter((item) => {
      const statusValue = String(item.tag || '').toLowerCase();
      const selectedStatus = String(selectedTagFilter || '').toLowerCase();
      const isStatusFilter = ['running', 'paused', 'completed', 'failed'].includes(selectedStatus);
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
    if (!selectedListId) return;
    setSelectedUploadedList(selectedListId);
    setSelectedCustomList(selectedListId);
  }, [selectedListId]);

  const addQuickNote = () => {
    const value = noteDraft.trim();
    if (!value) {
      onShowMessage?.('Write a note before saving it.', 'info');
      return;
    }
    const today = new Date().toLocaleDateString('en-GB');
    setQuickNotes((current) => [
      {
        id: `note-local-${Date.now()}`,
        avatar: 'QN',
        name: 'Quick Note',
        time: today,
        text: value
      },
      ...current
    ]);
    setNoteDraft('');
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

  const handleWorkflowAction = (step) => {
    if (step.action === 'Client List') {
      setShowClientListPopup(true);
      return;
    }
    if (step.action === 'Overview Data') {
      setShowOverviewPopup(true);
      return;
    }
    if (step.action === 'Campaign') {
      setShowCampaignPopup(true);
      return;
    }
    if (step.action === 'Draft / Templete') {
      setShowSelectDraftPopup(true);
      return;
    }
    if (step.index === 6 || step.action === 'Teast Mail' || step.action === 'Test Mail' || step.title === 'Test Mail') {
      setShowTestEmailPopup(true);
      return;
    }
    if (step.action === 'Draft Summary') {
      setShowDraftSummaryPopup(true);
      return;
    }
    if (step.action === 'Final Setup') {
      setShowSchedulePopup(true);
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
      `${selectedRows.length} campaign${selectedRows.length > 1 ? 's are' : ' is'} selected. Use the Campaigns panel below for start, pause, stop, resume, and delete actions.`,
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
    showTableMessage(`Filtered the table to ${campaign.name}. Use the Campaigns and History panels below for full controls.`, 'info');
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
        subtitle: 'Uploaded from Upload File tab',
        detail: 'This file will continue to step 2: Overview Data.'
      };
    }
    if (clientListTab === 'uploaded') {
      const selected = effectiveUploadedLists.find((item) => item.id === selectedUploadedList);
      return {
        title: selected?.title || 'Uploaded list',
        subtitle: selected?.meta || 'Previously uploaded file selected',
        detail: 'This uploaded file will continue to step 2: Overview Data.'
      };
    }
    const selected = effectiveCustomLists.find((item) => item.id === selectedCustomList);
    return {
      title: selected?.title || 'Custom list',
      subtitle: selected?.meta || 'Saved client list selected',
      detail: 'This custom list will continue to step 2: Overview Data.'
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
      ? true
      : clientListTab === 'uploaded'
        ? Boolean(selectedUploadedList)
        : Boolean(selectedCustomList);

  const handleClientListNext = () => {
    if (!canContinueClientList) return;
    if (clientListTab === 'uploaded' && selectedUploadedList) {
      onSelectList?.(selectedUploadedList);
    }
    if (clientListTab === 'custom' && selectedCustomList) {
      onSelectList?.(selectedCustomList);
    }
    setShowClientListPopup(false);
    setShowOverviewPopup(true);
  };
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
  const handleDraftTypeSelectFromDropdown = (draftTypeValue) => {
    onSelectedDraftTypeChange?.(draftTypeValue);
    setSelectDraftTab('my-drafts');
    const match = draftOptions.find((item) => String(item?.category || '').toLowerCase() === String(draftTypeValue || '').toLowerCase());
    if (match) {
      const id = match._id || match.id;
      setSelectedDraftId(id);
      onSelectSavedDraft?.(id);
      onShowMessage?.(`Selected ${draftTypeValue.replace('_', ' ')} draft for sending.`, 'success');
    } else {
      onShowMessage?.(`Draft type set to ${draftTypeValue.replace('_', ' ')} for sending.`, 'info');
    }
    setShowDraftTypeDropdown(false);
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
        <div className="premium-stepper-row" style={{ color: 'var(--text-primary)' }}>
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
            style={{ color: '#ecfdf5', background: 'linear-gradient(180deg, #22c55e, #15803d)', border: '1px solid #166534' }}
          >
            START
          </button>
        </div>
      </section>

      <div className="premium-content-grid">
        <div className="premium-gauge-card premium-card-with-tabs">
          <div className="premium-panel-head">
            <h3>Campaign Progress</h3>
            <div className="premium-progress-filter-wrap">
              <button
                type="button"
                className="ghost premium-progress-filter-btn"
                onClick={() => setShowProgressFilterDropdown((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={showProgressFilterDropdown}
              >
                Filter
              </button>
              {showProgressFilterDropdown ? (
                <div className="premium-progress-filter-menu">
                  {progressFilterOptions.map((item) => (
                    <button key={item.value} type="button" onClick={() => handleProgressFilterSelect(item.value)}>
                      {item.label}
                    </button>
                  ))}
                  <button type="button" className="add" onClick={handleAddProgressFilterOption}>
                    Add Option
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <span className="badge">{reportRangeLabel}</span>
          <div className="premium-progress-chip-row" aria-label="Campaign progress summary">
            <span className="premium-progress-chip done">Done {Math.max(0, Number(reportMetricCards[1]?.value || 0))}</span>
            <span className="premium-progress-chip pending">Pending {Math.max(0, Number(reportMetricCards[2]?.value || 0))}</span>
            <span className="premium-progress-chip failed">Failed {Math.max(0, Number(reportMetricCards[3]?.value || 0))}</span>
          </div>
          <div className="premium-arc-wrap">
            <div className="premium-arc-track">
              <div
                className="premium-arc-ring"
                style={{
                  background: `conic-gradient(from 180deg, #22c55e 0 ${safeCompletion * 1.8}deg, #f59e0b ${safeCompletion * 1.8}deg ${Math.min(360, (safeCompletion + Math.round((Number(reportMetricCards[2]?.value || 0) / Math.max(totalTrackedMails, 1)) * 100)) * 1.8)}deg, #ef4444 ${Math.min(360, (safeCompletion + Math.round((Number(reportMetricCards[2]?.value || 0) / Math.max(totalTrackedMails, 1)) * 100)) * 1.8)}deg 360deg)`
                }}
              >
                <div className="premium-arc-ring-inner">
                  <strong>{safeCompletion}%</strong>
                  <span>{Math.max(0, Number(reportMetricCards[1]?.value || 0))} / {totalTrackedMails}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="premium-arc-legend">
            <span><i className="done" />Done</span>
            <span><i className="pending" />Pending {Math.max(0, Number(reportMetricCards[2]?.value || 0))}</span>
            <span><i className="failed" />Failed {Math.max(0, Number(reportMetricCards[3]?.value || 0))}</span>
          </div>
          <small className="premium-arc-footer">{safeCompletion}% of your mail warming target reached.</small>
        </div>

        <div className="premium-calendar-card premium-card-with-tabs">
          <div className="premium-panel-head">
            <h3>{monthLabel}</h3>
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
                  setShowDayPopup(true);
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
                  onClick={() => setShowCalendarPopup(true)}
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
            <h3>Mail Notification</h3>
            <button type="button" className="ghost" onClick={() => setShowNotificationsPopup(true)}>
              See All
            </button>
          </div>
          <div className="premium-list-stack">
            {notificationCards.map((item, index) => (
              <NotificationItem key={`${item.name}-${index}`} item={item} />
            ))}
          </div>
        </section>

        <section className="premium-panel premium-side-notification-panel">
          <div className="premium-panel-head">
            <h3>Write Note</h3>
            <button type="button" className="ghost" onClick={() => setShowNotesPopup(true)}>
              See All
            </button>
          </div>
          <div className="premium-note-compose">
            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Write a quick note..."
              rows={8}
            />
            <div className="premium-note-compose-footer">
              <small>{noteDraft.trim().length} characters</small>
              <button type="button" onClick={addQuickNote}>Save Note</button>
            </div>
          </div>
        </section>

        <section className="premium-panel premium-panel-span-3">
          <div className="premium-panel-head">
            <h3>All Broadcast Performance</h3>
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
              <button type="button" onClick={handleSelectionSummaryClick}>{selectedRows.length ? `${selectedRows.length} Selected` : 'All Campaigns'}</button>
              <select value={selectedTagFilter} onChange={(event) => setSelectedTagFilter(event.target.value)}>
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
              {['', 'Sr. No.', 'Campaigns', 'Publish Date', 'Total Mails', 'Sent', 'Pending', 'Fail', 'Open', 'Bounce', 'Spam', 'Tags', 'Action'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            {paginatedCampaigns.map((campaign, index) => (
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
                <span className="premium-table-campaign" data-label="Campaigns">
                  <strong>{campaign.name}</strong>
                  <small>{[campaign.person, campaign.broadcast].filter(Boolean).join(' | ') || 'Campaign details available below'}</small>
                  <small>{[campaign.country, campaign.sector].filter(Boolean).join(' | ') || 'Location and sector not set'}</small>
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
                  {openActionMenu === campaign.id ? (
                    <div className="premium-row-action-menu">
                      <button type="button" onClick={() => handleViewCampaign(campaign)}>View</button>
                      <button type="button" onClick={() => handleEditTagsClick(campaign)}>Edit Tags</button>
                      <button type="button" onClick={() => { setOpenActionMenu(null); onPauseCampaign?.(campaign.id); }}>Pause</button>
                      <button type="button" onClick={() => { setOpenActionMenu(null); onStopCampaign?.(campaign.id); }}>Stop</button>
                      {String(campaign.tag || '').toLowerCase() === 'paused' ? (
                        <button type="button" onClick={() => { setOpenActionMenu(null); onResumeCampaign?.(campaign.id); }}>Resume</button>
                      ) : null}
                      <button type="button" onClick={() => handleDeleteCampaignClick(campaign)}>Delete</button>
                    </div>
                  ) : null}
                </span>
              </div>
            ))}
            {filteredCampaigns.length === 0 ? (
              <div className="premium-table-empty">
                <p>No running or matching campaigns were found for the current filter.</p>
              </div>
            ) : null}
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
                <button type="button" className="ghost" onClick={() => setShowTimelinePopup(true)}>
                  See All
                </button>
              </div>
              <div className="premium-timeline-stack">
                {timelineCards.map((item, index) => (
                  <TimelineItem key={`${item.date}-${index}`} item={item} />
                ))}
              </div>
            </div>

            <div className="premium-logs-split-column">
              <div className="premium-panel-head">
                <h3>Logs</h3>
                <button type="button" className="ghost" onClick={() => setShowLogsPopup(true)}>
                  See All
                </button>
              </div>
              <div className="premium-logs-stack">
                {logs.slice(0, 3).map((log, index) => (
                  <LogItem key={`${log.time}-${index}`} item={log} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {showCalendarPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowCalendarPopup(false)}>
          <div className="premium-calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <h3>Events on {selectedDate.toLocaleDateString('en-GB')}</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowCalendarPopup(false)}>
                × Close
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
      ) : null}

      {showDayPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowDayPopup(false)}>
          <div className="premium-calendar-modal premium-day-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <div>
                <h3>{selectedDateLabel}</h3>
                <p>Daily activity, events, and quick actions for this date.</p>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowDayPopup(false)}>
                × Close
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
      ) : null}

      {showNotificationsPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowNotificationsPopup(false)}>
          <div className="premium-calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <h3>Reply Notifications</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowNotificationsPopup(false)}>× Close</button>
            </div>
            <div className="premium-calendar-modal-list">
              {replyNotificationCards.length ? (
                replyNotificationCards.map((item, index) => (
                  <NotificationItem key={`${item.name}-popup-${index}`} item={item} />
                ))
              ) : (
                <div className="premium-empty-state">No reply notifications yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showNotesPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowNotesPopup(false)}>
          <div className="premium-calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <h3>All Quick Notes</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowNotesPopup(false)}>× Close</button>
            </div>
            <div className="premium-calendar-modal-list">
              {quickNotes.map((item) => (
                <QuickNoteItem key={`${item.id}-popup`} item={item} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showTimelinePopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowTimelinePopup(false)}>
          <div className="premium-calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <h3>All Activity Timeline Events</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowTimelinePopup(false)}>× Close</button>
            </div>
            <div className="premium-calendar-modal-list">
              {timelineCards.map((item, index) => (
                <TimelineItem key={`${item.date}-popup-${index}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showLogsPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowLogsPopup(false)}>
          <div className="premium-calendar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-panel-head">
              <h3>All Dashboard Logs</h3>
              <button type="button" className="ghost subtle" onClick={() => setShowLogsPopup(false)}>× Close</button>
            </div>
            <div className="premium-calendar-modal-list">
              {logs.map((log, index) => (
                <LogItem key={`${log.time}-popup-${index}`} item={log} detailed />
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showClientListPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowClientListPopup(false)}>
          <div className="premium-calendar-modal premium-clientlist-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-clientlist-head">
              <div>
                <h3>Add Client List</h3>
                <p>Upload a new list or select from your existing lists</p>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowClientListPopup(false)}>× Close</button>
            </div>

            <div className="premium-clientlist-step">Client List</div>

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
                  <p>Choose a file youÃ¢â‚¬â„¢ve already uploaded.</p>
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
                  )) : <p style={{ margin: 0, color: 'var(--muted)' }}>No uploaded lists yet. Upload a file first.</p>}
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
                        <strong>{item.title}</strong>
                        <p>{item.meta}</p>
                      </div>
                    </label>
                  )) : <p style={{ margin: 0, color: 'var(--muted)' }}>No saved client lists are available yet.</p>}
                </div>
              </div>
            ) : null}

            <div className="premium-clientlist-actions">
              <button type="button" className="ghost subtle" onClick={() => setShowClientListPopup(false)}>×</button>
              <button type="button" className="premium-step-skip" onClick={handleClientListNext}>
                Skip
              </button>
              <button type="button" className="premium-clientlist-next" onClick={handleClientListNext} disabled={!canContinueClientList}>
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showOverviewPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowOverviewPopup(false)}>
          <div className="premium-calendar-modal premium-review-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-clientlist-head">
              <div>
                <h3>Review Client List</h3>
                <p>Verify your uploaded file, column mapping, and contact data before continuing</p>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowOverviewPopup(false)}>
                Ãƒâ€”
              </button>
            </div>

            <div className="premium-clientlist-step">Step 2 Ã¢â‚¬â€ Overview Data</div>

            <div className="premium-review-body">
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
                        <span>{item.status === 'success' ? 'Ã¢Å“â€œ' : item.status === 'warning' ? '!' : 'Ãƒâ€”'}</span>
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
                      <span>Ãƒâ€”</span>
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
                  onClick={() => {
                    setShowOverviewPopup(false);
                    setShowClientListPopup(true);
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="ghost subtle"
                  onClick={() => {
                    setShowOverviewPopup(false);
                    setShowClientListPopup(true);
                  }}
                >
                  Re-upload
                </button>
              </div>
              <button
                type="button"
                className="premium-clientlist-next"
                onClick={() => {
                  setShowOverviewPopup(false);
                  setShowCampaignPopup(true);
                }}
              >
                Confirm & Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSchedulePopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowSchedulePopup(false)}>
          <div className="premium-calendar-modal premium-schedule-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-schedule-head">
              <div>
                <h3>Schedule Sending</h3>
                <p>Configure your sending preferences</p>
              </div>
            </div>

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
                className="premium-schedule-next"
                onClick={() => {
                  if (sendMode === 'scheduled') {
                    onApplyManualScheduledSlot?.(scheduledTimeValue);
                  }
                  onShowMessage?.('Final setup saved. Click START to begin sending the campaign.', 'success');
                  setShowSchedulePopup(false);
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCampaignPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowCampaignPopup(false)}>
          <div className="premium-calendar-modal premium-campaign-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-campaign-head">
              <div>
                <h3>Create Campaign</h3>
                <p>Give your campaign a name and organize it</p>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowCampaignPopup(false)}>
                X
              </button>
            </div>

            <div className="premium-campaign-body">
              <label className="premium-campaign-field">
                <span>Campaign Name *</span>
                <input
                  type="text"
                  value={effectiveCampaignName}
                  onChange={(event) => onCampaignNameChange ? onCampaignNameChange(event.target.value) : setCampaignName(event.target.value)}
                />
              </label>

              <div className="premium-campaign-field">
                <span>Tags</span>
                <div className="premium-campaign-tags">
                  {campaignTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="premium-campaign-tag"
                      onClick={() => removeCampaignTag(tag)}
                    >
                      {tag} <i>X</i>
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

              <label className="premium-campaign-field">
                <span>Description (optional)</span>
                <textarea
                  value={campaignDescription}
                  onChange={(event) => setCampaignDescription(event.target.value)}
                />
              </label>

              <div className="premium-campaign-grid">
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
                    <option value="">Active Campaigns</option>
                  </select>
                </label>
              </div>

              <div className="premium-campaign-grid premium-campaign-grid-bottom">
                <div className="premium-campaign-field">
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

                <div className="premium-campaign-field premium-campaign-toggle-field">
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
              <button type="button" className="premium-campaign-draft" onClick={() => onCreateCampaign?.()}>
                Save Draft
              </button>
              <button
                type="button"
                className="premium-campaign-next"
                onClick={() => {
                  onCreateCampaign?.();
                  setShowCampaignPopup(false);
                  setShowSelectDraftPopup(true);
                }}
              >
                Save & Continue
              </button>
            </div>
            <p className="premium-campaign-hint">
              Creating the campaign saves your setup. Mail sending begins only when you click <strong>START</strong> on the final step.
            </p>
          </div>
        </div>
      ) : null}

      {showSelectDraftPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowSelectDraftPopup(false)}>
          <div className="premium-calendar-modal premium-select-draft-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-select-draft-head">
              <div>
                <h3>Select Email Draft</h3>
                <p>Choose an existing draft or create a new one</p>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowSelectDraftPopup(false)}>
                X
              </button>
            </div>

            <div className="premium-select-draft-tabs">
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
                        key={item.value}
                        type="button"
                        className={selectedDraftType === item.value ? 'active' : ''}
                        onClick={() => handleDraftTypeSelectFromDropdown(item.value)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {selectDraftTab === 'my-drafts' ? (
              <div className="premium-select-draft-list">
                {filteredSavedDrafts.map((draft) => (
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
                ))}

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

            <div className="premium-select-draft-actions">
              <div className="premium-select-draft-actions-left">
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
                <button type="button" className="ghost subtle" onClick={() => setShowSelectDraftPopup(false)}>
                  Cancel
                </button>
              </div>
              <div className="premium-select-draft-actions-right">
                <button type="button" className="premium-select-draft-save" onClick={() => onSaveDraft?.()}>
                  Save Draft
                </button>
                <button
                  type="button"
                  className="premium-select-draft-next"
                  onClick={() => {
                    setShowSelectDraftPopup(false);
                    setShowDraftSummaryPopup(true);
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showTestEmailPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowTestEmailPopup(false)}>
          <div className="premium-calendar-modal premium-test-email-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-test-email-head">
              <div>
                <div className="premium-test-email-title">
                  <h3>Test Your Email</h3>
                  <span>Optional</span>
                </div>
                <p>Send a test email to preview how it will look in inbox</p>
              </div>
              <button type="button" className="ghost subtle" onClick={() => setShowTestEmailPopup(false)}>
                X
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
                      Ã°Å¸â€œÂ±
                    </button>
                    <button
                      type="button"
                      className={testPreviewMode === 'desktop' ? 'active' : ''}
                      onClick={() => setTestPreviewMode('desktop')}
                    >
                      Ã°Å¸â€“Â¥
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
                  <span>Ã¢Å“â€</span>
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

            <div className="premium-test-email-actions">
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
              <button type="button" className="premium-test-email-skip" onClick={() => setShowTestEmailPopup(false)}>
                Skip this step
              </button>
              <button
                type="button"
                className="premium-test-email-next"
                onClick={() => {
                  setShowTestEmailPopup(false);
                  setShowSchedulePopup(true);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDraftSummaryPopup ? (
        <div className="premium-calendar-modal-backdrop" onClick={() => setShowDraftSummaryPopup(false)}>
          <div className="premium-calendar-modal premium-template-modal" onClick={(event) => event.stopPropagation()}>
            <div className="premium-template-head">
              <h3>Setup Email Template</h3>
            </div>

            <label className="premium-template-field">
              <span>Subject</span>
              <input
                type="text"
                value={effectiveDraftSubject}
                onChange={(event) => onDraftSubjectChange ? onDraftSubjectChange(event.target.value) : setDraftSubject(event.target.value)}
                placeholder="Effortless Email Sending for Your Lists Ã¢â‚¬â€œ No Compromises"
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

            <div className="premium-template-actions">
              <button type="button" className="premium-template-save" onClick={() => onSaveDraft?.()}>
                Save Template
              </button>
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
                onClick={() => {
                  setShowDraftSummaryPopup(false);
                  setShowTestEmailPopup(true);
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
