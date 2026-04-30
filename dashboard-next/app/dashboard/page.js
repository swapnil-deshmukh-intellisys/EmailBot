'use client';

import { createPortal } from 'react-dom';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import RichTextEditor from '@/modules/draft-module/draft-components/RichTextDraftEditor';
import { FancyStatCard } from './components/DashboardUiPrimitives';
import {
  COUNTRY_TIME_SLOTS,
  DRAFT_CATEGORIES,
  PREVIEW_ROWS_PER_PAGE,
  QUICK_DRAFT_PREFIX,
  REPLY_MODE_DRAFT_TYPES,
  SUMMARY_RANGES
} from './DashboardViewConstants';
import useStats from '@/modules/analytics-module/analytics-hooks/UseDashboardStatsCollection';
import useCampaigns from '@/modules/campaign-module/campaign-hooks/UseCampaignCollection';
import { SIDEBAR_PRIMARY_ITEMS, SIDEBAR_WORKSPACE_ITEMS, TOP_NAV_ITEMS } from './DashboardNavigationLayoutConfig';
import {
  buildScheduledDateTimeInZone,
  buildScheduledLabel,
  convertDelayIntervalToSeconds,
  isFutureScheduledDate,
  normalizeDurationUnit,
  normalizeScheduledSlotInput
} from '@/modules/campaign-module/campaign-utils/CampaignScheduleHelper';
import { buildWordPadTableHtml } from '@/modules/draft-module/draft-utils/DraftWordPadTableBuilder';
import draftTemplates from '@/modules/template-module/template-services/DashboardDraftTemplateLibrary';
import PremiumDashboardShell from './components/PremiumDashboardShell';
import { TEMP_LOGIN_ACCOUNTS } from '../lib/dashboardRoles';
// import ScriptManager from "../dashboard/ScriptManager";

const DashboardStats = dynamic(() => import('@/modules/analytics-module/analytics-components/DashboardStatsOverview'));
const CampaignTable = dynamic(() => import('@/modules/campaign-module/campaign-components/CampaignExecutionTable'));
const LeadList = dynamic(() => import('@/modules/lead-module/lead-components/LeadUploadPreviewList'));
const ActivityPanel = dynamic(() => import('@/modules/analytics-module/analytics-components/DashboardActivityPanel'));

function FancyStatCardLegacy({ title, value, percent = 0, trend = 0, color = '#2563eb' }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const positive = trend >= 0;
  return (
    <div className="fancy-stat-card">
      <div className="fancy-stat-top">
        <span className={`fancy-stat-badge ${positive ? 'up' : 'down'}`}>
          {positive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </span>
        <span className="fancy-stat-menu">⋯</span>
      </div>
      <div className="fancy-stat-body">
        <div>
          <p className="fancy-stat-title">{title}</p>
          <h3 className="fancy-stat-value">{value}</h3>
        </div>
        <div
          className="fancy-stat-ring"
          style={{
            background: `conic-gradient(${color} 0% ${safePercent}%, #f2f4f8 ${safePercent}% 100%)`
          }}
        >
          <div className="fancy-stat-ring-inner">{safePercent}%</div>
        </div>
      </div>
    </div>
  );
}

function StatusBadgeLegacy({ status }) {
  const k = (status || '').toLowerCase();
  return <span className={`badge ${k}`}>{status}</span>;
}

const ACTIVE_CAMPAIGN_STATUSES = new Set(['Queued', 'Running', 'Paused']);

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeDraftBody(value = '') {
  const input = String(value || '');
  if (!input.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(input)) {
    return input;
  }
  const html = escapeHtml(input)
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, '<br/>');
  return `<div style="font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">${html}</div>`;
}

function normalizeDraft(draft = {}) {
  return {
    ...draft,
    subject: String(draft?.subject || ''),
    body: normalizeDraftBody(draft?.body || '')
  };
}

function displayNameFromEmail(email = '') {
  const tempAccount = TEMP_LOGIN_ACCOUNTS.find((item) => item.identifier === String(email || '').trim().toLowerCase());
  if (tempAccount?.label) return tempAccount.label;

  const localPart = String(email || '')
    .trim()
    .toLowerCase()
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim();

  if (!localPart) return 'Profile';

  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initialsFromName(value = '') {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'US';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

function RichTextEditorLegacy({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const changeTimerRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (changeTimerRef.current) {
        clearTimeout(changeTimerRef.current);
      }
    };
  }, []);

  const updateValue = (immediate = false) => {
    const next = editorRef.current?.innerHTML || '';
    if (immediate) {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      onChange(next);
      return;
    }
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => onChange(next), 220);
  };

  const runCommand = (command, val = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, val);
    updateValue(true);
  };

  const onPaste = (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      e.preventDefault();
      runCommand('insertHTML', html);
      return;
    }

    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      e.preventDefault();
      const normalized = String(text).replace(/\r\n/g, "\n");
      const escaped = normalized
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      // Preserve line breaks and spacing when clipboard has only plain text.
      const wrapped = `<div style="white-space:pre-wrap;font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">${escaped}</div>`;
      runCommand("insertHTML", wrapped);
    }
  };

  return (
    <div className="wysiwyg-wrap">
      <div className="wysiwyg-toolbar row">
        <select className="select wysiwyg-select" defaultValue="" onChange={(e) => runCommand('fontName', e.target.value)}>
          <option value="" disabled>Font</option>
          <option value="Arial">Arial</option>
          <option value="'Times New Roman'">Times New Roman</option>
          <option value="Calibri">Calibri</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>
        <select className="select wysiwyg-select" defaultValue="" onChange={(e) => runCommand('fontSize', e.target.value)}>
          <option value="" disabled>Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Medium</option>
          <option value="5">Large</option>
          <option value="6">XL</option>
        </select>
        <button type="button" className="button secondary" onClick={() => runCommand('bold')}>B</button>
        <button type="button" className="button secondary" onClick={() => runCommand('italic')}><i>I</i></button>
        <button type="button" className="button secondary" onClick={() => runCommand('underline')}><u>U</u></button>
        <button type="button" className="button secondary" onClick={() => runCommand('insertUnorderedList')}>List</button>
        <button type="button" className="button secondary" onClick={() => runCommand('justifyLeft')}>Left</button>
        <button type="button" className="button secondary" onClick={() => runCommand('justifyCenter')}>Center</button>
        <button type="button" className="button secondary" onClick={() => runCommand('justifyRight')}>Right</button>
        <button type="button" className="button secondary" onClick={() => runCommand('removeFormat')}>Clear Format</button>
      </div>
      <div
        ref={editorRef}
        className="wysiwyg-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || 'Compose your draft here...'}
        onInput={() => updateValue(false)}
        onBlur={() => updateValue(true)}
        onPaste={onPaste}
      />
    </div>
  );
}
const PROJECT_PRESET_SENDERS = {
  tec: [
    'lily@theentrepreneurialchronicle.com',
    'charlie@theentrepreneurialchronicle.com',
    'robert@theentrepreneurialchronicle.com',
    'mark@theentrepreneurialchronicle.com',
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
    'lacy@theentrepreneurialchronicle.com',
    'victoria@theentrepreneurialchronicle.com'
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
    'olivia@theunicorntimes.com'
  ]
};

const normalizeEmail = (value = '') => String(value || '').toLowerCase();

const filterAccountsByProject = (list = [], projectKey = '') => {
  const project = String(projectKey || '').toLowerCase();
  const allowedList = PROJECT_PRESET_SENDERS[project] || [];
  const hasAllowed = allowedList.length > 0;
  const allowedSet = new Set(allowedList.map((email) => email.toLowerCase()));
  return list.filter((account) => {
    const fromEmail = normalizeEmail(account?.from);
    if (hasAllowed && allowedSet.has(fromEmail)) {
      return true;
    }
    if (!hasAllowed) {
      return true;
    }
    const projectHint = String(account?.project || '').toLowerCase();
    return projectHint === project;
  });
};

const DEFAULT_SHEET_STYLE = {
  fontFamily: 'Segoe UI',
  fontSize: 14,
  headerBg: 'var(--bg-secondary)',
  headerColor: 'var(--text-secondary)',
  cellBg: 'var(--panel-strong)',
  cellColor: 'var(--text-primary)',
  columnWidths: {}
};
const DASHBOARD_DRAFT_STATE_KEY = 'dashboard:draft-state:v1';
const DASHBOARD_RESUME_CAMPAIGN_KEY = 'dashboard:resume-campaign-draft:v1';


