'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Button from '@/shared-components/ui-components/UiActionButton';
import { apiFetchJson } from '@/app/lib/apiClient';

const ACTION_LABELS = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop',
  'next-step': 'Next Mail'
};

const CAMPAIGN_STEP_TYPES = {
  1: { type: 'cover_story', label: 'Cover Story', actionLabel: 'Send Cover Story' },
  2: { type: 'reminder', label: 'Reminder', actionLabel: 'Send Reminder' },
  3: { type: 'follow_up', label: 'Follow Up', actionLabel: 'Send Follow Up' },
  4: { type: 'updated_cost', label: 'Updated Cost', actionLabel: 'Send Updated Cost' },
  5: { type: 'final_cost', label: 'Final Call', actionLabel: 'Send Final Call' }
};

const DRAFT_TYPE_TO_STEP = {
  cover_story: 1,
  initial_outreach: 1,
  reminder: 2,
  follow_up: 3,
  followup: 3,
  open_followup: 3,
  updated_cost: 4,
  final_cost: 5,
  final_followup: 5
};

const DASHBOARD_RESUME_CAMPAIGN_KEY = 'dashboard:resume-campaign-draft:v1';

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function inferCampaignStep(campaign = {}) {
  const completedWorkflowStepRaw = Math.floor(Number(campaign?.completedWorkflowStep || 0) || 0);
  const workflowStep = Math.floor(Number(campaign?.workflowStep || 0) || 0);
  const typeStep = DRAFT_TYPE_TO_STEP[normalizeText(campaign?.draftType || campaign?.type || '')] || 0;
  const baseStep = typeStep || workflowStep || 1;
  const completedWorkflowStep = baseStep > 0 && completedWorkflowStepRaw > 0
    ? Math.min(baseStep, completedWorkflowStepRaw)
    : completedWorkflowStepRaw;
  if (completedWorkflowStep >= 1 && completedWorkflowStep <= 5) return completedWorkflowStep;
  return Math.max(1, Math.min(5, baseStep));
}

function getNextCampaignStep(campaign = {}) {
  const nextWorkflowStep = Math.floor(Number(campaign?.nextWorkflowStep || 0) || 0);
  if (nextWorkflowStep >= 2 && nextWorkflowStep <= 5) return nextWorkflowStep;
  return Math.min(inferCampaignStep(campaign) + 1, 6);
}

function getNextCampaignStepConfig(campaign = {}) {
  return CAMPAIGN_STEP_TYPES[getNextCampaignStep(campaign)] || null;
}

function getActionDisabled(action, campaign = {}) {
  const safeActions = campaign?.safeActions || {};
  if (action === 'start' && typeof safeActions.canStart === 'boolean') return !safeActions.canStart;
  if (action === 'pause' && typeof safeActions.canPause === 'boolean') return !safeActions.canPause;
  if (action === 'resume' && typeof safeActions.canResume === 'boolean') return !safeActions.canResume;
  if (action === 'stop' && typeof safeActions.canStop === 'boolean') return !safeActions.canStop;
  const status = normalizeText(campaign?.status);
  if (action === 'next-step') return ['running', 'queued', 'scheduled'].includes(status) || !getNextCampaignStepConfig(campaign);
  return false;
}

function getActionLabel(action, campaign = {}) {
  if (action === 'start' && campaign?.safeActions?.actionLabel === 'Retry/Fix Issue') return 'Retry/Fix Issue';
  if (action === 'next-step') {
    return campaign?.nextActionLabel || getNextCampaignStepConfig(campaign)?.actionLabel || 'Final Mail Done';
  }
  return ACTION_LABELS[action] || action;
}

function buildNextProcessPayload(campaign = {}) {
  const nextStep = getNextCampaignStep(campaign);
  const nextConfig = CAMPAIGN_STEP_TYPES[nextStep];
  if (!nextConfig) return null;
  const listId = String(campaign.listId || campaign.selectedListId || '').trim();
  return {
    ...campaign,
    listId,
    selectedListId: listId,
    resumeToReviewList: true,
    nextProcessMode: true,
    nextProcessSourceCampaignId: campaign._id,
    nextProcessStep: nextStep,
    nextDraftType: nextConfig.type,
    draftType: nextConfig.type,
    type: nextConfig.type,
    workflowStep: nextStep,
    workflowStepLabel: nextConfig.label,
    workflowOpenStep: 2,
    inlineTemplate: {},
    resumedFromCampaignStatus: campaign.status || campaign.displayStatus || ''
  };
}

