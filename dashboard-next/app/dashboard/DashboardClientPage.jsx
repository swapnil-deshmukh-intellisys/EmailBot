'use client';

import { createPortal } from 'react-dom';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
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
  normalizeScheduleDateValue,
  normalizeScheduledSlotInput
} from '@/modules/campaign-module/campaign-utils/CampaignScheduleHelper';
import { buildWordPadTableHtml } from '@/modules/draft-module/draft-utils/DraftWordPadTableBuilder';
import draftTemplates from '@/modules/template-module/template-services/DashboardDraftTemplateLibrary';
import { TEMP_LOGIN_ACCOUNTS } from '../lib/dashboardRoles';
import { inferDraftTypeFromDraft, normalizeDraftType } from '@/app/lib/draftTypes';
import { buildEmailHtml } from '../../components/email/EmailRenderingSystem';
import PremiumDashboardShell from './components/PremiumDashboardShell';
// import ScriptManager from "../dashboard/ScriptManager";

const DashboardStats = dynamic(() => import('@/modules/analytics-module/analytics-components/DashboardStatsOverview'));
const CampaignTable = dynamic(() => import('@/modules/campaign-module/campaign-components/CampaignExecutionTable'));
const LeadList = dynamic(() => import('@/modules/lead-module/lead-components/LeadUploadPreviewList'));
const ActivityPanel = dynamic(() => import('@/modules/analytics-module/analytics-components/DashboardActivityPanel'));

const MIN_CAMPAIGN_SEND_GAP_SECONDS = 60;

function isRowRangeInputValid(value = '') {
  const match = String(value || '').trim().match(/^\[?\s*(\d+)\s*-\s*(\d+)\s*\]?$/);
  if (!match) return false;
  return Number(match[1]) <= Number(match[2]);
}
const MAX_SCHEDULE_DELAY_MINUTES = 1440;
const MAX_SCHEDULE_DELAY_HOURS = 24;
const MAX_SCHEDULE_DELAY_SECONDS = 86400;

function useBreakpoint() {
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return useMemo(() => {
    if (width >= 1200) return { width, name: 'desktop' };
    if (width >= 768) return { width, name: 'tablet' };
    return { width, name: 'mobile' };
  }, [width]);
}

function getScheduleDelayLimit(unit = 'minutes') {
  const normalizedUnit = normalizeDurationUnit(unit);
  if (normalizedUnit === 'hours') return MAX_SCHEDULE_DELAY_HOURS;
  if (normalizedUnit === 'seconds') return MAX_SCHEDULE_DELAY_SECONDS;
  return MAX_SCHEDULE_DELAY_MINUTES;
}