export default function DashboardPage() {
  const router = useRouter();
  const defaultProjectOptions = ['tec', 'tut'];
  const [stats, setStats] = useState({
    total: 0,
    totalUploaded: 0,
    sent: 0,
    pending: 0,
    failed: 0,
    bounced: 0,
    spam: 0,
    last10DaysStats: 0,
    dailyMailCounts: []
  });
  const [selectedStatsDate, setSelectedStatsDate] = useState('');
  const [selectedStatsRange, setSelectedStatsRange] = useState('');
  const [customStatsStartDate, setCustomStatsStartDate] = useState('');
  const [customStatsEndDate, setCustomStatsEndDate] = useState('');
  const [showCustomRangePopup, setShowCustomRangePopup] = useState(false);
  const [lists, setLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [preview, setPreview] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [batchSize, setBatchSize] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeTopNav, setActiveTopNav] = useState('Dashboard');
  const [activeSidebarView, setActiveSidebarView] = useState('');
  const [project, setProject] = useState('tec');
  const [projectOptions, setProjectOptions] = useState(defaultProjectOptions);
  const [showTopbarProjectDropdown, setShowTopbarProjectDropdown] = useState(false);
  const [showTopbarRangeDropdown, setShowTopbarRangeDropdown] = useState(false);
  const [showTopbarMailDropdown, setShowTopbarMailDropdown] = useState(false);
  const [showTopbarProfileDropdown, setShowTopbarProfileDropdown] = useState(false);
  const [userRangeOptions, setUserRangeOptions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [activeAccount, setActiveAccount] = useState('');
  const [showAllUserActivity, setShowAllUserActivity] = useState(true);
  const [profileUser, setProfileUser] = useState({ email: '', role: '', displayName: '' });
  const [profileAvatarDataUrl, setProfileAvatarDataUrl] = useState('');
  const [profileCredits, setProfileCredits] = useState({
      planName: 'Basic',
      upgradeTargetPlan: 'Pro',
      upgradeTargetCredits: 12000,
      totalCredits: 6000,
      usedCredits: 0,
      remainingCredits: 6000,
      creditUsagePercent: 0,
      targetApprovalStatus: 'approved',
      targetApprovalRequestedAt: null,
      targetApprovalReviewedAt: null,
      targetApprovalReviewer: '',
      targetApprovalRequestNote: ''
    });
  const [profileTimelineTasks, setProfileTimelineTasks] = useState({});
  const [profileTimelineCustomTasks, setProfileTimelineCustomTasks] = useState([]);
  const projectAccounts = useMemo(() => accounts, [accounts]);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [selectedDraft, setSelectedDraft] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [blankWordPad, setBlankWordPad] = useState('');

  const [showAddDraft, setShowAddDraft] = useState(false);
  const [newDraftCategory, setNewDraftCategory] = useState("cover_story");
  const [newDraftSubject, setNewDraftSubject] = useState("");
  const [newDraftBody, setNewDraftBody] = useState("");

  const loadScript = (script) => {
    const normalized = normalizeDraft(script);
    setDraftSubject(normalized.subject);
    setDraftBody(normalized.body);
  };

  const [savedDrafts, setSavedDrafts] = useState([]);
  const [activeSavedDraftId, setActiveSavedDraftId] = useState(null);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [newDraftTitle, setNewDraftTitle] = useState("");
  const [selectedActiveCampaignIds, setSelectedActiveCampaignIds] = useState([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [showCampaignHistory, setShowCampaignHistory] = useState(false);
  const [showDayCounts, setShowDayCounts] = useState(false);
  const [showUploadedFilesDropdown, setShowUploadedFilesDropdown] = useState(false);
  const [showDraftUploadedFilesDropdown, setShowDraftUploadedFilesDropdown] = useState(false);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [showBlankWordPad, setShowBlankWordPad] = useState(false);
  const [showDraftEditingSection, setShowDraftEditingSection] = useState(false);
  const [changeInDraftValue, setChangeInDraftValue] = useState('');
  const [showScheduledTimePicker, setShowScheduledTimePicker] = useState(false);
  const [scheduledCountry, setScheduledCountry] = useState('india');
  const [scheduledSlot, setScheduledSlot] = useState('');
  const [manualScheduledSlot, setManualScheduledSlot] = useState('');
  const [scheduledStartLabel, setScheduledStartLabel] = useState('');
  const [scheduleMode, setScheduleMode] = useState('send_now');
  const [scheduleTimezone, setScheduleTimezone] = useState('Asia/Kolkata');
  const [scheduledDateValue, setScheduledDateValue] = useState('');
  const [scheduledTimeValue, setScheduledTimeValue] = useState('');
  const [durationUnit, setDurationUnit] = useState('seconds');
  const [pendingCampaignId, setPendingCampaignId] = useState('');
  const [selectedUploadedFileIds, setSelectedUploadedFileIds] = useState([]);
  const [selectedDraftUploadedFileIds, setSelectedDraftUploadedFileIds] = useState([]);
  const [savedDraftFilterCategory, setSavedDraftFilterCategory] = useState('');
  const [previewDirty, setPreviewDirty] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewStyle, setPreviewStyle] = useState(DEFAULT_SHEET_STYLE);
  const [preferredActiveCampaignId, setPreferredActiveCampaignId] = useState('');
  const [toast, setToast] = useState(null);
  const isReplyModeCampaignType = REPLY_MODE_DRAFT_TYPES.has(String(selectedDraft || '').toLowerCase());
  const fileInputRef = useRef(null);
  const uploadedFilesDropdownRef = useRef(null);
  const draftUploadedFilesDropdownRef = useRef(null);
  const topbarProjectDropdownRef = useRef(null);
  const topbarRangeDropdownRef = useRef(null);
  const topbarMailDropdownRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const loadAllRef = useRef(null);
  const campaignCreateLockRef = useRef(false);
  const lastCampaignCreateSignatureRef = useRef('');
  const lastCreatedCampaignIdRef = useRef('');
  const notify = (message, tone = 'info') => {
    if (!message) return;
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, tone });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3200);
  };
  const selectedAccountLabel =
    projectAccounts.find((account) => account.id === selectedAccount)?.from ||
    'Select Mail ID';
  const profileDisplayName = profileUser.displayName || displayNameFromEmail(profileUser.email);
  const profileInitials = initialsFromName(profileDisplayName);
  const profileRoleLabel = profileUser.role ? String(profileUser.role).replace(/_/g, ' ') : 'User';
  const selectedAccountObj = useMemo(
    () => projectAccounts.find((account) => account.id === selectedAccount) || null,
    [projectAccounts, selectedAccount]
  );
  const selectedSenderEmail = String(selectedAccountObj?.from || '').trim().toLowerCase();
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const previewTotalRows = preview.length;
  const previewTotalPages = Math.max(1, Math.ceil(previewTotalRows / PREVIEW_ROWS_PER_PAGE));
  const previewStartIndex = (previewPage - 1) * PREVIEW_ROWS_PER_PAGE;
  const pagedPreviewRows = useMemo(
    () => preview.slice(previewStartIndex, previewStartIndex + PREVIEW_ROWS_PER_PAGE),
    [preview, previewStartIndex]
  );
  const handleSavedDraftSelect = (draft) => {
    const id = draft._id || draft.id;
    setActiveSavedDraftId(id);
    loadScript(draft);
  };

  const handleSavedDraftSelectById = (draftId) => {
    const draft = savedDrafts.find((item) => (item._id || item.id) === draftId);
    if (draft) {
      handleSavedDraftSelect(draft);
    }
  };

  const applyPremiumShellScheduledTime = (timeValue) => {
    const normalized = normalizeScheduledSlotInput(timeValue);
    if (!normalized) {
      notify('Enter a valid scheduled time.', 'info');
      return;
    }
    setScheduledSlot(normalized);
    setManualScheduledSlot(normalized);
  };

  const prepareScheduleConfig = (input = {}) => {
    const nextMode = String(input.scheduleMode || scheduleMode || 'send_now').trim().toLowerCase() === 'scheduled'
      ? 'scheduled'
      : 'send_now';
    const nextCountryRaw = String(input.country || scheduledCountry || 'india').trim();
    const nextCountry = nextCountryRaw || 'india';
    const nextTimezone = String(
      input.timezone ||
      scheduleTimezone ||
      COUNTRY_TIME_SLOTS[nextCountry]?.timezone ||
      'Asia/Kolkata'
    ).trim() || 'Asia/Kolkata';
    const nextDateValue = String(input.scheduledDate || scheduledDateValue || '').trim();
    const nextTimeValue = String(input.scheduledTime || scheduledTimeValue || '').trim();
    const nextDurationUnit = normalizeDurationUnit(input.durationUnit || durationUnit || 'seconds');
    const nextBatchSize = Math.max(1, Math.floor(Number(input.batchSize ?? batchSize ?? 1) || 1));
    const nextDelayInterval = Math.max(1, Math.floor(Number(input.delayInterval ?? delaySeconds ?? 1) || 1));
    const nextDelaySeconds = convertDelayIntervalToSeconds(nextDelayInterval, nextDurationUnit);
    const normalizedSlot = nextTimeValue ? normalizeScheduledSlotInput(nextTimeValue) : '';
    const scheduledAt = nextMode === 'scheduled'
      ? buildScheduledDateTimeInZone(nextDateValue, nextTimeValue, nextTimezone)
      : null;

    return {
      scheduleMode: nextMode,
      country: nextCountry,
      timezone: nextTimezone,
      scheduledDate: nextDateValue,
      scheduledTime: nextTimeValue,
      normalizedSlot,
      batchSize: nextBatchSize,
      delayInterval: nextDelayInterval,
      durationUnit: nextDurationUnit,
      delaySeconds: nextDelaySeconds,
      scheduledAt,
      label: nextMode === 'scheduled'
        ? buildScheduledLabel({
            country: nextCountry.charAt(0).toUpperCase() + nextCountry.slice(1),
            timeZone: nextTimezone,
            dateValue: nextDateValue,
            timeValue: nextTimeValue,
            scheduledAt
          })
        : ''
    };
  };

  const applyScheduleConfigState = (config = {}) => {
    setScheduleMode(String(config.scheduleMode || 'send_now'));
    setScheduledCountry(String(config.country || 'india').toLowerCase());
    setScheduleTimezone(String(config.timezone || 'Asia/Kolkata'));
    setScheduledDateValue(String(config.scheduledDate || ''));
    setScheduledTimeValue(String(config.scheduledTime || ''));
    setScheduledSlot(String(config.normalizedSlot || ''));
    setManualScheduledSlot(String(config.normalizedSlot || config.scheduledTime || ''));
    setDurationUnit(normalizeDurationUnit(config.durationUnit || 'seconds'));
    setBatchSize(String(config.batchSize || '1'));
    setDelaySeconds(String(config.delayInterval || '1'));
    setScheduledStartLabel(String(config.label || ''));
  };

  const selectProject = (value) => {
    setProject(value);
    setSelectedAccount("");
    setActiveAccount("");
    setShowTopbarProjectDropdown(false);
  };

  const addProjectOption = () => {
    const value = String(window.prompt('Enter new project name', '') || '').trim().toLowerCase();
    if (!value) return;
    setProjectOptions((prev) => (prev.includes(value) ? prev : [...prev, value]));
    selectProject(value);
    notify(`Project ${value.toUpperCase()} added.`, 'success');
  };

  const getRangeLabel = (value) => {
    const builtIn = SUMMARY_RANGES.find((option) => option.value === value);
    if (builtIn) return builtIn.label;
    const custom = userRangeOptions.find((option) => option.value === value);
    return custom?.label || 'This Week';
  };

  const handleStatsRangeSelection = (value) => {
    setSelectedStatsRange(value);
    setSelectedStatsDate('');
    if (value !== 'customize') {
      setCustomStatsStartDate('');
      setCustomStatsEndDate('');
      setShowCustomRangePopup(false);
    } else {
      setShowCustomRangePopup(true);
    }
    setShowDayCounts(Boolean(value));
  };

  const selectTopbarRange = (value) => {
    handleStatsRangeSelection(value);
    setShowTopbarRangeDropdown(false);
  };

  const addRangeOption = () => {
    const label = String(window.prompt('Enter new range option label', '') || '').trim();
    if (!label) return;
    const baseValue = String(window.prompt('Base range for this option (today, 7d, 15d, 30d, quarter, customize)', '7d') || '').trim() || '7d';
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const value = `saved-${slug || Date.now()}`;
    setUserRangeOptions((prev) => (prev.some((item) => item.value === value) ? prev : [...prev, { label, value, baseValue }]));
    applyRangeSelection(baseValue);
    setShowTopbarRangeDropdown(false);
    notify(`Added range option ${label}.`, 'success');
  };

  const applyRangeSelection = (value) => {
    if (value === 'customize') {
      setShowCustomRangePopup(true);
      return;
    }
    if (value.startsWith('custom-')) {
      setSelectedStatsRange(value);
      setSelectedStatsDate('');
      setShowDayCounts(true);
      setShowTopbarRangeDropdown(false);
      notify(`Selected ${getRangeLabel(value)}.`, 'success');
      return;
    }
    selectTopbarRange(value);
    notify(`Selected ${getRangeLabel(value)}.`, 'success');
  };

  const selectTopbarMail = (value) => {
    if (value === "__oauth_add__") {
      setShowTopbarMailDropdown(false);
      startGraphOAuth();
      return;
    }
    const selectedMail = projectAccounts.find((account) => account.id === value);
    if (!window.confirm(`Set ${selectedMail?.from || 'this mail ID'} as the active sending mail?`)) {
      notify('Mail selection cancelled.', 'info');
      return;
    }
    setSelectedAccount(value);
    setActiveAccount(selectedMail?.from || '');
    setShowTopbarMailDropdown(false);
    notify(`Working mail set to ${selectedMail?.from || 'selected account'}.`, 'success');
  };

  const loadSelectedDraftUploadedFile = async () => {
    if (!selectedDraftUploadedFileIds.length) return;

    try {
      const fileId = selectedDraftUploadedFileIds[0];
      const data = await safeFetchJson(`/api/lists/${fileId}`);
      const leads = data.leads || [];
      const columns = data.columns?.length
        ? data.columns
        : Array.from(new Set(leads.flatMap((lead) => Object.keys(lead?.data || {})).filter(Boolean)));
      const rows = leads.map((lead) => lead.data || {});
      setBlankWordPad(buildWordPadTableHtml(columns, rows));
      setShowBlankWordPad(true);
      setShowDraftUploadedFilesDropdown(false);
      notify('Uploaded file opened in Edit Word File.', 'success');
    } catch (e) {
      notify(e.message || 'Failed to load uploaded file into Edit Word File', 'error');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DASHBOARD_DRAFT_STATE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        setCampaignName(String(saved.campaignName || ''));
        setDelaySeconds(Number(saved.delaySeconds || 60));
        setBatchSize(String(saved.batchSize || '1'));
        setSelectedAccount(String(saved.selectedAccount || ''));
        setActiveAccount('');
        setTestEmailTo(String(saved.testEmailTo || ''));
        setSelectedDraft(String(saved.selectedDraft || ''));
        setDraftSubject(String(saved.draftSubject || ''));
        setDraftBody(String(saved.draftBody || ''));
        setScheduledCountry(String(saved.scheduledCountry || 'india'));
        setScheduledSlot(String(saved.scheduledSlot || ''));
        setManualScheduledSlot(String(saved.manualScheduledSlot || ''));
        setScheduledStartLabel(String(saved.scheduledStartLabel || ''));
        setScheduleMode(String(saved.scheduleMode || 'send_now'));
        setScheduleTimezone(String(saved.scheduleTimezone || 'Asia/Kolkata'));
        setScheduledDateValue(String(saved.scheduledDateValue || ''));
        setScheduledTimeValue(String(saved.scheduledTimeValue || ''));
        setDurationUnit(normalizeDurationUnit(saved.durationUnit || 'seconds'));
      }
    } catch (error) {
      // Ignore bad saved dashboard state and continue with defaults.
    }
  }, []);

  useEffect(() => {
    if (!selectedAccount) {
      setActiveAccount('');
    }
  }, [selectedAccount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DASHBOARD_RESUME_CAMPAIGN_KEY);
      if (!raw) return;
      window.localStorage.removeItem(DASHBOARD_RESUME_CAMPAIGN_KEY);
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      window.dispatchEvent(
        new CustomEvent('dashboard:resume-campaign-draft', {
          detail: { campaign: saved }
        })
      );
    } catch (error) {
      // Ignore bad resume payloads and continue with the default dashboard flow.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const user = data?.user || {};
        const profile = data?.profile || {};
        setProfileUser({
          email: String(user.email || '').trim(),
          role: String(user.role || '').trim(),
          displayName: String(profile.displayName || '').trim()
        });
        setProfileAvatarDataUrl(String(profile.avatarDataUrl || '').trim());
        const totalCredits = Math.max(0, Number(profile.totalCredits || 6000));
        const usedCredits = Math.max(0, Number(profile.usedCredits || 0));
        const remainingCredits = Math.max(0, Number(profile.remainingCredits || Math.max(totalCredits - usedCredits, 0)));
        const creditUsagePercent = Math.max(0, Math.min(100, Number(profile.creditUsagePercent || (totalCredits ? (usedCredits / totalCredits) * 100 : 0))));
          setProfileCredits({
            planName: String(profile.planName || 'Basic').trim() || 'Basic',
            upgradeTargetPlan: String(creditsData?.summary?.upgradeTargetPlan || (profile.planName === 'Basic' ? 'Pro' : 'Enterprise')).trim() || 'Pro',
            upgradeTargetCredits: Number(creditsData?.summary?.upgradeTargetCredits || (profile.planName === 'Basic' ? 12000 : 30000)),
            totalCredits,
            usedCredits,
            remainingCredits,
            creditUsagePercent,
            targetApprovalStatus: String(profile.targetApprovalStatus || 'approved').trim() || 'approved',
            targetApprovalRequestedAt: profile.targetApprovalRequestedAt || null,
            targetApprovalReviewedAt: profile.targetApprovalReviewedAt || null,
            targetApprovalReviewer: String(profile.targetApprovalReviewer || '').trim(),
            targetApprovalRequestNote: String(profile.targetApprovalRequestNote || '').trim()
          });
        setProfileTimelineTasks(
          Object.fromEntries(Object.entries(profile.timelineTasks || {}).map(([key, value]) => [key, Boolean(value)]))
        );
        setProfileTimelineCustomTasks(Array.isArray(profile.timelineCustomTasks) ? profile.timelineCustomTasks : []);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          // Ignore auth lookup failures and keep the fallback display name.
        }
      }
    };

    loadProfile();
    return () => controller.abort();
  }, []);

  const handleTimelineTaskStateChange = useCallback(async (nextTimelineTasks) => {
    const normalized = Object.fromEntries(Object.entries(nextTimelineTasks || {}).map(([key, value]) => [key, Boolean(value)]));
    setProfileTimelineTasks(normalized);
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelineTasks: normalized })
      });
    } catch (error) {
      // Keep the UI responsive even if persistence fails.
    }
  }, []);

  const handleTimelineCustomTaskAdd = useCallback(async (task) => {
    const nextTask = {
      id: task.id || `task-${Date.now()}`,
      date: String(task.date || '').trim(),
      time: String(task.time || '').trim(),
      title: String(task.title || '').trim(),
      text: String(task.text || '').trim(),
      type: String(task.type || 'Reminder').trim() || 'Reminder',
      status: String(task.status || 'pending').trim() || 'pending',
      done: Boolean(task.done)
    };
    const nextTasks = [nextTask, ...(profileTimelineCustomTasks || [])];
    setProfileTimelineCustomTasks(nextTasks);
    try {
      await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelineCustomTasks: nextTasks })
      });
    } catch (error) {
      // Keep the UI responsive even if persistence fails.
    }
  }, [profileTimelineCustomTasks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      campaignName,
      delaySeconds,
      batchSize,
      selectedAccount,
      activeAccount,
      testEmailTo,
      selectedDraft,
      draftSubject,
      draftBody,
      scheduledCountry,
      scheduledSlot,
      manualScheduledSlot,
      scheduledStartLabel,
      scheduleMode,
      scheduleTimezone,
      scheduledDateValue,
      scheduledTimeValue,
      durationUnit
    };
    try {
      window.localStorage.setItem(DASHBOARD_DRAFT_STATE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Ignore storage failures.
    }
  }, [
    campaignName,
    delaySeconds,
    batchSize,
    selectedAccount,
    activeAccount,
    testEmailTo,
    selectedDraft,
    draftSubject,
    draftBody,
    scheduledCountry,
    scheduledSlot,
    manualScheduledSlot,
    scheduledStartLabel,
    scheduleMode,
    scheduleTimezone,
    scheduledDateValue,
    scheduledTimeValue,
    durationUnit
  ]);