function buildNextProcessDashboardUrl(payload = {}) {
  const params = new URLSearchParams({ nextProcess: '1', workflowStep: '2' });
  const listId = String(payload.listId || payload.selectedListId || '').trim();
  if (listId) {
    params.set('listId', listId);
    params.set('autoUpload', '1');
  }
  return `/dashboard/user?${params.toString()}`;
}

function getDisplayStatus(campaign = {}) {
  const displayStatus = String(campaign?.displayStatus || '').trim();
  if (displayStatus) return displayStatus;

  const status = normalizeText(campaign?.status || '');
  const workerStatus = normalizeText(campaign?.workerStatus || '');
  const sent = Number(campaign?.sentCount ?? campaign?.stats?.sent ?? 0);
  const pending = Number(campaign?.pendingCount ?? campaign?.stats?.pending ?? 0);

  if (['paused', 'stopped', 'failed', 'completed'].includes(status)) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
  if (workerStatus === 'running') return 'Running';
  if (sent > 0 && pending > 0) return 'Running';
  if (status === 'queued' && sent === 0) return 'Queued';
  if (status === 'running') return 'Running';

  const rawStatus = String(campaign?.status || '').trim();
  return rawStatus || 'Draft';
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function getScheduledDate(campaign = {}) {
  return campaign?.scheduledAt || campaign?.scheduledStart?.at || null;
}

function getSenderEmail(campaign = {}) {
  return campaign?.senderFrom || campaign?.senderAccount?.from || campaign?.senderAccount?.user || '-';
}

function getProjectLabel(campaign = {}) {
  return campaign.projectName || String(campaign.project || '-').toUpperCase();
}

function getCampaignName(value = {}, fallback = 'Untitled campaign') {
  return value.campaignName || value.name || fallback;
}

function getLastActivity(campaign = {}) {
  return campaign.lastActivityAt || campaign.updatedAt || campaign.createdAt || null;
}

function getStep(log = {}, number) {
  return Array.isArray(log.stepLogs) ? log.stepLogs.find((item) => Number(item.stepNumber) === number) || {} : {};
}

function getStepStatus(step = {}) {
  return String(step.status || 'Pending').trim();
}

function isMailSent(step = {}) {
  const status = getStepStatus(step).toLowerCase();
  return Boolean(step.sentAt) || ['sent', 'opened', 'replied', 'delivered', 'auto reply'].includes(status);
}

function recipientHasSentMail(row = {}) {
  if (Number(row.sentCount || 0) > 0 || row.lastSentAt || row.messageId || row.internetMessageId || row.conversationId) {
    return true;
  }
  return [1, 2, 3, 4, 5].some((step) => isMailSent(getStep(row, step)));
}

function isUnsentMailStep(step = {}) {
  return !isMailSent(step);
}

function getMailStatusClass(step = {}) {
  const status = getStepStatus(step).toLowerCase();
  if (['failed', 'bounced', 'spam', 'pending', 'skipped'].includes(status) || isUnsentMailStep(step)) {
    return 'campaign-mail-cell campaign-mail-cell-red';
  }
  return 'campaign-mail-cell campaign-mail-cell-ok';
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function getStatusClassName(status = '') {
  const norm = status.trim().toLowerCase();
  if (['sent', 'replied', 'opened', 'delivered', 'auto reply', 'success', 'completed'].includes(norm)) {
    return 'success';
  }
  if (['failed', 'bounced', 'spam', 'error', 'danger'].includes(norm)) {
    return 'danger';
  }
  if (['paused', 'stopped', 'warning'].includes(norm)) {
    return 'warning';
  }
  if (['running', 'pending', 'queued', 'scheduled'].includes(norm)) {
    return 'status-pending';
  }
  return '';
}

export default function CampaignDetailsDrawer({ campaignId, initialReplyMode = '', initialRecipientEmail = '', initialRecipientLogId = '', onClose, onActionCompleted }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [compose, setCompose] = useState(null);
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState('');
  const [previousExpanded, setPreviousExpanded] = useState(false);
  const initialReplyHandledRef = useRef('');

  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!campaignId) return;
    try {
      if (silent) setRefreshing(true);
      if (!silent) setLoading(true);
      const data = await apiFetchJson(`/api/campaigns/${campaignId}`);
      setDetail(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to load campaign details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId]);

  useEffect(() => {
    initialReplyHandledRef.current = '';
  }, [campaignId, initialReplyMode, initialRecipientEmail, initialRecipientLogId]);

  useEffect(() => {
    void loadDetail();
    const id = window.setInterval(() => void loadDetail({ silent: true }), 12000);
    return () => window.clearInterval(id);
  }, [loadDetail]);

  const syncReplies = async () => {
    setNotice('');
    setError('');
    try {
      const data = await apiFetchJson(`/api/campaigns/${campaignId}/sync-replies`, { method: 'POST' });
      setNotice(data.message || 'Replies synced.');
      await loadDetail({ silent: true });
      onActionCompleted?.();
    } catch (err) {
      setError(err.message || 'Reply sync failed');
    }
  };

  const openNextProcessWorkflow = () => {
    if (!campaign) return;
    setNotice('');
    setError('');
    try {
      const payload = buildNextProcessPayload(campaign);
      if (!payload) {
        setError('This campaign is already at the final mail step.');
        return;
      }
      window.localStorage.setItem(DASHBOARD_RESUME_CAMPAIGN_KEY, JSON.stringify(payload));
      window.location.href = buildNextProcessDashboardUrl(payload);
    } catch (err) {
      setError(err.message || 'Unable to open next process workflow.');
    }
  };

  const copyTable = async () => {
    const rows = detail?.recipients || [];
    const headers = [
      'Campaign Name',
      'Client Name',
      'Email',
      'Company & Title',
      'Status',
      'Last Sent Draft',
      'Last Sent Time',
      'Next Draft',
      'Engagement',
      'Failure Reason',
      'Last Activity',
      'Notes'
    ];
    const text = [
      headers.join('\t'),
      ...rows.map((row) => {
        let lastSentStep = 0;
        for (let step = 5; step >= 1; step--) {
          const stepLog = getStep(row, step);
          if (isMailSent(stepLog)) {
            lastSentStep = step;
            break;
          }
        }
        const lastSentDraft = lastSentStep > 0 ? (CAMPAIGN_STEP_TYPES[lastSentStep]?.label || `Step ${lastSentStep}`) : '-';
        const lastSentTime = lastSentStep > 0 ? formatDateTime(getStep(row, lastSentStep).sentAt) : '-';

        let nextStep = 0;
        if (row.followUpStopped) {
          nextStep = -1;
        } else {
          for (let step = 1; step <= 5; step++) {
            const stepLog = getStep(row, step);
            if (!isMailSent(stepLog)) {
              nextStep = step;
              break;
            }
          }
        }
        let nextDraft = '-';
        if (nextStep === -1) {
          nextDraft = 'None (Stopped)';
        } else if (nextStep === 0) {
          nextDraft = 'None (Completed)';
        } else if (nextStep > 0) {
          nextDraft = CAMPAIGN_STEP_TYPES[nextStep]?.label || `Step ${nextStep}`;
        }

        const companyParts = [];
        if (row.company) companyParts.push(row.company);
        if (row.designation) companyParts.push(row.designation);
        const companyTitle = companyParts.join(' | ') || '-';

        const opens = row.openCount || 0;
        const replies = row.replyCount || 0;
        const engagement = `Opens: ${opens}, Replies: ${replies}`;

        return [
          row.campaignName || campaign.name || 'Untitled campaign',
          row.clientName || '-',
          row.email || '-',
          companyTitle,
          row.status || 'Pending',
          lastSentDraft,
          lastSentTime,
          nextDraft,
          engagement,
          row.failureReason || row.followUpStopReason || '-',
          formatDateTime(row.lastActivityAt),
          row.notes || '-'
        ].map((value) => String(value || '').replace(/\r?\n|\r/g, ' ')).join('\t');
      })
    ].join('\n');
    await navigator.clipboard?.writeText(text);
    setNotice('Campaign table copied.');
  };

  const campaign = detail?.summary || detail?.campaign || {};
  const recipients = detail?.recipients || [];
  const timeline = detail?.timeline || [];
  const followUpSummary = recipients.reduce((summary, row) => {
    summary.originalSent += Number(row.sentCount || 0) > 0 ? 1 : 0;
    summary.reminderSent += Number(row.reminderSentCount || 0);
    summary.replySent += Number(row.manualReplySentCount || 0);
    summary.replyAllSent += Number(row.replyAllSentCount || 0);
    const lastFollowUp = row.lastFollowUpAt ? new Date(row.lastFollowUpAt).getTime() : 0;
    if (lastFollowUp && lastFollowUp > summary.lastFollowUpTime) summary.lastFollowUpTime = lastFollowUp;
    return summary;
  }, { originalSent: 0, reminderSent: 0, replySent: 0, replyAllSent: 0, lastFollowUpTime: 0 });

  const openCompose = async (row, mode = 'reply') => {
    setComposeError('');
    setPreviousExpanded(false);
    try {
      const params = new URLSearchParams({ recipientLogId: String(row._id || ''), mode });
      const data = await apiFetchJson(`/api/campaigns/${campaignId}/replies?${params.toString()}`);
      const composeData = data.compose || {};
      const modeLabel = mode === 'reply_all' ? 'Reply All' : 'Reply';
      setCompose({
        mode,
        modeLabel,
        recipientLogId: row._id,
        recipientEmail: row.email || row.recipientEmail || '',
        to: (composeData.to || [row.email || row.recipientEmail || '']).join(', '),
        cc: mode === 'reply' ? '' : (composeData.cc || []).join(', '),
        bcc: '',
        subject: composeData.subject || `Re: ${composeData.originalSubject || campaign.name || ''}`,
        html: '<p></p>',
        previous: composeData.previous || {}
      });
    } catch (err) {
      setComposeError(err.message || 'Unable to prepare reply.');
    }
  };

  useEffect(() => {
    if (!initialReplyMode || compose || !recipients.length) return;
    const targetKey = [campaignId, initialReplyMode, initialRecipientLogId, initialRecipientEmail].join(':');
    if (initialReplyHandledRef.current === targetKey) return;

    const normalizedMode = initialReplyMode === 'reply_all' ? 'reply_all' : 'reply';
    const normalizedInitialEmail = normalizeEmail(initialRecipientEmail);
    const matchingRecipient = recipients.find((row) => String(row._id || '') === String(initialRecipientLogId || '').trim())
      || recipients.find((row) => normalizedInitialEmail && normalizeEmail(row.email || row.recipientEmail || '') === normalizedInitialEmail)
      || recipients.find((row) => recipientHasSentMail(row));

    initialReplyHandledRef.current = targetKey;
    if (!matchingRecipient) {
      setComposeError('No sent recipient thread is available for this campaign yet.');
      return;
    }
    void openCompose(matchingRecipient, normalizedMode);
  }, [campaignId, compose, initialRecipientEmail, initialRecipientLogId, initialReplyMode, recipients]);

  const submitCompose = async () => {
    if (!compose) return;
    setComposeSending(true);
    setComposeError('');
    setNotice('');
    try {
      const data = await apiFetchJson(`/api/campaigns/${campaignId}/replies`, {
        method: 'POST',
        body: JSON.stringify({
          mode: compose.mode,
          recipientLogId: compose.recipientLogId,
          recipientEmail: compose.recipientEmail,
          to: compose.to,
          cc: compose.cc,
          bcc: compose.bcc,
          subject: compose.subject,
          html: compose.html
        })
      });
      setNotice(data.message || 'Reply sent.');
      setCompose(null);
      await loadDetail({ silent: true });
      onActionCompleted?.();
    } catch (err) {
      setComposeError(err.message || 'Unable to send reply.');
    } finally {
      setComposeSending(false);
    }
  };

  return (
    <div className="dashboard-subscription-modal-backdrop campaign-detail-backdrop" onClick={onClose}>
      <section className="dashboard-subscription-modal campaign-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dashboard-subscription-modal-head campaign-detail-head">
          <button type="button" className="page-back-button campaign-detail-back-button" onClick={onClose} aria-label="Go back to campaigns">
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <div>
            <span>Campaign Details</span>
            <h2>{campaign.name || 'Campaign'}</h2>
            <p>{getProjectLabel(campaign)} | {getSenderEmail(campaign)}</p>
          </div>
          <button className="campaign-detail-close" type="button" onClick={onClose} aria-label="Close campaign details">x</button>
        </div>

        {loading ? <p>Loading campaign details...</p> : null}
        {error ? <div className="campaign-alert campaign-alert-error">{error}</div> : null}
        {notice ? <div className="campaign-alert campaign-alert-success">{notice}</div> : null}

        {!loading ? (
          <>
            <div className="dashboard-subscription-modal-grid campaign-detail-metric-grid">
              <article><span>Status</span><strong>{getDisplayStatus(campaign)}</strong></article>
              <article><span>Total recipients</span><strong>{Number(campaign.totalRecipients ?? campaign.stats?.total ?? recipients.length ?? 0).toLocaleString()}</strong></article>
              <article><span>Sent</span><strong>{Number(campaign.sentCount ?? campaign.stats?.sent ?? 0).toLocaleString()}</strong></article>
              <article><span>Pending</span><strong>{Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0).toLocaleString()}</strong></article>
              <article><span>Failed</span><strong>{Number(campaign.failedCount ?? campaign.stats?.failed ?? 0).toLocaleString()}</strong></article>
              <article><span>Open count</span><strong>{Number(campaign.openCount || 0).toLocaleString()}</strong></article>
              <article><span>Reply count</span><strong>{Number(campaign.replyCount || 0).toLocaleString()}</strong></article>
              <article><span>Positive replies</span><strong>{Number(campaign.positiveReplyCount || 0).toLocaleString()}</strong></article>
              <article><span>Negative replies</span><strong>{Number(campaign.negativeReplyCount || 0).toLocaleString()}</strong></article>
              <article><span>Follow-up stopped</span><strong>{Number(campaign.followUpStoppedCount || 0).toLocaleString()}</strong></article>
              <article><span>Original Sent</span><strong>{followUpSummary.originalSent.toLocaleString()}</strong></article>
              <article><span>Reminder Sent</span><strong>{followUpSummary.reminderSent.toLocaleString()}</strong></article>
              <article><span>Reply Sent</span><strong>{followUpSummary.replySent.toLocaleString()}</strong></article>
              <article><span>Reply All Sent</span><strong>{followUpSummary.replyAllSent.toLocaleString()}</strong></article>
              <article><span>Last Follow-up Date</span><strong>{followUpSummary.lastFollowUpTime ? formatDateTime(followUpSummary.lastFollowUpTime) : '-'}</strong></article>
              <article><span>Thread Status</span><strong>{followUpSummary.reminderSent || followUpSummary.replySent || followUpSummary.replyAllSent ? 'Follow-up active' : 'Original only'}</strong></article>
              <article><span>Created</span><strong>{formatDateTime(campaign.createdAt)}</strong></article>
              <article><span>Scheduled</span><strong>{formatDateTime(getScheduledDate(campaign))}</strong></article>
              <article><span>Started</span><strong>{formatDateTime(campaign.startedAt)}</strong></article>
              <article><span>Completed</span><strong>{formatDateTime(campaign.finishedAt)}</strong></article>
              <article><span>Reason</span><strong>{campaign.failureReason || campaign.pauseReason || campaign.stopReason || campaign.lastError || '-'}</strong></article>
              <article><span>Last activity</span><strong>{formatDateTime(getLastActivity(campaign))}</strong></article>
            </div>

            <div className="dashboard-subscription-modal-actions campaign-detail-actions">
              <Button variant="primary" size="sm" loading={refreshing} disabled={getActionDisabled('next-step', campaign)} onClick={openNextProcessWorkflow}>
                {getActionLabel('next-step', campaign)}
              </Button>
              <Button variant="secondary" size="sm" loading={refreshing} onClick={() => loadDetail({ silent: true })}>Refresh</Button>
              <Button variant="secondary" size="sm" onClick={syncReplies}>Sync Replies</Button>
              <Button as="a" href={`/api/campaigns/${campaignId}/export?format=csv`} variant="secondary" size="sm">Export CSV</Button>
              <Button as="a" href={`/api/campaigns/${campaignId}/export?format=xlsx`} variant="secondary" size="sm">Export Excel</Button>
              <Button variant="secondary" size="sm" onClick={copyTable}>Copy Table</Button>
              <span>Last updated at {formatDateTime(detail?.lastUpdatedAt || new Date())}</span>
            </div>

            <div className="dashboard-subscription-transactions campaign-detail-timeline">
              <div>
                <h3>Status Timeline</h3>
                <span>{timeline.length} events</span>
              </div>
              <div className="dashboard-subscription-transaction-list">
                {timeline.slice(0, 12).map((item, index) => (
                  <article key={`${item.at}-${index}`}>
                    <div>
                      <strong>{item.type || 'Activity'}</strong>
                      <span>{item.message || '-'}</span>
                    </div>
                    <b>{formatDateTime(item.at)}</b>
                  </article>
                ))}
              </div>
            </div>

            <div className="campaign-detail-table-section">
              <div className="campaign-detail-section-head">
                <div>
                  <span className="campaigns-page-kicker">Recipient delivery log</span>
                  <h3>Campaign Events</h3>
                </div>
                <strong>{recipients.length.toLocaleString()} recipients</strong>
              </div>
              <div className="campaign-table-wrap campaign-detail-table-wrap">
              <table className="campaign-table">
                <thead>
                  <tr>
                    <th>Client Name</th>
                    <th>Email</th>
                    <th>Company & Title</th>
                    <th>Status</th>
                    <th>Last Sent Draft</th>
                    <th>Last Sent Time</th>
                    <th>Next Draft</th>
                    <th>Engagement</th>
                    <th>Failure Reason</th>
                    <th>Last Activity</th>
                    <th>Thread Status</th>
                    <th>Actions</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((row) => {
                    const hasAnySentMail = recipientHasSentMail(row);
                    
                    let lastSentStep = 0;
                    for (let step = 5; step >= 1; step--) {
                      const stepLog = getStep(row, step);
                      if (isMailSent(stepLog)) {
                        lastSentStep = step;
                        break;
                      }
                    }
                    const lastSentDraft = lastSentStep > 0 ? (CAMPAIGN_STEP_TYPES[lastSentStep]?.label || `Step ${lastSentStep}`) : '-';
                    const lastSentTime = lastSentStep > 0 ? formatDateTime(getStep(row, lastSentStep).sentAt) : '-';

                    let nextStep = 0;
                    if (row.followUpStopped) {
                      nextStep = -1;
                    } else {
                      for (let step = 1; step <= 5; step++) {
                        const stepLog = getStep(row, step);
                        if (!isMailSent(stepLog)) {
                          nextStep = step;
                          break;
                        }
                      }
                    }
                    let nextDraft = '-';
                    if (nextStep === -1) {
                      nextDraft = 'None (Stopped)';
                    } else if (nextStep === 0) {
                      nextDraft = 'None (Completed)';
                    } else if (nextStep > 0) {
                      nextDraft = CAMPAIGN_STEP_TYPES[nextStep]?.label || `Step ${nextStep}`;
                    }

                    const companyParts = [];
                    if (row.company) companyParts.push(row.company);
                    if (row.designation) companyParts.push(row.designation);
                    const companyTitle = companyParts.join(' | ') || '-';

                    const opens = row.openCount || 0;
                    const replies = row.replyCount || 0;

                    return (
                      <tr key={row._id || row.email} className={hasAnySentMail ? '' : 'campaign-recipient-unsent-row'}>
                        <td>{row.clientName || '-'}</td>
                        <td>{row.email || '-'}</td>
                        <td>{companyTitle}</td>
                        <td>
                          <span className={getStatusClassName(row.status || 'Pending')}>
                            {row.status || 'Pending'}
                          </span>
                        </td>
                        <td>{lastSentDraft}</td>
                        <td>{lastSentTime}</td>
                        <td>{nextDraft}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                            <span className={opens > 0 ? 'success' : 'text-muted'}>
                              {opens > 0 ? `Opened (${opens}x)` : 'No opens'}
                            </span>
                            <span className={row.replyReceived ? 'success' : 'text-muted'}>
                              {row.replyReceived ? `Replied (${replies}x)` : 'No replies'}
                            </span>
                          </div>
                        </td>
                        <td>{row.failureReason || row.followUpStopReason || '-'}</td>
                        <td>{formatDateTime(row.lastActivityAt)}</td>
                        <td>{row.threadStatus || (hasAnySentMail ? 'Original Sent' : '-')}</td>
                        <td>
                          <div className="campaign-thread-actions">
                            <button type="button" className="campaign-thread-action" disabled={!hasAnySentMail} onClick={() => openCompose(row, 'reply')}>Reply</button>
                            <button type="button" className="campaign-thread-action" disabled={!hasAnySentMail} onClick={() => openCompose(row, 'reply_all')}>Reply All</button>
                          </div>
                        </td>
                        <td>{row.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          </>
        ) : null}

        {composeError && !compose ? <div className="campaign-alert campaign-alert-error">{composeError}</div> : null}
        {compose ? (
          <div className="campaign-compose-backdrop" onClick={() => setCompose(null)}>
            <section className="campaign-compose-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
              <div className="campaign-compose-head">
                <strong>{compose.modeLabel}</strong>
                <button type="button" onClick={() => setCompose(null)} aria-label="Cancel reply">x</button>
              </div>
              {composeError ? <div className="campaign-alert campaign-alert-error">{composeError}</div> : null}
              <label className="campaign-compose-field">
                <span>To</span>
                <input value={compose.to} onChange={(event) => setCompose((prev) => ({ ...prev, to: event.target.value }))} />
              </label>
              <label className="campaign-compose-field">
                <span>CC</span>
                <input value={compose.cc} onChange={(event) => setCompose((prev) => ({ ...prev, cc: event.target.value }))} />
              </label>
              <label className="campaign-compose-field">
                <span>BCC</span>
                <input value={compose.bcc} onChange={(event) => setCompose((prev) => ({ ...prev, bcc: event.target.value }))} />
              </label>
              <label className="campaign-compose-field">
                <span>Subject</span>
                <input value={compose.subject} onChange={(event) => setCompose((prev) => ({ ...prev, subject: event.target.value }))} />
              </label>
              <div className="campaign-compose-editor-wrap">
                <span>Message</span>
                <div
                  className="campaign-compose-editor"
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: compose.html }}
                  onInput={(event) => setCompose((prev) => ({ ...prev, html: event.currentTarget.innerHTML }))}
                />
              </div>
              <div className="campaign-compose-previous">
                <button type="button" onClick={() => setPreviousExpanded((value) => !value)}>
                  {previousExpanded ? 'Hide previous email' : 'Show previous email'}
                </button>
                {previousExpanded ? (
                  <div className="campaign-compose-previous-body">
                    <strong>{compose.previous?.subject || compose.subject}</strong>
                    <small>{formatDateTime(compose.previous?.sentAt)}</small>
                    {compose.previous?.previewHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: compose.previous.previewHtml }} />
                    ) : (
                      <p>Previous message content is not stored for this email, but thread headers will be preserved when sending.</p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="campaign-compose-actions">
                <Button variant="secondary" size="sm" onClick={() => setCompose(null)}>Cancel</Button>
                <Button variant="primary" size="sm" loading={composeSending} onClick={submitCompose}>
                  {compose.mode === 'reply_all' ? 'Send Reply All' : 'Send Reply'}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