function FancyStatCardLegacy({ title, value, percent = 0, trend = 0, color = '#2563eb' }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const positive = trend >= 0;
  return (
    <div className="fancy-stat-card">
      <div className="fancy-stat-top">
        <span className={`fancy-stat-badge ${positive ? 'up' : 'down'}`}>
          {positive ? 'â†‘' : 'â†“'} {Math.abs(trend).toFixed(1)}%
        </span>
        <span className="fancy-stat-menu">â‹¯</span>
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
const LIVE_CAMPAIGN_STATUSES = new Set(['Queued', 'Running', 'Scheduled']);

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
  return `<div style="font-family:Inter, 'Segoe UI', Arial, sans-serif;font-size:15px;line-height:1.6;">${html}</div>`;
}

function normalizeEmailDraftHtml(value = '') {
  const input = String(value || '').trim();
  if (!input) return '';
  return buildEmailHtml(/<[a-z][\s\S]*>/i.test(input) ? input : normalizeDraftBody(input));
}

function normalizeDraft(draft = {}) {
  const draftType = inferDraftTypeFromDraft(draft);
  const savedAt = draft?.updatedAt || draft?.createdAt || '';
  const savedDate = savedAt ? new Date(savedAt).toLocaleDateString() : 'No saved date';
  const savedTime = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No saved time';
  return {
    ...draft,
    category: draftType,
    draftType,
    sector: String(draft?.sector || ''),
    city: String(draft?.city || ''),
    project: String(draft?.project || ''),
    campaignName: String(draft?.campaignName || draft?.campaign || ''),
    savedDate,
    savedTime,
    updated: savedAt ? new Date(savedAt).toLocaleString() : 'Saved draft',
    subject: String(draft?.subject || ''),
    bodyHtml: normalizeEmailDraftHtml(draft?.bodyHtml || draft?.html || draft?.body || ''),
    bodyText: String(draft?.bodyText || ''),
    body: normalizeEmailDraftHtml(draft?.bodyHtml || draft?.html || draft?.body || '')
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

const normalizeEmail = (value = '') => String(value || '').toLowerCase();
const CONNECTED_SENDER_STATUSES = new Set(['connected', 'active', 'good', 'verified']);

function isGraphAppSenderAccount(account = {}) {
  const id = String(account?.id || '').toLowerCase();
  const provider = String(account?.provider || '').toLowerCase();
  const label = String(account?.label || '').toLowerCase();
  return provider === 'graph' && (id === 'outlook-graph' || id.startsWith('graphapp:') || label.includes('graph app'));
}

function isUsableSenderAccount(account = {}) {
  if (!account) return false;
  if (isGraphAppSenderAccount(account)) return true;
  const status = String(account?.status || '').trim().toLowerCase();
  return !status || CONNECTED_SENDER_STATUSES.has(status);
}

const inferProjectKeyFromCampaign = (campaign = {}, fallbackProject = '') => {
  const rawProject = String(
    campaign?.project ||
    campaign?.projectId ||
    campaign?.projectName ||
    campaign?.meta?.project ||
    campaign?.meta?.projectId ||
    campaign?.meta?.projectName ||
    ''
  ).trim().toLowerCase();

  if (rawProject === 'tec' || rawProject.includes('entrepreneurial')) return 'TEC';
  if (rawProject === 'tut' || rawProject.includes('unicorn')) return 'TUT';

  const senderEmail = String(
    campaign?.senderFrom ||
    campaign?.senderAccount?.from ||
    campaign?.senderAccount?.user ||
    campaign?.senderEmail ||
    campaign?.sender ||
    campaign?.from ||
    ''
  ).trim().toLowerCase();

  if (senderEmail.endsWith('@theentrepreneurialchronicle.com')) return 'TEC';
  if (senderEmail.endsWith('@theunicorntimes.com')) return 'TUT';

  const fallback = String(fallbackProject || '').trim().toLowerCase();
  if (fallback === 'tec' || fallback.includes('entrepreneurial')) return 'TEC';
  if (fallback === 'tut' || fallback.includes('unicorn')) return 'TUT';

  return 'TEC';
};

const buildCampaignBroadcastCode = (campaign = {}, projectKey = 'TEC', index = 0) => {
  const fallbackCode = `${projectKey}-${String(index + 1).padStart(2, '0')}`;
  const rawCode = String(campaign?.broadcast || campaign?.code || '').trim();
  if (!rawCode) return fallbackCode;

  const existing = rawCode.match(/^(TEC|TUT)-(.+)$/i);
  if (!existing) return rawCode;

  const rawPrefix = existing[1].toUpperCase();
  const suffix = existing[2];
  return rawPrefix === projectKey ? `${rawPrefix}-${suffix}` : `${projectKey}-${suffix}`;
};

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
  const searchParams = useSearchParams();
  const breakpoint = useBreakpoint();
  const isMobileViewport = breakpoint.name === 'mobile';
  const defaultProjectOptions = ['tec', 'tut'];
  const [isMounted, setIsMounted] = useState(false);
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
  const [rowRange, setRowRange] = useState('');
  const [loading, setLoading] = useState(false);
  const [campaignRefreshing, setCampaignRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeTopNav, setActiveTopNav] = useState('Dashboard');
  const [activeSidebarView, setActiveSidebarView] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [project, setProject] = useState('');
  const [projectOptions, setProjectOptions] = useState(defaultProjectOptions);
  const [showTopbarProjectDropdown, setShowTopbarProjectDropdown] = useState(false);
  const [showTopbarRangeDropdown, setShowTopbarRangeDropdown] = useState(false);
  const [showTopbarMailDropdown, setShowTopbarMailDropdown] = useState(false);
  const [showTopbarProfileDropdown, setShowTopbarProfileDropdown] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [userRangeOptions, setUserRangeOptions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [activeAccount, setActiveAccount] = useState('');
  const [showAllUserActivity, setShowAllUserActivity] = useState(true);
  const [profileUser, setProfileUser] = useState({ email: '', role: '', displayName: '' });
  const [profileAvatarDataUrl, setProfileAvatarDataUrl] = useState('');
  const [profileCredits, setProfileCredits] = useState({
      planName: 'Basic',
      upgradeTargetPlan: 'Starter',
      upgradeTargetCredits: 2000,
      monthlyLimit: 300,
      totalCredits: 300,
      usedCredits: 0,
      remainingCredits: 300,
      usagePercentage: 0,
      creditUsagePercent: 0,
      dailyLimit: 500,
      dailyUsedCredits: 0,
      dailyRemainingCredits: 500,
      dailyUsagePercentage: 0,
      upgradeTargetDailyLimit: 1000,
      upgradeRequestPending: false,
      requestedUpgradePlan: null,
      status: 'active',
      warningLevel: 'healthy',
      dailyWarningLevel: 'healthy',
      sendingDisabled: false,
      targetApprovalStatus: 'approved',
      targetApprovalRequestedAt: null,
      targetApprovalReviewedAt: null,
      targetApprovalReviewer: '',
      targetApprovalRequestNote: ''
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (breakpoint.width >= 768) {
      setSidebarOpen(false);
      setShowMobileFilters(false);
    }
  }, [breakpoint.width]);
  const [creditTransactions, setCreditTransactions] = useState([]);
  const [showSubscriptionDetails, setShowSubscriptionDetails] = useState(false);
  const [subscriptionDetailsLoading, setSubscriptionDetailsLoading] = useState(false);
  const [profileTimelineTasks, setProfileTimelineTasks] = useState({});
  const [profileTimelineCustomTasks, setProfileTimelineCustomTasks] = useState([]);
  const projectAccounts = useMemo(() => {
    const filtered = filterAccountsByProject(accounts, project);
    return project ? filtered : accounts;
  }, [accounts, project]);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [selectedDraft, setSelectedDraft] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [blankWordPad, setBlankWordPad] = useState('');

  const [showAddDraft, setShowAddDraft] = useState(false);
  const [newDraftCategory, setNewDraftCategory] = useState("initial_outreach");
  const [newDraftSubject, setNewDraftSubject] = useState("");
  const [newDraftBody, setNewDraftBody] = useState("");

  const loadScript = (script) => {
    const normalized = normalizeDraft(script);
    setSelectedDraft(normalized.draftType);
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
  const [nextProcessCampaignId, setNextProcessCampaignId] = useState('');
  const [nextProcessStep, setNextProcessStep] = useState(0);
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
  const topbarProfileDropdownRef = useRef(null);
  const topbarMobileFiltersRef = useRef(null);
  const topbarProfilePhotoInputRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const loadAllRef = useRef(null);
  const campaignCreateLockRef = useRef(false);
  const lastCampaignCreateSignatureRef = useRef('');
  const lastCreatedCampaignIdRef = useRef('');
  const lastAutoAppliedDraftTypeRef = useRef('');
  const requestedListIdRef = useRef('');
  const requestedAutoUploadRef = useRef(false);
  useEffect(() => {
    requestedListIdRef.current = String(searchParams?.get('listId') || '').trim();
    requestedAutoUploadRef.current = String(searchParams?.get('autoUpload') || '').trim() === '1';
  }, [searchParams]);
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
  const handleUpgradePlan = async () => {
    try {
      const targetPlan = profileCredits.upgradeTargetPlan || 'Starter';
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName: targetPlan })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to upgrade subscription');
      }
      const summary = data.summary || {};
      const usage = Number(summary.usagePercentage ?? summary.creditUsagePercent ?? 0);
      setProfileCredits((current) => ({
        ...current,
        ...summary,
        planName: summary.planName || targetPlan,
        monthlyLimit: Number(summary.monthlyLimit || summary.totalCredits || current.monthlyLimit || 300),
        totalCredits: Number(summary.totalCredits || summary.monthlyLimit || current.totalCredits || 300),
        usagePercentage: usage,
        creditUsagePercent: usage,
        upgradeTargetPlan: summary.upgradeTargetPlan || summary.nextPlan || targetPlan
      }));
      notify(data.message || `Upgraded to ${summary.planName || targetPlan}.`, 'success');
    } catch (error) {
      notify(error.message || 'Failed to upgrade subscription', 'error');
    }
  };
  const openSubscriptionDetails = async () => {
    setShowSubscriptionDetails(true);
    setSubscriptionDetailsLoading(true);
    try {
      const response = await fetch('/api/credits', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || 'Failed to load credit details');
      }
      const summary = data.summary || {};
      const usage = Number(summary.usagePercentage ?? summary.creditUsagePercent ?? 0);
      setProfileCredits((current) => ({
        ...current,
        ...summary,
        planName: summary.planName || current.planName || 'Basic',
        monthlyLimit: Number(summary.monthlyLimit || summary.totalCredits || current.monthlyLimit || 300),
        totalCredits: Number(summary.totalCredits || summary.monthlyLimit || current.totalCredits || 300),
        usedCredits: Number(summary.usedCredits || 0),
        remainingCredits: Number(summary.remainingCredits || 0),
        usagePercentage: usage,
        creditUsagePercent: usage,
        upgradeTargetPlan: summary.upgradeTargetPlan || summary.nextPlan || current.upgradeTargetPlan || 'Starter'
      }));
      setCreditTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (error) {
      notify(error.message || 'Failed to load credit details', 'error');
    } finally {
      setSubscriptionDetailsLoading(false);
    }
  };
  const selectedAccountLabel =
    projectAccounts.find((account) => account.id === selectedAccount)?.from ||
    'Select Sender';
  const profileDisplayName = profileUser.displayName || displayNameFromEmail(profileUser.email);
  const profileInitials = initialsFromName(profileDisplayName);
  const profileRoleLabel = profileUser.role ? String(profileUser.role).replace(/_/g, ' ') : 'User';

  const handleTopbarProfilePhotoUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please select an image file.', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notify('Profile photo must be under 2 MB.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const avatarDataUrl = String(reader.result || '');
      setProfileAvatarDataUrl(avatarDataUrl);
      try {
        await safeFetchJson('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarName: file.name, avatarDataUrl })
        });
        notify('Profile photo saved.', 'success');
      } catch (error) {
        notify(error.message || 'Profile photo save failed.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

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
    if (!draftId) {
      setActiveSavedDraftId(null);
      return;
    }
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

  const normalizeScheduleConfigInput = (input = {}) => (
    input && typeof input === 'object' && !('nativeEvent' in input) ? input : {}
  );

  const prepareScheduleConfig = (input = {}) => {
    input = normalizeScheduleConfigInput(input);
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
    const nextDateValue = normalizeScheduleDateValue(input.scheduledDate || scheduledDateValue || '');
    const nextTimeValue = String(input.scheduledTime || scheduledTimeValue || '').trim();
    const nextDurationUnit = normalizeDurationUnit(input.durationUnit || durationUnit || 'seconds');
    const nextBatchSize = Math.max(1, Math.floor(Number(input.batchSize ?? batchSize ?? 1) || 1));
    const nextRowRange = String(input.rowRange ?? rowRange ?? '').trim();
    const parsedDelayInterval = Math.min(
      getScheduleDelayLimit(nextDurationUnit),
      Math.max(1, Math.floor(Number(input.delayInterval ?? delaySeconds ?? MIN_CAMPAIGN_SEND_GAP_SECONDS) || MIN_CAMPAIGN_SEND_GAP_SECONDS))
    );
    const nextDelaySeconds = Math.max(
      MIN_CAMPAIGN_SEND_GAP_SECONDS,
      convertDelayIntervalToSeconds(parsedDelayInterval, nextDurationUnit)
    );
    const nextDelayInterval = nextDurationUnit === 'seconds'
      ? Math.max(MIN_CAMPAIGN_SEND_GAP_SECONDS, parsedDelayInterval)
      : parsedDelayInterval;
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
      rowRange: nextRowRange,
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

  const selectTopbarRange = async (value) => {
    handleStatsRangeSelection(value);
    setShowTopbarRangeDropdown(false);
    await loadAll({
      selectedStatsDate: '',
      selectedStatsRange: value,
      customStatsStartDate: '',
      customStatsEndDate: ''
    });
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

  const applyRangeSelection = async (value) => {
    if (value === 'customize') {
      setShowTopbarRangeDropdown(false);
      setShowCustomRangePopup(true);
      return;
    }
    if (value.startsWith('custom-')) {
      setSelectedStatsRange(value);
      setSelectedStatsDate('');
      setShowDayCounts(true);
      setShowTopbarRangeDropdown(false);
      await loadAll({
        selectedStatsDate: '',
        selectedStatsRange: value,
        customStatsStartDate: '',
        customStatsEndDate: ''
      });
      notify(`Selected ${getRangeLabel(value)}.`, 'success');
      return;
    }
    await selectTopbarRange(value);
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
    notify(`Active sender set to ${selectedMail?.from || 'selected account'}.`, 'success');
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
      notify('Uploaded file opened in Edit Content.', 'success');
    } catch (e) {
      notify(e.message || 'Failed to load uploaded file into Edit Content', 'error');
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
        setRowRange('');
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
      if (saved.nextProcessMode) {
        setNextProcessCampaignId(String(saved.nextProcessSourceCampaignId || saved._id || ''));
        setNextProcessStep(Number(saved.nextProcessStep || saved.workflowStep || 0) || 0);
        setPendingCampaignId('');
      }
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
        const [profileRes, creditsRes] = await Promise.all([
          fetch('/api/auth/me', { signal: controller.signal }),
          fetch('/api/credits', { signal: controller.signal })
        ]);
        if (!profileRes.ok) return;
        const data = await profileRes.json().catch(() => null);
        const creditsData = creditsRes.ok ? await creditsRes.json().catch(() => null) : null;
        setCreditTransactions(Array.isArray(creditsData?.transactions) ? creditsData.transactions : []);
        const user = data?.user || {};
        const profile = data?.profile || {};
        setProfileUser({
          email: String(user.email || '').trim(),
          role: String(user.role || '').trim(),
          displayName: String(profile.displayName || '').trim()
        });
        setProfileAvatarDataUrl(String(profile.avatarDataUrl || '').trim());
        const creditSummary = creditsData?.summary || {};
        const totalCredits = Math.max(0, Number(creditSummary.monthlyLimit || creditSummary.totalCredits || profile.totalCredits || 300));
        const usedCredits = Math.max(0, Number(creditSummary.usedCredits || profile.usedCredits || 0));
        const remainingCredits = Math.max(0, Number(creditSummary.remainingCredits ?? profile.remainingCredits ?? Math.max(totalCredits - usedCredits, 0)));
        const creditUsagePercent = Math.max(0, Math.min(100, Number(creditSummary.usagePercentage ?? creditSummary.creditUsagePercent ?? profile.creditUsagePercent ?? (totalCredits ? (usedCredits / totalCredits) * 100 : 0))));
        const dailyLimit = Math.max(1, Number(creditSummary.dailyLimit || 500));
        const dailyUsedCredits = Math.max(0, Number(creditSummary.usedToday ?? creditSummary.dailyUsedCredits ?? 0));
        const dailyRemainingCredits = Math.max(0, Number(creditSummary.remainingToday ?? creditSummary.dailyRemainingCredits ?? Math.max(dailyLimit - dailyUsedCredits, 0)));
        const dailyUsagePercentage = Math.max(0, Math.min(100, Number(creditSummary.dailyUsagePercentage ?? (dailyLimit ? (dailyUsedCredits / dailyLimit) * 100 : 0))));
          setProfileCredits({
            planName: String(creditSummary.planName || profile.planName || 'Basic').trim() || 'Basic',
            upgradeTargetPlan: String(creditSummary.upgradeTargetPlan || creditSummary.nextPlan || 'Starter').trim() || 'Starter',
            upgradeTargetCredits: Number(creditSummary.upgradeTargetCredits || 2000),
            monthlyLimit: totalCredits,
            totalCredits,
            usedCredits,
            remainingCredits,
            usagePercentage: creditUsagePercent,
            creditUsagePercent,
            dailyLimit,
            dailyUsedCredits,
            dailyRemainingCredits,
            dailyUsagePercentage,
            upgradeRequestPending: Boolean(creditSummary.upgradeRequestPending),
            requestedUpgradePlan: creditSummary.requestedUpgradePlan || null,
            pendingUpgradeRequestId: creditSummary.pendingUpgradeRequestId || null,
            upgradeTargetDailyLimit: Number(creditSummary.upgradeTargetDailyLimit || dailyLimit),
            renewalDate: creditSummary.renewalDate || null,
            status: String(creditSummary.status || 'active').trim() || 'active',
            warningLevel: String(creditSummary.warningLevel || 'healthy').trim() || 'healthy',
            dailyWarningLevel: String(creditSummary.dailyWarningLevel || 'healthy').trim() || 'healthy',
            sendingDisabled: Boolean(creditSummary.sendingDisabled),
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
      rowRange,
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
    rowRange,
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
        category: normalizeDraftType(newDraftCategory),
        draftType: normalizeDraftType(newDraftCategory),
        title: baseTitle,
        campaignName,
        project: String(project || '').trim().toLowerCase(),
        subject: newDraftSubject,
        body: normalizeEmailDraftHtml(newDraftBody),
        bodyHtml: normalizeEmailDraftHtml(newDraftBody),
        bodyText: ''
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
      notify('Draft added successfully.', 'success');
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
    const category = normalizeDraftType(newDraftCategory || selectedDraft || 'initial_outreach');
    setNewDraftCategory(category);
    setNewDraftTitle(changeInDraftValue || '');
    setNewDraftSubject('');
    setNewDraftBody('');
    setShowAddDraft(true);
  };

  const saveCurrentDraftScript = async () => {
    if (!draftSubject || !draftBody) {
      notify('Please enter subject and draft body.', 'info');
      return { ok: false };
    }

    try {
      if (!String(selectedDraft || '').trim()) {
        notify('Select a draft type before saving.', 'info');
        return { ok: false };
      }
      const category = normalizeDraftType(selectedDraft);
      const activeDraft = activeSavedDraftId
        ? savedDrafts.find((draft) => String(draft._id || draft.id || '') === String(activeSavedDraftId))
        : null;
      const count = savedDrafts.filter((d) => d.category === category).length;
      const baseTitle = changeInDraftValue
        ? changeInDraftValue
        : activeDraft?.title || `${DRAFT_CATEGORIES.find((c) => c.value === category)?.label || category} Draft ${count + 1}`;
      const payload = {
        category,
        draftType: category,
        title: baseTitle,
        campaignName: activeDraft?.campaignName || campaignName,
        project: String(activeDraft?.project || project || '').trim().toLowerCase(),
        sector: activeDraft?.sector || '',
        country: activeDraft?.country || '',
        city: activeDraft?.city || '',
        subject: draftSubject,
        body: normalizeEmailDraftHtml(draftBody),
        bodyHtml: normalizeEmailDraftHtml(draftBody),
        bodyText: ''
      };
      const isUpdatingExistingDraft = Boolean(
        activeDraft &&
        activeSavedDraftId &&
        /^[0-9a-f]{24}$/i.test(String(activeSavedDraftId))
      );

      const result = await safeFetchJson(isUpdatingExistingDraft ? `/api/drafts/${activeSavedDraftId}` : '/api/drafts', {
        method: isUpdatingExistingDraft ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setSavedDraftFilterCategory(category);
      await loadSavedDrafts();
      if (!isUpdatingExistingDraft && result?.draft?._id) {
        setActiveSavedDraftId(result.draft._id);
      }
      notify(isUpdatingExistingDraft ? 'Draft updated successfully.' : 'Draft added successfully.', 'success');
      return { ok: true };
    } catch (err) {
      notify(err.message || 'Failed to save draft', 'error');
      throw err;
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
  useEffect(() => {
    const sheetName = String(selectedListName || '').trim();
    if (!sheetName || String(campaignName || '').trim()) return;
    setCampaignName(`${sheetName} Campaign`);
  }, [campaignName, selectedListName]);
  const selectedListLabel = useMemo(() => {
    const selectedList = lists.find((list) => list._id === selectedListId);
    if (!selectedList) return 'Select List';
    return `${selectedList.name} (${selectedList.leadCount || 0})`;
  }, [lists, selectedListId]);
  useEffect(() => {
    const requestedListId = requestedListIdRef.current;
    if (!requestedListId || selectedListId) return;
    const exists = lists.some((list) => String(list?._id) === requestedListId);
    if (exists) {
      setSelectedListId(requestedListId);
    }
  }, [lists, selectedListId]);

  useEffect(() => {
    if (!requestedAutoUploadRef.current) return;
    if (!selectedListId) return;
    setShowUploadPreview(true);
    notify('Sheet uploaded automatically. Continue with sender and create campaign.', 'success');
    requestedAutoUploadRef.current = false;
  }, [selectedListId]);
  const searchableSectionText = useMemo(
    () => ({
      summary: `summary filter project client active project working mail select mail id quick range starting date today total mails sent pending failed ${project} ${selectedAccountLabel} ${(stats.dailyMailCounts || []).map((item) => `${item.date} ${item.count}`).join(' ')}`,
      upload: `upload client files uploaded file preview show table normalize emails list add column add row save changes ${selectedListName} ${lists.map((list) => list.name).join(' ')}`,
      campaignManagement: `campaign management campaign name campaign type client list batch size delay seconds create campaign ${campaignName} ${selectedDraft} ${selectedListName}`,
      draftEditing: `draft editing and setting select draft type draft name save draft uploaded files choose uploaded file saved drafts edit content draft email body subject line test email ${draftSubject} ${changeInDraftValue} ${savedDrafts.map((draft) => `${draft.title} ${draft.category}`).join(' ')}`,
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
    selectedStatsRange === 'customize' && customStatsStartDate && customStatsEndDate
      ? `${customStatsStartDate} - ${customStatsEndDate}`
      : selectedStatsRange
        ? buildRangeDateLabel(selectedStatsRange)
        : 'Select Date';
  const activeRangeSummary = useMemo(() => [
    { label: 'Total', value: Number(stats?.total || 0).toLocaleString(), tone: 'total' },
    { label: 'Sent', value: Number(stats?.sent || 0).toLocaleString(), tone: 'sent' },
    { label: 'Pending', value: Number(stats?.pending || 0).toLocaleString(), tone: 'pending' },
    { label: 'Failed', value: Number(stats?.failed || 0).toLocaleString(), tone: 'failed' }
  ], [stats?.failed, stats?.pending, stats?.sent, stats?.total]);
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
      title: 'Total emails',
      value: Number(stats?.total || 0),
      percent: 100,
      meta: 'All emails',
      tone: 'total',
      color: '#f59e0b',
      icon: 'â—‰'
    },
    {
      title: 'Delivered',
      value: Number(stats?.sent || 0),
      percent: completionRate,
      meta: 'Delivered',
      tone: 'sent',
      color: '#4f46e5',
      icon: 'âœ“'
    },
    {
      title: 'Waiting to send',
      value: Number(stats?.pending || 0),
      percent: Math.round((Number(stats?.pending || 0) / safeTrackedMails) * 100),
      meta: 'Waiting to send',
      tone: 'pending',
      color: '#3b82f6',
      icon: 'â—”'
    },
    {
      title: 'Failed',
      value: Number(stats?.failed || 0),
      percent: Math.round((Number(stats?.failed || 0) / safeTrackedMails) * 100),
      meta: 'Failed',
      tone: 'failed',
      color: '#ef4444',
      icon: 'âœ–'
    },
    {
      title: 'Bounced',
      value: Number(stats?.bounced || 0),
      percent: Math.round((Number(stats?.bounced || 0) / safeTrackedMails) * 100),
      meta: 'Bounced',
      tone: 'bounced',
      color: '#14b8a6',
      icon: 'â†º'
    },
    {
      title: 'Spam',
      value: Number(stats?.spam || 0),
      percent: Math.round((Number(stats?.spam || 0) / safeTrackedMails) * 100),
      meta: 'Spam',
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
  const timelineCards = useMemo(() => {
    const sourceCampaigns = Array.isArray(campaigns) ? campaigns : [];
    const campaignActivityCards = sourceCampaigns
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime() || 0;
        const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      })
      .flatMap((campaign, index) => {
        const rawStatus = String(campaign?.status || campaign?.tag || 'Pending').trim() || 'Pending';
        const normalizedStatus = rawStatus.toLowerCase();
        const campaignName = String(campaign?.name || campaign?.campaignName || `Campaign ${index + 1}`).trim();
        const eventDate = campaign?.updatedAt || campaign?.createdAt || new Date();
        const date = new Date(eventDate);
        const dateLabel = Number.isNaN(date.getTime()) ? new Date().toLocaleDateString('en-GB') : date.toLocaleDateString('en-GB');
        const timeLabel = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const total = Number(campaign?.stats?.total || campaign?.totalRecipients || campaign?.total || 0);
        const sent = Number(campaign?.sentCount ?? campaign?.stats?.sent ?? 0);
        const failed = Number(campaign?.failedCount ?? campaign?.stats?.failed ?? 0);
        const pending = Number(campaign?.pendingCount ?? campaign?.stats?.pending ?? Math.max(total - sent - failed, 0));
        const statusType =
          normalizedStatus === 'paused' ? 'Paused' :
          normalizedStatus === 'completed' ? 'Completed' :
          normalizedStatus === 'failed' ? 'Failed' :
          normalizedStatus === 'draft' ? 'Draft' :
          pending > 0 ? 'Pending' :
          ACTIVE_CAMPAIGN_STATUSES.has(rawStatus) ? 'Active' :
          rawStatus;
        const cards = [{
          id: `campaign-activity-${campaign?._id || campaign?.id || index}`,
          date: dateLabel,
          time: timeLabel,
          title: `${statusType}: ${campaignName}`,
          type: statusType,
          text: `${sent} sent, ${pending} pending, ${failed} failed${total ? ` out of ${total}` : ''}.`,
          status: normalizedStatus === 'completed' ? 'done' : normalizedStatus === 'failed' ? 'failed' : 'pending',
          done: normalizedStatus === 'completed'
        }];
        if (pending > 0 && normalizedStatus !== 'completed') {
          cards.push({
            id: `campaign-pending-${campaign?._id || campaign?.id || index}`,
            date: dateLabel,
            time: timeLabel,
            title: `Pending mails: ${campaignName}`,
            type: 'Pending',
            text: `${pending} mails pending. Use campaign actions to pause, resume, or stop sending.`,
            status: 'pending',
            done: false
          });
        }
        return cards;
      });

    if (campaignActivityCards.length) return campaignActivityCards.slice(0, 16);

    return [{
      id: 'timeline-pipeline-empty',
      date: new Date().toLocaleDateString('en-GB'),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: 'No campaign activity yet',
      type: 'Pending',
      text: 'Start or schedule a campaign to populate active, pending, paused, completed, and failed activity.',
      status: 'pending',
      done: false
    }];
  }, [campaigns]);
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
    .map((campaign, index) => {
    const total = Number(campaign?.stats?.total || 0);
    const sent = Number(campaign?.sentCount ?? campaign?.stats?.sent ?? 0);
    const failed = Number(campaign?.failedCount ?? campaign?.stats?.failed ?? 0);
    const pending = Number(campaign?.pendingCount ?? campaign?.stats?.pending ?? Math.max(total - sent - failed, 0));
    const opened = Number(campaign?.stats?.opened || campaign?.stats?.opens || campaign?.trackingStats?.openCount || 0);
    const bounced = Number(campaign?.stats?.bounced || campaign?.stats?.bounce || 0);
    const spam = Number(campaign?.stats?.spam || 0);
    const campaignProjectKey = inferProjectKeyFromCampaign(campaign, project);
    const senderEmail = String(
      campaign?.senderFrom ||
      campaign?.senderAccount?.from ||
      campaign?.senderAccount?.user ||
      campaign?.senderEmail ||
      campaign?.sender ||
      campaign?.from ||
      ''
    ).trim();
    const senderName = senderEmail ? senderEmail.split('@')[0] : '';
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
    const broadcast = buildCampaignBroadcastCode(campaign, campaignProjectKey, index);
    return {
      id: campaign?._id || index,
      srNo: index + 1,
      name: campaign?.name || `Campaign ${index + 1}`,
      status,
      publishDate: campaign?.createdAt ? new Date(campaign.createdAt).toLocaleDateString('en-GB') : '',
      scheduledDate: campaign?.scheduledAt
        ? new Date(campaign.scheduledAt).toLocaleString()
        : campaign?.schedule?.scheduledAt
          ? new Date(campaign.schedule.scheduledAt).toLocaleString()
          : [campaign?.scheduledDate || campaign?.options?.scheduledDate || campaign?.schedule?.scheduledDate, campaign?.scheduledTime || campaign?.options?.scheduledTime || campaign?.schedule?.scheduledTime].filter(Boolean).join(' ') || '-',
      createdBy: campaign?.createdBy?.email || campaign?.createdByEmail || campaign?.ownerEmail || senderEmail || '-',
      createdDate: campaign?.createdAt ? new Date(campaign.createdAt).toLocaleString() : '-',
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
      project: campaignProjectKey,
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
            next: 'If the worker does not claim it within 2 minutes, the worker is not active or the campaign is locked. Check worker status.',
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
  const workspaceOverviewItems = useMemo(() => {
    const campaignTotal = Number(campaigns?.length || 0);
    const runningCampaigns = (campaigns || []).filter((item) => String(item?.status || '').toLowerCase() === 'running').length;
    const draftCampaigns = (campaigns || []).filter((item) => String(item?.status || '').toLowerCase() === 'draft').length;
    const savedDraftTotal = Number(savedDrafts?.length || 0);
    const draftTypeTotal = new Set((savedDrafts || []).map((item) => String(item?.draftType || item?.category || '').trim()).filter(Boolean)).size;
    const clientListTotal = Number(lists?.length || 0);
    const clientRecordTotal = (lists || []).reduce((total, item) => total + Number(item?.count || item?.total || item?.rows || item?.rowCount || 0), 0);
    const sentMails = Number(stats?.sent || 0);
    const pendingMails = Number(stats?.pending || 0);
    const failedMails = Number(stats?.failed || 0);

    return [
      {
        label: 'Campaigns',
        value: String(campaignTotal),
        detail: `${runningCampaigns} running, ${draftCampaigns} draft`,
        tone: 'campaigns'
      },
      {
        label: 'Drafts',
        value: String(savedDraftTotal),
        detail: `${draftTypeTotal} draft type${draftTypeTotal === 1 ? '' : 's'} available`,
        tone: 'drafts'
      },
      {
        label: 'Clients',
        value: String(clientListTotal),
        detail: clientRecordTotal ? `${clientRecordTotal.toLocaleString()} records in lists` : 'Client lists ready',
        tone: 'clients'
      },
      {
        label: 'Mails',
        value: String(sentMails),
        detail: `${pendingMails} pending, ${failedMails} failed`,
        tone: 'mails'
      }
    ];
  }, [campaigns, lists, savedDrafts, stats?.failed, stats?.pending, stats?.sent]);
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
      if (lastAutoAppliedDraftTypeRef.current === selectedDraft) return;
      if (String(draftSubject || '').trim() || String(draftBody || '').trim()) return;
      const normalized = normalizeDraft(tpl);
      setDraftSubject(normalized.subject || "");
      setDraftBody(normalized.body || "");
      lastAutoAppliedDraftTypeRef.current = selectedDraft;
    }
  }, [selectedDraft, draftSubject, draftBody]);

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
      res = await fetch(url, {
        ...restOptions,
        signal: controller.signal,
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          ...(restOptions.headers || {})
        }
      });
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
      const message = data.message || data.error || `Request failed: ${url}`;
      const error = new Error(message);
      error.status = res.status;
      error.code = data.code || '';
      error.details = data;
      throw error;
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
    const appendLimit = (url) => {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}limit=80`;
    };
    if (showAllUserActivity) {
      return appendLimit('/api/campaigns');
    }
    const params = new URLSearchParams();
    if (project) {
      params.set('project', String(project).trim().toLowerCase());
    }
    if (selectedSenderEmail) {
      params.set('sender', selectedSenderEmail);
    }
    const qs = params.toString();
    return appendLimit(qs ? `/api/campaigns?${qs}` : '/api/campaigns');
  };

  const fetchCampaignsWithFallback = async () => {
    const primaryUrl = buildCampaignsUrl();
    console.debug('[campaign:refetch] request', { url: primaryUrl, at: new Date().toISOString() });
    const primary = await safeFetchJson(primaryUrl);
    const primaryCampaigns = primary?.campaigns || [];

    if (!showAllUserActivity && primaryCampaigns.length === 0) {
      console.debug('[campaign:refetch] fallback', { url: '/api/campaigns?limit=80', at: new Date().toISOString() });
      const fallback = await safeFetchJson('/api/campaigns?limit=80');
      return fallback?.campaigns || [];
    }

    return primaryCampaigns;
  };

  const applyCampaignPatch = (campaignId, patch = {}) => {
    if (!campaignId) return;
    setCampaigns((items) =>
      items.map((item) => {
        if (String(item?._id || item?.id || '') !== String(campaignId)) return item;
        return {
          ...item,
          ...patch,
          stats: {
            ...(item.stats || {}),
            ...(patch.stats || {})
          },
          updatedAt: patch.updatedAt || new Date().toISOString()
        };
      })
    );
  };

  const refreshCampaignData = async ({ silent = true, source = 'manual' } = {}) => {
    try {
      setCampaignRefreshing(true);
      console.debug('[campaign:refetch]', { source, silent, at: new Date().toISOString() });
      await loadLiveData();
    } finally {
      setCampaignRefreshing(false);
    }
  };

  const loadAll = async (filterOverrides = {}) => {
    try {
      const statsUrl = buildStatsUrl(filterOverrides);
      const accountsPromise = safeFetchJson('/api/accounts')
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
      if (!topbarProfileDropdownRef.current?.contains(event.target)) {
        setShowTopbarProfileDropdown(false);
      }
      if (!topbarMobileFiltersRef.current?.contains(event.target)) {
        setShowMobileFilters(false);
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
    if (historyCampaigns.length > 0) {
      setShowCampaignHistory(true);
    }
  }, [historyCampaigns.length]);


  useEffect(() => {
    const hasLiveCampaign = campaigns.some((campaign) => LIVE_CAMPAIGN_STATUSES.has(String(campaign?.status || campaign?.displayStatus || '')));
    const refreshMs = hasLiveCampaign ? 7000 : 90000;
    const id = setInterval(() => {
      void refreshCampaignData({ source: hasLiveCampaign ? 'live-poll' : 'idle-poll' });
    }, refreshMs);
    return () => clearInterval(id);
  }, [
    campaigns,
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
      const uploadData = data?.data && typeof data.data === 'object' ? data.data : data;
      if (!uploadData?.listId || !Number(uploadData?.validRows ?? uploadData?.count ?? 0)) {
        throw new Error('Upload succeeded but no valid list data was returned. Please try again.');
      }
      setLoading(false);
      setPreviewColumns(uploadData.previewColumns || []);
      setPreview(uploadData.previewRows || []);
      setPreviewPage(1);
      setPreviewStyle({ ...DEFAULT_SHEET_STYLE, ...(uploadData.sheetStyle || {}) });
      setPreviewDirty(false);
      setSelectedListId(uploadData.listId);
      await loadAll();
      notify(`File uploaded successfully. ${uploadData.validRows ?? uploadData.count} valid rows ready.`, 'success');
      return { ok: true, ...uploadData };
    } catch (e) {
      setLoading(false);
      notify(e.message || 'Upload failed', 'error');
      return { ok: false, error: e.message || 'Upload failed' };
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
      notify('Select Sender before creating a campaign.', 'info');
      return null;
    }
    const selectedAccountRecord = accounts.find((account) => account.id === selectedAccount);
    const selectedAccountStatus = String(selectedAccountRecord?.status || '').trim().toLowerCase();
    if (!selectedAccountRecord) {
      notify('Selected Mail ID was not found. Refresh accounts and select a sender again.', 'error');
      return null;
    }
    if (selectedAccountStatus && !['connected', 'active', 'good', 'verified'].includes(selectedAccountStatus)) {
      notify(`${selectedAccountRecord.from || 'Selected Mail ID'} is not connected. Connect this sender before creating a campaign.`, 'error');
      return null;
    }
    if (!selectedListId) {
      notify('Select a client list before creating a campaign.', 'info');
      return null;
    }
    if (!lists.some((list) => String(list._id || '') === String(selectedListId))) {
      notify('Selected client list was not found. Refresh and select the uploaded list again.', 'error');
      return null;
    }
    if (!String(campaignName || '').trim()) {
      notify('Enter campaign name before creating a campaign.', 'info');
      return null;
    }
    if (!String(selectedDraft || '').trim()) {
      notify('Select a draft type before creating a campaign.', 'info');
      return null;
    }
    if (!activeSavedDraftId) {
      notify('Select a saved draft before creating a campaign.', 'info');
      return null;
    }
    if (!String(draftSubject || '').trim()) {
      notify('Enter draft subject before creating a campaign.', 'info');
      return null;
    }
    if (!String(normalizeEmailDraftHtml(draftBody) || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()) {
      notify('Enter draft message before creating a campaign.', 'info');
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
        activeSavedDraftId,
        draftSubject: String(draftSubject || '').trim(),
        draftBody: normalizeEmailDraftHtml(draftBody),
        batchSize: String(batchSize || ''),
        delaySeconds: String(delaySeconds || ''),
        scheduleConfig: JSON.stringify(scheduleConfig || {}),
        workflowStep: String(workflowStep || ''),
        workflowStepLabel: String(workflowStepLabel || ''),
        tracking: JSON.stringify({
          enabled: Boolean(tracking?.enabled),
          opens: Boolean(tracking?.opens),
          clicks: Boolean(tracking?.clicks),
          replies: Boolean(tracking?.replies),
          abTesting: Boolean(tracking?.abTesting)
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
      console.info('[draft_summary_updated]', {
        source: 'campaign_create',
        draftId: activeSavedDraftId || '',
        draftType: normalizeDraftType(selectedDraft),
        subjectLength: String(draftSubject || '').length,
        htmlLength: normalizeEmailDraftHtml(draftBody).length
      });
      console.debug('[campaign:create] request', {
        url: '/api/campaigns',
        project,
        listId: selectedListId,
        senderAccountId: selectedAccount || null,
        senderFrom: selectedSenderEmail,
        workflowStep,
        workflowStepLabel,
        scheduleMode: effectiveSchedule.scheduleMode
      });
      const data = await safeFetchJson('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          project,
          senderFrom: selectedSenderEmail,
          listId: selectedListId,
          templateId: null,
          type: normalizeDraftType(selectedDraft),
          draftType: normalizeDraftType(selectedDraft),
          draftId: activeSavedDraftId,
          inlineTemplate: {
            subject: draftSubject,
            body: normalizeEmailDraftHtml(draftBody),
            bodyHtml: normalizeEmailDraftHtml(draftBody),
            bodyText: ''
          },
          senderAccountId: selectedAccount || null,
          scheduleMode: effectiveSchedule.scheduleMode,
          scheduledAt: effectiveSchedule.scheduledAt ? effectiveSchedule.scheduledAt.toISOString() : null,
          scheduledDate: effectiveSchedule.scheduledDate,
          scheduledTime: effectiveSchedule.scheduledTime,
          timezone: effectiveSchedule.timezone,
          country: effectiveSchedule.country,
          options: {
            batchSize: effectiveSchedule.batchSize,
            rowRange: effectiveSchedule.rowRange,
            delayInterval: effectiveSchedule.delayInterval,
            durationUnit: effectiveSchedule.durationUnit,
            delaySeconds: effectiveSchedule.delaySeconds,
            replyMode: isReplyModeCampaignType
          },
          tracking: {
            enabled: Boolean(tracking?.enabled),
            opens: Boolean(tracking?.opens),
            clicks: Boolean(tracking?.clicks),
            replies: Boolean(tracking?.replies),
            abTesting: Boolean(tracking?.abTesting)
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
      if (!autoStart) {
        notify('Campaign created successfully.', 'success');
      }
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
    rawConfig = normalizeScheduleConfigInput(rawConfig);
    const config = prepareScheduleConfig(rawConfig);
    applyScheduleConfigState(config);
    notify('Saving campaign schedule...', 'info');

    if (config.batchSize < 1) {
      notify('Batch size must be greater than or equal to 1.', 'warning');
      return { ok: false };
    }
    if (config.rowRange && !isRowRangeInputValid(config.rowRange)) {
      notify('Sheet row limit must use format like 20-50.', 'warning');
      return { ok: false };
    }
    if (config.delayInterval < 1) {
      notify('Delay interval must be greater than or equal to 1.', 'warning');
      return { ok: false };
    }
    if (config.delayInterval > getScheduleDelayLimit(config.durationUnit)) {
      notify(`Delay interval cannot be more than ${getScheduleDelayLimit(config.durationUnit)} ${config.durationUnit}.`, 'warning');
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
        notify('Scheduled time must be in future. Choose a later date/time, or select Send now.', 'warning');
        return { ok: false };
      }
    }

    let campaignId = pendingCampaignId;
    if (!campaignId) {
      const campaign = await createCampaign({
        skipReload: true,
        scheduleConfig: config,
        tracking: rawConfig?.tracking || { enabled: false, opens: false, clicks: false, replies: false, abTesting: false }
      });
      campaignId = campaign?._id || '';
      if (!campaignId) {
        notify('Schedule could not be saved because the campaign draft was not created. Please check list, sender, draft, subject, and message.', 'error');
        return { ok: false };
      }
    }

    try {
      console.debug('[campaign:schedule] request', {
        url: `/api/campaigns/${campaignId}/schedule`,
        campaignId,
        scheduleMode: config.scheduleMode,
        scheduledAt: config.scheduledAt ? config.scheduledAt.toISOString() : null,
        batchSize: config.batchSize,
        delayInterval: config.delayInterval,
        durationUnit: config.durationUnit
      });
      await safeFetchJson(`/api/campaigns/${campaignId}/schedule`, {
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
          rowRange: config.rowRange,
          delayInterval: config.delayInterval,
          durationUnit: config.durationUnit,
          persistOnly: true,
          replyMode: isReplyModeCampaignType
        })
      });
      setPendingCampaignId(campaignId);
      notify(config.scheduleMode === 'scheduled' ? 'Schedule saved to campaign draft.' : 'Send-now settings saved to campaign draft.', 'success');
      await loadAll();
      return { ok: true, config, campaignId };
    } catch (e) {
      notify(e.message || 'Failed to save schedule', 'error');
      return { ok: false };
    }
  };

  const createAndStartCampaign = async (rawConfig = {}) => {
    rawConfig = normalizeScheduleConfigInput(rawConfig);
    if (campaignCreateLockRef.current) {
      notify('Campaign creation is already in progress.', 'info');
      return { ok: false };
    }
    const scheduleConfig = prepareScheduleConfig(rawConfig);
    applyScheduleConfigState(scheduleConfig);
    notify(scheduleConfig.scheduleMode === 'scheduled' ? 'Validating schedule before start...' : 'Starting campaign...', 'info');

    if (nextProcessCampaignId) {
      if (!String(selectedDraft || '').trim()) {
        notify('Select a draft type before sending the next campaign process.', 'info');
        return { ok: false };
      }
      if (!String(draftSubject || '').trim()) {
        notify('Enter draft subject before sending the next campaign process.', 'info');
        return { ok: false };
      }
      const normalizedDraftBody = normalizeEmailDraftHtml(draftBody);
      if (!String(normalizedDraftBody || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()) {
        notify('Enter draft message before sending the next campaign process.', 'info');
        return { ok: false };
      }

      try {
        campaignCreateLockRef.current = true;
        const data = await safeFetchJson(`/api/campaigns/${nextProcessCampaignId}/next-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            step: nextProcessStep || undefined,
            draftType: normalizeDraftType(selectedDraft),
            type: normalizeDraftType(selectedDraft),
            draftId: activeSavedDraftId || null,
            inlineTemplate: {
              subject: draftSubject,
              body: normalizedDraftBody,
              bodyHtml: normalizedDraftBody,
              bodyText: ''
            },
            options: {
              batchSize: scheduleConfig.batchSize,
              rowRange: scheduleConfig.rowRange,
              delayInterval: scheduleConfig.delayInterval,
              durationUnit: scheduleConfig.durationUnit,
              delaySeconds: scheduleConfig.delaySeconds,
              replyMode: isReplyModeCampaignType
            },
            tracking: rawConfig?.tracking || { enabled: false, opens: false, clicks: false, replies: false, abTesting: false }
          })
        });
        setNextProcessCampaignId('');
        setNextProcessStep(0);
        setPendingCampaignId('');
        notify(data?.message || 'Next campaign process started for the same campaign.', 'success');
        await loadAll();
        return { ok: true, campaign: data?.campaign, ...data };
      } catch (e) {
        notify(e.message || 'Failed to start next campaign process.', 'error');
        return { ok: false };
      } finally {
        campaignCreateLockRef.current = false;
      }
    }

    let campaignId = pendingCampaignId;

    if (!campaignId) {
      const campaign = await createCampaign({
        skipReload: true,
        scheduleConfig,
        tracking: rawConfig?.tracking || { enabled: false, opens: false, clicks: false, replies: false, abTesting: false }
      });
      campaignId = campaign?._id || '';
    }

    if (!campaignId) return { ok: false };

    const result = await startCampaign(campaignId, { scheduleConfig, startAfterSchedule: true });
    if (
      result?.ok === false &&
      (result.status === 404 || result.status === 409 || ['CAMPAIGN_NOT_FOUND', 'CAMPAIGN_ALREADY_FINISHED'].includes(result.code))
    ) {
      setPendingCampaignId('');
      lastCreatedCampaignIdRef.current = '';
      lastCampaignCreateSignatureRef.current = '';
      notify('Previous campaign draft cannot be started. Creating a fresh campaign and starting again...', 'info');
      const freshCampaign = await createCampaign({
        skipReload: true,
        scheduleConfig,
        tracking: rawConfig?.tracking || { enabled: false, opens: false, clicks: false, replies: false, abTesting: false }
      });
      if (!freshCampaign?._id) return result;
      return startCampaign(freshCampaign._id, { scheduleConfig, startAfterSchedule: true });
    }

    return result;
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
    if (!acc) return notify('Select Sender.', 'info');
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


  const sendTestEmail = async (recipientOverride = '') => {
  const acc = accounts.find((a) => a.id === selectedAccount);
  const recipient = String(recipientOverride || testEmailTo || '').trim();
  const normalizedBody = normalizeEmailDraftHtml(draftBody);
  const accountStatus = String(acc?.status || '').trim().toLowerCase();
  if (!acc) {
    const message = 'Select Sender.';
    notify(message, 'info');
    return { ok: false, error: message };
  }
  if (accountStatus && !['connected', 'active', 'good', 'verified'].includes(accountStatus)) {
    const message = `${acc.from || 'Selected sender'} is not connected. Connect this Mail ID before sending a test email.`;
    notify(message, 'error');
    return { ok: false, error: message };
  }
  if (!recipient) {
    const message = 'Enter test recipient email.';
    notify(message, 'info');
    return { ok: false, error: message };
  }
  if (!String(draftSubject || '').trim()) {
    const message = 'Enter test email subject.';
    notify(message, 'info');
    return { ok: false, error: message };
  }
  if (!String(normalizedBody || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()) {
    const message = 'Enter test email body.';
    notify(message, 'info');
    return { ok: false, error: message };
  }
  try {
    const data = await safeFetchJson('/api/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: acc.id,
        project,
        to: recipient,
        subject: draftSubject,
        body: normalizedBody,
        bodyHtml: normalizedBody
      })
    });
    if (data?.ok === false || data?.success === false) {
      throw new Error(data?.message || data?.error || 'Test email failed');
    }
    notify('Test email sent successfully.', 'success');
    return { ok: true };
  } catch (e) {
    const message = e.message || 'Test email failed';
    notify(message, 'error');
    return { ok: false, error: message };
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

  const getCampaignActionCounts = (data = {}) => {
    const campaign = data.campaign || {};
    return {
      sent: Number(data.sentCount ?? campaign.sentCount ?? campaign.stats?.sent ?? 0),
      pending: Number(data.pendingCount ?? campaign.pendingCount ?? campaign.stats?.pending ?? 0),
      failed: Number(data.failedCount ?? campaign.failedCount ?? campaign.stats?.failed ?? 0)
    };
  };

  const buildCampaignStartMessage = (data = {}) => {
    const displayStatus = String(data.displayStatus || data.status || data.campaign?.displayStatus || data.campaign?.status || '').trim();
    const normalizedStatus = displayStatus.toLowerCase();
    const counts = getCampaignActionCounts(data);
    const countText = `Sent ${counts.sent}, Pending ${counts.pending}, Failed ${counts.failed}`;

    if (data.warning) {
      return { tone: 'warning', message: `${data.warning} ${countText}.` };
    }
    if (data.scheduled || normalizedStatus === 'scheduled') {
      return { tone: 'success', message: `Campaign scheduled successfully. It will start automatically at the selected time. ${countText}.` };
    }
    if (normalizedStatus === 'running' || data.started) {
      return { tone: 'success', message: `Campaign started successfully. First email is sending now; every next email waits at least 60 seconds. ${countText}.` };
    }
    if (data.queued || normalizedStatus === 'queued') {
      return { tone: 'info', message: `Campaign queued. Worker will process it shortly. If it is not picked within 2 minutes, check worker status. ${countText}.` };
    }
    if (data.started === false && data.message) {
      return { tone: 'info', message: data.message };
    }
    return { tone: 'success', message: `Campaign start request completed. ${countText}.` };
  };

  const waitForCampaignStartStatus = async (campaignId, initialData = {}) => {
    return initialData;
  };

  const startCampaign = async (campaignId, options = {}) => {
    try {
      setPreferredActiveCampaignId(campaignId);
      const scheduleConfig = prepareScheduleConfig(options.scheduleConfig || {});
      applyScheduleConfigState(scheduleConfig);
      console.debug('[campaign:start] prepare', {
        campaignId,
        startAfterSchedule: Boolean(options.startAfterSchedule),
        scheduleMode: scheduleConfig.scheduleMode,
        scheduledAt: scheduleConfig.scheduledAt ? scheduleConfig.scheduledAt.toISOString() : null,
        batchSize: scheduleConfig.batchSize,
        rowRange: scheduleConfig.rowRange,
        delayInterval: scheduleConfig.delayInterval,
        durationUnit: scheduleConfig.durationUnit
      });
      if (scheduleConfig.scheduleMode === 'scheduled') {
        if (!scheduleConfig.scheduledDate || !scheduleConfig.scheduledTime) {
          notify('Please select scheduled date and time', 'warning');
          return { ok: false };
        }
        if (!isFutureScheduledDate(scheduleConfig.scheduledAt)) {
          notify('Scheduled time must be in future. Choose a later date/time, or select Send now.', 'warning');
          return { ok: false };
        }
        setScheduledStartLabel(scheduleConfig.label);
      }
      console.debug('[campaign:start] request', { url: `/api/campaigns/${campaignId}/start`, campaignId });
      const data = await safeFetchJson(`/api/campaigns/${campaignId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleMode: scheduleConfig.scheduleMode,
          country: scheduleConfig.country,
          timezone: scheduleConfig.timezone,
          slot: scheduleConfig.normalizedSlot,
          scheduledDate: scheduleConfig.scheduledDate,
          scheduledTime: scheduleConfig.scheduledTime,
          scheduledAt: scheduleConfig.scheduledAt ? scheduleConfig.scheduledAt.toISOString() : null,
          batchSize: scheduleConfig.batchSize,
          rowRange: scheduleConfig.rowRange,
          delayInterval: scheduleConfig.delayInterval,
          durationUnit: scheduleConfig.durationUnit,
          replyMode: isReplyModeCampaignType
        })
      });
      const latestData = await waitForCampaignStartStatus(campaignId, data);
      const latestStatus = String(latestData.displayStatus || latestData.status || latestData.campaign?.displayStatus || latestData.campaign?.status || '').trim();
      const optimisticStatus = latestData.scheduled || latestStatus === 'Scheduled' ? 'Scheduled' : latestData.queued || latestStatus === 'Queued' ? 'Queued' : latestStatus || 'Running';
      const latestCounts = getCampaignActionCounts(latestData);
      applyCampaignPatch(campaignId, {
        status: optimisticStatus,
        displayStatus: latestData.displayStatus || optimisticStatus,
        workerStatus: latestData.workerStatus || latestData.queueState?.workerStatus || (optimisticStatus === 'Running' ? 'running' : ''),
        queueReason: latestData.queueReason || latestData.queueState?.queueReason || '',
        sentCount: latestCounts.sent,
        pendingCount: latestCounts.pending,
        failedCount: latestCounts.failed
      });
      setPendingCampaignId('');
      const startMessage = buildCampaignStartMessage(latestData);
      notify(startMessage.message, startMessage.tone);
      await refreshCampaignData({ source: 'start-campaign' });
      return { ok: true, data: latestData, message: startMessage.message, tone: startMessage.tone };
    } catch (e) {
      notify(e.message || 'Failed to start campaign', 'error');
      void refreshCampaignData({ source: 'start-campaign-error' });
      return { ok: false, error: e.message || 'Failed to start campaign', code: e.code || '', status: e.status || 0 };
    }
  };

  const pauseCampaign = async (campaignId) => {
    try {
      applyCampaignPatch(campaignId, { status: 'Paused', displayStatus: 'Paused' });
      await safeFetchJson(`/api/campaigns/${campaignId}/pause`, { method: 'POST' });
      notify('Campaign paused successfully.', 'success');
      void refreshCampaignData({ source: 'pause-campaign' });
    } catch (e) {
      notify(e.message || 'Failed to pause campaign', 'error');
      void refreshCampaignData({ source: 'pause-campaign-error' });
    }
  };

  const resumeCampaign = async (campaignId) => {
    try {
      applyCampaignPatch(campaignId, { status: 'Queued', displayStatus: 'Queued' });
      await safeFetchJson(`/api/campaigns/${campaignId}/resume`, { method: 'POST' });
      notify('Campaign resumed successfully.', 'success');
      void refreshCampaignData({ source: 'resume-campaign' });
    } catch (e) {
      notify(e.message || 'Failed to resume campaign', 'error');
      void refreshCampaignData({ source: 'resume-campaign-error' });
    }
  };

  const stopCampaign = async (campaignId) => {
    try {
      applyCampaignPatch(campaignId, { status: 'Stopped', displayStatus: 'Stopped' });
      await safeFetchJson(`/api/campaigns/${campaignId}/stop`, { method: 'POST' });
      notify('Campaign stopped successfully.', 'success');
      void refreshCampaignData({ source: 'stop-campaign' });
    } catch (e) {
      notify(e.message || 'Failed to stop campaign', 'error');
      void refreshCampaignData({ source: 'stop-campaign-error' });
    }
  };

  const clearCampaignLogs = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/clear-logs`, { method: 'POST' });
      notify('Campaign logs cleared.', 'success');
      void refreshCampaignData({ source: 'clear-campaign-logs' });
    } catch (e) {
      notify(e.message || 'Failed to clear campaign logs', 'error');
      void refreshCampaignData({ source: 'clear-campaign-logs-error' });
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

  const addPreviewRow = (afterIndex = null) => {
    const columns = getPreviewColumns();
    const newRow = Object.fromEntries(columns.map((column) => [column, '']));
    setPreview((prev) => {
      const insertIndex = Number.isInteger(afterIndex)
        ? Math.max(0, Math.min(prev.length, afterIndex + 1))
        : prev.length;
      return [...prev.slice(0, insertIndex), newRow, ...prev.slice(insertIndex)];
    });
    setPreviewDirty(true);
    setShowUploadPreview(true);
  };

  const addPreviewColumn = (preferredName = '') => {
    const existingColumns = getPreviewColumns();
    let nextIndex = existingColumns.length + 1;
    let nextName = String(preferredName || '').trim() || `Column${nextIndex}`;
    while (existingColumns.includes(nextName)) {
      nextIndex += 1;
      nextName = `Column${nextIndex}`;
    }

    setPreviewColumns((current) => {
      const currentColumns = current.length ? current : existingColumns;
      return currentColumns.includes(nextName) ? currentColumns : [...currentColumns, nextName];
    });
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
    loadAll({
      selectedStatsDate: '',
      selectedStatsRange: 'customize',
      customStatsStartDate,
      customStatsEndDate
    });
    notify('Custom date range selected.', 'success');
  };

  const handleTopNavSelect = (item) => {
    setActiveTopNav(item.label);
    setSidebarOpen(false);
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
    setSidebarOpen(false);
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

  const getSidebarIconClass = (label = '') => {
    const icons = {
      Dashboard: 'ti-layout-grid',
      Leads: 'ti-users',
      'Draft & Templates': 'ti-file-text',
      Mailbox: 'ti-mail',
      'Sender Emails': 'ti-mail-plus',
      'Warm-Up': 'ti-flame',
      Campaigns: 'ti-speakerphone',
      Report: 'ti-chart-line'
    };
    return icons[label] || 'ti-circle';
  };

  const renderSidebarNode = (item, depth = 0) => (
    <div
      key={`${item.label}-${depth}`}
      className="dashboard-sidebar-item"
      style={depth > 0 ? { marginLeft: depth * 14 } : undefined}
    >
      <a
        href={item.href}
        className={depth === 0 ? 'nav-item dashboard-sidebar-link' : 'nav-item dashboard-sidebar-subitem-link'}
        onClick={(event) => openSidebarBlankView(item, event)}
      >
        {depth === 0 ? <i className={`ti ${getSidebarIconClass(item.label)} dashboard-link-icon soft`} aria-hidden="true" /> : null}
        <span>{item.label}</span>
        {depth === 0 && sidebarLiveBadges[item.label] ? <em className="dashboard-sidebar-badge nav-badge warm">{sidebarLiveBadges[item.label]}</em> : null}
      </a>
      {item.items?.length ? (
        <div className="dashboard-sidebar-submenu">
          {item.items.map((child) => renderSidebarNode(child, depth + 1))}
        </div>
      ) : null}
    </div>
  );

  const showSidebarBlankView = Boolean(activeSidebarView);

  if (!isMounted) {
    return (
      <main className="dashboard-shell">
        <section
          className="card"
          style={{
            minHeight: 'calc(100vh - 48px)',
            display: 'grid',
            alignContent: 'center',
            justifyItems: 'center',
            gap: 12,
            margin: 24
          }}
        >
          <strong>Loading dashboard...</strong>
          <span style={{ color: 'var(--text-muted)' }}>Preparing live campaign data</span>
        </section>
      </main>
    );
  }

  return (
    <main
      className={`dashboard-shell dashboard-breakpoint-${breakpoint.name} ${sidebarOpen ? 'sidebar-open' : ''}`}
      data-breakpoint={breakpoint.name}
    >
      <style>{`
        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          min-height: 100% !important;
        }

        body {
          overflow-x: hidden !important;
        }

        body main.dashboard-shell {
          --dash-sidebar-width: 232px;
          --dash-tablet-sidebar-width: 64px;
          --dash-mobile-sidebar-width: min(232px, 88vw);
          --dash-topbar-height: 56px;
          position: relative !important;
          display: block !important;
          width: 100vw !important;
          min-height: 100vh !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow-x: hidden !important;
          background: #f5f6f8 !important;
          color: #111827 !important;
          font-family: 'DM Sans', system-ui, sans-serif !important;
          font-size: 15px !important;
        }

        body main.dashboard-shell *,
        body main.dashboard-shell button,
        body main.dashboard-shell input,
        body main.dashboard-shell select,
        body main.dashboard-shell textarea {
          box-sizing: border-box !important;
          font-family: 'DM Sans', system-ui, sans-serif !important;
          letter-spacing: 0 !important;
        }

        body main.dashboard-shell > aside.sidebar.dashboard-sidebar {
          position: fixed !important;
          inset: 0 auto 0 0 !important;
          width: var(--dash-sidebar-width) !important;
          min-width: var(--dash-sidebar-width) !important;
          height: 100vh !important;
          z-index: 1000 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          transform: none !important;
          border: 0 !important;
          border-right: 1px solid #e8ecf1 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          margin: 0 !important;
        }

        body main.dashboard-shell .dashboard-sidebar-card {
          width: 100% !important;
          height: 100vh !important;
          min-height: 0 !important;
          max-height: none !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        body main.dashboard-shell .sidebar-logo.reference-brand {
          height: 67px !important;
          min-height: 67px !important;
          flex: 0 0 67px !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          margin: 0 !important;
          padding: 18px 20px 16px !important;
          border: 0 !important;
          border-bottom: 1px solid #f0f2f5 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .logo-mark {
          width: 32px !important;
          height: 32px !important;
          flex: 0 0 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 8px !important;
          color: #ffffff !important;
          background: linear-gradient(135deg, #4f5bd5 0%, #667eea 100%) !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .logo-mark i {
          color: #ffffff !important;
          font-size: 16px !important;
        }

        body main.dashboard-shell .reference-brand-copy {
          min-width: 0 !important;
          display: block !important;
          white-space: nowrap !important;
        }

        body main.dashboard-shell .logo-text {
          display: block !important;
          color: #111827 !important;
          font-size: 15px !important;
          line-height: 18px !important;
          font-weight: 600 !important;
        }

        body main.dashboard-shell .logo-sub {
          display: block !important;
          margin: 0 !important;
          color: #98a2b3 !important;
          font-size: 10px !important;
          line-height: 12px !important;
          font-weight: 400 !important;
          letter-spacing: 0.08em !important;
          text-transform: uppercase !important;
        }

        body main.dashboard-shell .dashboard-sidebar-stack {
          flex: 0 0 auto !important;
          display: flex !important;
          flex-direction: column !important;
          min-height: 0 !important;
          padding: 16px 18px 12px !important;
          gap: 0 !important;
        }

        body main.dashboard-shell .sidebar-search.dashboard-sidebar-search {
          flex: 0 0 auto !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .search-wrap {
          position: relative !important;
          height: 34px !important;
          display: flex !important;
          align-items: center !important;
        }

        body main.dashboard-shell .search-wrap .si-icon {
          position: absolute !important;
          left: 9px !important;
          top: 50% !important;
          z-index: 1 !important;
          transform: translateY(-50%) !important;
          color: #9aa5b4 !important;
          font-size: 14px !important;
        }

        body main.dashboard-shell .search-input {
          width: 100% !important;
          height: 34px !important;
          min-height: 0 !important;
          padding: 7px 10px 7px 32px !important;
          border: 1px solid #e8ecf1 !important;
          border-radius: 10px !important;
          background: #f8f9fb !important;
          color: #111827 !important;
          box-shadow: none !important;
          outline: none !important;
          font-size: 13px !important;
          font-weight: 400 !important;
        }

        body main.dashboard-shell .search-input::placeholder {
          color: #98a2b3 !important;
        }

        body main.dashboard-shell .dashboard-sidebar-nav {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 18px 12px !important;
          border: 0 !important;
        }

        body main.dashboard-shell .dashboard-sidebar-menu {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
          padding: 0 !important;
          scrollbar-width: none !important;
        }

        body main.dashboard-shell .dashboard-sidebar-menu::-webkit-scrollbar {
          display: none !important;
        }

        body main.dashboard-shell .nav-section-label.reference-nav-label,
        body main.dashboard-shell .nav-section-label {
          flex: 0 0 auto !important;
          margin: 0 !important;
          padding: 14px 8px 6px !important;
          color: #9aa5b4 !important;
          font-size: 11px !important;
          line-height: 14px !important;
          font-weight: 600 !important;
          letter-spacing: 0.1em !important;
          text-transform: uppercase !important;
        }

        body main.dashboard-shell .dashboard-sidebar-item {
          margin: 0 !important;
          padding: 0 !important;
        }

        body main.dashboard-shell .nav-item,
        body main.dashboard-shell .dashboard-primary-link,
        body main.dashboard-shell .dashboard-sidebar-link {
          height: 36px !important;
          min-height: 36px !important;
          width: auto !important;
          display: flex !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 12px !important;
          margin: 0 !important;
          padding: 0 12px !important;
          border: 0 !important;
          border-radius: 10px !important;
          background: transparent !important;
          color: #536172 !important;
          box-shadow: none !important;
          text-decoration: none !important;
          cursor: pointer !important;
          font-size: 14.5px !important;
          line-height: 20px !important;
          font-weight: 400 !important;
        }

        body main.dashboard-shell .nav-item:hover,
        body main.dashboard-shell .dashboard-primary-link:hover,
        body main.dashboard-shell .dashboard-sidebar-link:hover {
          background: #f8f9fb !important;
          color: #111827 !important;
        }

        body main.dashboard-shell .nav-item.active,
        body main.dashboard-shell .dashboard-primary-link.active {
          background: #eef0fd !important;
          color: #4f5bd5 !important;
          font-weight: 500 !important;
        }

        body main.dashboard-shell .dashboard-link-icon,
        body main.dashboard-shell .nav-item i {
          width: 20px !important;
          min-width: 20px !important;
          height: 20px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: inherit !important;
          font-size: 18px !important;
          line-height: 1 !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .dashboard-sidebar-badge,
        body main.dashboard-shell .nav-badge.warm {
          margin-left: auto !important;
          padding: 2px 8px !important;
          border-radius: 999px !important;
          background: #fff2c7 !important;
          color: #e78b00 !important;
          font-size: 12px !important;
          line-height: 16px !important;
          font-weight: 700 !important;
          font-style: normal !important;
        }

        body main.dashboard-shell .plan-card.dashboard-upgrade-card {
          flex: 0 0 auto !important;
          margin: 0 18px 54px !important;
          width: auto !important;
          max-width: none !important;
          min-height: 96px !important;
          height: 96px !important;
          display: block !important;
          gap: normal !important;
          position: relative !important;
          overflow: visible !important;
          padding: 12px !important;
          border: 1px solid #d5d9f8 !important;
          border-radius: 14px !important;
          background: #eef0fd !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .plan-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 8px !important;
          margin-bottom: 8px !important;
        }

        body main.dashboard-shell .plan-name {
          color: #4f5bd5 !important;
          font-size: 12px !important;
          line-height: 16px !important;
          font-weight: 600 !important;
        }

        body main.dashboard-shell .plan-tag {
          padding: 2px 6px !important;
          border-radius: 4px !important;
          background: #fee2e2 !important;
          color: #dc2626 !important;
          font-size: 10px !important;
          font-weight: 600 !important;
        }

        body main.dashboard-shell .plan-credits {
          color: #111827 !important;
          font-size: 22px !important;
          line-height: 22px !important;
          font-weight: 600 !important;
        }

        body main.dashboard-shell .plan-credits-label {
          margin-top: 2px !important;
          color: #98a2b3 !important;
          font-size: 12px !important;
          line-height: 16px !important;
        }

        body main.dashboard-shell .reference-plan-meta {
          display: none !important;
        }

        body main.dashboard-shell .upgrade-btn.dashboard-upgrade-button {
          position: absolute !important;
          left: 0 !important;
          top: calc(100% + 10px) !important;
          width: calc(100% - 32px) !important;
          min-height: 34px !important;
          margin: 0 16px !important;
          padding: 9px 14px !important;
          border: 0 !important;
          border-radius: 10px !important;
          background: #4f5bd5 !important;
          color: #ffffff !important;
          box-shadow: none !important;
          font-size: 13px !important;
          font-weight: 500 !important;
        }

        body main.dashboard-shell .user-row.reference-sidebar-user {
          flex: 0 0 auto !important;
          min-height: 54px !important;
          display: flex !important;
          align-items: center !important;
          gap: 9px !important;
          margin: 0 18px 14px !important;
          padding: 6px 4px !important;
          border: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .user-avatar,
        body main.dashboard-shell .dashboard-topbar-avatar {
          width: 32px !important;
          height: 32px !important;
          display: grid !important;
          place-items: center !important;
          border-radius: 50% !important;
          background: #4f5bd5 !important;
          color: #ffffff !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          overflow: hidden !important;
        }

        body main.dashboard-shell .dashboard-topbar-avatar-img {
          object-fit: cover !important;
        }

        body main.dashboard-shell .user-copy {
          min-width: 0 !important;
        }

        body main.dashboard-shell .user-actions {
          margin-left: auto !important;
          display: flex !important;
          gap: 4px !important;
        }

        body main.dashboard-shell .user-name {
          display: block !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          color: #111827 !important;
          font-size: 13px !important;
          line-height: 16px !important;
          font-weight: 500 !important;
        }

        body main.dashboard-shell .user-plan {
          display: block !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          color: #98a2b3 !important;
          font-size: 12px !important;
          line-height: 16px !important;
        }

        body main.dashboard-shell .user-icon-btn {
          width: 28px !important;
          height: 28px !important;
          min-width: 28px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 7px !important;
          background: transparent !important;
          color: #98a2b3 !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .dashboard-sidebar-close {
          display: none !important;
        }

        body main.dashboard-shell > div.main.dashboard-main {
          position: relative !important;
          z-index: 1 !important;
          min-width: 0 !important;
          width: calc(100vw - var(--dash-sidebar-width)) !important;
          max-width: calc(100vw - var(--dash-sidebar-width)) !important;
          margin: 0 0 0 var(--dash-sidebar-width) !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          background: #f5f6f8 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell > div.main.dashboard-main > header.topbar.dashboard-topbar {
          position: sticky !important;
          top: 0 !important;
          z-index: 50 !important;
          width: 100% !important;
          min-width: 0 !important;
          height: var(--dash-topbar-height) !important;
          min-height: var(--dash-topbar-height) !important;
          margin: 0 !important;
          padding: 0 24px !important;
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          gap: 8px !important;
          border: 0 !important;
          border-bottom: 1px solid #e8ecf1 !important;
          border-radius: 0 !important;
          background: #ffffff !important;
          box-shadow: none !important;
          transform: none !important;
          overflow: visible !important;
        }

        body main.dashboard-shell .topbar-tabs.dashboard-topbar-tabs {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 2px !important;
          overflow: hidden !important;
          padding: 0 !important;
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .tb-tab.dashboard-topbar-tab {
          flex: 0 0 auto !important;
          height: 34px !important;
          min-height: 34px !important;
          padding: 0 15px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          border: 0 !important;
          border-radius: 10px !important;
          background: transparent !important;
          box-shadow: none !important;
          color: #4a5568 !important;
          font-size: 14.5px !important;
          line-height: 20px !important;
          font-weight: 400 !important;
          cursor: pointer !important;
        }

        body main.dashboard-shell .tb-tab.dashboard-topbar-tab.active {
          background: #eef0fd !important;
          color: #4f5bd5 !important;
          font-weight: 500 !important;
        }

        body main.dashboard-shell .topbar-actions.dashboard-topbar-actions {
          flex: 0 1 auto !important;
          min-width: 0 !important;
          display: flex !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 8px !important;
          padding: 0 !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }

        body main.dashboard-shell .dashboard-topbar-filter-group {
          min-width: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
        }

        body main.dashboard-shell .tb-theme-btn,
          body main.dashboard-shell .tb-select,
          body main.dashboard-shell .dashboard-mobile-filter-toggle,
          body main.dashboard-shell .dashboard-topbar-profile {
          height: 34px !important;
          min-height: 34px !important;
          border: 1px solid #e8ecf1 !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          color: #4a5568 !important;
          box-shadow: none !important;
          font-size: 13.5px !important;
          font-weight: 400 !important;
        }

        body main.dashboard-shell .tb-theme-btn {
          min-width: auto !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          padding: 6px 12px !important;
          cursor: pointer !important;
        }

        body main.dashboard-shell .tb-select {
          min-width: 0 !important;
          width: auto !important;
          max-width: 190px !important;
          padding: 6px 28px 6px 12px !important;
          cursor: pointer !important;
          outline: none !important;
          appearance: none !important;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239aa5b4' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 10px center !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        body main.dashboard-shell .dashboard-topbar-date-select {
          width: 112px !important;
          max-width: 112px !important;
        }

        body main.dashboard-shell .dashboard-topbar-project-select {
          width: 128px !important;
          max-width: 128px !important;
        }

        body main.dashboard-shell .dashboard-topbar-sender-select {
          width: 126px !important;
          max-width: 126px !important;
        }

        body main.dashboard-shell .tb-divider {
          width: 1px !important;
          height: 20px !important;
          flex: 0 0 1px !important;
          margin: 0 4px !important;
          border: 0 !important;
          background: #e8ecf1 !important;
        }

        body main.dashboard-shell .dashboard-legacy-sidebar-toggle,
        body main.dashboard-shell .dashboard-mobile-sidebar-toggle,
        body main.dashboard-shell .dashboard-mobile-filter-toggle {
          display: none !important;
        }

        body main.dashboard-shell .dashboard-topbar-profile-wrap {
          position: relative !important;
          flex: 0 0 auto !important;
          display: block !important;
        }

        body main.dashboard-shell .dashboard-topbar-profile {
          display: inline-flex !important;
          align-items: center !important;
          gap: 8px !important;
          width: 138px !important;
          max-width: 138px !important;
          padding: 0 10px !important;
          cursor: pointer !important;
        }

        body main.dashboard-shell .dashboard-topbar-profile-name {
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
        }

        body main.dashboard-shell .dashboard-profile-photo-input {
          display: none !important;
        }

        body main.dashboard-shell .dashboard-topbar-dropdown-menu {
          position: absolute !important;
          top: calc(100% + 10px) !important;
          right: 0 !important;
          z-index: 1200 !important;
          min-width: 240px !important;
          display: grid !important;
          gap: 2px !important;
          padding: 8px !important;
          border: 1px solid #e8ecf1 !important;
          border-radius: 14px !important;
          background: #ffffff !important;
          box-shadow: 0 20px 44px rgba(15, 23, 42, 0.12) !important;
        }

        body main.dashboard-shell .dashboard-topbar-dropdown-item {
          width: 100% !important;
          min-height: 36px !important;
          display: flex !important;
          align-items: center !important;
          padding: 8px 10px !important;
          border: 0 !important;
          border-radius: 9px !important;
          background: transparent !important;
          color: #374151 !important;
          box-shadow: none !important;
          text-align: left !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
        }

        body main.dashboard-shell .dashboard-topbar-dropdown-item:hover {
          background: #f8f9fb !important;
        }

        body main.dashboard-shell .dashboard-topbar-dropdown-item.logout {
          margin-top: 6px !important;
          padding-top: 10px !important;
          border-top: 1px solid #f0f2f5 !important;
          color: #e11d48 !important;
          font-weight: 700 !important;
        }

        body main.dashboard-shell .page-body {
          padding: 24px !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 20px !important;
          min-width: 0 !important;
        }

        body main.dashboard-shell .stats-grid,
        body main.dashboard-shell .stat-strip {
          display: grid !important;
          grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          gap: 12px !important;
        }

        body main.dashboard-shell .middle-grid,
        body main.dashboard-shell .grid-3 {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          align-items: stretch !important;
          gap: 16px !important;
        }

        body main.dashboard-shell .bottom-grid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 16px !important;
        }

        body main.dashboard-shell .workflow-steps {
          display: grid !important;
          grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
        }

        html body main.dashboard-shell {
          margin: 0 !important;
          padding: 0 !important;
        }

        html body main.dashboard-shell > div.main.dashboard-main {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }

        html body main.dashboard-shell #dashboard-top {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        html body main.dashboard-shell > div.main.dashboard-main > header.topbar.dashboard-topbar {
          top: 0 !important;
          margin-top: 0 !important;
        }

        html body main.dashboard-shell > aside.sidebar.dashboard-sidebar > .dashboard-sidebar-card {
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          gap: 0 !important;
          overflow: hidden !important;
        }

        html body main.dashboard-shell .dashboard-sidebar-stack {
          padding: 16px 18px 12px !important;
          margin: 0 !important;
        }

        html body main.dashboard-shell .sidebar-logo.reference-brand {
          height: 68px !important;
          min-height: 68px !important;
          flex-basis: 68px !important;
        }

        html body main.dashboard-shell .sidebar-search.dashboard-sidebar-search {
          margin: 0 !important;
          position: relative !important;
          top: 0 !important;
        }

        html body main.dashboard-shell .dashboard-sidebar-nav {
          flex: 1 1 auto !important;
          min-height: 0 !important;
        }

        html body main.dashboard-shell .dashboard-sidebar-menu {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
          overflow-y: auto !important;
        }

        html body main.dashboard-shell .dashboard-sidebar-menu .nav-item,
        html body main.dashboard-shell .dashboard-sidebar-menu .dashboard-primary-link,
        html body main.dashboard-shell .dashboard-sidebar-menu .dashboard-sidebar-link,
        html body main.dashboard-shell .dashboard-sidebar-menu .nav-item.active,
        html body main.dashboard-shell .dashboard-sidebar-menu .dashboard-primary-link.active {
          width: auto !important;
          height: 36px !important;
          min-height: 36px !important;
          margin: 0 !important;
          padding: 0 12px !important;
          gap: 12px !important;
          align-items: center !important;
          border-radius: 10px !important;
          font-size: 14.5px !important;
          line-height: 20px !important;
        }

        html body main.dashboard-shell .plan-card.dashboard-upgrade-card {
          margin-top: 0 !important;
          margin-right: 0 !important;
          margin-left: 0 !important;
        }

        html body main.dashboard-shell .user-row.reference-sidebar-user {
          margin-right: 0 !important;
          margin-left: 0 !important;
        }

        @media (min-width: 768px) and (max-width: 1199px) {
          body main.dashboard-shell > aside.sidebar.dashboard-sidebar {
            width: var(--dash-tablet-sidebar-width) !important;
            min-width: var(--dash-tablet-sidebar-width) !important;
          }

          body main.dashboard-shell > div.main.dashboard-main {
            width: calc(100vw - var(--dash-tablet-sidebar-width)) !important;
            max-width: calc(100vw - var(--dash-tablet-sidebar-width)) !important;
            margin-left: var(--dash-tablet-sidebar-width) !important;
          }

          body main.dashboard-shell .reference-brand-copy,
          body main.dashboard-shell .sidebar-search,
          body main.dashboard-shell .nav-section-label,
          body main.dashboard-shell .nav-item span,
          body main.dashboard-shell .dashboard-sidebar-badge,
          body main.dashboard-shell .plan-card.dashboard-upgrade-card,
          body main.dashboard-shell .user-copy,
          body main.dashboard-shell .user-icon-btn {
            display: none !important;
          }

          body main.dashboard-shell .sidebar-logo.reference-brand {
            height: 64px !important;
            min-height: 64px !important;
            flex-basis: 64px !important;
            justify-content: center !important;
            padding: 0 !important;
          }

          body main.dashboard-shell .logo-mark {
            width: 36px !important;
            height: 36px !important;
            flex-basis: 36px !important;
          }

          body main.dashboard-shell .dashboard-sidebar-nav {
            padding: 8px 0 12px !important;
          }

          body main.dashboard-shell .dashboard-sidebar-menu {
            align-items: center !important;
            padding: 0 0 8px !important;
          }

          body main.dashboard-shell .nav-item,
          body main.dashboard-shell .dashboard-primary-link,
          body main.dashboard-shell .dashboard-sidebar-link {
            width: 48px !important;
            min-width: 48px !important;
            height: 42px !important;
            min-height: 42px !important;
            margin: 2px 0 !important;
            padding: 0 !important;
            justify-content: center !important;
            gap: 0 !important;
          }

          html body main.dashboard-shell .dashboard-sidebar-menu .nav-item,
          html body main.dashboard-shell .dashboard-sidebar-menu .dashboard-primary-link,
          html body main.dashboard-shell .dashboard-sidebar-menu .dashboard-sidebar-link,
          html body main.dashboard-shell .dashboard-sidebar-menu .nav-item.active,
          html body main.dashboard-shell .dashboard-sidebar-menu .dashboard-primary-link.active {
            width: 48px !important;
            min-width: 48px !important;
            height: 42px !important;
            min-height: 42px !important;
            margin: 2px 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            justify-content: center !important;
          }

          body main.dashboard-shell .user-row.reference-sidebar-user {
            display: flex !important;
            justify-content: center !important;
            grid-template-columns: none !important;
            margin: 0 0 12px !important;
          }

          body main.dashboard-shell > div.main.dashboard-main > header.topbar.dashboard-topbar {
            padding: 0 16px !important;
            gap: 10px !important;
          }

          body main.dashboard-shell .tb-tab.dashboard-topbar-tab {
            padding: 0 12px !important;
            font-size: 14.5px !important;
          }

          body main.dashboard-shell .topbar-actions.dashboard-topbar-actions {
            gap: 8px !important;
            margin-left: auto !important;
          }

          body main.dashboard-shell .tb-theme-btn {
            min-width: 42px !important;
            width: 42px !important;
            padding: 0 !important;
          }

          body main.dashboard-shell .tb-theme-btn span {
            display: none !important;
          }

          body main.dashboard-shell .dashboard-mobile-filter-toggle {
            width: 42px !important;
            min-width: 42px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            cursor: pointer !important;
          }

          body main.dashboard-shell .dashboard-topbar-filter-group {
            position: absolute !important;
            top: calc(100% + 8px) !important;
            right: 16px !important;
            z-index: 80 !important;
            display: none !important;
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            width: 260px !important;
            padding: 10px !important;
            border: 1px solid #e8ecf1 !important;
            border-radius: 14px !important;
            background: #ffffff !important;
            box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12) !important;
          }

          body main.dashboard-shell .dashboard-topbar-filter-group.open {
            display: grid !important;
          }

          body main.dashboard-shell .dashboard-topbar-filter-group .tb-theme-btn,
          body main.dashboard-shell .dashboard-topbar-filter-group .tb-select {
            width: 100% !important;
            max-width: none !important;
          }

          body main.dashboard-shell .tb-select {
            max-width: 150px !important;
            font-size: 13px !important;
          }

          body main.dashboard-shell .dashboard-topbar-profile-name {
            display: none !important;
          }

          body main.dashboard-shell .dashboard-topbar-profile {
            width: 42px !important;
            min-width: 42px !important;
            padding: 0 4px !important;
          }

          body main.dashboard-shell .stats-grid,
          body main.dashboard-shell .stat-strip {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          body main.dashboard-shell .middle-grid,
          body main.dashboard-shell .grid-3 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          body main.dashboard-shell .bottom-grid {
            grid-template-columns: 1fr !important;
          }

          body main.dashboard-shell .workflow-steps {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            row-gap: 16px !important;
          }

          body main.dashboard-shell .workflow-connector {
            display: none !important;
          }
        }

        @media (max-width: 767px) {
          body main.dashboard-shell > aside.sidebar.dashboard-sidebar {
            width: var(--dash-mobile-sidebar-width) !important;
            min-width: var(--dash-mobile-sidebar-width) !important;
            transform: translateX(-100%) !important;
            transition: transform 180ms ease !important;
            box-shadow: 18px 0 40px rgba(15, 23, 42, 0.22) !important;
          }

          body main.dashboard-shell > aside.sidebar.dashboard-sidebar.mobile-open {
            transform: translateX(0) !important;
          }

          body main.dashboard-shell > div.main.dashboard-main {
            width: 100vw !important;
            max-width: 100vw !important;
            margin-left: 0 !important;
          }

          body main.dashboard-shell > div.main.dashboard-main > header.topbar.dashboard-topbar {
            height: var(--dash-topbar-height) !important;
            min-height: var(--dash-topbar-height) !important;
            padding: 0 12px !important;
            gap: 10px !important;
          }

          body main.dashboard-shell .topbar-actions.dashboard-topbar-actions {
            flex: 0 0 auto !important;
            margin-left: auto !important;
            gap: 8px !important;
          }

          body main.dashboard-shell .dashboard-mobile-sidebar-toggle.dashboard-hamburger-button {
            position: static !important;
            flex: 0 0 40px !important;
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            border: 1px solid #e8ecf1 !important;
            border-radius: 12px !important;
            background: #ffffff !important;
            color: #1f2937 !important;
            box-shadow: none !important;
            font-size: 20px !important;
          }

          body main.dashboard-shell .dashboard-mobile-filter-toggle {
            width: 40px !important;
            min-width: 40px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            cursor: pointer !important;
          }

          body main.dashboard-shell .dashboard-sidebar-backdrop.open {
            position: fixed !important;
            inset: 0 !important;
            z-index: 900 !important;
            display: block !important;
            background: rgba(15, 23, 42, 0.52) !important;
          }

          body main.dashboard-shell .dashboard-sidebar-close {
            position: absolute !important;
            top: 14px !important;
            right: 12px !important;
            z-index: 2 !important;
            width: 34px !important;
            height: 34px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 !important;
            border: 1px solid #e8ecf1 !important;
            border-radius: 10px !important;
            background: #ffffff !important;
            color: #1f2937 !important;
          }

          body main.dashboard-shell .topbar-tabs.dashboard-topbar-tabs {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            overflow: hidden !important;
          }

          body main.dashboard-shell .tb-tab.dashboard-topbar-tab:not(.active) {
            display: none !important;
          }

          body main.dashboard-shell .tb-tab.dashboard-topbar-tab.active {
            max-width: 100% !important;
            padding: 0 8px !important;
            background: transparent !important;
            color: #111827 !important;
            font-size: 17px !important;
            font-weight: 700 !important;
          }

          body main.dashboard-shell .dashboard-topbar-filter-group {
            position: absolute !important;
            top: calc(100% + 8px) !important;
            right: 12px !important;
            left: 12px !important;
            z-index: 80 !important;
            display: none !important;
            grid-template-columns: 1fr !important;
            gap: 8px !important;
            padding: 10px !important;
            border: 1px solid #e8ecf1 !important;
            border-radius: 14px !important;
            background: #ffffff !important;
            box-shadow: 0 18px 36px rgba(15, 23, 42, 0.12) !important;
          }

          body main.dashboard-shell .dashboard-topbar-filter-group.open {
            display: grid !important;
          }

          body main.dashboard-shell .tb-divider {
            display: none !important;
          }

          body main.dashboard-shell .tb-theme-btn,
          body main.dashboard-shell .tb-select,
          body main.dashboard-shell .dashboard-topbar-sender-select {
            width: 100% !important;
            max-width: none !important;
          }

          body main.dashboard-shell .dashboard-topbar-profile-name {
            display: none !important;
          }

          body main.dashboard-shell .dashboard-topbar-profile-wrap {
            width: 40px !important;
            min-width: 40px !important;
            flex: 0 0 40px !important;
          }

          body main.dashboard-shell .dashboard-topbar-profile {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            padding: 0 3px !important;
          }

          body main.dashboard-shell .dashboard-topbar-dropdown-menu {
            right: 0 !important;
            min-width: 220px !important;
          }

          body main.dashboard-shell .page-body {
            padding: 16px !important;
            gap: 16px !important;
          }

          body main.dashboard-shell .stats-grid,
          body main.dashboard-shell .stat-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          body main.dashboard-shell .middle-grid,
          body main.dashboard-shell .grid-3,
          body main.dashboard-shell .bottom-grid {
            grid-template-columns: 1fr !important;
          }

          body main.dashboard-shell .workflow-steps {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            row-gap: 16px !important;
          }

          body main.dashboard-shell .workflow-connector {
            display: none !important;
          }
        }

        @media (max-width: 420px) {
          body main.dashboard-shell .stats-grid,
          body main.dashboard-shell .stat-strip,
          body main.dashboard-shell .workflow-steps {
            grid-template-columns: 1fr !important;
          }
        }

        html body main.dashboard-shell > aside.sidebar.dashboard-sidebar .dashboard-sidebar-nav > nav.dashboard-sidebar-menu {
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
          overflow-y: auto !important;
        }

        html body main.dashboard-shell > aside.sidebar.dashboard-sidebar .dashboard-sidebar-stack {
          flex: 0 0 auto !important;
          height: auto !important;
          min-height: 0 !important;
          padding: 16px 18px 12px !important;
        }

        html body main.dashboard-shell > aside.sidebar.dashboard-sidebar .dashboard-sidebar-nav {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 0 18px 12px !important;
          gap: 0 !important;
        }

        html body main.dashboard-shell > div.main.dashboard-main > header.topbar.dashboard-topbar {
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
        }

        html body main.dashboard-shell .dashboard-mobile-sidebar-toggle.dashboard-hamburger-button {
          order: 0 !important;
        }

        html body main.dashboard-shell .topbar-tabs.dashboard-topbar-tabs {
          order: 1 !important;
        }

        html body main.dashboard-shell .topbar-actions.dashboard-topbar-actions {
          order: 2 !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
        }

        @media (max-width: 767px) {
          html body main.dashboard-shell .dashboard-mobile-sidebar-toggle.dashboard-hamburger-button {
            position: static !important;
            flex: 0 0 40px !important;
          }

          html body main.dashboard-shell .topbar-tabs.dashboard-topbar-tabs {
            flex: 1 1 auto !important;
            min-width: 0 !important;
          }

          html body main.dashboard-shell .topbar-actions.dashboard-topbar-actions {
            width: auto !important;
            min-width: 0 !important;
            flex: 0 0 auto !important;
            margin-left: auto !important;
          }
        }

        @media (min-width: 768px) and (max-width: 1199px) {
          html body main.dashboard-shell > aside.sidebar.dashboard-sidebar .dashboard-sidebar-stack {
            display: none !important;
          }

          html body main.dashboard-shell > aside.sidebar.dashboard-sidebar .dashboard-sidebar-nav {
            padding: 8px 0 12px !important;
          }
        }

        html body main.dashboard-shell {
          --dash-sidebar-width: 232px !important;
          --dash-tablet-sidebar-width: 64px !important;
          --dash-mobile-sidebar-width: min(232px, 88vw) !important;
          --dash-topbar-height: 56px !important;
        }

        html body main.dashboard-shell > aside.sidebar.dashboard-sidebar {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
          width: var(--dash-sidebar-width) !important;
          min-width: var(--dash-sidebar-width) !important;
          max-width: var(--dash-sidebar-width) !important;
          height: 100vh !important;
          z-index: 1000 !important;
        }

        html body main.dashboard-shell > div.main.dashboard-main {
          width: calc(100% - var(--dash-sidebar-width)) !important;
          max-width: calc(100% - var(--dash-sidebar-width)) !important;
          min-width: 0 !important;
          margin-left: var(--dash-sidebar-width) !important;
          padding-top: var(--dash-topbar-height) !important;
          position: relative !important;
          left: 0 !important;
          transform: none !important;
        }

        html body main.dashboard-shell > div.main.dashboard-main > header.topbar.dashboard-topbar {
          position: fixed !important;
          top: 0 !important;
          left: var(--dash-sidebar-width) !important;
          right: auto !important;
          width: calc(100% - var(--dash-sidebar-width)) !important;
          max-width: calc(100% - var(--dash-sidebar-width)) !important;
          height: var(--dash-topbar-height) !important;
          min-height: var(--dash-topbar-height) !important;
          z-index: 950 !important;
          margin: 0 !important;
        }

        @media (min-width: 768px) and (max-width: 1199px) {
          html body main.dashboard-shell > aside.sidebar.dashboard-sidebar {
            width: var(--dash-tablet-sidebar-width) !important;
            min-width: var(--dash-tablet-sidebar-width) !important;
            max-width: var(--dash-tablet-sidebar-width) !important;
          }

          html body main.dashboard-shell > div.main.dashboard-main {
            width: calc(100% - var(--dash-tablet-sidebar-width)) !important;
            max-width: calc(100% - var(--dash-tablet-sidebar-width)) !important;
            margin-left: var(--dash-tablet-sidebar-width) !important;
          }

          html body main.dashboard-shell > div.main.dashboard-main > header.topbar.dashboard-topbar {
            left: var(--dash-tablet-sidebar-width) !important;
            width: calc(100% - var(--dash-tablet-sidebar-width)) !important;
            max-width: calc(100% - var(--dash-tablet-sidebar-width)) !important;
          }
        }

        @media (max-width: 767px) {
          html body main.dashboard-shell > aside.sidebar.dashboard-sidebar {
            width: var(--dash-mobile-sidebar-width) !important;
            min-width: var(--dash-mobile-sidebar-width) !important;
            max-width: var(--dash-mobile-sidebar-width) !important;
          }

          html body main.dashboard-shell > div.main.dashboard-main {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
          }

          html body main.dashboard-shell > div.main.dashboard-main > header.topbar.dashboard-topbar {
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
      <div
        className={`dashboard-sidebar-backdrop ${sidebarOpen && isMobileViewport ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <button
        type="button"
        className="dashboard-legacy-sidebar-toggle"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open navigation menu"
      >
        â˜°
      </button>
      <aside className={`sidebar dashboard-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
          <div className="dashboard-sidebar-card">
            <button
              type="button"
              className="dashboard-sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
            >
              Ã—
            </button>
            <div className="sidebar-logo dashboard-brand reference-brand">
              <div className="logo-mark" aria-hidden="true"><i className="ti ti-mail-bolt" /></div>
              <span className="reference-brand-copy">
                <strong className="logo-text">IntelliMail</strong>
                <small className="logo-sub">MAIL PILOT</small>
              </span>
            </div>

          <div className="dashboard-sidebar-stack">
            <div className={`sidebar-search dashboard-sidebar-search ${normalizedSearchQuery ? 'active' : ''}`}>
              <div className="search-wrap">
              <i className="ti ti-search si-icon" aria-hidden="true" />
              <input
                className="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search"
                placeholder="Search anything..."
              />
            </div>
            </div>
          </div>
          <div className="dashboard-sidebar-nav">
            <nav className="dashboard-sidebar-menu">
              <div className="nav-section-label reference-nav-label">Main</div>
              {SIDEBAR_PRIMARY_ITEMS.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={`nav-item dashboard-primary-link ${item.tone} ${(!activeSidebarView && item.label === 'Dashboard') || activeSidebarView === item.label ? 'active' : ''}`}
                  onClick={(event) => openSidebarBlankView(item, event)}
                >
                  <i className={`ti ${getSidebarIconClass(item.label)} dashboard-link-icon`} aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              ))}
              <div className="nav-section-label reference-nav-label">Campaigns</div>
              {SIDEBAR_WORKSPACE_ITEMS.map((item) => renderSidebarNode(item))}
            </nav>
            <div
              className={`plan-card dashboard-upgrade-card dashboard-subscription-card usage-${profileCredits.warningLevel || 'healthy'}`}
              role="button"
              tabIndex={0}
              onClick={openSubscriptionDetails}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openSubscriptionDetails();
                }
              }}
              aria-label="Open subscription and credit details"
            >
              <div className="plan-header">
                <span className="plan-name">Basic Plan</span>
                <span className="plan-tag">Active</span>
              </div>
              <div className="plan-credits">300</div>
              <div className="plan-credits-label">credits remaining</div>
              <div className="dashboard-upgrade-meta reference-plan-meta">
                <span>Basic · Free forever</span>
              </div>
              <button
                type="button"
                className="upgrade-btn dashboard-upgrade-button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleUpgradePlan();
                }}
              >
                Pending Enterprise
              </button>
            </div>

            <div className="user-row reference-sidebar-user">
              <div className="user-avatar">AM</div>
              <div className="user-copy">
                <strong className="user-name">Akshay More</strong>
                <small className="user-plan">Basic · Free forever</small>
              </div>
              <div className="user-actions">
                <button type="button" className="icon-btn user-icon-btn" onClick={() => router.push('/dashboard/user/profile/settings')} aria-label="Settings"><i className="ti ti-settings" /></button>
                <button type="button" className="icon-btn user-icon-btn" onClick={logout} aria-label="Log out"><i className="ti ti-logout" /></button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main dashboard-main">
      <div id="dashboard-top" />
      <header className="topbar dashboard-topbar">
        <button
          type="button"
          className="dashboard-mobile-sidebar-toggle dashboard-hamburger-button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <i className="ti ti-menu-2" aria-hidden="true" />
        </button>
        <div className="topbar-tabs dashboard-topbar-tabs">
          {TOP_NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`tb-tab dashboard-topbar-tab ${activeTopNav === item.label ? 'active' : ''}`}
              onClick={() => handleTopNavSelect(item)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="topbar-actions dashboard-topbar-actions">
          <button
            type="button"
            className="dashboard-mobile-filter-toggle"
            onClick={() => setShowMobileFilters((current) => !current)}
            aria-label="Open dashboard filters"
            aria-expanded={showMobileFilters}
          >
            <i className="ti ti-adjustments-horizontal" aria-hidden="true" />
          </button>
          <div
            ref={topbarMobileFiltersRef}
            className={`dashboard-topbar-filter-group ${showMobileFilters ? 'open' : ''}`}
          >
          <select
            className="tb-select dashboard-topbar-date-select"
            value={selectedStatsRange || ''}
            onChange={(event) => applyRangeSelection(event.target.value)}
          >
            <option value="">Select Date</option>
            {SUMMARY_RANGES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
            {userRangeOptions.map((item) => (
              <option key={item.value} value={item.baseValue || '7d'}>{item.label}</option>
            ))}
          </select>

          <select
            className="tb-select dashboard-topbar-project-select"
            value={project || ''}
            onChange={(event) => {
              if (event.target.value === '__add__') {
                addProjectOption();
                return;
              }
              selectProject(event.target.value);
            }}
          >
            <option value="">Select Project</option>
            {projectOptions.map((item) => (
              <option key={item} value={item}>{item.toUpperCase()}</option>
            ))}
            <option value="__add__">Add Project</option>
          </select>

          <select
            className="tb-select dashboard-topbar-sender-select"
            value={selectedAccount || ''}
            onChange={(event) => {
              if (!event.target.value) return;
              selectTopbarMail(event.target.value);
            }}
          >
            <option value="">Select Sender</option>
            {projectAccounts.map((account) => (
              <option key={account.id} value={account.id}>{account.from}</option>
            ))}
            <option value="__oauth_add__">Add New Mail</option>
          </select>
          </div>
          <div className="dashboard-topbar-profile-wrap" ref={topbarProfileDropdownRef}>
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
              <span className="dashboard-topbar-profile-name">{profileDisplayName}</span>
            </button>
            {showTopbarProfileDropdown ? (
              <div className="dashboard-topbar-dropdown-menu" style={{ minWidth: 240, right: 0 }}>
                <input
                  ref={topbarProfilePhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="dashboard-profile-photo-input"
                  onChange={handleTopbarProfilePhotoUpload}
                />
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
                    topbarProfilePhotoInputRef.current?.click();
                  }}
                >
                  Add Profile Photo
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile');
                  }}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile/settings');
                  }}
                >
                  Settings
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile/notifications');
                  }}
                >
                  Notifications
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile/billing');
                  }}
                >
                  Billing
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    router.push('/dashboard/user/profile/security');
                  }}
                >
                  Security
                </button>
                <button
                  type="button"
                  className="dashboard-topbar-dropdown-item logout"
                  onClick={() => {
                    setShowTopbarProfileDropdown(false);
                    logout();
                  }}
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {showTopbarRangeDropdown && typeof window !== 'undefined'
        ? createPortal(
            <div className="dashboard-popup-backdrop" onClick={() => setShowTopbarRangeDropdown(false)}>
              <div
                ref={topbarRangeDropdownRef}
                className="dashboard-popup-card dashboard-range-popup"
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
              >
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
                Ã— Close
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
                Ã— Close
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
            <strong>
              {String(toast.message || '').includes('Campaign Scheduled Successfully')
                ? 'Campaign Scheduled Successfully'
                : toast.tone === 'error'
                  ? 'Action failed'
                  : toast.tone === 'success'
                    ? 'Action completed'
                    : 'Notification'}
            </strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="dashboard-toast-close" onClick={() => setToast(null)} aria-label="Close notification">
            Ã— Close
          </button>
        </div>
      ) : null}

      {showSubscriptionDetails && typeof document !== 'undefined'
        ? createPortal(
            <div className="dashboard-subscription-modal-backdrop" onClick={() => setShowSubscriptionDetails(false)}>
              <section className="dashboard-subscription-modal" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog">
                <div className="dashboard-subscription-modal-head">
                  <div>
                    <span>Subscription</span>
                    <h2>{profileCredits.planName || 'Basic'} Plan</h2>
                    <p>{profileUser.email || 'Current user'} has a separate daily mail limit.</p>
                  </div>
                  <button type="button" onClick={() => setShowSubscriptionDetails(false)} aria-label="Close subscription details">
                    Ã—
                  </button>
                </div>

                <div className="dashboard-subscription-modal-grid">
                  <article>
                    <span>Monthly Mail Limit</span>
                    <strong>{Number(profileCredits.monthlyLimit || profileCredits.totalCredits || 0).toLocaleString()}</strong>
                  </article>
                  <article>
                    <span>Used Credits</span>
                    <strong>{Number(profileCredits.usedCredits || 0).toLocaleString()}</strong>
                  </article>
                  <article>
                    <span>Remaining Credits</span>
                    <strong>{Number(profileCredits.remainingCredits || 0).toLocaleString()}</strong>
                  </article>
                  <article>
                    <span>Daily Mail Limit</span>
                    <strong>{Number(profileCredits.dailyLimit || 500).toLocaleString()}</strong>
                  </article>
                  <article>
                    <span>Used Today</span>
                    <strong>{Number(profileCredits.dailyUsedCredits || 0).toLocaleString()}</strong>
                  </article>
                  <article>
                    <span>Remaining Today</span>
                    <strong>{Number(profileCredits.dailyRemainingCredits ?? profileCredits.dailyLimit ?? 500).toLocaleString()}</strong>
                  </article>
                  <article>
                    <span>Usage</span>
                    <strong>{Math.round(profileCredits.creditUsagePercent || profileCredits.usagePercentage || 0)}%</strong>
                  </article>
                  <article>
                    <span>Status</span>
                    <strong>{String(profileCredits.status || 'active').replace(/_/g, ' ')}</strong>
                  </article>
                  <article>
                    <span>Next Plan</span>
                    <strong>{profileCredits.upgradeTargetPlan || profileCredits.nextPlan || 'Starter'}</strong>
                  </article>
                  <article>
                    <span>Next Daily Limit</span>
                    <strong>{Number(profileCredits.upgradeTargetDailyLimit || profileCredits.dailyLimit || 500).toLocaleString()}</strong>
                  </article>
                  <article>
                    <span>Renewal Date</span>
                    <strong>{profileCredits.renewalDate ? new Date(profileCredits.renewalDate).toLocaleDateString() : 'Next month'}</strong>
                  </article>
                  <article>
                    <span>Upgrade Request</span>
                    <strong>{profileCredits.upgradeRequestPending ? `Pending ${profileCredits.requestedUpgradePlan || ''}` : 'None'}</strong>
                  </article>
                </div>

                <div className="dashboard-subscription-modal-progress">
                  <div>
                    <span>Credit usage this month</span>
                    <strong>{Number(profileCredits.usedCredits || 0).toLocaleString()} / {Number(profileCredits.monthlyLimit || profileCredits.totalCredits || 0).toLocaleString()}</strong>
                  </div>
                  <i>
                    <b style={{ width: `${Math.max(0, Math.min(100, profileCredits.creditUsagePercent || profileCredits.usagePercentage || 0))}%` }} />
                  </i>
                </div>

                <div className="dashboard-subscription-modal-progress">
                  <div>
                    <span>Daily usage</span>
                    <strong>{Number(profileCredits.dailyUsedCredits || 0).toLocaleString()} / {Number(profileCredits.dailyLimit || 500).toLocaleString()}</strong>
                  </div>
                  <i>
                    <b style={{ width: `${Math.max(0, Math.min(100, profileCredits.dailyUsagePercentage || 0))}%` }} />
                  </i>
                </div>

                {profileCredits.creditUsagePercent >= 80 || profileCredits.sendingDisabled ? (
                  <p className={`dashboard-subscription-modal-warning ${profileCredits.creditUsagePercent >= 95 || profileCredits.sendingDisabled ? 'danger' : ''}`}>
                    {profileCredits.dailyRemainingCredits <= 0
                      ? 'Daily limit reached. Ask admin to approve an upgrade or wait until tomorrow.'
                      : profileCredits.sendingDisabled
                      ? 'Monthly limit reached. Sending is disabled until renewal or upgrade.'
                      : profileCredits.creditUsagePercent >= 95
                        ? 'Usage is above 95%. Upgrade soon to avoid blocked sending.'
                        : 'Usage is above 80%. Keep an eye on remaining credits.'}
                  </p>
                ) : null}

                <div className="dashboard-subscription-modal-actions">
                  <button type="button" className="ghost subtle" onClick={() => setShowSubscriptionDetails(false)}>Close</button>
                  <button
                    type="button"
                    className="upgrade-btn dashboard-upgrade-button"
                    onClick={() => {
                      setShowSubscriptionDetails(false);
                      handleUpgradePlan();
                    }}
                  >
                    {profileCredits.upgradeTargetPlan && profileCredits.upgradeTargetPlan !== profileCredits.planName
                      ? 'Upgrade Daily Limit'
                      : 'Manage Plan'}
                  </button>
                </div>

                <div className="dashboard-subscription-transactions">
                  <div>
                    <h3>Recent Credit Activity</h3>
                    {subscriptionDetailsLoading ? <span>Loading...</span> : <span>{creditTransactions.length} records</span>}
                  </div>
                  <div className="dashboard-subscription-transaction-list">
                    {creditTransactions.length ? creditTransactions.map((item) => (
                      <article key={item._id || `${item.reason}-${item.createdAt}`}>
                        <div>
                          <strong>{String(item.reason || 'Credit update').replace(/_/g, ' ')}</strong>
                          <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent'}</span>
                        </div>
                        <b className={item.type === 'credit' ? 'positive' : 'negative'}>
                          {item.type === 'credit' ? '+' : '-'}{Math.abs(Number(item.credits || 0))}
                        </b>
                      </article>
                    )) : (
                      <p>No credit transactions yet.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>,
            document.body
          )
        : null}

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
        campaignRefreshing={campaignRefreshing}
        onRefreshCampaigns={() => refreshCampaignData({ source: 'manual-button' })}
        calendarDays={calendarDays}
        selectedAccountLabel={selectedAccountLabel}
        senderAccounts={accounts}
        selectedSenderAccountId={selectedAccount}
        onSelectSenderAccount={(accountId) => {
          setSelectedAccount(accountId);
          const nextAccount = accounts.find((account) => account.id === accountId);
          setActiveAccount(nextAccount?.from || '');
        }}
        senderEmptyMessage={
          project
            ? `No sender IDs added for this project.`
            : 'No sender IDs available.'
        }
        project={project}
        projectOptions={projectOptions}
        barChartMetrics={barChartMetrics}
        logs={logs}
        workspaceOverviewItems={workspaceOverviewItems}
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
        rowRange={rowRange}
        onRowRangeChange={setRowRange}
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
                    <button className="button" onClick={() => createAndStartCampaign()}>Create Campaign</button>
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