const startEditingDraft = (draft) => {
  const normalized = normalizeDraft(draft);
  setEditingDraftId(normalized._id || normalized.id);
  setNewDraftTitle(normalized.title);
  setNewDraftCategory(normalized.category);
  setNewDraftSubject(normalized.subject);
  setNewDraftBody(normalized.body);
  setShowAddDraft(true);
};

const handleDeleteDraft = async (draft) => {
  const id = draft._id || draft.id;
  if (!id) return;
  if (!window.confirm('Delete this draft?')) return;
  try {
    await safeFetchJson(`/api/drafts/${id}`, { method: 'DELETE' });
    if (activeSavedDraftId === id) {
      setActiveSavedDraftId(null);
      setDraftSubject('');
      setDraftBody('');
    }
    loadSavedDrafts();
    notify('Draft deleted successfully.', 'success');
  } catch (err) {
    notify(err.message || 'Failed to delete draft', 'error');
  }
};

  const loadSavedDrafts = async () => {
    try {
      const data = await safeFetchJson('/api/drafts');
      setSavedDrafts((data.drafts || data || []).map((draft) => normalizeDraft(draft)));
    } catch (err) {
      console.error('Failed to load drafts', err);
    }
  };


  const toggleCampaignSelection = (campaignId) => {
    setSelectedCampaignIds((prev) => {
      if (prev.includes(campaignId)) {
        return prev.filter((id) => id !== campaignId);
      }
      return [...prev, campaignId];
    });
  };

  const toggleActiveCampaignSelection = (campaignId) => {
    setSelectedActiveCampaignIds((prev) => {
      if (prev.includes(campaignId)) {
        return prev.filter((id) => id !== campaignId);
      }
      return [...prev, campaignId];
    });
  };

  const toggleSelectAllCampaigns = () => {
    if (allCampaignsSelected) {
      setSelectedCampaignIds([]);
      return;
    }
    setSelectedCampaignIds(historyCampaignIds);
  };

  const toggleSelectAllActiveCampaigns = () => {
    if (allActiveCampaignsSelected) {
      setSelectedActiveCampaignIds([]);
      return;
    }
    setSelectedActiveCampaignIds(activeCampaignIds);
  };

  const deleteSelectedCampaigns = async () => {
    if (!selectedCampaignIds.length) return;
    if (!window.confirm('Delete selected campaigns? This cannot be undone.')) return;
    try {
      await Promise.all(
        selectedCampaignIds.map((id) =>
          safeFetchJson(`/api/campaigns/${id}`, { method: 'DELETE' })
        )
      );
      setSelectedCampaignIds([]);
      await loadAll();
      notify('Selected history campaigns deleted.', 'success');
    } catch (err) {
      notify(err.message || 'Failed to delete selected campaigns', 'error');
    }
  };

  const deleteSelectedActiveCampaigns = async () => {
    if (!selectedActiveCampaignIds.length) return;
    if (!window.confirm('Delete selected active campaigns? This cannot be undone.')) return;
    try {
      await Promise.all(
        selectedActiveCampaignIds.map((id) =>
          safeFetchJson(`/api/campaigns/${id}`, { method: 'DELETE' })
        )
      );
      setSelectedActiveCampaignIds([]);
      await loadAll();
      notify('Selected active campaigns deleted.', 'success');
    } catch (err) {
      notify(err.message || 'Failed to delete selected active campaigns', 'error');
    }
  };

  const deleteAllActiveCampaigns = async () => {
    if (!activeCampaignIds.length) return;
    if (!window.confirm('Delete all campaigns in the campaign section? This cannot be undone.')) return;
    try {
      await Promise.all(
        activeCampaignIds.map((id) =>
          safeFetchJson(`/api/campaigns/${id}`, { method: 'DELETE' })
        )
      );
      setSelectedActiveCampaignIds([]);
      await loadAll();
      notify('All active campaigns deleted.', 'success');
    } catch (err) {
      notify(err.message || 'Failed to delete all active campaigns', 'error');
    }
  };

  const addNewDraft = async () => {
    if (!newDraftSubject || !newDraftBody) {
      notify('Please enter subject and body.', 'info');
      return;
    }

    try {
      const count = savedDrafts.filter((d) => d.category === newDraftCategory).length;
      const baseTitle = newDraftTitle
        ? newDraftTitle
        : `${DRAFT_CATEGORIES.find((c) => c.value === newDraftCategory)?.label || newDraftCategory} Draft ${count + 1}`;
      const payload = {
        category: newDraftCategory,
        title: baseTitle,
        subject: newDraftSubject,
        body: newDraftBody
      };
      const isEditing = Boolean(editingDraftId);
      const url = isEditing ? `/api/drafts/${editingDraftId}` : '/api/drafts';
      const method = isEditing ? 'PATCH' : 'POST';
      const result = await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setNewDraftSubject("");
      setNewDraftBody("");
      setNewDraftTitle("");
      setShowAddDraft(false);
      setEditingDraftId(null);
      setSavedDraftFilterCategory(newDraftCategory);
      notify('Draft script added successfully.', 'success');
      const saved = result.draft;
      if (isEditing && saved) {
        setSavedDrafts((prev) => prev.map((d) => (d._id === saved._id ? saved : d)));
      } else if (saved) {
        setSavedDrafts((prev) => [...prev, saved]);
      }
      await loadSavedDrafts();
    } catch (err) {
      notify(err.message || 'Failed to save draft', 'error');
    }
  };

  const openCreateScriptForm = () => {
    setEditingDraftId(null);
    const category = newDraftCategory || selectedDraft || 'cover_story';
    setNewDraftCategory(category);
    setNewDraftTitle(changeInDraftValue || '');
    setNewDraftSubject('');
    setNewDraftBody('');
    setShowAddDraft(true);
  };

  const saveCurrentDraftScript = async () => {
    if (!draftSubject || !draftBody) {
      notify('Please enter subject and draft body.', 'info');
      return;
    }

    try {
      const category = selectedDraft || 'cover_story';
      const count = savedDrafts.filter((d) => d.category === category).length;
      const baseTitle = changeInDraftValue
        ? changeInDraftValue
        : `${DRAFT_CATEGORIES.find((c) => c.value === category)?.label || category} Draft ${count + 1}`;

      await safeFetchJson('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: baseTitle,
          subject: draftSubject,
          body: draftBody
        })
      });

      setSavedDraftFilterCategory(category);
      await loadSavedDrafts();
      notify('Draft script added successfully.', 'success');
    } catch (err) {
      notify(err.message || 'Failed to save draft', 'error');
    }
  };
  const {
    activeCampaigns,
    historyCampaigns,
    activeCampaign,
    activeCampaignIds,
    historyCampaignIds,
    progressText
  } = useCampaigns(campaigns, preferredActiveCampaignId);
  const allActiveCampaignsSelected =
    activeCampaignIds.length > 0 && activeCampaignIds.every((id) => selectedActiveCampaignIds.includes(id));
  const allCampaignsSelected =
    historyCampaignIds.length > 0 && historyCampaignIds.every((id) => selectedCampaignIds.includes(id));
  const selectedListName = useMemo(
    () => lists.find((list) => list._id === selectedListId)?.name || '',
    [lists, selectedListId]
  );
  const selectedListLabel = useMemo(() => {
    const selectedList = lists.find((list) => list._id === selectedListId);
    if (!selectedList) return 'Select List';
    return `${selectedList.name} (${selectedList.leadCount || 0})`;
  }, [lists, selectedListId]);
  const searchableSectionText = useMemo(
    () => ({
      summary: `summary filter project client active project working mail select mail id quick range starting date today total mails sent pending failed ${project} ${selectedAccountLabel} ${(stats.dailyMailCounts || []).map((item) => `${item.date} ${item.count}`).join(' ')}`,
      upload: `upload client files uploaded file preview show table normalize emails list add column add row save changes ${selectedListName} ${lists.map((list) => list.name).join(' ')}`,
      campaignManagement: `campaign management campaign name campaign type client list batch size delay seconds create campaign ${campaignName} ${selectedDraft} ${selectedListName}`,
      draftEditing: `draft editing and setting select draft type give draft name create script uploaded files choose uploaded file saved draft scripts edit word file draft email body subject line test email ${draftSubject} ${changeInDraftValue} ${savedDrafts.map((draft) => `${draft.title} ${draft.category}`).join(' ')}`,
      schedule: `schedule time slot country time slot add select time scheduled start ${scheduledCountry} ${scheduledSlot} ${manualScheduledSlot} ${scheduledStartLabel}`,
      campaigns: `campaigns campaign history live logs ${campaigns.map((campaign) => `${campaign.name} ${campaign.status}`).join(' ')}`
    }),
    [
      campaignName,
      campaigns,
      changeInDraftValue,
      draftSubject,
      lists,
      manualScheduledSlot,
      project,
      savedDrafts,
      scheduledCountry,
      scheduledSlot,
      scheduledStartLabel,
      selectedDraft,
      selectedListName,
      selectedAccountLabel,
      stats.dailyMailCounts
    ]
  );
  const isSearchMatch = (sectionKey) =>
    normalizedSearchQuery && String(searchableSectionText[sectionKey] || '').toLowerCase().includes(normalizedSearchQuery);
  const fancyStats = useStats(stats);
  const quickDraftButtons = useMemo(() => {
    const supportedCategories = ['cover_story', 'reminder', 'follow_up', 'updated_cost', 'final_cost'];
    return supportedCategories.flatMap((category) => {
      const draftsByCategory = savedDrafts.filter((draft) => draft.category === category);
      const prefix = QUICK_DRAFT_PREFIX[category] || 'draft';
      return draftsByCategory.map((draft, index) => ({
        label: `${prefix}${index + 1}`,
        draft,
        category
      }));
    });
  }, [savedDrafts]);
  const visibleQuickDraftButtons = useMemo(
    () =>
      savedDraftFilterCategory
        ? quickDraftButtons.filter(({ category }) => category === savedDraftFilterCategory)
        : quickDraftButtons,
    [quickDraftButtons, savedDraftFilterCategory]
  );
  const totalTrackedMails = Math.max(
    Number(stats?.total || 0),
    Number(stats?.sent || 0) +
      Number(stats?.pending || 0) +
      Number(stats?.failed || 0) +
      Number(stats?.bounced || 0) +
      Number(stats?.spam || 0)
  );
  const safeTrackedMails = Math.max(totalTrackedMails, 1);
  const completionRate = Math.round((Number(stats?.sent || 0) / safeTrackedMails) * 100);
  const formatDateLabel = (date) => {
    if (!date) return '';
    const normalized = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(normalized.getTime())) return '';
    return normalized.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const buildRangeDateLabel = (value) => {
    const today = new Date();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    const start = new Date(today);
    if (value === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (value === '7d') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (value === '15d') {
      start.setDate(start.getDate() - 14);
      start.setHours(0, 0, 0, 0);
    } else if (value === '30d') {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    } else if (value === 'quarter') {
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
    } else if (value === 'customize' && customStatsStartDate && customStatsEndDate) {
      return `${customStatsStartDate} - ${customStatsEndDate}`;
    } else if (String(value || '').startsWith('custom-')) {
      const match = userRangeOptions.find((option) => option.value === value);
      return match?.label || 'Custom Option';
    }
    return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
  };
  const selectedRangeLabel =
    getRangeLabel(selectedStatsRange);
  const reportDateLabel = selectedRangeLabel;
  const reportRangeLabel =
    selectedStatsRange === 'custom' && customStatsStartDate && customStatsEndDate
      ? `${customStatsStartDate} - ${customStatsEndDate}`
      : selectedStatsRange
        ? buildRangeDateLabel(selectedStatsRange)
        : 'Sep 01 - Nov 30, 2025';
  const rangeDayAnalytics = useMemo(() => {
    const counts = Array.isArray(stats?.dailyMailCounts) ? stats.dailyMailCounts : [];
    return counts
      .map((item) => ({
        date: item?.date || item?.day || item?.label || 'Unknown day',
        count: Number(item?.count || item?.sent || item?.value || 0)
      }))
      .filter((item) => item.date)
      .slice(0, 14);
  }, [stats?.dailyMailCounts]);
  const reportMetricCards = [
    {
      title: 'Total',
      value: Number(stats?.total || 0),
      percent: 100,
      meta: 'Backend count',
      tone: 'total',
      color: '#f59e0b',
      icon: '◉'
    },
    {
      title: 'Sent',
      value: Number(stats?.sent || 0),
      percent: completionRate,
      meta: 'Live status',
      tone: 'sent',
      color: '#4f46e5',
      icon: '✓'
    },
    {
      title: 'Pending',
      value: Number(stats?.pending || 0),
      percent: Math.round((Number(stats?.pending || 0) / safeTrackedMails) * 100),
      meta: 'Waiting to send',
      tone: 'pending',
      color: '#3b82f6',
      icon: '◔'
    },
    {
      title: 'Failed',
      value: Number(stats?.failed || 0),
      percent: Math.round((Number(stats?.failed || 0) / safeTrackedMails) * 100),
      meta: 'Delivery error',
      tone: 'failed',
      color: '#ef4444',
      icon: '✖'
    },
    {
      title: 'Bounced',
      value: Number(stats?.bounced || 0),
      percent: Math.round((Number(stats?.bounced || 0) / safeTrackedMails) * 100),
      meta: 'Delivery bounce',
      tone: 'bounced',
      color: '#14b8a6',
      icon: '↺'
    },
    {
      title: 'Spam',
      value: Number(stats?.spam || 0),
      percent: Math.round((Number(stats?.spam || 0) / safeTrackedMails) * 100),
      meta: 'Blocked / policy',
      tone: 'spam',
      color: '#fb7185',
      icon: '!'
    }
  ];
  const workflowSteps = [
    { index: 1, title: 'Upload List', action: 'Upload List' },
    { index: 2, title: 'Review List', action: 'Review' },
    { index: 3, title: 'Campaign', action: 'Campaign' },
    { index: 4, title: 'Select Draft', action: 'Drafts' },
    { index: 5, title: 'Draft Summary', action: 'Draft Summary' },
    { index: 6, title: 'Test Email', action: 'Test Email' },
    { index: 7, title: 'Schedule Sending', action: 'Schedule' }
  ];
  const calendarDays = ['30', '31', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'];
  const notificationCards = (campaigns || [])
    .flatMap((campaign) => {
      const campaignName = String(campaign?.name || 'Campaign').trim();
      const senderId =
        String(
          campaign?.senderFrom ||
          campaign?.senderAccount?.from ||
          campaign?.senderAccount?.user ||
          campaign?.senderEmail ||
          ''
        ).trim();
      const senderName = senderId
        ? senderId
            .split('@')[0]
            .split(/[._\-]+/g)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ')
        : campaignName;
      return Array.isArray(campaign?.logs)
        ? campaign.logs.map((log) => {
            const message = String(log?.message || '').trim();
            const preview = message.replace(/^Replied:\s*/i, '').replace(/^Reply:\s*/i, '').trim();
            const clippedPreview = preview.length > 90 ? `${preview.slice(0, 87)}...` : preview;
            const normalized = message.toLowerCase();
            const looksLikeReply =
              /^replied:\s*/i.test(message) ||
              /^reply:\s*/i.test(message) ||
              normalized.includes('received reply') ||
              normalized.includes('reply notification');
            const isBlockedNoise =
              normalized.includes('fallback') ||
              normalized.includes('new email') ||
              normalized.includes('no previous messagid') ||
              normalized.includes('no previous messageid') ||
              normalized.includes('campaign');
            return {
              avatar: senderName.slice(0, 2).toUpperCase(),
              sender: senderName,
              name: campaignName,
              title: `${senderName} sent you a mail`,
              time: log?.at ? new Date(log.at).toLocaleDateString('en-GB') : (campaign?.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-GB') : ''),
              text: clippedPreview || message,
              preview: clippedPreview || message,
              subject: campaignName,
              _reply: looksLikeReply && !isBlockedNoise
            };
          })
        : [];
    })
    .filter((item) => item._reply)
    .slice(0, 3)
    .map(({ _reply, ...item }) => item);
  const timelineCards = [
    {
      id: 'timeline-resumed',
      date: activeCampaign?.updatedAt ? new Date(activeCampaign.updatedAt).toLocaleDateString('en-GB') : '27/03/2026',
      time: activeCampaign?.updatedAt ? new Date(activeCampaign.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '09:00 AM',
      title: activeCampaign?.status ? `Campaign ${String(activeCampaign.status).toLowerCase()}` : 'Campaign resumed',
      type: 'Reminder',
      text: 'Review the running campaign and confirm next steps.',
      status: 'done',
      done: true
    },
    {
      id: 'timeline-started',
      date: activeCampaign?.createdAt ? new Date(activeCampaign.createdAt).toLocaleDateString('en-GB') : '27/03/2026',
      time: activeCampaign?.createdAt ? new Date(activeCampaign.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:30 AM',
      title: activeCampaign?.name || 'Campaign started',
      type: 'Appointment',
      text: 'Campaign setup has been completed and is ready for tracking.',
      status: 'done',
      done: true
    },
    {
      id: 'timeline-pipeline',
      date: '27/03/2026',
      time: '12:00 PM',
      title: 'Pipeline check',
      type: 'Meeting',
      text: `Campaign pipeline active: ${Number(campaigns?.filter((campaign) => ACTIVE_CAMPAIGN_STATUSES.has(String(campaign?.status || ''))).length || 0)} active`,
      status: 'pending',
      done: false
    }
  ];
  const performanceCampaigns = (campaigns || [])
    .slice()
    .sort((a, b) => {
      const aActive = ACTIVE_CAMPAIGN_STATUSES.has(String(a?.status || '')) ? 1 : 0;
      const bActive = ACTIVE_CAMPAIGN_STATUSES.has(String(b?.status || '')) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aTime = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 6)
    .map((campaign, index) => {
    const total = Number(campaign?.stats?.total || 0);
    const sent = Number(campaign?.stats?.sent || 0);
    const failed = Number(campaign?.stats?.failed || 0);
    const pending = Number(campaign?.stats?.pending || Math.max(total - sent - failed, 0));
    const opened = Number(campaign?.stats?.opened || campaign?.stats?.opens || campaign?.trackingStats?.openCount || 0);
    const bounced = Number(campaign?.stats?.bounced || campaign?.stats?.bounce || 0);
    const spam = Number(campaign?.stats?.spam || 0);
    const projectKey = String(project || 'tec').toUpperCase();
    const senderEmail = String(campaign?.senderEmail || campaign?.sender || campaign?.from || '');
    const senderName = senderEmail ? senderEmail.split('@')[0] : 'Unassigned';
    const status = campaign?.status || 'Unknown';
    const country =
      campaign?.country ||
      campaign?.options?.country ||
      campaign?.schedule?.country ||
      '';
    const sector =
      campaign?.sector ||
      campaign?.industry ||
      campaign?.category ||
      '';
    const broadcast =
      campaign?.broadcast ||
      campaign?.code ||
      `${projectKey}-${String(index + 1).padStart(2, '0')}`;
    return {
      id: campaign?._id || index,
      srNo: index + 1,
      name: campaign?.name || `Campaign ${index + 1}`,
      status,
      publishDate: campaign?.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-GB') : '',
      total,
      sent,
      pending,
      failed,
      open: opened,
      bounced,
      spam,
      tag: status,
      person: senderName,
      broadcast,
      country,
      sector,
      workerId: campaign?.workerId || '',
      workerLockedAt: campaign?.workerLockedAt || null,
      workerHeartbeatAt: campaign?.workerHeartbeatAt || null,
      queueRequestedAt: campaign?.queueRequestedAt || null,
      tags: [status, country, sector, senderName].filter(Boolean)
    };
  });
  const barChartMetrics = [
    { label: 'Total', height: 88, color: '#94a3b8' },
    { label: 'Sent', height: Math.max(18, completionRate), color: '#4f46e5' },
    {
      label: 'Pending',
      height: Math.max(12, Math.round((Number(stats?.pending || 0) / safeTrackedMails) * 100)),
      color: '#3b82f6'
    },
    {
      label: 'Failed',
      height: Math.max(8, Math.round((Number(stats?.failed || 0) / safeTrackedMails) * 100)),
      color: '#ef4444'
    },
    {
      label: 'Bounce',
      height: Math.max(8, Math.round((Number(stats?.bounced || 0) / safeTrackedMails) * 100)),
      color: '#14b8a6'
    },
    {
      label: 'Spam',
      height: Math.max(6, Math.round((Number(stats?.spam || 0) / safeTrackedMails) * 100)),
      color: '#f97316'
    }
  ];
  const activeCampaignLogs = useMemo(() => {
    const senderId =
      String(
        activeCampaign?.senderFrom ||
        activeCampaign?.senderAccount?.from ||
        activeCampaign?.senderAccount?.user ||
        selectedAccountLabel ||
        ''
      ).trim() || 'unknown sender';
    const campaignName = String(activeCampaign?.name || 'Active campaign');
    const campaignStatus = String(activeCampaign?.status || 'Unknown').trim() || 'Unknown';
    const formatEventTime = (value) => {
      const parsed = value ? new Date(value) : null;
      return parsed && !Number.isNaN(parsed.getTime())
        ? parsed.toLocaleString([], {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        : 'Unknown time';
    };
    const buildMetaLines = ({ sender = '', recipient = '', status = campaignStatus, reason = '', eventTime = '', lagMs = null }) => {
      const items = [
        `Sender ID: ${sender || senderId}`,
        `Receiver ID: ${recipient || 'N/A'}`,
        `Mail Time: ${eventTime || 'Unknown time'}`,
        `Campaign Status: ${status || 'Unknown'}`
      ];
      if (reason) items.push(`Reason: ${reason}`);
      if (Number.isFinite(lagMs) && lagMs >= 0) {
        items.push(`Start Delay: ${Math.max(0, Math.round(lagMs / 1000))} sec`);
      }
      return items;
    };
    let lastStartRequestAt = null;
    let lastLiveRecipient = '';
    let lastLiveSender = senderId;

    if (!Array.isArray(activeCampaign?.logs) || activeCampaign.logs.length === 0) {
      return [];
    }

      return activeCampaign.logs.slice(-120).map((log) => {
        const rawMessage = String(log?.message || '').trim();
        const sendingMatch = rawMessage.match(/^Sending to\s+(.+?)\s+with\s+.+?\s+via\s+(.+)$/i);
        const sentMatch = rawMessage.match(/^Sent:\s*(.+)$/i);
        const failedMatch = rawMessage.match(/^Failed:\s*([^\-]+)\s*-\s*(.+)$/i);
        const sendFailedMatch = rawMessage.match(/^Send failed for\s+([^:]+):\s*(.+)$/i);
        const skippedDuplicateMatch = rawMessage.match(/^Skipped duplicate recipient:\s*(.+)$/i);
        const fallbackRecipient = rawMessage.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)?.[1] || '';
        const timestamp = log?.at || new Date().toISOString();
        const eventTime = formatEventTime(timestamp);
        const normalizedMessage = rawMessage.toLowerCase();
        const normalizedFallbackRecipient = String(fallbackRecipient || '').trim();

        if (sendingMatch) {
          lastLiveRecipient = String(sendingMatch[1] || '').trim();
          lastLiveSender = String(sendingMatch[2] || '').trim() || lastLiveSender || senderId;
          return {
            time: timestamp,
            tag: 'Sending',
            source: 'Campaign Engine',
            action: 'Delivery in progress',
            msg: `Sending mail to ${lastLiveRecipient}`,
            detail: `Campaign: ${campaignName}`,
            meta: buildMetaLines({
              sender: lastLiveSender,
              recipient: lastLiveRecipient,
              eventTime,
              status: 'Running'
            }),
            next: 'The delivery request is in progress. Watch for sent or failed confirmation.',
            status: 'pending'
          };
        }

        if (normalizedMessage.startsWith('runner start requested')) {
          lastStartRequestAt = timestamp ? new Date(timestamp) : null;
          return {
            time: timestamp,
            tag: 'Starting',
            source: 'Campaign Engine',
            action: 'Startup queued',
            msg: `${campaignName} is preparing to start`,
            detail: `Campaign: ${campaignName}`,
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: 'Starting'
            }),
            next: 'Waiting for sender, template, and recipient queue checks to complete.',
            status: 'pending'
          };
        }

        if (normalizedMessage === 'campaign queued for server worker' || normalizedMessage === 'campaign re-queued for server worker') {
          return {
            time: timestamp,
            tag: 'Queued',
            source: 'Campaign Engine',
            action: normalizedMessage.includes('re-queued') ? 'Campaign re-queued' : 'Campaign queued',
            msg: `${campaignName} is waiting in the worker queue`,
            detail: 'Campaign is queued on the server and will start when the worker claims it.',
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: 'Queued'
            }),
            next: 'Watch for the worker claim and running event in the campaign log.',
            status: 'info'
          };
        }

        if (normalizedMessage.startsWith('campaign worker claimed:')) {
          const workerName = rawMessage.split(':').slice(1).join(':').trim() || 'server worker';
          return {
            time: timestamp,
            tag: 'Queued',
            source: 'Campaign Engine',
            action: 'Worker claimed campaign',
            msg: `${campaignName} was claimed by ${workerName}`,
            detail: 'The server worker accepted the campaign and is preparing the send loop.',
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: 'Queued'
            }),
            next: 'The campaign should move to running as soon as preflight checks complete.',
            status: 'info'
          };
        }

        if (sentMatch) {
          const recipient = String(sentMatch[1] || '').replace(/\s+\(reply\)\s*$/i, '').trim() || lastLiveRecipient || normalizedFallbackRecipient;
          return {
            time: timestamp,
            tag: 'Sent',
            source: 'Campaign Engine',
            action: 'Delivery complete',
            msg: `Mail sent to ${recipient}`,
            detail: `Campaign: ${campaignName}`,
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              recipient,
              eventTime,
              status: 'Running'
            }),
            next: 'Continue the send queue or review recent delivery stats.',
            status: 'success'
          };
        }

        if (failedMatch) {
          const recipient = String(failedMatch[1] || '').trim();
          const reason = String(failedMatch[2] || '').trim();
          return {
            time: timestamp,
            tag: 'Failed',
            source: 'Campaign Engine',
            action: 'Delivery failed',
            msg: `Mail failed for ${recipient}`,
            detail: `Campaign: ${campaignName}`,
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              recipient,
              reason,
              eventTime,
              status: 'Failed'
            }),
            next: 'Check sender health or retry after reviewing the failure reason.',
            status: 'danger'
          };
        }

        if (sendFailedMatch) {
          const recipient = String(sendFailedMatch[1] || '').trim() || lastLiveRecipient || normalizedFallbackRecipient;
          const reason = String(sendFailedMatch[2] || '').trim();
          return {
            time: timestamp,
            tag: 'Failed',
            source: 'Campaign Engine',
            action: 'Delivery failed',
            msg: `Mail failed for ${recipient}`,
            detail: `Campaign: ${campaignName}`,
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              recipient,
              reason,
              eventTime,
              status: 'Failed'
            }),
            next: 'Review the sender account and failure reason before retrying this recipient.',
            status: 'danger'
          };
        }

        if (skippedDuplicateMatch) {
          const recipient = String(skippedDuplicateMatch[1] || '').trim() || lastLiveRecipient || normalizedFallbackRecipient;
          return {
            time: timestamp,
            tag: 'Skipped',
            source: 'Campaign Engine',
            action: 'Duplicate recipient',
            msg: `Skipped duplicate recipient: ${recipient}`,
            detail: `Campaign: ${campaignName}`,
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              recipient,
              eventTime,
              status: 'Running'
            }),
            next: 'Recipient already exists in this campaign queue, so the engine moved to the next lead.',
            status: 'warning'
          };
        }

        if (normalizedMessage === 'campaign started') {
          const startDelayMs = lastStartRequestAt ? (new Date(timestamp).getTime() - lastStartRequestAt.getTime()) : null;
          return {
            time: timestamp,
            tag: 'Running',
            source: 'Campaign Engine',
            action: 'Campaign running',
            msg: `${campaignName} is now running`,
            detail: 'Campaign engine is active and sending has started.',
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: 'Running',
              lagMs: startDelayMs
            }),
            next: 'Watch the queue for sent, failed, and pending delivery updates.',
            status: 'success'
          };
        }

        if (normalizedMessage === 'campaign resumed') {
          return {
            time: timestamp,
            tag: 'Running',
            source: 'Campaign Engine',
            action: 'Campaign resumed',
            msg: `${campaignName} resumed sending`,
            detail: 'Campaign queue resumed from the last saved step.',
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: 'Running'
            }),
            next: 'The queue is active again and will continue from the last saved position.',
            status: 'success'
          };
        }

        if (normalizedMessage === 'campaign paused') {
          return {
            time: timestamp,
            tag: 'Paused',
            source: 'Campaign Engine',
            action: 'Campaign paused',
            msg: `${campaignName} is paused`,
            detail: 'Campaign queue is paused and waiting for manual resume.',
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: 'Paused'
            }),
            next: 'Resume the campaign when you are ready to continue the send queue.',
            status: 'warning'
          };
        }

        if (normalizedMessage === 'campaign stopped') {
          return {
            time: timestamp,
            tag: 'Stopped',
            source: 'Campaign Engine',
            action: 'Campaign stopped',
            msg: `${campaignName} stopped`,
            detail: 'Campaign engine stopped processing the current queue.',
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: 'Stopped'
            }),
            next: 'Review the previous event to see whether this was manual or triggered by an error.',
            status: 'info'
          };
        }

        if (normalizedMessage.startsWith('campaign stopped:')) {
          const reason = rawMessage.split(':').slice(1).join(':').trim() || 'Campaign stopped';
          const derivedStatus = reason.toLowerCase().includes('credit') ? 'Failed' : 'Stopped';
          return {
            time: timestamp,
            tag: derivedStatus,
            source: 'Campaign Engine',
            action: 'Campaign stop detected',
            msg: rawMessage,
            detail: `Campaign: ${campaignName}`,
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: derivedStatus,
              reason
            }),
            next: 'Resolve the blocker first, then restart or resume the campaign.',
            status: derivedStatus === 'Failed' ? 'danger' : 'warning'
          };
        }

        if (normalizedMessage === 'campaign completed') {
          return {
            time: timestamp,
            tag: 'Completed',
            source: 'Campaign Engine',
            action: 'Campaign completed',
            msg: `${campaignName} completed`,
            detail: 'All queued recipients for this campaign have been processed.',
            meta: buildMetaLines({
              sender: lastLiveSender || senderId,
              eventTime,
              status: 'Completed'
            }),
            next: 'Review delivery totals and prepare the next campaign batch.',
            status: 'success'
          };
        }

        return {
          time: timestamp,
          tag: String(log?.level || 'Info').toUpperCase(),
          source: 'Campaign Engine',
          action: 'System event',
          msg: rawMessage || 'Campaign event',
          detail: `Campaign: ${campaignName}`,
          meta: buildMetaLines({
            sender: lastLiveSender || senderId,
            recipient: normalizedFallbackRecipient || lastLiveRecipient,
            eventTime,
            status: campaignStatus
          }),
          next: 'Review the campaign log stream for the next step.',
          status: String(log?.level || 'info').toLowerCase()
        };
      }).reverse();
  }, [activeCampaign, selectedAccountLabel]);

  const logs = activeCampaignLogs.length
    ? activeCampaignLogs
      : [
          ...timelineCards.map((item, index) => ({
            time: item.date,
            tag: item.done ? 'Task' : 'Live',
            source: 'Timeline',
            action: String(item.type || 'Task'),
            msg: item.title,
            detail: item.text || 'Timeline update recorded on the dashboard.',
            next: item.done ? 'Completed task' : 'Keep it in the next work queue.',
            status: item.done ? 'success' : 'pending'
          })),
          ...notificationCards.map((item) => ({
            time: item.time,
            tag: 'Inbox',
            source: 'Inbox',
            action: 'Incoming mail',
            msg: item.name,
            detail: item.text,
            next: 'Open the inbox preview to read the full message.',
            status: 'info'
          })),
          ...performanceCampaigns.slice(0, 4).map((item) => ({
            time: item.publishDate,
            tag: String(item.status || 'Campaign').toLowerCase() === 'running' ? 'Live' : 'Campaign',
              source: 'Campaign Overview',
              action: 'Performance update',
              msg: `${item.name} (${item.tag})`,
              detail: `${item.sent} sent, ${item.pending} pending, ${item.failed} failed`,
              next: 'Use the campaign panel to check the next batch and blockers.',
              status: 'info'
            })),
          ...campaigns.slice(0, 3).map((item) => ({
            time: item.updatedAt || item.createdAt || new Date().toISOString(),
            tag: String(item.status || 'System').toLowerCase() === 'running' ? 'Live' : 'System',
            source: 'Campaign Manager',
            action: String(item.status || 'Campaign update'),
            msg: item.name || 'Campaign activity',
            detail: `${item.totalRecipients || 0} recipients | ${item.status || 'unknown status'}`,
            next: String(item.status || '').toLowerCase() === 'draft'
              ? 'Open the campaign workflow to continue setup.'
              : 'Review the campaign controls for the next step.',
            status: String(item.status || 'info').toLowerCase()
          }))
        ];
  const sidebarLiveBadges = useMemo(() => {
    const campaignTotal = Number(campaigns?.length || 0);
    const draftsTotal = Number(savedDrafts?.length || 0);
    const clientListsTotal = Number(lists?.length || 0);
    const runningCampaigns = (campaigns || []).filter((item) => String(item?.status || '').toLowerCase() === 'running').length;
    const inboxActivity = Math.max(0, Number(logs?.length || 0));
    const warmupPercent = Math.max(0, Math.min(100, Number(completionRate || 0)));
    return {
      Dashboard: String(Number(stats?.sent || 0)),
      'Client Data': String(clientListsTotal),
      Drafts: String(draftsTotal),
      Campaign: `${runningCampaigns}/${campaignTotal}`,
      'Warm-Up': `${warmupPercent}%`,
      'Mail Inbox': String(inboxActivity)
    };
  }, [campaigns, completionRate, lists, logs, savedDrafts, stats?.sent, totalTrackedMails]);

  useEffect(() => {
    if (!projectAccounts.length) {
      setSelectedAccount('');
      setActiveAccount('');
      return;
    }
    const match = projectAccounts.find((a) => a.id === selectedAccount);
    if (!match) {
      setSelectedAccount('');
    }
  }, [projectAccounts, selectedAccount]);

  useEffect(() => {
    setPreviewPage((prev) => Math.min(Math.max(prev, 1), previewTotalPages));
  }, [previewTotalPages]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        showUploadedFilesDropdown &&
        uploadedFilesDropdownRef.current &&
        !uploadedFilesDropdownRef.current.contains(event.target)
      ) {
        setShowUploadedFilesDropdown(false);
      }

      if (
        showDraftUploadedFilesDropdown &&
        draftUploadedFilesDropdownRef.current &&
        !draftUploadedFilesDropdownRef.current.contains(event.target)
      ) {
        setShowDraftUploadedFilesDropdown(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showUploadedFilesDropdown, showDraftUploadedFilesDropdown]);

  useEffect(() => {
    setSelectedActiveCampaignIds((prev) => prev.filter((id) => activeCampaignIds.includes(id)));
  }, [activeCampaignIds]);

  useEffect(() => {
    if (!selectedDraft) return;
    const tpl = draftTemplates[selectedDraft];
    if (tpl) {
      const normalized = normalizeDraft(tpl);
      setDraftSubject(normalized.subject || "");
      setDraftBody(normalized.body || "");
    }
  }, [selectedDraft]);

  const safeFetchJson = async (url, options = {}) => {
    const controller = new AbortController();
    const timeoutMs = Number(options?.timeoutMs || 20000);
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const { timeoutMs: _timeoutMs, signal: externalSignal, ...restOptions } = options || {};
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    let res;
    try {
      res = await fetch(url, { ...restOptions, signal: controller.signal, cache: 'no-store' });
    } catch (fetchError) {
      if (fetchError?.name === 'AbortError') {
        throw new Error(`Request timeout: ${url}`);
      }
      if (String(fetchError?.message || '').includes('ERR_NETWORK_IO_SUSPENDED')) {
        throw new Error('Network suspended by browser/system. Resume network and retry.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        data = {};
      }
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Unauthorized');
      }
      throw new Error(data.error || `Request failed: ${url}`);
    }

    return data;
  };

  const buildStatsUrl = (filterOverrides = {}) => {
    const effectiveDate =
      filterOverrides.selectedStatsDate !== undefined
        ? filterOverrides.selectedStatsDate
        : selectedStatsDate;
    const effectiveRange =
      filterOverrides.selectedStatsRange !== undefined
        ? filterOverrides.selectedStatsRange
        : selectedStatsRange;
    const effectiveCustomStartDate =
      filterOverrides.customStatsStartDate !== undefined
        ? filterOverrides.customStatsStartDate
        : customStatsStartDate;
    const effectiveCustomEndDate =
      filterOverrides.customStatsEndDate !== undefined
        ? filterOverrides.customStatsEndDate
        : customStatsEndDate;

    if (effectiveRange === 'customize' && effectiveCustomStartDate && effectiveCustomEndDate) {
      return `/api/stats?range=customize&startDate=${encodeURIComponent(effectiveCustomStartDate)}&endDate=${encodeURIComponent(effectiveCustomEndDate)}`;
    }
    if (effectiveRange) {
      return `/api/stats?range=${encodeURIComponent(effectiveRange)}`;
    }
    if (effectiveDate) {
      return `/api/stats?date=${encodeURIComponent(effectiveDate)}`;
    }
    return '/api/stats';
  };

  const buildCampaignsUrl = () => {
    if (showAllUserActivity) {
      return '/api/campaigns';
    }
    const params = new URLSearchParams();
    if (project) {
      params.set('project', String(project).trim().toLowerCase());
    }
    if (selectedSenderEmail) {
      params.set('sender', selectedSenderEmail);
    }
    const qs = params.toString();
    return qs ? `/api/campaigns?${qs}` : '/api/campaigns';
  };

  const fetchCampaignsWithFallback = async () => {
    const primaryUrl = buildCampaignsUrl();
    const primary = await safeFetchJson(primaryUrl);
    const primaryCampaigns = primary?.campaigns || [];

    if (primaryUrl !== '/api/campaigns' && primaryCampaigns.length === 0) {
      const fallback = await safeFetchJson('/api/campaigns');
      return fallback?.campaigns || [];
    }

    return primaryCampaigns;
  };

  const loadAll = async (filterOverrides = {}) => {
    try {
      const statsUrl = buildStatsUrl(filterOverrides);
      const accountsPromise = safeFetchJson(`/api/accounts?project=${encodeURIComponent(project)}`)
        .then((accRes) => {
          setAccounts(accRes.accounts || []);
          return accRes;
        })
        .catch((err) => ({ __error: err }));

      const [statsRes, templatesRes, campaignsRes] = await Promise.allSettled([
        safeFetchJson(statsUrl, { timeoutMs: 45000 }),
        safeFetchJson('/api/templates'),
        fetchCampaignsWithFallback()
      ]);
      const errors = [];

      if (statsRes.status === 'fulfilled') {
        const st = statsRes.value || {};
        setStats(st);
        setLists(st.lists || []);
      } else {
        errors.push(statsRes.reason?.message || 'Failed to load stats');
      }

      if (templatesRes.status === 'fulfilled') {
        const tpl = templatesRes.value || {};
        setTemplates(tpl.templates || []);
      } else {
        errors.push(templatesRes.reason?.message || 'Failed to load templates');
      }

      if (campaignsRes.status === 'fulfilled') {
        const campaignList = campaignsRes.value || [];
        setCampaigns(campaignList);
        setSelectedCampaignIds((prev) =>
          campaignList
            .filter((c) => !ACTIVE_CAMPAIGN_STATUSES.has(c.status))
            .map((c) => c._id)
            .filter((id) => prev.includes(id))
        );
      } else {
        errors.push(campaignsRes.reason?.message || 'Failed to load campaigns');
      }

      const accountsRes = await accountsPromise;
      if (accountsRes?.__error) {
        if (String(accountsRes.__error?.message || '') === 'Unauthorized') {
          router.replace('/login');
          return;
        }
        errors.push(accountsRes.__error?.message || 'Failed to load accounts');
      }

      const accList =
        !accountsRes?.__error
          ? (accountsRes?.accounts || [])
          : [];
      if (selectedAccount && !accList.find((a) => a.id === selectedAccount)) {
        setSelectedAccount("");
        setActiveAccount("");
      }

      const firstTemplateId =
        templatesRes.status === 'fulfilled' ? templatesRes.value?.templates?.[0]?._id : '';
      if (!selectedTemplateId && firstTemplateId) {
        setSelectedTemplateId(firstTemplateId);
      }
      setError(errors[0] || '');
    } catch (e) {
      if (String(e?.message || '') === 'Unauthorized') {
        router.replace('/login');
        return;
      }
      setError(e.message || 'Failed to load dashboard data');
    }
  };

  const loadLiveData = async (filterOverrides = {}) => {
    try {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      const statsUrl = buildStatsUrl(filterOverrides);
      const [statsRes, campaignsRes] = await Promise.allSettled([
        safeFetchJson(statsUrl, { timeoutMs: 45000 }),
        fetchCampaignsWithFallback()
      ]);

      if (statsRes.status === 'fulfilled') {
        const st = statsRes.value || {};
        setStats(st);
        setLists(st.lists || []);
      } else if (String(statsRes.reason?.message || '') === 'Unauthorized') {
        router.replace('/login');
        return;
      }

      if (campaignsRes.status === 'fulfilled') {
        const campaignList = campaignsRes.value || [];
        setCampaigns(campaignList);
        setSelectedCampaignIds((prev) =>
          campaignList
            .filter((c) => !ACTIVE_CAMPAIGN_STATUSES.has(c.status))
            .map((c) => c._id)
            .filter((id) => prev.includes(id))
        );
      } else if (String(campaignsRes.reason?.message || '') === 'Unauthorized') {
        router.replace('/login');
        return;
      }

      const errors = [];
      if (statsRes.status === 'rejected') {
        errors.push(statsRes.reason?.message || 'Failed to refresh stats');
      }
      if (campaignsRes.status === 'rejected') {
        errors.push(campaignsRes.reason?.message || 'Failed to refresh campaigns');
      }
      setError(errors[0] || '');
    } catch (e) {
      if (String(e?.message || '') === 'Unauthorized') {
        router.replace('/login');
        return;
      }
      setError(e.message || 'Failed to refresh live data');
    }
  };

  useEffect(() => {
    loadSavedDrafts();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!topbarProjectDropdownRef.current?.contains(event.target)) {
        setShowTopbarProjectDropdown(false);
      }
      if (!topbarRangeDropdownRef.current?.contains(event.target)) {
        setShowTopbarRangeDropdown(false);
      }
      if (!topbarMailDropdownRef.current?.contains(event.target)) {
        setShowTopbarMailDropdown(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  useEffect(() => {
    loadAllRef.current = loadAll;
  });

  useEffect(() => {
    loadAll();
  }, [showAllUserActivity, project, selectedAccount, activeAccount, selectedStatsDate, selectedStatsRange, customStatsStartDate, customStatsEndDate]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadAllRef.current?.();
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (historyCampaigns.length > 0) {
      setShowCampaignHistory(true);
    }
  }, [historyCampaigns.length]);


  useEffect(() => {
    const refreshMs = String(activeCampaign?.status || '').toLowerCase() === 'running' ? 5000 : 30000;
    const id = setInterval(() => loadLiveData(), refreshMs);
    return () => clearInterval(id);
  }, [
    activeCampaign?.status,
    showAllUserActivity,
    project,
    selectedAccount,
    activeAccount,
    selectedStatsDate,
    selectedStatsRange,
    customStatsStartDate,
    customStatsEndDate
  ]);

  useEffect(() => {
    const loadListPreview = async () => {
      if (!selectedListId) {
        setPreview([]);
        setPreviewColumns([]);
        setPreviewDirty(false);
        setPreviewPage(1);
        setPreviewStyle(DEFAULT_SHEET_STYLE);
        return;
      }

      try {
        const data = await safeFetchJson(`/api/lists/${selectedListId}`);
        const leads = data.leads || [];
        const columns = data.columns?.length
          ? data.columns
          : Array.from(
              new Set(
                leads.flatMap((lead) => Object.keys(lead?.data || {})).filter(Boolean)
              )
            );
        setPreviewColumns(columns);
        setPreview(leads.map((lead) => lead.data || {}));
        setPreviewPage(1);
        setPreviewStyle({ ...DEFAULT_SHEET_STYLE, ...(data.sheetStyle || {}) });
        setPreviewDirty(false);
      } catch (e) {
        console.error('Failed to load list preview', e);
      }
    };

    loadListPreview();
  }, [selectedListId]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const form = new FormData();
    form.append('file', file);

    try {
      const data = await safeFetchJson('/api/uploads', { method: 'POST', body: form });
      setLoading(false);
      setPreviewColumns(data.previewColumns || []);
      setPreview(data.previewRows || []);
      setPreviewPage(1);
      setPreviewStyle({ ...DEFAULT_SHEET_STYLE, ...(data.sheetStyle || {}) });
      setPreviewDirty(false);
      setSelectedListId(data.listId);
      await loadAll();
      notify('File uploaded successfully.', 'success');
    } catch (e) {
      setLoading(false);
      notify(e.message || 'Upload failed', 'error');
    }
  };

  const createCampaign = async ({
    skipReload = false,
    autoStart = false,
    workflowStep = 3,
    workflowStepLabel = 'Campaign',
    tracking = { enabled: false, opens: false, clicks: false, replies: false },
    scheduleConfig = null
  } = {}) => {
    if (!selectedAccount) {
      notify('Select Mail ID before creating a campaign.', 'info');
      return null;
    }
    if (campaignCreateLockRef.current) {
      notify('Campaign creation is already in progress.', 'info');
      return null;
    }

    const createSignature = JSON.stringify({
      project,
      campaignName: String(campaignName || '').trim(),
      selectedListId,
      selectedAccount,
        selectedDraft,
        draftSubject: String(draftSubject || '').trim(),
        draftBody: String(draftBody || '').trim(),
        batchSize: String(batchSize || ''),
        delaySeconds: String(delaySeconds || ''),
        scheduleConfig: JSON.stringify(scheduleConfig || {}),
        workflowStep: String(workflowStep || ''),
        workflowStepLabel: String(workflowStepLabel || ''),
        tracking: JSON.stringify({
          enabled: Boolean(tracking?.enabled),
          opens: Boolean(tracking?.opens),
          clicks: Boolean(tracking?.clicks),
          replies: Boolean(tracking?.replies)
        })
      });

    if (
      lastCampaignCreateSignatureRef.current &&
      lastCampaignCreateSignatureRef.current === createSignature &&
      lastCreatedCampaignIdRef.current
    ) {
      setPendingCampaignId(lastCreatedCampaignIdRef.current);
      return campaigns.find((campaign) => campaign._id === lastCreatedCampaignIdRef.current) || { _id: lastCreatedCampaignIdRef.current };
    }

    try {
      campaignCreateLockRef.current = true;
      const effectiveSchedule = scheduleConfig || prepareScheduleConfig();
      const data = await safeFetchJson('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          project,
          senderFrom: selectedSenderEmail,
          listId: selectedListId,
          templateId: null,
          type: selectedDraft,
          draftType: selectedDraft,
          inlineTemplate: { subject: draftSubject, body: draftBody },
          senderAccountId: selectedAccount || null,
          scheduleMode: effectiveSchedule.scheduleMode,
          scheduledAt: effectiveSchedule.scheduledAt ? effectiveSchedule.scheduledAt.toISOString() : null,
          scheduledDate: effectiveSchedule.scheduledDate,
          scheduledTime: effectiveSchedule.scheduledTime,
          timezone: effectiveSchedule.timezone,
          country: effectiveSchedule.country,
          options: {
            batchSize: effectiveSchedule.batchSize,
            delayInterval: effectiveSchedule.delayInterval,
            durationUnit: effectiveSchedule.durationUnit,
            delaySeconds: effectiveSchedule.delaySeconds,
            replyMode: isReplyModeCampaignType
          },
          tracking: {
            enabled: Boolean(tracking?.enabled),
            opens: Boolean(tracking?.opens),
            clicks: Boolean(tracking?.clicks),
            replies: Boolean(tracking?.replies)
          },
          workflowStep,
          workflowStepLabel
        })
      });
      const createdCampaign = data.campaign || null;
      if (createdCampaign?._id) {
        setPendingCampaignId(createdCampaign._id);
        lastCampaignCreateSignatureRef.current = createSignature;
        lastCreatedCampaignIdRef.current = createdCampaign._id;
        applyScheduleConfigState(effectiveSchedule);
        setShowDraftEditor(true);
        if (autoStart) {
          await startCampaign(createdCampaign._id, { scheduleConfig: effectiveSchedule, startAfterSchedule: true });
        }
      }
      notify('Campaign created successfully.', 'success');
      if (!skipReload) {
        void loadAll();
      }
      return createdCampaign;
    } catch (e) {
      notify(e.message || 'Failed to create campaign', 'error');
      return null;
    } finally {
      campaignCreateLockRef.current = false;
    }
  };

  const saveCampaignSchedule = async (rawConfig = {}) => {
    const config = prepareScheduleConfig(rawConfig);
    applyScheduleConfigState(config);

    if (config.batchSize < 1) {
      notify('Batch size must be greater than or equal to 1.', 'warning');
      return { ok: false };
    }
    if (config.delayInterval < 1) {
      notify('Delay interval must be greater than or equal to 1.', 'warning');
      return { ok: false };
    }
    if (!['seconds', 'minutes', 'hours'].includes(config.durationUnit)) {
      notify('Duration unit is invalid.', 'warning');
      return { ok: false };
    }
    if (config.scheduleMode === 'scheduled') {
      if (!config.scheduledDate || !config.scheduledTime) {
        notify('Please select scheduled date and time', 'warning');
        return { ok: false };
      }
      if (!isFutureScheduledDate(config.scheduledAt)) {
        notify('Scheduled time must be in future', 'warning');
        return { ok: false };
      }
    }

    if (!pendingCampaignId) {
      notify('Schedule saved', 'success');
      return { ok: true, config };
    }

    try {
      await safeFetchJson(`/api/campaigns/${pendingCampaignId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleMode: config.scheduleMode,
          scheduledAt: config.scheduledAt ? config.scheduledAt.toISOString() : null,
          scheduledDate: config.scheduledDate,
          scheduledTime: config.scheduledTime,
          country: config.country,
          timezone: config.timezone,
          slot: config.normalizedSlot,
          batchSize: config.batchSize,
          delayInterval: config.delayInterval,
          durationUnit: config.durationUnit,
          persistOnly: true,
          replyMode: isReplyModeCampaignType
        })
      });
      notify('Schedule saved', 'success');
      await loadAll();
      return { ok: true, config };
    } catch (e) {
      notify(e.message || 'Failed to save schedule', 'error');
      return { ok: false };
    }
  };

  const createAndStartCampaign = async (rawConfig = {}) => {
    if (campaignCreateLockRef.current) {
      notify('Campaign creation is already in progress.', 'info');
      return;
    }
    const scheduleConfig = prepareScheduleConfig(rawConfig);
    applyScheduleConfigState(scheduleConfig);
    let campaignId = pendingCampaignId;

    if (!campaignId) {
      const campaign = await createCampaign({ skipReload: true, scheduleConfig });
      campaignId = campaign?._id || '';
    }

    if (!campaignId) return;

    await startCampaign(campaignId, { scheduleConfig, startAfterSchedule: true });
  };

  useEffect(() => {
    if (!pendingCampaignId) return;

    const matchingCampaign = campaigns.find((campaign) => campaign._id === pendingCampaignId);
    if (!matchingCampaign) {
      setPendingCampaignId('');
      return;
    }

    const status = String(matchingCampaign.status || '').toLowerCase();
    if (status !== 'draft') {
      setPendingCampaignId('');
    }
  }, [campaigns, pendingCampaignId]);

  const startGraphOAuth = (expectedEmail = "") => {
    const returnTo = window.location.pathname + window.location.search;
    let u = "/api/graph-oauth/start?returnTo=" + encodeURIComponent(returnTo);
    if (expectedEmail) u += "&expectedEmail=" + encodeURIComponent(expectedEmail) + "&loginHint=" + encodeURIComponent(expectedEmail);
    window.location.href = u;
  };

  const connectSelectedAccount = async () => {
    const acc = accounts.find((a) => a.id === selectedAccount);
    if (!acc) return notify('Select Mail ID.', 'info');
    if (acc.provider === "graph_oauth" && String(acc.status || "").toLowerCase() !== "connected") {
      startGraphOAuth(acc.from || "");
      return;
    }
    try {
      await safeFetchJson('/api/accounts/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: acc.id })
      });
      setActiveAccount(acc.from || '');
      notify('Account connected successfully.', 'success');
    } catch (e) {
      notify(e.message || 'Account connection failed', 'error');
    }
  };


  const sendTestEmail = async () => {
  const acc = accounts.find((a) => a.id === selectedAccount);
  if (!acc) return notify('Select Mail ID.', 'info');
  if (!testEmailTo) return notify('Enter test recipient email.', 'info');
  try {
    await safeFetchJson('/api/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: acc.id,
        to: testEmailTo,
        subject: draftSubject,
        body: draftBody
      })
    });
    notify('Test email sent successfully.', 'success');
  } catch (e) {
    notify(e.message || 'Test email failed', 'error');
  }
};

const normalizeSelectedListEmails = async () => {
    if (!selectedListId) {
      notify('Select a list first.', 'info');
      return;
    }
    try {
      const data = await safeFetchJson(`/api/lists/${selectedListId}/normalize-emails`, { method: 'POST' });
      notify(`Email normalization complete. Updated rows: ${data.changed || 0}`, 'success');
      await loadAll();
    } catch (e) {
      notify(e.message || 'Failed to normalize emails', 'error');
    }
  };

  const startCampaign = async (campaignId, options = {}) => {
    try {
      setPreferredActiveCampaignId(campaignId);
      const scheduleConfig = prepareScheduleConfig(options.scheduleConfig || {});
      applyScheduleConfigState(scheduleConfig);
      if (scheduleConfig.scheduleMode === 'scheduled') {
        if (!scheduleConfig.scheduledDate || !scheduleConfig.scheduledTime) {
          notify('Please select scheduled date and time', 'warning');
          return;
        }
        if (!isFutureScheduledDate(scheduleConfig.scheduledAt)) {
          notify('Scheduled time must be in future', 'warning');
          return;
        }
        await safeFetchJson(`/api/campaigns/${campaignId}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleMode: 'scheduled',
            country: scheduleConfig.country,
            slot: scheduleConfig.normalizedSlot,
            timezone: scheduleConfig.timezone,
            label: scheduleConfig.label,
            scheduledDate: scheduleConfig.scheduledDate,
            scheduledTime: scheduleConfig.scheduledTime,
            scheduledAt: scheduleConfig.scheduledAt.toISOString(),
            batchSize: scheduleConfig.batchSize,
            delayInterval: scheduleConfig.delayInterval,
            durationUnit: scheduleConfig.durationUnit,
            activate: true,
            replyMode: isReplyModeCampaignType
          })
        });
        setScheduledStartLabel(scheduleConfig.label);
      } else {
        await safeFetchJson(`/api/campaigns/${campaignId}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleMode: 'send_now',
            country: scheduleConfig.country,
            timezone: scheduleConfig.timezone,
            batchSize: scheduleConfig.batchSize,
            delayInterval: scheduleConfig.delayInterval,
            durationUnit: scheduleConfig.durationUnit,
            persistOnly: true,
            replyMode: isReplyModeCampaignType
          })
        });
      }
      const data = await safeFetchJson(`/api/campaigns/${campaignId}/start`, { method: 'POST' });
      setPendingCampaignId('');
      if (data.scheduled) {
        notify('Campaign scheduled successfully', 'success');
      } else if (data.started === false && data.message) {
        notify(data.message, 'info');
      } else {
        notify('Campaign started now', 'success');
      }
      await loadAll();
    } catch (e) {
      notify(e.message || 'Failed to start campaign', 'error');
    }
  };

  const pauseCampaign = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/pause`, { method: 'POST' });
      notify('Campaign paused successfully.', 'success');
      void loadAll();
    } catch (e) {
      notify(e.message || 'Failed to pause campaign', 'error');
    }
  };

  const resumeCampaign = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/resume`, { method: 'POST' });
      notify('Campaign resumed successfully.', 'success');
      void loadAll();
    } catch (e) {
      notify(e.message || 'Failed to resume campaign', 'error');
    }
  };

  const stopCampaign = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/stop`, { method: 'POST' });
      notify('Campaign stopped successfully.', 'success');
      void loadAll();
    } catch (e) {
      notify(e.message || 'Failed to stop campaign', 'error');
    }
  };

  const clearCampaignLogs = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/clear-logs`, { method: 'POST' });
      notify('Campaign logs cleared.', 'success');
      void loadAll();
    } catch (e) {
      notify(e.message || 'Failed to clear campaign logs', 'error');
    }
  };

  const deleteCampaign = async (campaignId) => {
    if (!window.confirm('Delete this campaign? This cannot be undone.')) {
      return;
    }

    try {
      await safeFetchJson(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      notify('Campaign deleted successfully.', 'success');
      void loadAll();
    } catch (e) {
      notify(e.message || 'Failed to delete campaign', 'error');
    }
  };

  const deleteSelectedUploadedFile = async () => {
    const idsToDelete = selectedUploadedFileIds.length ? selectedUploadedFileIds : (selectedListId ? [selectedListId] : []);
    if (!idsToDelete.length) {
      notify('Select uploaded file first.', 'info');
      return;
    }
    if (!window.confirm('Delete selected uploaded file(s)?')) {
      return;
    }

    try {
      await Promise.all(idsToDelete.map((id) => safeFetchJson(`/api/lists/${id}`, { method: 'DELETE' })));
      setSelectedListId('');
      setSelectedUploadedFileIds([]);
      setPreview([]);
      setPreviewColumns([]);
      setShowUploadedFilesDropdown(false);
      await loadAll();
      notify('Uploaded file deleted successfully.', 'success');
    } catch (e) {
      notify(e.message || 'Failed to delete uploaded file', 'error');
    }
  };

  const deleteAllUploadedFiles = async () => {
    if (!lists.length) {
      notify('No uploaded files to delete.', 'info');
      return;
    }
    if (!window.confirm('Delete all uploaded files?')) {
      return;
    }

    try {
      await Promise.all(
        lists.map((list) => safeFetchJson(`/api/lists/${list._id}`, { method: 'DELETE' }))
      );
      setSelectedListId('');
      setSelectedUploadedFileIds([]);
      setPreview([]);
      setPreviewColumns([]);
      setShowUploadedFilesDropdown(false);
      await loadAll();
      notify('All uploaded files deleted.', 'success');
    } catch (e) {
      notify(e.message || 'Failed to delete all uploaded files', 'error');
    }
  };

  const updatePreviewCell = (rowIndex, column, value) => {
    setPreview((prev) =>
      prev.map((row, idx) => (idx === rowIndex ? { ...row, [column]: value } : row))
    );
    setPreviewDirty(true);
  };

  const savePreviewEdits = async () => {
    if (!selectedListId) {
      notify('Select uploaded file first.', 'info');
      return;
    }

    try {
      await safeFetchJson(`/api/lists/${selectedListId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview, columns: previewColumns, sheetStyle: previewStyle })
      });
      setPreviewDirty(false);
      await loadAll();
      notify('Table changes saved.', 'success');
    } catch (e) {
      notify(e.message || 'Failed to save table changes', 'error');
    }
  };

  const getPreviewColumns = () =>
    previewColumns.length
      ? previewColumns
      : Array.from(new Set(preview.flatMap((row) => Object.keys(row || {})).filter(Boolean)));

  const addPreviewRow = () => {
    const columns = getPreviewColumns();
    const newRow = Object.fromEntries(columns.map((column) => [column, '']));
    setPreview((prev) => [...prev, newRow]);
    setPreviewDirty(true);
    setShowUploadPreview(true);
  };

  const addPreviewColumn = () => {
    const existingColumns = getPreviewColumns();
    let nextIndex = existingColumns.length + 1;
    let nextName = `Column${nextIndex}`;
    while (existingColumns.includes(nextName)) {
      nextIndex += 1;
      nextName = `Column${nextIndex}`;
    }

    setPreviewColumns([...existingColumns, nextName]);
    setPreview((prev) => prev.map((row) => ({ ...row, [nextName]: '' })));
    setPreviewDirty(true);
    setShowUploadPreview(true);
  };

  const renamePreviewColumn = (oldName, newName) => {
    const trimmed = String(newName || '').trim();
    if (!trimmed || trimmed === oldName) return;

    const columns = getPreviewColumns();
    if (columns.includes(trimmed)) {
      notify('Column name already exists.', 'info');
      return;
    }

    setPreviewColumns(columns.map((column) => (column === oldName ? trimmed : column)));
    setPreview((prev) =>
      prev.map((row) => {
        const updated = { ...row, [trimmed]: row?.[oldName] ?? '' };
        delete updated[oldName];
        return updated;
      })
    );
    setPreviewDirty(true);
  };

  const deletePreviewColumn = (columnToDelete) => {
    const columns = getPreviewColumns();
    if (columns.length <= 1) {
      notify('At least one column is required.', 'info');
      return;
    }
    if (!window.confirm(`Delete column "${columnToDelete}"?`)) {
      return;
    }

    setPreviewColumns(columns.filter((column) => column !== columnToDelete));
    setPreviewStyle((prev) => {
      const nextWidths = { ...(prev.columnWidths || {}) };
      delete nextWidths[columnToDelete];
      return { ...prev, columnWidths: nextWidths };
    });
    setPreview((prev) =>
      prev.map((row) => {
        const updated = { ...row };
        delete updated[columnToDelete];
        return updated;
      })
    );
    setPreviewDirty(true);
  };

  const deletePreviewRow = (rowIndex) => {
    if (!window.confirm('Delete this row?')) {
      return;
    }
    setPreview((prev) => prev.filter((_, idx) => idx !== rowIndex));
    setPreviewDirty(true);
  };

  const updatePreviewStyle = (key, value) => {
    setPreviewStyle((prev) => ({ ...prev, [key]: value }));
    setPreviewDirty(true);
  };

  const updateColumnWidth = (column, value) => {
    const width = Math.max(80, Number(value || 140));
    setPreviewStyle((prev) => ({
      ...prev,
      columnWidths: {
        ...(prev.columnWidths || {}),
        [column]: width
      }
    }));
    setPreviewDirty(true);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const resetSummaryFilters = () => {
    setSelectedStatsDate('');
    setSelectedStatsRange('');
    setCustomStatsStartDate('');
    setCustomStatsEndDate('');
    setShowDayCounts(false);
    loadAll({
      selectedStatsDate: '',
      selectedStatsRange: '',
      customStatsStartDate: '',
      customStatsEndDate: ''
    });
  };

  const applyCustomRangeSelection = () => {
    if (!customStatsStartDate || !customStatsEndDate) {
      notify('Please select both start date and end date.', 'info');
      return;
    }
    if (customStatsStartDate > customStatsEndDate) {
      notify('Start date cannot be after end date.', 'error');
      return;
    }
    setSelectedStatsRange('customize');
    setSelectedStatsDate('');
    setShowDayCounts(true);
    setShowCustomRangePopup(false);
    notify('Custom date range selected.', 'success');
  };

  const handleTopNavSelect = (item) => {
    setActiveTopNav(item.label);
    if (item.href?.startsWith('/')) {
      router.push(item.href);
      return;
    }
    if (item.label === 'Revenue') {
      setActiveSidebarView('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (item.label === 'Home' && activeSidebarView) {
      setActiveSidebarView('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = document.querySelector(item.href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openSidebarBlankView = (item, event) => {
    if (event) {
      event.preventDefault();
    }
    if (item.href?.startsWith('/')) {
      router.push(item.href);
      return;
    }
    const label = item.label;
    if (label === 'Revenue') {
      setActiveTopNav('Revenue');
      setActiveSidebarView('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveSidebarView(label);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderSidebarNode = (item, depth = 0) => (
    <div
      key={`${item.label}-${depth}`}
      className="dashboard-sidebar-item"
      style={depth > 0 ? { marginLeft: depth * 14 } : undefined}
    >
      <a
        href={item.href}
        className={depth === 0 ? 'dashboard-sidebar-link' : 'dashboard-sidebar-subitem-link'}
        onClick={(event) => openSidebarBlankView(item, event)}
      >
        {depth === 0 ? <span className="dashboard-link-icon soft">{item.icon}</span> : null}
        <span>{item.label}</span>
        {depth === 0 && sidebarLiveBadges[item.label] ? <em className="dashboard-sidebar-badge">{sidebarLiveBadges[item.label]}</em> : null}
      </a>
      {item.items?.length ? (
        <div className="dashboard-sidebar-submenu">
          {item.items.map((child) => renderSidebarNode(child, depth + 1))}
        </div>
      ) : null}
    </div>
  );

  const showSidebarBlankView = Boolean(activeSidebarView);

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
          <div className="dashboard-sidebar-card">
            <div className="dashboard-brand">
              <img
                src="/intellimailpilot-logo.png"
                alt="Intelli Mail Pilot"
                className="dashboard-brand-logo"
              />
            </div>

          <div className="dashboard-sidebar-stack">
            <div className={`dashboard-topbar-search dashboard-sidebar-search ${normalizedSearchQuery ? 'active' : ''}`}>
              <span className="dashboard-topbar-search-icon">⌕</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search"
                placeholder="Search"
              />
            </div>
            {SIDEBAR_PRIMARY_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`dashboard-primary-link ${item.tone}`}
                onClick={(event) => openSidebarBlankView(item, event)}
              >
                <span className="dashboard-link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
          <div className="dashboard-sidebar-nav" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
            <nav className="dashboard-sidebar-menu">
              {SIDEBAR_WORKSPACE_ITEMS.map((item) => renderSidebarNode(item))}
            </nav>
            <div className="dashboard-upgrade-card">
              <div className="dashboard-upgrade-head">
                <strong>Upgrade</strong>
                <span className="dashboard-upgrade-badge" aria-hidden="true">↻</span>
              </div>
              <p className="dashboard-upgrade-summary">
                <span className="dashboard-upgrade-plan">{profileCredits.planName || 'Basic'}</span>
                <span className="dashboard-upgrade-credits">{profileCredits.remainingCredits} Credits Left</span>
              </p>
              <div className="dashboard-upgrade-meta">
                <span>
                  <small>Current</small>
                  <strong>{profileCredits.planName || 'Basic'}</strong>
                </span>
                <span>
                  <small>Next Plan</small>
                  <strong>{profileCredits.upgradeTargetPlan || 'Pro'}</strong>
                </span>
              </div>
              <div className="dashboard-upgrade-meter">
                <span style={{ width: `${Math.max(0, Math.min(100, profileCredits.creditUsagePercent || 0))}%` }} />
              </div>
              <button type="button" className="dashboard-upgrade-button">
                {profileCredits.upgradeTargetPlan && profileCredits.upgradeTargetPlan !== profileCredits.planName
                  ? `Upgrade to ${profileCredits.upgradeTargetPlan}`
                  : 'Manage Plan'}
              </button>
            </div>

            <button type="button" className="dashboard-logout-link" onClick={logout}>
              <span aria-hidden="true" style={{ width: 28, height: 28, flexShrink: 0 }} />
              <span aria-hidden="true" style={{ visibility: 'hidden' }}>Log out</span>
              <span className="dashboard-logout-text">Log out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="container grid dashboard-main">
      <div id="dashboard-top" />
      <section className="dashboard-topbar">
        <div className="dashboard-topbar-tabs">
          {TOP_NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`dashboard-topbar-tab ${activeTopNav === item.label ? 'active' : ''}`}
              onClick={() => handleTopNavSelect(item)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={`dashboard-topbar-search ${normalizedSearchQuery ? 'active' : ''}`}>
          <span className="dashboard-topbar-search-icon">⌕</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search"
            placeholder="Search"
          />
        </div>

        <div className="dashboard-topbar-actions">
          <button
            type="button"
            className="dashboard-topbar-pill dashboard-topbar-range-pill"
            onClick={() => setShowTopbarRangeDropdown((prev) => !prev)}
            aria-haspopup="dialog"
            aria-expanded={showTopbarRangeDropdown}
          >
            <span className="dashboard-topbar-pill-label">{reportDateLabel}</span>
            <span className="dashboard-topbar-pill-range">{reportRangeLabel}</span>
          </button>
          <div className="dashboard-topbar-dropdown" ref={topbarProjectDropdownRef}>
            <button
              type="button"
              className={`badge ${project ? 'sent' : 'failed'}`}
              onClick={() => setShowTopbarProjectDropdown((prev) => !prev)}
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25, cursor: 'pointer' }}
            >
              <span>{project ? String(project).toUpperCase() : 'Select Project'}</span>
            </button>
            {showTopbarProjectDropdown ? (
              <div className="dashboard-topbar-dropdown-menu">
                {projectOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`dashboard-topbar-dropdown-item ${project === item ? 'active' : ''}`}
                    onClick={() => selectProject(item)}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item add"
                  onClick={addProjectOption}
                >
                  Add Project
                </button>
              </div>
            ) : null}
          </div>
          <div className="dashboard-topbar-dropdown" ref={topbarMailDropdownRef}>
            <button
              type="button"
              className={`badge ${activeAccount ? 'sent' : 'failed'}`}
              onClick={() => setShowTopbarMailDropdown((prev) => !prev)}
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25, cursor: 'pointer' }}
            >
              <span>{selectedAccountLabel}</span>
            </button>
            {showTopbarMailDropdown ? (
              <div className="dashboard-topbar-dropdown-menu" style={{ minWidth: 280, maxHeight: 220, overflowY: 'auto' }}>
                {projectAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    className={`dashboard-topbar-dropdown-item ${selectedAccount === account.id ? 'active' : ''}`}
                    onClick={() => selectTopbarMail(account.id)}
                  >
                    {account.from}
                  </button>
                ))}
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item add"
                  onClick={() => selectTopbarMail('__oauth_add__')}
                >
                  Add New Mail
                </button>
              </div>
            ) : null}
          </div>
          <div className="dashboard-topbar-profile-wrap" style={{ position: 'relative' }}>
            <button
              type="button"
              className="dashboard-topbar-profile"
              onClick={() => setShowTopbarProfileDropdown((prev) => !prev)}
            >
              {profileAvatarDataUrl ? (
                <img className="dashboard-topbar-avatar dashboard-topbar-avatar-img" src={profileAvatarDataUrl} alt={profileDisplayName} />
              ) : (
                <span className="dashboard-topbar-avatar">{profileInitials}</span>
              )}
              <span>{profileDisplayName}</span>
            </button>
            {showTopbarProfileDropdown ? (
              <div className="dashboard-topbar-dropdown-menu" style={{ minWidth: 240, right: 0 }}>
                <div className="dashboard-topbar-dropdown-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
                  <strong style={{ display: 'block' }}>{profileDisplayName}</strong>
                  <small style={{ display: 'block', color: 'rgba(15, 23, 42, 0.56)', marginTop: 2 }}>
                    {profileUser.email || 'Signed in user'}
                  </small>
                </div>
                <div className="dashboard-topbar-dropdown-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
                  <small style={{ display: 'block', color: 'rgba(15, 23, 42, 0.56)' }}>
                    Role: {profileRoleLabel}
                  </small>
                </div>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile#profile');
                  }}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile#settings');
                  }}
                >
                  Settings
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile#notifications');
                  }}
                >
                  Notifications
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile#billing');
                  }}
                >
                  Billing
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile#security');
                  }}
                >
                  Security
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item add"
                  onClick={async () => {
                    setShowTopbarProfileDropdown(false);
                    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
                    router.push('/login');
                    router.refresh();
                  }}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      {showTopbarRangeDropdown && typeof window !== 'undefined'
        ? createPortal(
            <div className="dashboard-popup-backdrop" onClick={() => setShowTopbarRangeDropdown(false)}>
              <div className="dashboard-popup-card dashboard-range-popup" onClick={(event) => event.stopPropagation()}>
            <div className="dashboard-popup-head">
              <div>
                <strong>Filter Dashboard</strong>
                <p>Choose a date view, then the range label will update automatically.</p>
              </div>
              <button
                type="button"
                className="dashboard-popup-close"
                onClick={() => setShowTopbarRangeDropdown(false)}
                aria-label="Close timeframe popup"
              >
                × Close
              </button>
            </div>

            <div className="dashboard-range-summary">
              {activeRangeSummary.map((item) => (
                <article key={item.label} className={`dashboard-range-summary-card ${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>

            <div className="dashboard-range-actions">
              {SUMMARY_RANGES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`dashboard-range-option ${selectedStatsRange === item.value ? 'active' : ''}`}
                  onClick={() => {
                    applyRangeSelection(item.value);
                  }}
                >
                  <span>{item.label}</span>
                  <small>{item.value === '7d' ? 'Default week view' : item.value === 'today' ? 'Today only' : item.value === 'customize' ? 'Choose your own range' : 'Preset range'}</small>
                </button>
              ))}
              {userRangeOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`dashboard-range-option ${selectedStatsRange === item.baseValue ? 'active' : ''}`}
                  onClick={() => applyRangeSelection(item.baseValue || '7d')}
                >
                  <span>{item.label}</span>
                  <small>Custom saved option</small>
                </button>
              ))}
              <button type="button" className="dashboard-range-option dashboard-range-option-add" onClick={addRangeOption}>
                <span>Add Option</span>
                <small>Save a new quick range</small>
              </button>
            </div>

            <div className="dashboard-range-chart">
              <div className="dashboard-range-chart-head">
                <strong>Day Wise Analytics</strong>
                <span>{reportRangeLabel}</span>
              </div>
              <div className="dashboard-range-chart-list">
                {rangeDayAnalytics.length ? (
                  rangeDayAnalytics.map((item) => (
                    <div key={`${item.date}-${item.count}`} className="dashboard-range-chart-row">
                      <span>{item.date}</span>
                      <div className="dashboard-range-chart-bar">
                        <i style={{ width: `${Math.min(100, Math.max(8, item.count * 4))}%` }} />
                      </div>
                      <strong>{item.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="dashboard-range-empty">No daily analytics available yet.</p>
                )}
              </div>
            </div>
              </div>
            </div>,
            document.body
          )
        : null}
      {showCustomRangePopup && typeof window !== 'undefined'
        ? createPortal(
            <div className="dashboard-popup-backdrop" onClick={() => setShowCustomRangePopup(false)}>
              <div className="dashboard-popup-card dashboard-range-popup" onClick={(event) => event.stopPropagation()}>
            <div className="dashboard-popup-head">
              <div>
                <strong>Custom Date Range</strong>
                <p>Pick a start date and end date for day-wise analytics.</p>
              </div>
              <button
                type="button"
                className="dashboard-popup-close"
                onClick={() => setShowCustomRangePopup(false)}
                aria-label="Close custom range popup"
              >
                × Close
              </button>
            </div>
            <div className="dashboard-range-summary">
              <article className="dashboard-range-summary-card total">
                <span>Current Mode</span>
                <strong>{getRangeLabel(selectedStatsRange)}</strong>
              </article>
              <article className="dashboard-range-summary-card sent">
                <span>Start</span>
                <strong>{customStatsStartDate || 'Pick a date'}</strong>
              </article>
              <article className="dashboard-range-summary-card pending">
                <span>End</span>
                <strong>{customStatsEndDate || 'Pick a date'}</strong>
              </article>
              <article className="dashboard-range-summary-card failed">
                <span>Preview</span>
                <strong>{customStatsStartDate && customStatsEndDate ? `${customStatsStartDate} - ${customStatsEndDate}` : 'Select both dates'}</strong>
              </article>
            </div>
            <div className="dashboard-range-actions">
              <label className="dashboard-range-option dashboard-range-option-input">
                <span>Start Date</span>
                <input
                  type="date"
                  value={customStatsStartDate}
                  onChange={(event) => setCustomStatsStartDate(event.target.value)}
                />
              </label>
              <label className="dashboard-range-option dashboard-range-option-input">
                <span>End Date</span>
                <input
                  type="date"
                  value={customStatsEndDate}
                  onChange={(event) => setCustomStatsEndDate(event.target.value)}
                />
              </label>
            </div>
            <div className="dashboard-range-popup-actions">
              <button type="button" className="ghost subtle" onClick={() => setShowCustomRangePopup(false)}>Cancel</button>
              <button type="button" className="dashboard-popup-save" onClick={applyCustomRangeSelection}>Apply Range</button>
            </div>
              </div>
            </div>,
            document.body
          )
        : null}
      {toast ? (
        <div className={`dashboard-toast dashboard-toast-${toast.tone}`} role="status" aria-live="polite">
          <div>
            <strong>{toast.tone === 'error' ? 'Action failed' : toast.tone === 'success' ? 'Action completed' : 'Notification'}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="dashboard-toast-close" onClick={() => setToast(null)} aria-label="Close notification">
            × Close
          </button>
        </div>
      ) : null}

      {error && error !== 'Request timeout: /api/stats' ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}

      <PremiumDashboardShell
        reportDateLabel={reportDateLabel}
        reportRangeLabel={reportRangeLabel}
          reportMetricCards={reportMetricCards}
          dailyMailCounts={stats.dailyMailCounts}
          workflowSteps={workflowSteps}
          completionRate={completionRate}
        totalTrackedMails={totalTrackedMails}
        notificationCards={notificationCards}
        timelineCards={timelineCards}
        timelineTaskStates={profileTimelineTasks}
        onTimelineTaskStatesChange={handleTimelineTaskStateChange}
        timelineCustomTasks={profileTimelineCustomTasks}
        onTimelineCustomTaskAdd={handleTimelineCustomTaskAdd}
        performanceCampaigns={performanceCampaigns}
        calendarDays={calendarDays}
        selectedAccountLabel={selectedAccountLabel}
        senderAccounts={projectAccounts}
        selectedSenderAccountId={selectedAccount}
        onSelectSenderAccount={(accountId) => {
          setSelectedAccount(accountId);
          const nextAccount = projectAccounts.find((account) => account.id === accountId);
          setActiveAccount(nextAccount?.from || '');
        }}
        project={project}
        barChartMetrics={barChartMetrics}
        logs={logs}
        activeCampaign={activeCampaign}
        activeCampaignProgressText={progressText}
        lists={lists}
        selectedListId={selectedListId}
        selectedListName={selectedListName}
        previewRows={preview}
        previewColumns={previewColumns}
        onPreviewCellChange={updatePreviewCell}
        onPreviewAddRow={addPreviewRow}
        onPreviewAddColumn={addPreviewColumn}
        onPreviewDeleteRow={deletePreviewRow}
        onPreviewDeleteColumn={deletePreviewColumn}
        onPreviewRenameColumn={renamePreviewColumn}
        onPreviewSave={savePreviewEdits}
        previewDirty={previewDirty}
        onUploadFile={onUpload}
        onSelectList={setSelectedListId}
        draftOptions={savedDrafts}
        activeDraftId={activeSavedDraftId || ''}
        onSelectSavedDraft={handleSavedDraftSelectById}
        onSaveDraft={saveCurrentDraftScript}
        draftSubject={draftSubject}
        onDraftSubjectChange={setDraftSubject}
        draftBody={draftBody}
        onDraftBodyChange={setDraftBody}
        testEmailTo={testEmailTo}
        onTestEmailToChange={setTestEmailTo}
        onSendTestEmail={sendTestEmail}
        campaignName={campaignName}
        onCampaignNameChange={setCampaignName}
        selectedDraftType={selectedDraft}
        onSelectedDraftTypeChange={setSelectedDraft}
        onOpenReportRangePopup={() => setShowCustomRangePopup(true)}
        onApplyReportRange={applyRangeSelection}
        batchSize={batchSize}
        onBatchSizeChange={setBatchSize}
        delaySeconds={delaySeconds}
        onDelaySecondsChange={setDelaySeconds}
        initialScheduleMode={scheduleMode}
        initialScheduledDateValue={scheduledDateValue}
        initialScheduledTimeValue={scheduledTimeValue}
        initialScheduleTimezone={scheduleTimezone}
        initialDurationUnit={durationUnit}
        onCreateCampaign={createCampaign}
        scheduledCountry={
          String(scheduledCountry || '').toLowerCase() === 'usa'
            ? 'USA'
            : String(scheduledCountry || '').toLowerCase() === 'uk'
              ? 'UK'
              : String(scheduledCountry || '').toLowerCase() === 'uae'
                ? 'UAE'
                : String(scheduledCountry || '').charAt(0).toUpperCase() + String(scheduledCountry || '').slice(1)
        }
        onScheduledCountryChange={(value) => {
          setScheduledCountry(String(value || '').toLowerCase());
          setScheduledSlot('');
        }}
        scheduledSlot={scheduledSlot}
        onScheduledSlotChange={setScheduledSlot}
        manualScheduledSlot={manualScheduledSlot}
        onManualScheduledSlotChange={setManualScheduledSlot}
        onApplyManualScheduledSlot={applyPremiumShellScheduledTime}
        onSaveSchedule={saveCampaignSchedule}
        onStartCampaign={createAndStartCampaign}
        onPauseCampaign={pauseCampaign}
        onResumeCampaign={resumeCampaign}
        onStopCampaign={stopCampaign}
        onDeleteCampaign={deleteCampaign}
          onShowMessage={notify}
          creditSummary={profileCredits}
          targetApprovalStatus={profileCredits.targetApprovalStatus}
          targetApprovalRequestedAt={profileCredits.targetApprovalRequestedAt}
          targetApprovalReviewedAt={profileCredits.targetApprovalReviewedAt}
          targetApprovalReviewer={profileCredits.targetApprovalReviewer}
          targetApprovalRequestNote={profileCredits.targetApprovalRequestNote}
        />

      {showSidebarBlankView ? (
        <section className="grid" id="summary-panel">
          <div
            style={{
              minHeight: 'calc(100vh - 140px)',
              border: '1px solid var(--border-color)',
              borderRadius: 24,
              background: 'linear-gradient(180deg, var(--panel-strong), color-mix(in srgb, var(--panel-strong) 82%, var(--bg-secondary)))',
              boxShadow: '0 20px 44px var(--shadow-color)',
              padding: 24,
              display: 'grid',
              gap: 22,
              alignContent: 'start'
            }}
          >
            <div
              style={{
                display: 'grid',
                gap: 10,
                textAlign: 'center',
                justifyItems: 'center'
              }}
            >
              {activeSidebarView !== 'Dashboard' ? <h3 style={{ margin: 0 }}>{activeSidebarView}</h3> : null}
            </div>
            <section className="grid stats-grid">
              {fancyStats.map((item) => (
                <FancyStatCard
                  key={`blank-${item.title}`}
                  title={item.title}
                  value={item.value}
                  percent={item.percent}
                  trend={item.trend}
                  color={item.color}
                />
              ))}
            </section>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 560px))', gap: 20, alignItems: 'start' }}>
              <section
                className="card grid"
                id="upload-client-files-blank"
                style={{ margin: 0, width: '100%', justifySelf: 'start' }}
              >
                <h3>Upload Client Files</h3>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 12 }}>
                  <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={onUpload}
                      style={{ display: 'none' }}
                    />
                    <button
                      className="button"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload File
                    </button>
                    <span
                      className={`badge ${selectedListName ? 'sent' : 'failed'}`}
                      style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {selectedListName || 'No file selected'}
                    </span>
                    <div
                      ref={uploadedFilesDropdownRef}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'nowrap'
                      }}
                    >
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => setShowUploadedFilesDropdown((prev) => !prev)}
                        style={{ minWidth: 128, flexShrink: 0 }}
                      >
                        Uploaded Files
                      </button>
                      {showUploadedFilesDropdown ? (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            zIndex: 20,
                            minWidth: 320,
                            maxHeight: 200,
                            overflowY: 'auto',
                            margin: 0,
                            border: '1px solid var(--button-border)',
                            borderRadius: 10,
                            background: 'var(--panel-strong)',
                            padding: 8,
                            boxShadow: '0 12px 30px var(--shadow-color)'
                          }}
                        >
                          {lists.length ? (
                            lists.map((list) => (
                              <label
                                key={`blank-${list._id}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  padding: '6px 4px',
                                  cursor: 'pointer',
                                  borderRadius: 6,
                                  background: selectedListId === list._id ? 'color-mix(in srgb, var(--accent) 12%, var(--panel-strong))' : 'transparent'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedUploadedFileIds.includes(list._id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUploadedFileIds((prev) => [...new Set([...prev, list._id])]);
                                    } else {
                                      setSelectedUploadedFileIds((prev) => prev.filter((id) => id !== list._id));
                                    }
                                  }}
                                />
                                <span onClick={() => setSelectedListId(list._id)} style={{ flex: 1 }}>
                                  {list.name}
                                </span>
                              </label>
                            ))
                          ) : (
                            <p>No uploaded files</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                    {loading ? <p>Uploading...</p> : null}
                  </div>
                </div>
                {preview.length ? (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 12, overflow: 'hidden' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <p>Uploaded file preview</p>
                      <div className="row">
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => setShowUploadPreview((prev) => !prev)}
                        >
                          {showUploadPreview ? 'Minimize Table' : 'Show Table'}
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={normalizeSelectedListEmails}
                        >
                          Normalize Emails List
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
              <section
                className="card grid"
                id="campaign-management-blank"
                style={{ margin: 0, width: '100%', justifySelf: 'start', alignSelf: 'start', paddingTop: 14, paddingBottom: 14, minHeight: 0 }}
              >
                <div style={{ display: 'grid', gap: 8 }}>
                  <div>
                    <input className="input" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign Name" />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Campaign Type</p>
                    <select
                      className="select"
                      style={{ width: '50%', minWidth: 140 }}
                      value={selectedDraft}
                      onChange={(e) => setSelectedDraft(e.target.value)}
                    >
                      <option value="cover_story">Cover Story</option>
                      <option value="reminder">Reminder</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="updated_cost">Updated Cost</option>
                      <option value="final_cost">Final Call</option>
                    </select>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: isReplyModeCampaignType ? 'var(--success)' : 'var(--muted)', fontWeight: 600 }}>
                      Reply Mode: {isReplyModeCampaignType ? 'ON (Reply All in thread)' : 'OFF (New Email)'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600 }}>List</p>
                    <span className={`badge ${selectedListId ? 'sent' : 'failed'}`} style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedListLabel}
                    </span>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Batch Size</p>
                      <input className="input" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} placeholder="Enter number of emails per cycle" />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Delay (Seconds)</p>
                      <input className="input" type="number" min="60" value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} placeholder="Delay(s)" />
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 2 }}>
                    <button className="button" onClick={createAndStartCampaign}>Create Campaign</button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      ) : null}

      </div>
    </main>
  );
}







