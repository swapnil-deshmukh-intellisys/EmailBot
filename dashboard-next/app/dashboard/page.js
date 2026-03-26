'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import RichTextEditor from './components/RichTextEditor';
import { FancyStatCard } from './components/DashboardUiBits';
import {
  COUNTRY_TIME_SLOTS,
  DRAFT_CATEGORIES,
  PREVIEW_ROWS_PER_PAGE,
  QUICK_DRAFT_PREFIX,
  REPLY_MODE_DRAFT_TYPES,
  SUMMARY_RANGES
} from './dashboardConstants';
import useStats from './hooks/useStats';
import useCampaigns from './hooks/useCampaigns';
import { SIDEBAR_PRIMARY_ITEMS, SIDEBAR_WORKSPACE_ITEMS, TOP_NAV_ITEMS } from './dashboardLayoutConfig';
import { buildScheduledDate, normalizeScheduledSlotInput } from './utils/schedule';
import { buildWordPadTableHtml } from './utils/wordPad';
import draftTemplates from './draftTemplates';
// import ScriptManager from "../dashboard/ScriptManager";

const DashboardStats = dynamic(() => import('./components/DashboardStats'));
const CampaignTable = dynamic(() => import('./components/CampaignTable'));
const LeadList = dynamic(() => import('./components/LeadList'));
const ActivityPanel = dynamic(() => import('./components/ActivityPanel'));

