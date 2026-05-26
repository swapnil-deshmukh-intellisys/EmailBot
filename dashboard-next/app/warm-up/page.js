'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';
import { Card, CardContent } from '@/app/components/ui/Card';
import PageSection from '@/app/components/ui/PageSection';
import { UNIFIED_NAVBAR_TOPBAR_PROPS } from '@/shared-components/layout-components/UnifiedNavbarConfig';

function formatDateTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString();
}

function formatLogText(log = {}) {
  const raw = log.status === 'failed' && log.failedReason
    ? `${log.body || log.note || log.subject || ''} | Reason: ${log.failedReason}`
    : log.body || log.note || log.subject || '';
  const text = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '-';
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

function formatFullLogText(log = {}) {
  const raw = log.status === 'failed' && log.failedReason
    ? `${log.body || log.note || log.subject || ''} | Reason: ${log.failedReason}`
    : log.body || log.note || log.subject || '';
  const text = String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || '-';
}

function formatLogType(log = {}) {
  if (log.source === 'auto_reply') return 'Auto Reply';
  if (log.simulatedReply || log.fromType === 'internal_bot') return 'Bot Reply';
  if (log.status === 'simulated') return 'Simulated Reply';
  return 'Real Sent';
}

const LOG_CONVERSATIONS_PER_PAGE = 8;

function normalizeCampaign(row = {}) {
  return {
    id: String(row.id || row._id || ''),
    name: row.name || 'Warmup campaign',
    status: row.status || row.displayStatus || 'Draft',
    senderFrom: row.senderFrom || row.senderAccount?.from || '',
    total: Number(row.total ?? row.totalRecipients ?? row.stats?.total ?? 0),
    sent: Number(row.sent ?? row.sentCount ?? row.stats?.sent ?? 0),
    pending: Number(row.pending ?? row.pendingCount ?? row.stats?.pending ?? 0),
    failed: Number(row.failed ?? row.failedCount ?? row.stats?.failed ?? 0),
    updatedAt: row.updatedAt || row.createdAt || null
  };
}

function htmlToPlainText(html = '') {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainTextToEmailHtml(text = '') {
  const blocks = String(text || '').trim().split(/\n{2,}/);
  const body = blocks
    .map((block) => {
      const escaped = escapeHtml(block.trim()).replace(/\n/g, '<br/>');
      return escaped ? `<p style="margin:0 0 12px;">${escaped}</p>` : '';
    })
    .filter(Boolean)
    .join('');
  return `<div style="font-family:Inter, 'Segoe UI', Arial, sans-serif;font-size:15px;line-height:1.55;color:#111827;">${body}</div>`;
}

export default function EmailWarmupPage() {
  const [projects, setProjects] = useState([]);
  const [senders, setSenders] = useState([]);
  const [warmupSheets, setWarmupSheets] = useState([]);
  const [selectedWarmupSheetId, setSelectedWarmupSheetId] = useState('');
  const [delayMinutes, setDelayMinutes] = useState('1');
  const [warmupConversations, setWarmupConversations] = useState([]);
  const [warmupLogs, setWarmupLogs] = useState([]);
  const [warmupSummary, setWarmupSummary] = useState({});
  const [selectedLogConversationId, setSelectedLogConversationId] = useState('');
  const [logConversationPage, setLogConversationPage] = useState(1);
  const [drafts, setDrafts] = useState([]);
  const [leadList, setLeadList] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [activeCampaignId, setActiveCampaignId] = useState('');
  const toastTimeoutRef = useRef(null);

  const selectedSender = useMemo(
    () => senders.find((sender) => sender.id === selectedSenderId) || null,
    [senders, selectedSenderId]
  );
  const selectedDraft = useMemo(
    () => drafts.find((draft) => String(draft._id) === selectedDraftId) || null,
    [drafts, selectedDraftId]
  );
  const latestCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === activeCampaignId) || campaigns[0] || null,
    [activeCampaignId, campaigns]
  );
  const visibleCampaigns = useMemo(() => campaigns.slice(0, 10), [campaigns]);
  const allVisibleCampaignsSelected = visibleCampaigns.length > 0 && visibleCampaigns.every((campaign) => selectedCampaignIds.includes(campaign.id));
  const selectedWarmupSheet = useMemo(
    () => warmupSheets.find((sheet) => sheet.id === selectedWarmupSheetId) || null,
    [selectedWarmupSheetId, warmupSheets]
  );
  const logsByConversation = useMemo(() => {
    const map = new Map();
    warmupLogs.forEach((log) => {
      const id = String(log.conversationId || log.threadId || log.id || '');
      if (!id) return;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(log);
    });
    map.forEach((items) => {
      items.sort((a, b) => {
        const aNo = Number(a.messageNumber || 0);
        const bNo = Number(b.messageNumber || 0);
        if (aNo || bNo) return aNo - bNo;
        return new Date(a.sentAt || a.createdAt || 0) - new Date(b.sentAt || b.createdAt || 0);
      });
    });
    return map;
  }, [warmupLogs]);
  const conversationCards = useMemo(() => {
    const conversationMap = new Map(warmupConversations.map((item) => [String(item.id), item]));
    const ids = new Set([
      ...warmupConversations.map((item) => String(item.id || '')),
      ...Array.from(logsByConversation.keys())
    ]);
    return Array.from(ids)
      .filter(Boolean)
      .map((id) => {
        const conversation = conversationMap.get(id) || {};
        const messages = logsByConversation.get(id) || [];
        const latest = messages[messages.length - 1] || {};
        const senderEmail = conversation.senderEmail || messages.find((item) => !item.simulatedReply)?.fromEmail || latest.fromEmail || '-';
        const receiverEmail = conversation.receiverEmail || messages.find((item) => item.simulatedReply)?.fromEmail || latest.toEmail || '-';
        const realCount = messages.filter((item) => item.status === 'sent').length;
        const simulatedCount = messages.filter((item) => item.simulatedReply || item.status === 'simulated').length;
        const failedCount = messages.filter((item) => item.status === 'failed').length;
        return {
          id,
          senderEmail,
          receiverEmail,
          status: conversation.status || latest.status || 'logged',
          mode: conversation.mode || latest.provider || '-',
          currentMessageNumber: Number(conversation.currentMessageNumber || latest.messageNumber || messages.length || 0),
          totalMessages: Number(conversation.totalMessages || 10),
          nextMessageAt: conversation.nextMessageAt || null,
          lastMessageAt: conversation.lastMessageAt || latest.sentAt || latest.createdAt || null,
          realCount,
          simulatedCount,
          failedCount,
          messages
        };
      })
      .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  }, [logsByConversation, warmupConversations]);
  const logPageCount = Math.max(1, Math.ceil(conversationCards.length / LOG_CONVERSATIONS_PER_PAGE));
  const visibleLogConversations = useMemo(() => {
    const safePage = Math.min(Math.max(1, logConversationPage), logPageCount);
    const start = (safePage - 1) * LOG_CONVERSATIONS_PER_PAGE;
    return conversationCards.slice(start, start + LOG_CONVERSATIONS_PER_PAGE);
  }, [conversationCards, logConversationPage, logPageCount]);
  const selectedLogConversation = useMemo(
    () => conversationCards.find((item) => item.id === selectedLogConversationId) || visibleLogConversations[0] || conversationCards[0] || null,
    [conversationCards, selectedLogConversationId, visibleLogConversations]
  );
  const leadRows = Array.isArray(leadList?.leads) ? leadList.leads : [];
  const leadColumns = useMemo(() => {
    const saved = Array.isArray(leadList?.columns) ? leadList.columns.filter(Boolean) : [];
    if (saved.length) return saved.slice(0, 8);
    const first = leadRows[0] || {};
    return Object.keys(first).filter((key) => !['data', 'thread', 'status', 'error'].includes(key)).slice(0, 8);
  }, [leadList?.columns, leadRows]);
  const getLeadCellValue = (row, column) => {
    const value = row?.[column] ?? row?.data?.[column] ?? '';
    return String(value || '').trim() || '-';
  };

  useEffect(() => {
    if (!selectedWarmupSheet) return;
    setLeadList({
      id: selectedWarmupSheet.id,
      name: selectedWarmupSheet.sheetName,
      sourceFile: selectedWarmupSheet.sheetName,
      total: selectedWarmupSheet.total,
      sourceTotal: selectedWarmupSheet.total,
      columns: ['name', 'email', 'warmupApproved'],
      leads: selectedWarmupSheet.rows || []
    });
  }, [selectedWarmupSheet]);

  const showActionAlert = (tone, text) => {
    setToast({ tone, message: text });
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 5200);
  };

  const setActionError = (text) => {
    setError(text);
    showActionAlert('error', text);
  };

  const setActionMessage = (text) => {
    setMessage(text);
    showActionAlert('success', text);
  };

  const loadWarmupStatus = async ({ silent = false } = {}) => {
    try {
      const response = await fetch('/api/warmup-dashboard', { cache: 'no-store' });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || 'Failed to load warmup status');
      const rows = Array.isArray(next.campaigns) ? next.campaigns.map(normalizeCampaign) : [];
      setCampaigns(rows);
      setSelectedCampaignIds((current) => current.filter((id) => rows.some((campaign) => campaign.id === id)));
      if (!silent) setError('');
      return rows;
    } catch (err) {
      if (!silent) setError(err.message || 'Failed to load warmup status');
      return [];
    }
  };

  const loadWarmupLeads = async () => {
    setLoadingLeads(true);
    const response = await fetch(`/api/warmup/leads?t=${Date.now()}`, { cache: 'no-store' });
    const next = await response.json();
    if (!response.ok) throw new Error(next?.error || 'Failed to load warmup clients');
    setLeadList(next.list || null);
    if (next.reusedExisting) {
      setMessage('Your existing uploaded database sheet is now used as the warmup sheet.');
    }
    setError('');
    setLoadingLeads(false);
    return next.list || null;
  };

  const loadWarmupSheets = async (projectValue = selectedProject) => {
    const params = new URLSearchParams();
    if (projectValue) params.set('project', projectValue);
    const response = await fetch(`/api/warmup/sheets?${params.toString()}`, { cache: 'no-store' });
    const next = await response.json();
    if (!response.ok) throw new Error(next?.error || 'Failed to load warmup sheets');
    const rows = Array.isArray(next.sheets) ? next.sheets : [];
    setWarmupSheets(rows);
    const nextSelectedId = rows.some((row) => row.id === selectedWarmupSheetId)
      ? selectedWarmupSheetId
      : rows.find((row) => row.isDefault)?.id || rows[0]?.id || '';
    setSelectedWarmupSheetId(nextSelectedId);
    const previewSheet = rows.find((row) => row.id === nextSelectedId) || rows.find((row) => row.isDefault) || rows[0];
    if (previewSheet) {
      setLeadList({
        id: previewSheet.id,
        name: previewSheet.sheetName,
        sourceFile: previewSheet.sheetName,
        total: previewSheet.total,
        sourceTotal: previewSheet.total,
        columns: ['name', 'email', 'warmupApproved'],
        leads: previewSheet.rows || []
      });
    }
    return rows;
  };

  const handleWarmupSheetChange = async (sheetId) => {
    setSelectedWarmupSheetId(sheetId);
    const sheet = warmupSheets.find((row) => row.id === sheetId);
    if (sheet) {
      setLeadList({
        id: sheet.id,
        name: sheet.sheetName,
        sourceFile: sheet.sheetName,
        total: sheet.total,
        sourceTotal: sheet.total,
        columns: ['name', 'email', 'warmupApproved'],
        leads: sheet.rows || []
      });
    }
    if (!sheetId) return;
    try {
      await fetch('/api/warmup/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject, warmupSheetId: sheetId })
      });
    } catch (err) {
      console.warn('[warmup] failed to persist selected sheet', err);
    }
  };

  const loadWarmupAutoStatus = async (projectValue = selectedProject) => {
    const params = new URLSearchParams();
    if (projectValue) params.set('project', projectValue);
    const [conversationResponse, logsResponse] = await Promise.all([
      fetch(`/api/warmup/conversations?${params.toString()}`, { cache: 'no-store' }),
      fetch(`/api/warmup/logs?${params.toString()}&limit=500`, { cache: 'no-store' })
    ]);
    const conversationData = await conversationResponse.json();
    const logsData = await logsResponse.json();
    if (!conversationResponse.ok) throw new Error(conversationData?.error || 'Failed to load warmup conversations');
    if (!logsResponse.ok) throw new Error(logsData?.error || 'Failed to load warmup logs');
    const nextConversations = Array.isArray(conversationData.conversations) ? conversationData.conversations : [];
    setWarmupConversations(nextConversations);
    setWarmupSummary(conversationData.summary || {});
    setWarmupLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
    setSelectedLogConversationId((current) => (
      current && nextConversations.some((item) => String(item.id) === current)
        ? current
        : nextConversations[0]?.id || ''
    ));
  };

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try {
        setLoadingProjects(true);
        setLoadingLeads(true);
        const projectResponse = await fetch('/api/warmup/projects', { cache: 'no-store' });
        const projectData = await projectResponse.json();
        if (!active) return;
        if (!projectResponse.ok) throw new Error(projectData?.error || 'Failed to load projects');
        const nextProjects = Array.isArray(projectData.projects) ? projectData.projects : [];
        setProjects(nextProjects);
        if (!selectedProject && nextProjects.length) setSelectedProject(nextProjects[0].value);
        await loadWarmupSheets(nextProjects[0]?.value || selectedProject);
        await loadWarmupAutoStatus(nextProjects[0]?.value || selectedProject).catch(() => {});
        setError('');
      } catch (err) {
        if (active) setError(err.message || 'Failed to load warmup setup');
      } finally {
        if (active) {
          setLoadingProjects(false);
          setLoadingLeads(false);
        }
      }
    };

    void loadInitial();
    void loadWarmupStatus();
    const intervalId = window.setInterval(() => {
      void loadWarmupStatus({ silent: true });
      void loadWarmupAutoStatus(selectedProject).catch(() => {});
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }
    };
  }, []);

  const handleWarmupSheetUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingSheet(true);
      setMessage('');
      setError('');
      const form = new FormData();
      form.append('file', file);
      form.append('project', selectedProject || 'warmup');
      const response = await fetch('/api/warmup/sheets/upload', {
        method: 'POST',
        body: form
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || 'Failed to save warmup sheet');
      const sheets = await loadWarmupSheets(selectedProject);
      setSelectedWarmupSheetId(next.sheet?.id || sheets[0]?.id || '');
      setActionMessage(`${next.message || 'Warmup sheet saved successfully.'} Table updated.`);
    } catch (err) {
      setActionError(err.message || 'Failed to save warmup sheet');
    } finally {
      setUploadingSheet(false);
      setLoadingLeads(false);
      event.target.value = '';
    }
  };

  useEffect(() => {
    let active = true;
    const loadSenders = async () => {
      if (!selectedProject) {
        setSenders([]);
        setSelectedSenderId('');
        return;
      }
      try {
        setLoadingSenders(true);
        const response = await fetch(`/api/warmup/senders?project=${encodeURIComponent(selectedProject)}`, { cache: 'no-store' });
        const next = await response.json();
        if (!response.ok) throw new Error(next?.error || 'Failed to load sender IDs');
        if (!active) return;
        const rows = Array.isArray(next.senders) ? next.senders : [];
        setSenders(rows);
        setSelectedSenderId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || ''));
        setError('');
      } catch (err) {
        if (active) {
          setSenders([]);
          setSelectedSenderId('');
          setError(err.message || 'Failed to load sender IDs');
        }
      } finally {
        if (active) setLoadingSenders(false);
      }
    };

    void loadSenders();
    void loadWarmupSheets(selectedProject).catch((err) => setError(err.message || 'Failed to load warmup sheets'));
    void loadWarmupAutoStatus(selectedProject).catch(() => {});
    setDrafts([]);
    setSelectedDraftId('');
    return () => {
      active = false;
    };
  }, [selectedProject]);

  useEffect(() => {
    let active = true;
    const loadDrafts = async () => {
      if (!selectedProject || !selectedSenderId) {
        setDrafts([]);
        setSelectedDraftId('');
        return;
      }
      try {
        setLoadingDrafts(true);
        const params = new URLSearchParams({ project: selectedProject, senderId: selectedSenderId });
        const response = await fetch(`/api/warmup/drafts?${params.toString()}`, { cache: 'no-store' });
        const next = await response.json();
        if (!response.ok) throw new Error(next?.error || 'Failed to load warmup drafts');
        if (!active) return;
        const rows = Array.isArray(next.drafts) ? next.drafts : [];
        setDrafts(rows);
        setSelectedDraftId((current) => (rows.some((row) => String(row._id) === current) ? current : String(rows[0]?._id || '')));
        setError('');
      } catch (err) {
        if (active) {
          setDrafts([]);
          setSelectedDraftId('');
          setError(err.message || 'Failed to load warmup drafts');
        }
      } finally {
        if (active) setLoadingDrafts(false);
      }
    };

    void loadDrafts();
    return () => {
      active = false;
    };
  }, [selectedProject, selectedSenderId]);

  useEffect(() => {
    setDraftSubject(String(selectedDraft?.subject || ''));
    setDraftBody(htmlToPlainText(selectedDraft?.body || ''));
  }, [selectedDraftId, selectedDraft]);

  const handleStartWarmup = async () => {
    setMessage('');
    setError('');
    if (!selectedProject) return setActionError('Select a project first.');
    if (!selectedSenderId) return setActionError('Select a sender ID first.');
    if (!selectedWarmupSheetId) return setActionError('Please select a warmup sheet.');
    if (!selectedDraftId) return setActionError('Select a warmup draft first.');
    if (!draftSubject.trim()) return setActionError('Draft subject is required.');
    if (!draftBody.trim()) return setActionError('Draft body is required.');
    if (!leadList || Number(leadList.total || 0) < 1) return setActionError('Upload a warmup sheet with at least one valid email client.');

    try {
      setStarting(true);
      const response = await fetch('/api/warmup/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: selectedProject,
          senderId: selectedSenderId,
          warmupSheetId: selectedWarmupSheetId,
          draftId: selectedDraftId,
          subject: draftSubject,
          body: plainTextToEmailHtml(draftBody)
        })
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || 'Failed to start warmup campaign');
      setActiveCampaignId(next.campaign?.id || '');
      const rows = await loadWarmupStatus();
      const freshCampaign = rows.find((campaign) => campaign.id === next.campaign?.id) || next.campaign;
      const status = freshCampaign?.status ? ` Status: ${freshCampaign.status}.` : '';
      setActionMessage(`${next.message || 'Warmup campaign started.'}${status}`);
    } catch (err) {
      setActionError(err.message || 'Failed to start warmup campaign');
    } finally {
      setStarting(false);
    }
  };

  const handleStopWarmupCampaign = async () => {
    const campaignId = latestCampaign?.id || activeCampaignId;
    if (!campaignId) return setActionError('No warmup campaign selected to stop.');
    try {
      setStarting(true);
      const response = await fetch(`/api/campaigns/${campaignId}/stop`, { method: 'POST' });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || next?.message || 'Failed to stop warmup campaign');
      await loadWarmupStatus();
      setActionMessage(next.message || 'Warmup campaign stopped.');
    } catch (err) {
      setActionError(err.message || 'Failed to stop warmup campaign');
    } finally {
      setStarting(false);
    }
  };

  const runCampaignAction = async (campaignId, action) => {
    if (!campaignId) return;
    const method = action === 'delete' ? 'DELETE' : 'POST';
    const url = action === 'delete'
      ? `/api/campaigns/${campaignId}`
      : `/api/campaigns/${campaignId}/${action}`;
    const response = await fetch(url, { method });
    const next = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(next?.error || next?.message || `Failed to ${action} campaign`);
    return next;
  };

  const handleCampaignAction = async (campaignId, action) => {
    try {
      setStarting(true);
      const result = await runCampaignAction(campaignId, action);
      await loadWarmupStatus();
      setActionMessage(result?.message || `Campaign ${action} completed.`);
    } catch (err) {
      setActionError(err.message || `Failed to ${action} campaign`);
    } finally {
      setStarting(false);
    }
  };

  const handleBulkCampaignAction = async (action) => {
    if (!selectedCampaignIds.length) return setActionError('Select at least one campaign.');
    try {
      setStarting(true);
      for (const campaignId of selectedCampaignIds) {
        await runCampaignAction(campaignId, action);
      }
      await loadWarmupStatus();
      setSelectedCampaignIds([]);
      setActionMessage(`${selectedCampaignIds.length} campaign action(s) completed.`);
    } catch (err) {
      setActionError(err.message || `Failed to ${action} selected campaigns`);
    } finally {
      setStarting(false);
    }
  };

  const toggleCampaignSelection = (campaignId) => {
    setSelectedCampaignIds((current) => (
      current.includes(campaignId)
        ? current.filter((id) => id !== campaignId)
        : [...current, campaignId]
    ));
  };

  const toggleAllVisibleCampaigns = () => {
    setSelectedCampaignIds((current) => {
      const visibleIds = visibleCampaigns.map((campaign) => campaign.id);
      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleStartAutoCommunication = async () => {
    setMessage('');
    setError('');
    if (!selectedSenderId) return setActionError('Please select a sender ID.');
    if (!selectedWarmupSheetId) return setActionError('Please select a warmup sheet.');
    try {
      setStarting(true);
      const response = await fetch('/api/warmup/start-auto-communication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject,
          selectedSenderId,
          warmupSheetId: selectedWarmupSheetId,
          delayMinutes
        })
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || 'Failed to start auto communication');
      await loadWarmupAutoStatus(selectedProject);
      setActionMessage(next.message || 'Auto communication started successfully.');
    } catch (err) {
      setActionError(err.message || 'Failed to start auto communication');
    } finally {
      setStarting(false);
    }
  };

  const updateAutoCommunication = async (action) => {
    try {
      const response = await fetch(`/api/warmup/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject })
      });
      const next = await response.json();
      if (!response.ok) throw new Error(next?.error || `Failed to ${action} warmup`);
      await loadWarmupAutoStatus(selectedProject);
      setActionMessage(action === 'pause' ? 'Warmup auto communication paused.' : 'Warmup auto communication stopped.');
    } catch (err) {
      setActionError(err.message || `Failed to ${action} warmup`);
    }
  };

  return (
    <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
      {toast ? (
        <div className={`dashboard-toast dashboard-toast-${toast.tone}`} role="alert" aria-live="assertive">
          <div>
            <strong>{toast.tone === 'error' ? 'Action failed' : 'Action completed'}</strong>
            <p>{toast.message}</p>
          </div>
          <button type="button" className="dashboard-toast-close" onClick={() => setToast(null)} aria-label="Close notification">
            x
          </button>
        </div>
      ) : null}
      <PageSection
        title="Email Warmup"
        description="Start a warmup campaign from a saved client list, project sender ID, and project draft."
      >
        <div className="workspace-page warmup-workspace-page" style={{ '--workspace-accent': '#14b8a6' }}>
          <div className="workspace-stats">
            <article className="workspace-stat-card">
              <span>Warmup Clients</span>
              <strong>{loadingLeads ? '...' : leadList?.total || 0}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Sender IDs</span>
              <strong>{loadingSenders ? '...' : senders.length}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Warmup Drafts</span>
              <strong>{loadingDrafts ? '...' : drafts.length}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Latest Status</span>
              <strong>{latestCampaign?.status || 'Ready'}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Approved IDs</span>
              <strong>{selectedWarmupSheet?.approved || 0}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Active Conversations</span>
              <strong>{warmupSummary.activeConversations || 0}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Completed</span>
              <strong>{warmupSummary.completedConversations || 0}</strong>
            </article>
            <article className="workspace-stat-card">
              <span>Failed Messages</span>
              <strong>{warmupSummary.failedMessages || 0}</strong>
            </article>
          </div>

          {error ? (
            <Card className="workspace-panel" style={{ marginBottom: 16 }}>
              <CardContent>
                <p style={{ margin: 0, color: '#b91c1c', fontWeight: 700 }}>{error}</p>
              </CardContent>
            </Card>
          ) : null}
          {message ? (
            <Card className="workspace-panel" style={{ marginBottom: 16 }}>
              <CardContent>
                <p style={{ margin: 0, color: '#047857', fontWeight: 700 }}>{message}</p>
              </CardContent>
            </Card>
          ) : null}

          <div className="workspace-grid">
            <section className="workspace-panel workspace-panel-large" style={{ gridColumn: '1 / -1' }}>
              <div className="workspace-panel-head">
                <div>
                  <h2>Warmup Campaign Flow</h2>
                  <p>Select project, sender, sheet, and delay. Then start auto communication or a warmup campaign.</p>
                </div>
              </div>

              <div className="warmup-start-grid">
                <section className="workspace-panel">
                  <div className="warmup-inline-setup-grid">
                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Project</h2>
                          <p>Loaded from saved project data when available.</p>
                        </div>
                      </div>
                      <select
                        className="warmup-select"
                        value={selectedProject}
                        disabled={loadingProjects}
                        onChange={(event) => setSelectedProject(event.target.value)}
                      >
                        <option value="">{loadingProjects ? 'Loading projects...' : 'Select project'}</option>
                        {projects.map((project) => (
                          <option key={project.value} value={project.value}>{project.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Sender ID</h2>
                          <p>Only sender IDs for the selected project are listed.</p>
                        </div>
                      </div>
                      <select
                        className="warmup-select"
                        value={selectedSenderId}
                        disabled={!selectedProject || loadingSenders}
                        onChange={(event) => setSelectedSenderId(event.target.value)}
                      >
                        <option value="">{loadingSenders ? 'Loading sender IDs...' : 'Select sender ID'}</option>
                        {senders.map((sender) => (
                          <option key={sender.id} value={sender.id}>
                            {sender.from} ({sender.provider})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Warmup Draft</h2>
                          <p>Only real saved database drafts for this project and sender ID are shown.</p>
                        </div>
                      </div>
                      <select
                        className="warmup-select"
                        value={selectedDraftId}
                        disabled={!selectedSenderId || loadingDrafts}
                        onChange={(event) => setSelectedDraftId(event.target.value)}
                      >
                        <option value="">{loadingDrafts ? 'Loading drafts...' : 'Select warmup draft'}</option>
                        {drafts.map((draft) => (
                          <option key={String(draft._id)} value={String(draft._id)}>
                            {draft.title || draft.label || 'Warmup Draft'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Warmup Sheet</h2>
                          <p>Change this anytime. The selected sheet is used for warmup.</p>
                        </div>
                      </div>
                      <select
                        className="warmup-select"
                        value={selectedWarmupSheetId}
                        disabled={!selectedProject || uploadingSheet}
                        onChange={(event) => handleWarmupSheetChange(event.target.value)}
                      >
                        <option value="">{uploadingSheet ? 'Saving sheet...' : 'Select warmup sheet'}</option>
                        {warmupSheets.map((sheet) => (
                          <option key={sheet.id} value={sheet.id}>
                            {sheet.sheetName} ({sheet.approved}/{sheet.total} approved)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="workspace-panel-head">
                        <div>
                          <h2>Delay</h2>
                          <p>Delay between messages in minutes.</p>
                        </div>
                      </div>
                      <input
                        className="warmup-select"
                        type="number"
                        min="1"
                        value={delayMinutes}
                        onChange={(event) => setDelayMinutes(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="workspace-list" style={{ marginTop: 16 }}>
                    <div>
                      <strong>Selected Project</strong>
                      <span>{selectedProject ? selectedProject.toUpperCase() : 'Not selected'}</span>
                    </div>
                    <div>
                      <strong>Selected Sender</strong>
                      <span>{selectedSender?.from || 'Not selected'}</span>
                    </div>
                    <div>
                      <strong>Selected Draft</strong>
                      <span>{selectedDraft?.title || selectedDraft?.label || 'Not selected'}</span>
                    </div>
                    <div>
                      <strong>Selected Sheet</strong>
                      <span>{selectedWarmupSheet?.sheetName || 'Not selected'}</span>
                    </div>
                    <div>
                      <strong>Saved Clients</strong>
                      <span>{selectedWarmupSheet?.approved || 0} approved of {selectedWarmupSheet?.total || leadList?.total || 0} rows</span>
                    </div>
                    <div>
                      <strong>Next Scheduled</strong>
                      <span>{formatDateTime(warmupSummary.nextScheduledMessageTime)}</span>
                    </div>
                  </div>

                  <div className="warmup-draft-editor">
                    <div className="workspace-panel-head">
                      <div>
                        <h2>Editable Selected Draft</h2>
                        <p>Review or change the draft before starting warmup. These edits are used for this campaign.</p>
                      </div>
                    </div>
                    <label className="warmup-editor-label" htmlFor="warmup-draft-subject">Subject</label>
                    <input
                      id="warmup-draft-subject"
                      className="warmup-editor-input"
                      value={draftSubject}
                      disabled={!selectedDraftId}
                      onChange={(event) => setDraftSubject(event.target.value)}
                      placeholder="Select a draft to load subject"
                    />
                    <label className="warmup-editor-label" htmlFor="warmup-draft-body">Body</label>
                    <textarea
                      id="warmup-draft-body"
                      className="warmup-editor-textarea"
                      value={draftBody}
                      disabled={!selectedDraftId}
                      onChange={(event) => setDraftBody(event.target.value)}
                      placeholder="Select a draft to load body"
                    />
                  </div>

                  <div className="warmup-guide-actions">
                    <Button loading={starting} disabled={starting || !selectedSenderId || !selectedWarmupSheetId} onClick={handleStartAutoCommunication}>
                      Start Auto Communication
                    </Button>
                    <Button variant="ghost" disabled={starting} onClick={() => updateAutoCommunication('pause')}>
                      Pause
                    </Button>
                    <Button variant="ghost" disabled={starting} onClick={() => updateAutoCommunication('stop')}>
                      Stop Auto
                    </Button>
                    <Button loading={starting} disabled={starting || loadingProjects || loadingSenders || loadingDrafts || loadingLeads || uploadingSheet || !selectedWarmupSheetId} onClick={handleStartWarmup}>
                      Start Warmup
                    </Button>
                    <Button variant="ghost" loading={starting} disabled={starting || !latestCampaign?.id} onClick={handleStopWarmupCampaign}>
                      Stop Warmup
                    </Button>
                  </div>
                </section>

                <section className="workspace-panel workspace-panel-large warmup-sheet-panel">
                  <div className="workspace-panel-head">
                    <div>
                      <h2>Database Warmup Sheet</h2>
                      <p>Upload a new sheet or choose an existing sheet from the dropdown.</p>
                    </div>
                    <div className="warmup-panel-actions">
                      <Button variant="ghost" size="sm">{leadList?.total || 0} clients</Button>
                      <label className="warmup-upload-action">
                        {uploadingSheet ? 'Saving...' : 'Upload Sheet'}
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          disabled={uploadingSheet}
                          onChange={handleWarmupSheetUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="workspace-table warmup-preview-table">
                    {loadingLeads || uploadingSheet ? (
                      <div className="warmup-empty-preview">{uploadingSheet ? 'Saving uploaded sheet...' : 'Loading warmup sheet...'}</div>
                    ) : leadRows.length ? (
                      <>
                        <div className="workspace-table-head" style={{ gridTemplateColumns: `64px repeat(${leadColumns.length || 1}, minmax(140px, 1fr))` }}>
                          <span>No.</span>
                          {leadColumns.map((column) => (
                            <span key={column}>{column}</span>
                          ))}
                        </div>
                        {leadRows.slice(0, 12).map((row, index) => (
                          <div key={`${row.Email || row.email || row.data?.Email || index}`} className="workspace-table-row" style={{ gridTemplateColumns: `64px repeat(${leadColumns.length || 1}, minmax(140px, 1fr))` }}>
                            <span>{index + 1}</span>
                            {leadColumns.map((column) => (
                              <span key={`${index}-${column}`}>{getLeadCellValue(row, column)}</span>
                            ))}
                          </div>
                        ))}
                        {leadRows.length > 12 ? (
                          <div className="warmup-minimized-note">Showing first 12 saved clients. Full list is used when the campaign starts.</div>
                        ) : null}
                      </>
                    ) : (
                      <div className="warmup-empty-preview">Upload your warmup sheet to show clients here.</div>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <section className="workspace-panel workspace-panel-large" style={{ gridColumn: '1 / -1' }}>
              <div className="workspace-panel-head">
                <div>
                  <h2>Warmup Campaign Status</h2>
                  <p>Live status refreshes automatically without reloading the page.</p>
                </div>
                <div className="warmup-panel-actions">
                  <Button variant="ghost" size="sm" disabled={starting || !selectedCampaignIds.length} onClick={() => handleBulkCampaignAction('start')}>
                    Start
                  </Button>
                  <Button variant="ghost" size="sm" disabled={starting || !selectedCampaignIds.length} onClick={() => handleBulkCampaignAction('pause')}>
                    Pause
                  </Button>
                  <Button variant="ghost" size="sm" disabled={starting || !selectedCampaignIds.length} onClick={() => handleBulkCampaignAction('resume')}>
                    Resume
                  </Button>
                  <Button variant="ghost" size="sm" disabled={starting || !selectedCampaignIds.length} onClick={() => handleBulkCampaignAction('stop')}>
                    Stop
                  </Button>
                  <Button variant="ghost" size="sm" disabled={starting || !selectedCampaignIds.length} onClick={() => handleBulkCampaignAction('delete')}>
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => loadWarmupStatus()}>
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="workspace-table">
                <div className="workspace-table-head" style={{ gridTemplateColumns: '.45fr 2fr 1fr .8fr .6fr .6fr .7fr .7fr 1fr 2.2fr' }}>
                  <span>
                    <input
                      type="checkbox"
                      checked={allVisibleCampaignsSelected}
                      onChange={toggleAllVisibleCampaigns}
                      aria-label="Select all visible campaigns"
                    />
                  </span>
                  <span>Campaign</span>
                  <span>Sender</span>
                  <span>Status</span>
                  <span>Total</span>
                  <span>Sent</span>
                  <span>Pending</span>
                  <span>Failed</span>
                  <span>Updated</span>
                  <span>Action</span>
                </div>
                {visibleCampaigns.length ? visibleCampaigns.map((campaign) => (
                  <div key={campaign.id} className="workspace-table-row" style={{ gridTemplateColumns: '.45fr 2fr 1fr .8fr .6fr .6fr .7fr .7fr 1fr 2.2fr' }}>
                    <span>
                      <input
                        type="checkbox"
                        checked={selectedCampaignIds.includes(campaign.id)}
                        onChange={() => toggleCampaignSelection(campaign.id)}
                        aria-label={`Select ${campaign.name}`}
                      />
                    </span>
                    <span>{campaign.name}</span>
                    <span>{campaign.senderFrom || '-'}</span>
                    <span>{campaign.status}</span>
                    <span>{campaign.total}</span>
                    <span>{campaign.sent}</span>
                    <span>{campaign.pending}</span>
                    <span>{campaign.failed}</span>
                    <span>{formatDateTime(campaign.updatedAt)}</span>
                    <span className="warmup-panel-actions">
                      <Button variant="ghost" size="sm" disabled={starting} onClick={() => handleCampaignAction(campaign.id, 'start')}>Start</Button>
                      <Button variant="ghost" size="sm" disabled={starting} onClick={() => handleCampaignAction(campaign.id, 'pause')}>Pause</Button>
                      <Button variant="ghost" size="sm" disabled={starting} onClick={() => handleCampaignAction(campaign.id, 'resume')}>Resume</Button>
                      <Button variant="ghost" size="sm" disabled={starting} onClick={() => handleCampaignAction(campaign.id, 'stop')}>Stop</Button>
                      <Button variant="ghost" size="sm" disabled={starting} onClick={() => handleCampaignAction(campaign.id, 'delete')}>Delete</Button>
                    </span>
                  </div>
                )) : (
                  <div className="warmup-empty-preview">No warmup campaigns yet.</div>
                )}
                {visibleCampaigns.length ? (
                  <div className="warmup-minimized-note">
                    <label>
                      <input
                        type="checkbox"
                        checked={allVisibleCampaignsSelected}
                        onChange={toggleAllVisibleCampaigns}
                      /> Select all visible rows
                    </label>
                  </div>
                ) : null}
              </div>
            </section>
            <section className="workspace-panel workspace-panel-large" style={{ gridColumn: '1 / -1' }}>
              <div className="workspace-panel-head">
                <div>
                  <h2>Auto Communication Logs</h2>
                  <p>Select a conversation to view every send and reply in order.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => loadWarmupAutoStatus(selectedProject)}>
                  View Logs
                </Button>
              </div>
              {conversationCards.length ? (
                <div className="warmup-log-console">
                  <aside className="warmup-log-list">
                    <div className="warmup-log-list-head">
                      <strong>{conversationCards.length} conversations</strong>
                      <span>Page {Math.min(logConversationPage, logPageCount)} of {logPageCount}</span>
                    </div>
                    {visibleLogConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        className={`warmup-log-card ${selectedLogConversation?.id === conversation.id ? 'active' : ''}`}
                        onClick={() => setSelectedLogConversationId(conversation.id)}
                      >
                        <span className="warmup-log-card-top">
                          <strong>{conversation.receiverEmail}</strong>
                          <em>{conversation.status}</em>
                        </span>
                        <span>{conversation.senderEmail} {'->'} {conversation.receiverEmail}</span>
                        <span className="warmup-log-card-stats">
                          <b>{conversation.currentMessageNumber}/{conversation.totalMessages}</b>
                          <small>{conversation.realCount} real</small>
                          <small>{conversation.simulatedCount} bot</small>
                          {conversation.failedCount ? <small>{conversation.failedCount} failed</small> : null}
                        </span>
                        <span className="warmup-log-card-time">{formatDateTime(conversation.lastMessageAt)}</span>
                      </button>
                    ))}
                    <div className="warmup-log-pagination">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={logConversationPage <= 1}
                        onClick={() => setLogConversationPage((page) => Math.max(1, page - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={logConversationPage >= logPageCount}
                        onClick={() => setLogConversationPage((page) => Math.min(logPageCount, page + 1))}
                      >
                        Next
                      </Button>
                    </div>
                  </aside>
                  <section className="warmup-log-detail">
                    <div className="warmup-log-detail-head">
                      <div>
                        <span>Selected conversation</span>
                        <h3>{selectedLogConversation?.senderEmail} {'->'} {selectedLogConversation?.receiverEmail}</h3>
                      </div>
                      <div className="warmup-log-detail-meta">
                        <strong>{selectedLogConversation?.currentMessageNumber || 0}/{selectedLogConversation?.totalMessages || 10}</strong>
                        <span>{selectedLogConversation?.status || '-'}</span>
                      </div>
                    </div>
                    <div className="warmup-log-thread">
                      {(selectedLogConversation?.messages || []).length ? selectedLogConversation.messages.map((log) => (
                        <article key={log.id} className={`warmup-log-message ${log.simulatedReply || log.status === 'simulated' ? 'simulated' : 'real'}`}>
                          <div className="warmup-log-message-head">
                            <span>{log.messageNumber ? `Message ${log.messageNumber}` : formatLogType(log)}</span>
                            <strong>{formatLogType(log)}</strong>
                            <em>{formatDateTime(log.sentAt || log.createdAt)}</em>
                          </div>
                          <div className="warmup-log-route">
                            <span title={log.fromAccountId || ''}>{log.fromEmail || '-'}</span>
                            <b>to</b>
                            <span title={log.toAccountId || ''}>{log.toEmail || '-'}</span>
                          </div>
                          <p>{formatFullLogText(log)}</p>
                          <div className="warmup-log-message-foot">
                            <span>{log.status || '-'}</span>
                            <span>{log.simulatedReply ? 'simulated' : log.provider || '-'}</span>
                            {log.failedReason ? <span>{log.failedReason}</span> : null}
                          </div>
                        </article>
                      )) : (
                        <div className="warmup-empty-preview">No messages found for this conversation.</div>
                      )}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="warmup-empty-preview">No auto communication logs yet.</div>
              )}
            </section>
          </div>
        </div>
      </PageSection>
    </AppLayout>
  );
}