function FancyStatCardLegacy({ title, value, percent = 0, trend = 0, color = '#2563eb' }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const positive = trend >= 0;
  return (
    <div className="fancy-stat-card">
      <div className="fancy-stat-top">
        <span className={`fancy-stat-badge ${positive ? 'up' : 'down'}`}>
          {positive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </span>
        <span className="fancy-stat-menu">⋮</span>
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

const ACTIVE_CAMPAIGN_STATUSES = new Set(['Running', 'Paused']);

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
  headerBg: '#edf2f7',
  headerColor: '#1e293b',
  cellBg: '#ffffff',
  cellColor: '#0f172a',
  columnWidths: {}
};


export default function DashboardPage() {
  const defaultProjectOptions = ['tec', 'tut'];
  const [stats, setStats] = useState({ totalUploaded: 0, sent: 0, pending: 0, failed: 0, last10DaysStats: 0, dailyMailCounts: [] });
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
  const [campaignName, setCampaignName] = useState('Write a Campaign name');
  const [delaySeconds, setDelaySeconds] = useState(60);
  const [batchSize, setBatchSize] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [activeTopNav, setActiveTopNav] = useState('Home');
  const [activeSidebarView, setActiveSidebarView] = useState('');
  const [project, setProject] = useState('tec');
  const [projectOptions, setProjectOptions] = useState(defaultProjectOptions);
  const [showTopbarProjectDropdown, setShowTopbarProjectDropdown] = useState(false);
  const [showTopbarRangeDropdown, setShowTopbarRangeDropdown] = useState(false);
  const [showTopbarMailDropdown, setShowTopbarMailDropdown] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [activeAccount, setActiveAccount] = useState('');
  const [showAllUserActivity, setShowAllUserActivity] = useState(true);
  const projectAccounts = useMemo(() => accounts, [accounts]);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [selectedDraft, setSelectedDraft] = useState('cover_story');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [blankWordPad, setBlankWordPad] = useState('');

  const [showAddDraft, setShowAddDraft] = useState(false);
  const [newDraftCategory, setNewDraftCategory] = useState("cover_story");
  const [newDraftSubject, setNewDraftSubject] = useState("");
  const [newDraftBody, setNewDraftBody] = useState("");

  const loadScript = (script) => {
    setDraftSubject(script.subject);
    setDraftBody(script.body);
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
    activeAccount ||
    projectAccounts.find((account) => account.id === selectedAccount)?.from ||
    'Select Mail ID';
  const selectedAccountObj = useMemo(
    () => projectAccounts.find((account) => account.id === selectedAccount) || null,
    [projectAccounts, selectedAccount]
  );
  const selectedSenderEmail = String(selectedAccountObj?.from || activeAccount || '').trim().toLowerCase();
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


const startEditingDraft = (draft) => {
  setEditingDraftId(draft._id || draft.id);
  setNewDraftTitle(draft.title);
  setNewDraftCategory(draft.category);
  setNewDraftSubject(draft.subject);
  setNewDraftBody(draft.body);
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
      setSavedDrafts(data.drafts || data || []);
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
    if (!window.confirm('Delete all campaigns in the Campaigns section? This cannot be undone.')) return;
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
    const tpl = draftTemplates[selectedDraft];
    if (tpl) {
      setDraftSubject(tpl.subject || "");
      setDraftBody(tpl.body || "");
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
        safeFetchJson(buildCampaignsUrl())
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
        const cps = campaignsRes.value || {};
        setCampaigns(cps.campaigns || []);
        setSelectedCampaignIds((prev) =>
          (cps.campaigns || [])
            .filter((c) => !ACTIVE_CAMPAIGN_STATUSES.has(c.status))
            .map((c) => c._id)
            .filter((id) => prev.includes(id))
        );
      } else {
        errors.push(campaignsRes.reason?.message || 'Failed to load campaigns');
      }

      const accountsRes = await accountsPromise;
      if (accountsRes?.__error) {
        errors.push(accountsRes.__error?.message || 'Failed to load accounts');
      }

      const accList =
        !accountsRes?.__error
          ? (accountsRes?.accounts || [])
          : [];
      if (selectedAccount && !accList.find((a) => a.id === selectedAccount)) {
        setSelectedAccount("");
      }

      const firstListId =
        statsRes.status === 'fulfilled' ? statsRes.value?.lists?.[0]?._id : '';
      if (!selectedListId && firstListId) {
        setSelectedListId(firstListId);
      }
      const firstTemplateId =
        templatesRes.status === 'fulfilled' ? templatesRes.value?.templates?.[0]?._id : '';
      if (!selectedTemplateId && firstTemplateId) {
        setSelectedTemplateId(firstTemplateId);
      }
      setError(errors[0] || '');
    } catch (e) {
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
        safeFetchJson(buildCampaignsUrl())
      ]);

      if (statsRes.status === 'fulfilled') {
        const st = statsRes.value || {};
        setStats(st);
        setLists(st.lists || []);
      }

      if (campaignsRes.status === 'fulfilled') {
        const cps = campaignsRes.value || {};
        setCampaigns(cps.campaigns || []);
        setSelectedCampaignIds((prev) =>
          (cps.campaigns || [])
            .filter((c) => !ACTIVE_CAMPAIGN_STATUSES.has(c.status))
            .map((c) => c._id)
            .filter((id) => prev.includes(id))
        );
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
    loadAll();
  }, [showAllUserActivity, project, selectedAccount, activeAccount, selectedStatsDate, selectedStatsRange, customStatsStartDate, customStatsEndDate]);


  useEffect(() => {
    const id = setInterval(() => loadLiveData(), 30000);
    return () => clearInterval(id);
  }, [
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

  const createCampaign = async ({ skipReload = false } = {}) => {
    try {
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
          options: { batchSize, delaySeconds: Number(delaySeconds), replyMode: isReplyModeCampaignType }
        })
      });
      const createdCampaign = data.campaign || null;
      if (createdCampaign?._id) {
        setPendingCampaignId(createdCampaign._id);
        setShowDraftEditor(true);
      }
      notify('Campaign created successfully.', 'success');
      if (!skipReload) {
        void loadAll();
      }
      return createdCampaign;
    } catch (e) {
      notify(e.message || 'Failed to create campaign', 'error');
      return null;
    }
  };

  const createAndStartCampaign = async () => {
    let campaignId = pendingCampaignId;

    if (!campaignId) {
      const campaign = await createCampaign({ skipReload: true });
      campaignId = campaign?._id || '';
    }

    if (!campaignId) return;

    await startCampaign(campaignId, { schedule: Boolean(scheduledSlot) });
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
      if (options.schedule) {
        const effectiveSlot = scheduledSlot;
        if (!effectiveSlot) {
          notify('Select a scheduled time first.', 'info');
          return;
        }
        const zoneConfig = COUNTRY_TIME_SLOTS[scheduledCountry];
        const targetDate = buildScheduledDate(zoneConfig.timezone, effectiveSlot);
        if (!targetDate) {
          notify('Invalid scheduled time.', 'error');
          return;
        }
        const label = `${scheduledCountry.toUpperCase()} - ${effectiveSlot} (${targetDate.toLocaleString()})`;
        await safeFetchJson(`/api/campaigns/${campaignId}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            country: scheduledCountry,
            slot: effectiveSlot,
            timezone: zoneConfig.timezone,
            label,
            scheduledAt: targetDate.toISOString()
          })
        });
        setScheduledStartLabel(label);
        setPendingCampaignId('');
        notify(`Campaign scheduled for ${scheduledCountry.toUpperCase()} at ${effectiveSlot}`, 'success');
        await loadAll();
        return;
      }
      const data = await safeFetchJson(`/api/campaigns/${campaignId}/start`, { method: 'POST' });
      setPendingCampaignId('');
      if (data.started === false && data.message) {
        notify(data.message, 'info');
      } else {
        notify('Campaign started successfully.', 'success');
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

  const openSidebarBlankView = (label, event) => {
    if (event) {
      event.preventDefault();
    }
    if (label === 'Revenue') {
      setActiveTopNav('Revenue');
      setActiveSidebarView('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveSidebarView(label);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showSidebarBlankView = Boolean(activeSidebarView);

  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-card">
          <div className="dashboard-brand">
            <div className="dashboard-brand-mark">AM</div>
            <div>
              <h2>automail</h2>
            </div>
          </div>

          <div className="dashboard-sidebar-stack">
            {SIDEBAR_PRIMARY_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className={`dashboard-primary-link ${item.tone}`}
                onClick={(event) => openSidebarBlankView(item.label, event)}
              >
                <span className="dashboard-link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
          <div className="dashboard-sidebar-nav" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
            <div className="dashboard-sidebar-section-head">
              <div>
                <h3>Workspace</h3>
              </div>
              <button type="button" className="dashboard-sidebar-plus" onClick={(event) => openSidebarBlankView('Workspace', event)}>+</button>
            </div>

            <nav className="dashboard-sidebar-menu">
              {SIDEBAR_WORKSPACE_ITEMS.map((item) => (
                <div key={item.label} className="dashboard-sidebar-item">
                  <a
                    href={item.href}
                    className="dashboard-sidebar-link"
                    onClick={(event) => openSidebarBlankView(item.label, event)}
                  >
                    <span className="dashboard-link-icon soft">{item.icon}</span>
                    <span>{item.label}</span>
                  </a>
                  {item.subItems?.length ? (
                    <div className="dashboard-sidebar-submenu">
                      {item.subItems.map((subItem) => (
                        <button
                          key={subItem}
                          type="button"
                          className="dashboard-sidebar-subitem"
                          onClick={(event) => openSidebarBlankView(subItem, event)}
                        >
                          {subItem}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </nav>

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
          <div className="dashboard-topbar-dropdown" ref={topbarRangeDropdownRef}>
            <button
              type="button"
              className="dashboard-topbar-pill"
              onClick={() => setShowTopbarRangeDropdown((prev) => !prev)}
            >
              {SUMMARY_RANGES.find((range) => range.value === selectedStatsRange)?.label || 'Quick Range'}
            </button>
            {showTopbarRangeDropdown ? (
              <div className="dashboard-topbar-dropdown-menu">
                {SUMMARY_RANGES.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    className={`dashboard-topbar-dropdown-item ${selectedStatsRange === range.value ? 'active' : ''}`}
                    onClick={() => selectTopbarRange(range.value)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="dashboard-topbar-dropdown" ref={topbarProjectDropdownRef}>
            <button
              type="button"
              className={`badge ${project ? 'sent' : 'failed'}`}
              onClick={() => setShowTopbarProjectDropdown((prev) => !prev)}
              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25, cursor: 'pointer' }}
            >
              <span>Active Project:</span>
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
              <span>Working Mail:</span>
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
          <button type="button" className="dashboard-topbar-profile">
            <span className="dashboard-topbar-avatar">RY</span>
            <span>Rylic</span>
          </button>
        </div>
      </section>
      {toast ? (
        <div className={`dashboard-toast dashboard-toast-${toast.tone}`} role="status" aria-live="polite">
          <div>
            <strong>{toast.tone === 'error' ? 'Action failed' : toast.tone === 'success' ? 'Action completed' : 'Notification'}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="dashboard-toast-close" onClick={() => setToast(null)} aria-label="Close notification">
            ×
          </button>
        </div>
      ) : null}

      {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}

      {showSidebarBlankView ? (
        <section className="grid" id="summary-panel">
          <div
            style={{
              minHeight: 'calc(100vh - 140px)',
              border: '1px solid #d7e0ea',
              borderRadius: 24,
              background: 'linear-gradient(180deg, #ffffff, #f8fbff)',
              boxShadow: '0 20px 44px rgba(15, 23, 42, 0.06)',
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
                <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12 }}>
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
                            border: '1px solid #cbd5e1',
                            borderRadius: 10,
                            background: '#fff',
                            padding: 8,
                            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)'
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
                                  background: selectedListId === list._id ? '#eff6ff' : 'transparent'
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
                  <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12, overflow: 'hidden' }}>
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
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: isReplyModeCampaignType ? '#166534' : 'var(--muted)', fontWeight: 600 }}>
                      Reply Mode: {isReplyModeCampaignType ? 'ON (Reply All in thread)' : 'OFF (New Email)'}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Client List</p>
                    <span className={`badge ${selectedListId ? 'sent' : 'failed'}`} style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedListLabel}
                    </span>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Batch Size</p>
                      <input className="input" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} placeholder="1-9 or 25-50" />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Delay (Seconds)</p>
                      <input className="input" type="number" min="60" value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} placeholder="Delay(s)" />
                    </div>
                  </div>
                  <div className="row" style={{ marginTop: 2 }}>
                    <button className="button" onClick={createCampaign}>Create Campaign</button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      ) : (
      <>
      {activeTopNav === 'Revenue' ? (
        <section className={`card grid ${isSearchMatch('summary') ? 'dashboard-search-match' : ''}`} id="summary-panel">
          <div className="row" style={{ flexWrap: "wrap", gap: 16, alignItems: 'stretch' }}>
            <div style={{ flex: '1 1 420px', border: '1px solid #cfe3ff', borderRadius: 14, padding: 14, background: '#f8fbff' }}>
              <h3 style={{ margin: '0 0 6px' }}>Summary</h3>
              <div className="row" style={{ flexWrap: "wrap", gap: 12, alignItems: 'end' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 8, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={showAllUserActivity}
                    onChange={(e) => setShowAllUserActivity(e.target.checked)}
                  />
                  Show All User Activity (Admin)
                </label>
                <div>
                  <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Project / Client</p>
                  <select
                    className="select"
                    style={{
                      maxWidth: 160,
                      borderColor: project ? '#0ea5e9' : undefined,
                      background: project ? '#e0f2fe' : undefined,
                      color: project ? '#0f172a' : undefined,
                      fontWeight: project ? 700 : undefined
                    }}
                    value={project}
                    onChange={(e) => selectProject(e.target.value)}
                  >
                    {projectOptions.map((item) => (
                      <option key={item} value={item}>
                        {item.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Select Mail ID</p>
                  <select
                    className="select"
                    style={{ maxWidth: 420 }}
                    value={selectedAccount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__oauth_add__") {
                        startGraphOAuth();
                        return;
                      }
                      setSelectedAccount(v);
                    }}
                  >
                    <option value="">Select Mail ID</option>
                    {projectAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.from}
                      </option>
                    ))}
                    <option value="__oauth_add__">Connect New Account</option>
                  </select>
                </div>
                <button className="button" type="button" onClick={connectSelectedAccount}>Select Sender</button>
                <button className="button secondary" type="button" onClick={startGraphOAuth}>Add New Mail</button>
              </div>
              <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 12 }}>
                {showAllUserActivity
                  ? 'Admin view is ON: campaigns and logs from all users are visible.'
                  : 'Admin view is OFF: campaigns and logs are filtered by selected Project and Mail ID.'}
              </p>
            </div>
            <div style={{ flex: '1 1 420px', border: '1px solid #d8e6dc', borderRadius: 14, padding: 14, background: '#f8fcf8' }}>
              <h3 style={{ margin: '0 0 6px' }}>Filter</h3>
              <div className="row" style={{ flexWrap: "wrap", gap: 12, alignItems: 'end' }}>
                <div>
                  <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Starting Date</p>
                  <input
                    className="input"
                    type="date"
                    value={selectedStatsDate}
                    onChange={(e) => {
                      setSelectedStatsDate(e.target.value);
                      setSelectedStatsRange('');
                      setCustomStatsStartDate('');
                      setCustomStatsEndDate('');
                      setShowDayCounts(Boolean(e.target.value));
                    }}
                  />
                </div>
                <div>
                  <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Quick Range</p>
                  <select
                    className="select"
                    value={selectedStatsRange}
                    onChange={(e) => handleStatsRangeSelection(e.target.value)}
                  >
                    <option value="">Select Range</option>
                    {SUMMARY_RANGES.map((range) => (
                      <option key={range.value} value={range.value}>
                        {range.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="button secondary"
                  type="button"
                  onClick={resetSummaryFilters}
                  disabled={!selectedStatsDate && !selectedStatsRange && !customStatsStartDate && !customStatsEndDate}
                >
                  Clear Filter
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={resetSummaryFilters}
                  style={{ position: 'relative', zIndex: 1, pointerEvents: 'auto' }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : <div id="summary-panel" />}
      {showCustomRangePopup ? (
        <div className="dashboard-popup-backdrop" onClick={() => setShowCustomRangePopup(false)}>
          <div className="dashboard-popup-card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px' }}>Filter</h3>
            <div className="grid" style={{ gap: 12 }}>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Start Date</p>
                <input
                  className="input"
                  type="date"
                  value={customStatsStartDate}
                  onChange={(e) => {
                    setCustomStatsStartDate(e.target.value);
                    setShowDayCounts(Boolean(e.target.value || customStatsEndDate));
                  }}
                />
              </div>
              <div>
                <p style={{ margin: '0 0 6px', fontWeight: 600 }}>End Date</p>
                <input
                  className="input"
                  type="date"
                  value={customStatsEndDate}
                  onChange={(e) => {
                    setCustomStatsEndDate(e.target.value);
                    setShowDayCounts(Boolean(customStatsStartDate || e.target.value));
                  }}
                />
              </div>
              <div className="row" style={{ gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    resetSummaryFilters();
                    setShowCustomRangePopup(false);
                  }}
                >
                  Clear Filter
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    resetSummaryFilters();
                    setShowCustomRangePopup(false);
                  }}
                >
                  Reset
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={applyCustomRangeSelection}
                >
                  Select
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setShowCustomRangePopup(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DashboardStats
        isSearchMatch={isSearchMatch}
        fancyStats={fancyStats}
        showDayCounts={showDayCounts}
        selectedStatsRange={selectedStatsRange}
        selectedStatsDate={selectedStatsDate}
        summaryRanges={SUMMARY_RANGES}
        dailyMailCounts={stats.dailyMailCounts}
        onCloseDayCounts={() => setShowDayCounts(false)}
      />

      <section className={`card grid ${isSearchMatch('upload') ? 'dashboard-search-match' : ''}`} id="upload-client-files">
        <h3>Upload Client Files</h3>
        <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12 }}>
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
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
            <span className={`badge ${selectedListName ? 'sent' : 'failed'}`}>
              {selectedListName || 'No file selected'}
            </span>
            <div ref={uploadedFilesDropdownRef}>
              <LeadList
                lists={lists}
                selectedListId={selectedListId}
                selectedUploadedFileIds={selectedUploadedFileIds}
                showUploadedFilesDropdown={showUploadedFilesDropdown}
                setShowUploadedFilesDropdown={setShowUploadedFilesDropdown}
                setSelectedUploadedFileIds={setSelectedUploadedFileIds}
                setSelectedListId={setSelectedListId}
                onDeleteSelected={deleteSelectedUploadedFile}
                onDeleteAll={deleteAllUploadedFiles}
              />
            </div>
            {loading ? <p>Uploading...</p> : null}
          </div>
        </div>
        {preview.length ? (
          <>
            <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12, overflow: 'hidden' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <p>Uploaded file preview</p>
                <div className="row">
                  {showUploadPreview ? (
                    <>
                      <button
                        className="button"
                        type="button"
                        onClick={addPreviewColumn}
                      >
                        Add Column
                      </button>
                      <button
                        className="button"
                        type="button"
                        onClick={addPreviewRow}
                      >
                        Add Row
                      </button>
                      <button
                        className="button"
                        type="button"
                        onClick={savePreviewEdits}
                        disabled={!previewDirty}
                      >
                        Save Changes
                      </button>
                    </>
                  ) : null}
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
              {showUploadPreview ? (
                <div style={{ marginTop: 12, maxHeight: 470, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
                  <div className="row" style={{ gap: 12, alignItems: 'end', marginTop: 12 }}>
                    <div>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Font</p>
                      <select
                        className="select"
                        value={previewStyle.fontFamily}
                        onChange={(e) => updatePreviewStyle('fontFamily', e.target.value)}
                        style={{ minWidth: 150 }}
                      >
                        <option value="Segoe UI">Segoe UI</option>
                        <option value="Arial">Arial</option>
                        <option value="Calibri">Calibri</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Times New Roman">Times New Roman</option>
                      </select>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Font Size</p>
                      <input
                        className="input"
                        type="number"
                        min="10"
                        max="24"
                        value={previewStyle.fontSize}
                        onChange={(e) => updatePreviewStyle('fontSize', Number(e.target.value || 14))}
                        style={{ width: 90 }}
                      />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Header Color</p>
                      <input type="color" value={previewStyle.headerBg} onChange={(e) => updatePreviewStyle('headerBg', e.target.value)} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Header Text</p>
                      <input type="color" value={previewStyle.headerColor} onChange={(e) => updatePreviewStyle('headerColor', e.target.value)} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Cell Color</p>
                      <input type="color" value={previewStyle.cellBg} onChange={(e) => updatePreviewStyle('cellBg', e.target.value)} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Cell Text</p>
                      <input type="color" value={previewStyle.cellColor} onChange={(e) => updatePreviewStyle('cellColor', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginTop: 12, height: 320, overflow: 'hidden' }}>
                    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                        Showing {previewTotalRows ? previewStartIndex + 1 : 0} - {Math.min(previewStartIndex + PREVIEW_ROWS_PER_PAGE, previewTotalRows)} of {previewTotalRows} rows
                      </p>
                      <div className="row" style={{ gap: 8 }}>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => setPreviewPage((prev) => Math.max(1, prev - 1))}
                          disabled={previewPage <= 1}
                        >
                          Prev
                        </button>
                        <span style={{ fontSize: 12, alignSelf: 'center' }}>
                          Page {previewPage}/{previewTotalPages}
                        </span>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => setPreviewPage((prev) => Math.min(previewTotalPages, prev + 1))}
                          disabled={previewPage >= previewTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                    <div className="table-wrap excel-preview" style={{ height: '100%', overflowY: 'auto', overflowX: 'auto' }}>
                      <table
                        className="excel-table"
                        style={{
                          fontFamily: previewStyle.fontFamily,
                          fontSize: `${previewStyle.fontSize}px`
                        }}
                      >
                        <thead>
                          <tr>
                            <th style={{ minWidth: 90 }}>Actions</th>
                            {getPreviewColumns().map((column) => (
                              <th
                                key={column}
                                style={{
                                  background: previewStyle.headerBg,
                                  color: previewStyle.headerColor,
                                  minWidth: previewStyle.columnWidths?.[column] || 140
                                }}
                              >
                                <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                                  <input
                                    className="input"
                                    defaultValue={column}
                                    onBlur={(e) => renamePreviewColumn(column, e.target.value)}
                                    style={{ minWidth: 140, fontWeight: 700, padding: 6, background: 'transparent' }}
                                  />
                                  <input
                                    className="input"
                                    type="number"
                                    min="80"
                                    value={previewStyle.columnWidths?.[column] || 140}
                                    onChange={(e) => updateColumnWidth(column, e.target.value)}
                                    style={{ width: 82, padding: 6 }}
                                  />
                                  <button
                                    className="button danger"
                                    type="button"
                                    onClick={() => deletePreviewColumn(column)}
                                    style={{ padding: '6px 8px' }}
                                  >
                                    X
                                  </button>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pagedPreviewRows.map((row, idx) => {
                            const rowIndex = previewStartIndex + idx;
                            return (
                            <tr key={rowIndex}>
                              <td>
                                <button
                                  className="button danger"
                                  type="button"
                                  onClick={() => deletePreviewRow(rowIndex)}
                                  style={{ padding: '6px 8px' }}
                                >
                                  Delete
                                </button>
                              </td>
                              {getPreviewColumns().map((column) => (
                                <td
                                  key={`${rowIndex}-${column}`}
                                  style={{
                                    background: previewStyle.cellBg,
                                    color: previewStyle.cellColor,
                                    minWidth: previewStyle.columnWidths?.[column] || 140
                                  }}
                                >
                                  <input
                                    className="input"
                                    value={row?.[column] ?? ''}
                                    onChange={(e) => updatePreviewCell(rowIndex, column, e.target.value)}
                                    style={{
                                      minWidth: previewStyle.columnWidths?.[column] || 140,
                                      border: 'none',
                                      padding: 6,
                                      background: 'transparent',
                                      color: previewStyle.cellColor,
                                      fontFamily: previewStyle.fontFamily,
                                      fontSize: `${previewStyle.fontSize}px`
                                    }}
                                  />
                                </td>
                              ))}
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <section className={`card grid ${isSearchMatch('campaignManagement') ? 'dashboard-search-match' : ''}`} id="campaign-management">
        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', alignItems: 'end' }}>
          <div>
            <input className="input" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign Name" />
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Campaign Type</p>
            <select
              className="select"
              value={selectedDraft}
              onChange={(e) => setSelectedDraft(e.target.value)}
            >
              <option value="cover_story">Cover Story</option>
              <option value="reminder">Reminder</option>
              <option value="follow_up">Follow Up</option>
              <option value="updated_cost">Updated Cost</option>
              <option value="final_cost">Final Call</option>
            </select>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: isReplyModeCampaignType ? '#166534' : 'var(--muted)', fontWeight: 600 }}>
              Reply Mode: {isReplyModeCampaignType ? 'ON (Reply All in thread)' : 'OFF (New Email)'}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Client List</p>
            <select className="select" value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)}>
              <option value="">Select List</option>
              {lists.map((l) => <option key={l._id} value={l._id}>{l.name} ({l.leadCount})</option>)}
            </select>
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Batch Size</p>
            <input className="input" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} placeholder="1-9 or 25-50" />
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Delay (Seconds)</p>
            <input className="input" type="number" min="60" value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} placeholder="Delay(s)" />
          </div>
        </div>
        <div className="row">
          <div>
            <button className="button" onClick={createCampaign}>Create Campaign</button>
          </div>
        </div>
      </section>

      <section className={`card grid ${isSearchMatch('draftEditing') ? 'dashboard-search-match' : ''}`} id="draft-editing-panel">
        <div style={{ border: '1px solid #0f172a', borderRadius: 12, padding: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Draft Editing and Setting</h3>
            <button
              className="button secondary"
              type="button"
              onClick={() => setShowDraftEditingSection((prev) => !prev)}
            >
              {showDraftEditingSection ? 'Minimize' : 'Show'}
            </button>
          </div>
        </div>
        {showDraftEditingSection ? (
        <div style={{ border: '1px solid #0f172a', borderRadius: 12, padding: 12, marginTop: 4, height: 640, overflow: 'hidden' }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: '1fr',
              gap: 20,
              alignItems: 'end',
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: 6
            }}
          >
            <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12 }}>
              <div className="row" style={{ gap: 28, alignItems: 'flex-end', flexWrap: 'nowrap' }}>
                <div style={{ flex: '1 1 auto' }}>
                  <div className="row" style={{ gap: 12, alignItems: 'flex-end', flexWrap: 'nowrap' }}>
                    <button
                      className="button"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      Upload File
                    </button>
                    <span className={`badge ${selectedListName ? 'sent' : 'failed'}`} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {selectedListName || 'No file selected'}
                    </span>
                    <div style={{ width: 260, minWidth: 260, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Select Draft Type</p>
                      <select
                        className="select"
                        value={newDraftCategory}
                        onChange={(e) => setNewDraftCategory(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">Customize Draft</option>
                        <option value="cover_story">Cover Story</option>
                        <option value="reminder">Reminder</option>
                        <option value="follow_up">Follow Up</option>
                        <option value="updated_cost">Updated Cost</option>
                        <option value="final_cost">Final Cost</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div style={{ minWidth: 360 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Give Draft Name</p>
                  <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
                    <input
                      className="input"
                      value={changeInDraftValue}
                      onChange={(e) => setChangeInDraftValue(e.target.value)}
                      placeholder=""
                      style={{ width: 260, minWidth: 260 }}
                    />
                    <button
                      className="button"
                      type="button"
                      onClick={openCreateScriptForm}
                      style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      Create Script
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 4, paddingBottom: 4 }}>
                <div
                  ref={draftUploadedFilesDropdownRef}
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
                    onClick={() => setShowDraftUploadedFilesDropdown((prev) => !prev)}
                    style={{ minWidth: 140, flexShrink: 0 }}
                  >
                    Uploaded Files
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={loadSelectedDraftUploadedFile}
                    style={{ minWidth: 180, flexShrink: 0 }}
                    disabled={!selectedDraftUploadedFileIds.length}
                  >
                    Choose Uploaded File
                  </button>
                  {showDraftUploadedFilesDropdown ? (
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
                        border: '1px solid #cbd5e1',
                        borderRadius: 10,
                        background: '#fff',
                        padding: 8,
                        boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)'
                      }}
                    >
                      {lists.length ? (
                        lists.map((list) => (
                          <label
                            key={list._id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 4px',
                              cursor: 'pointer',
                              borderRadius: 6,
                              background: selectedListId === list._id ? '#eff6ff' : 'transparent'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedDraftUploadedFileIds.includes(list._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDraftUploadedFileIds((prev) => [...new Set([...prev, list._id])]);
                                } else {
                                  setSelectedDraftUploadedFileIds((prev) => prev.filter((id) => id !== list._id));
                                }
                              }}
                            />
                            <span
                              onClick={() => setSelectedDraftUploadedFileIds([list._id])}
                              style={{ flex: 1 }}
                            >
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
                {showDraftUploadedFilesDropdown ? (
                  <>
                    <button
                      className="button danger"
                      type="button"
                      onClick={deleteSelectedUploadedFile}
                      disabled={!selectedListId && !selectedUploadedFileIds.length}
                    >
                      Delete Selected
                    </button>
                    <button
                      className="button danger"
                      type="button"
                      onClick={deleteAllUploadedFiles}
                      disabled={!lists.length}
                    >
                      Delete All
                    </button>
                  </>
                ) : null}
              </div>
              <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12, marginTop: 4 }}>
                <h4 style={{ margin: '12px 0 6px' }}>Saved Draft Scripts (for quick draft selection)</h4>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 12 }}>
                  <button
                    className="button"
                    type="button"
                    onClick={openCreateScriptForm}
                    style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                  >
                    Create Script
                  </button>
                  {DRAFT_CATEGORIES.map((item) => {
                    const isActive = savedDraftFilterCategory === item.value;
                    return (
                      <div key={item.value} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => setSavedDraftFilterCategory(item.value)}
                          style={
                            isActive
                              ? {
                                  background: '#eff6ff',
                                  borderColor: '#2563eb',
                                  color: '#1d4ed8',
                                  fontWeight: 700
                                }
                              : undefined
                          }
                        >
                          {item.label}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 12,
                    background: '#f1f5f9',
                    border: '1px solid #d7e0ea',
                    padding: 12,
                    minHeight: 58
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {visibleQuickDraftButtons.length ? (
                      visibleQuickDraftButtons.map(({ label, draft }) => (
                        <button
                          key={label}
                          className="button secondary"
                          type="button"
                          disabled={!draft}
                          onClick={() => {
                            if (draft) handleSavedDraftSelect(draft);
                          }}
                          style={{
                            background: '#eff6ff',
                            borderColor: '#2563eb',
                            color: '#1d4ed8',
                            fontWeight: 700
                          }}
                        >
                          {label}
                        </button>
                      ))
                    ) : (
                      <p style={{ margin: 0, color: '#64748b' }}>No scripts for this draft type.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: showBlankWordPad ? 8 : 0 }}>
                <p style={{ fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                  Edit Word File
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setBlankWordPad('')}
                    disabled={!blankWordPad}
                  >
                    Clear
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setShowBlankWordPad((prev) => !prev)}
                  >
                    {showBlankWordPad ? 'Minimize' : 'Show'}
                  </button>
                </div>
              </div>
              {showBlankWordPad ? (
                <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
                  <RichTextEditor
                    value={blankWordPad}
                    onChange={setBlankWordPad}
                    placeholder="Write here..."
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        ) : null}
        {showDraftEditingSection && showAddDraft && (
          <div className="card" style={{ marginTop: 10, border: '1px solid #0f172a', boxShadow: 'inset 0 0 0 1px #0f172a' }}>
            <div style={{ maxHeight: 620, overflowY: 'auto', paddingRight: 6 }}>
              <h4>{editingDraftId ? 'Edit Draft Script' : 'Create Draft Script'}</h4>
              <p style={{ marginTop: 12, marginBottom: 6 }}>Script Title (optional)</p>
              <input
                className="input"
                value={newDraftTitle}
                onChange={(e) => setNewDraftTitle(e.target.value)}
                placeholder="Script 1, Script 2, etc."
              />
              <p style={{ marginTop: 12, marginBottom: 6 }}>Subject</p>
              <input
                className="input"
                value={newDraftSubject}
                onChange={(e) => setNewDraftSubject(e.target.value)}
                placeholder="Enter Subject"
              />
              <p style={{ marginTop: 12, marginBottom: 6 }}>Draft Body</p>
              <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
                <RichTextEditor
                  value={newDraftBody}
                  onChange={setNewDraftBody}
                />
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button className="button" type="button" onClick={addNewDraft}>
                  {editingDraftId ? 'Update Draft' : 'Submit Draft'}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setShowAddDraft(false);
                    setEditingDraftId(null);
                    setNewDraftTitle('');
                    setNewDraftSubject('');
                    setNewDraftBody('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: showDraftEditor ? 8 : 0 }}>
              <p style={{ fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Draft / Email Body (HTML)
              </p>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="button"
                  type="button"
                  onClick={saveCurrentDraftScript}
                  disabled={!draftSubject && !draftBody}
                >
                  Add Draft
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => {
                    setDraftSubject('');
                    setDraftBody('');
                  }}
                  disabled={!draftSubject && !draftBody}
                >
                  Clear
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setShowDraftEditor((prev) => !prev)}
                >
                  {showDraftEditor ? 'Minimize' : 'Show'}
                </button>
              </div>
            </div>
            {showDraftEditor ? (
              <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
                <p style={{ fontWeight: 600, color: 'var(--text)', marginTop: 12 }}>
                  Subject Line
                </p>
                <input
                  className="input"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  placeholder="Email Subject"
                />
                <RichTextEditor
                  value={draftBody}
                  onChange={setDraftBody}
                />
              </div>
            ) : null}
          </div>
          <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12, marginTop: 12 }}>
            <div className="row">
              <input
                className="input"
                style={{ maxWidth: 320 }}
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="Test recipient email"
              />
              <button
                className="button secondary"
                onClick={sendTestEmail}
              >
                Test Email
              </button>
            </div>
          </div>
        </div>
      </section>

      <div style={{ marginBottom: 12 }}>
        <div style={{ minHeight: 24, marginBottom: 8, textAlign: 'right' }}>
          {scheduledStartLabel ? (
            <span style={{ color: '#166534', fontWeight: 600 }}>
              Scheduled Start: {scheduledStartLabel}
            </span>
          ) : null}
        </div>
        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <button
            className="button secondary"
            type="button"
            onClick={() => setShowScheduledTimePicker((prev) => !prev)}
          >
            Sheduled Time
          </button>
        <button
          className="button"
          type="button"
          onClick={createAndStartCampaign}
        >
          Start Campaign
        </button>
      </div>
      </div>

      {showScheduledTimePicker ? (
        <section className={`card grid ${isSearchMatch('schedule') ? 'dashboard-search-match' : ''}`} style={{ marginTop: -4 }}>
          <h3>Schedule Time Slot</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Country</p>
              <select
                className="select"
                value={scheduledCountry}
                onChange={(e) => {
                  setScheduledCountry(e.target.value);
                  setScheduledSlot('');
                }}
              >
                <option value="india">India</option>
                <option value="usa">USA</option>
                <option value="uk">UK</option>
                <option value="uae">UAE</option>
                <option value="australia">Australia</option>
              </select>
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Time Slot</p>
              <select
                className="select"
                value={scheduledSlot}
                onChange={(e) => setScheduledSlot(e.target.value)}
              >
                <option value="">Select time</option>
                {(COUNTRY_TIME_SLOTS[scheduledCountry]?.slots || []).map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
              <input
                className="input"
                value={manualScheduledSlot}
                onChange={(e) => setManualScheduledSlot(e.target.value)}
                placeholder="Manual time like 09:30 AM"
                style={{ marginTop: 8 }}
              />
              <button
                className="button secondary"
                type="button"
                style={{ marginTop: 8 }}
                onClick={() => {
                  const normalized = normalizeScheduledSlotInput(manualScheduledSlot);
                  if (!normalized) {
                    notify('Enter time like 09:30 AM.', 'info');
                    return;
                  }
                  setScheduledSlot(normalized);
                  setManualScheduledSlot(normalized);
                  setShowScheduledTimePicker(false);
                }}
                disabled={!manualScheduledSlot.trim()}
              >
                Add Select Time
              </button>
            </div>
          </div>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
            {scheduledSlot ? `Selected: ${scheduledCountry.toUpperCase()} - ${scheduledSlot}` : 'Choose a country and time slot.'}
          </p>
        </section>
      ) : null}

      <CampaignTable
        title="Campaigns"
        campaigns={activeCampaigns}
        selectedIds={selectedActiveCampaignIds}
        allSelected={allActiveCampaignsSelected}
        onToggleSelectAll={toggleSelectAllActiveCampaigns}
        onToggleSelect={toggleActiveCampaignSelection}
        onDeleteSelected={deleteSelectedActiveCampaigns}
        onDeleteAll={deleteAllActiveCampaigns}
        onToggleHistory={() => setShowCampaignHistory((prev) => !prev)}
        showHistoryButton
        showHistory={showCampaignHistory}
        onStart={startCampaign}
        onPause={pauseCampaign}
        onStop={stopCampaign}
        onResume={resumeCampaign}
        onDelete={deleteCampaign}
        emptyText="No active campaigns right now."
      />

      {showCampaignHistory ? (
        <CampaignTable
          title="Campaign History"
          campaigns={historyCampaigns}
          selectedIds={selectedCampaignIds}
          allSelected={allCampaignsSelected}
          onToggleSelectAll={toggleSelectAllCampaigns}
          onToggleSelect={toggleCampaignSelection}
          onDeleteSelected={deleteSelectedCampaigns}
          onStart={startCampaign}
          onPause={pauseCampaign}
          onStop={stopCampaign}
          onResume={resumeCampaign}
          onDelete={deleteCampaign}
          emptyText="No campaign history yet."
        />
      ) : null}

      <ActivityPanel
        activeCampaign={activeCampaign}
        progressText={progressText}
        onStop={stopCampaign}
        onClearLogs={clearCampaignLogs}
        onDelete={deleteCampaign}
      />
      </>
      )}
      </div>
    </main>
  );
}

