'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/app/components/layout/AppLayout';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import { apiFetchJson } from '@/app/lib/apiClient';
import { UNIFIED_NAVBAR_TOPBAR_PROPS } from '@/shared-components/layout-components/UnifiedNavbarConfig';

const EMPTY_COUNTS = {
  total: 0,
  running: 0,
  paused: 0,
  failed: 0,
  incomplete: 0,
  completed: 0,
  scheduled: 0
};

const COUNT_CARDS = [
  { key: 'total', label: 'Total Campaigns', shortLabel: 'Total', icon: 'ti-stack-2', tone: 'total' },
  { key: 'running', label: 'Running Campaigns', shortLabel: 'Running', icon: 'ti-player-play', tone: 'running' },
  { key: 'paused', label: 'Paused Campaigns', shortLabel: 'Paused', icon: 'ti-player-pause', tone: 'paused' },
  { key: 'failed', label: 'Failed Campaigns', shortLabel: 'Failed', icon: 'ti-circle-x', tone: 'failed' },
  { key: 'incomplete', label: 'Incomplete / Draft', shortLabel: 'Incomplete', icon: 'ti-clock-pause', tone: 'incomplete' },
  { key: 'completed', label: 'Completed Campaigns', shortLabel: 'Completed', icon: 'ti-circle-check', tone: 'completed' },
  { key: 'scheduled', label: 'Scheduled Campaigns', shortLabel: 'Scheduled', icon: 'ti-calendar-event', tone: 'scheduled' }
];

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'failed', label: 'Failed' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'completed', label: 'Completed' },
  { value: 'scheduled', label: 'Scheduled' }
];

const STATUS_BADGE_VARIANTS = {
  running: 'success',
  paused: 'warning',
  failed: 'danger',
  incomplete: 'warning',
  completed: 'success',
  scheduled: 'info'
};

const ACTION_LABELS = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop',
  'next-step': 'Next Mail'
};
const LIVE_CAMPAIGN_STATUSES = new Set(['running', 'queued', 'scheduled']);
const DASHBOARD_RESUME_CAMPAIGN_KEY = 'dashboard:resume-campaign-draft:v1';
const CAMPAIGN_PAGE_SIZE = 10;
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

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function inferCampaignStep(campaign = {}) {
  const completedWorkflowStep = Math.floor(Number(campaign?.completedWorkflowStep || 0) || 0);
  if (completedWorkflowStep >= 1 && completedWorkflowStep <= 5) return completedWorkflowStep;
  const workflowStep = Math.floor(Number(campaign?.workflowStep || 0) || 0);
  const typeStep = DRAFT_TYPE_TO_STEP[normalizeText(campaign?.draftType || campaign?.type || '')] || 0;
  return Math.max(1, Math.min(5, typeStep || workflowStep || 1));
}

function getNextCampaignStep(campaign = {}) {
  const nextWorkflowStep = Math.floor(Number(campaign?.nextWorkflowStep || 0) || 0);
  if (nextWorkflowStep >= 2 && nextWorkflowStep <= 5) return nextWorkflowStep;
  return Math.min(inferCampaignStep(campaign) + 1, 6);
}

function getNextCampaignStepConfig(campaign = {}) {
  return CAMPAIGN_STEP_TYPES[getNextCampaignStep(campaign)] || null;
}

function hasRequiredCampaignData(campaign = {}) {
  const hasList = Boolean(campaign.listId);
  const hasTemplate = Boolean(campaign.templateId || (campaign.inlineTemplate?.subject && campaign.inlineTemplate?.body));
  const hasSender = Boolean(campaign.senderAccountId || campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user);
  const total = Number(campaign.stats?.total || 0);
  return hasList && hasTemplate && hasSender && total > 0;
}

function normalizeCampaignStatusBucket(campaign = {}) {
  const status = normalizeText(getDisplayStatus(campaign));
  if (status === 'running') return 'running';
  if (status === 'paused') return 'paused';
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'completed';
  if (status === 'scheduled') return 'scheduled';
  if (status === 'queued') return hasRequiredCampaignData(campaign) ? 'scheduled' : 'incomplete';
  return 'incomplete';
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

function getStats(campaign = {}) {
  const total = Number(campaign?.totalRecipients ?? campaign?.stats?.total ?? 0);
  const sent = Number(campaign?.sentCount ?? campaign?.stats?.sent ?? 0);
  const failed = Number(campaign?.failedCount ?? campaign?.stats?.failed ?? 0);
  const pendingFromStats = campaign?.pendingCount ?? campaign?.stats?.pending;
  const pending = Number.isFinite(Number(pendingFromStats))
    ? Number(pendingFromStats || 0)
    : Math.max(total - sent - failed, 0);

  return {
    total,
    sent,
    pending,
    failed,
    opens: Number(campaign?.openCount ?? campaign?.trackingStats?.openCount ?? 0),
    replies: Number(campaign?.replyCount ?? campaign?.trackingStats?.replyCount ?? 0)
  };
}

function getFailureRateLabel(stats = {}) {
  const total = Number(stats.total || 0);
  const failed = Number(stats.failed || 0);
  if (!total || !failed) return '-';
  return `${Math.round((failed / total) * 100)}%`;
}

function getProjectLabel(campaign = {}) {
  return campaign.projectName || String(campaign.project || '-').toUpperCase();
}

function getCampaignName(value = {}, fallback = 'Untitled campaign') {
  return value.campaignName || value.name || fallback;
}

function getFailureReason(campaign = {}) {
  if (getDisplayStatus(campaign) === 'Queued' && campaign.queueReason) return campaign.queueReason;
  return campaign.failureReason || campaign.lastError || '-';
}

function getLastActivity(campaign = {}) {
  return campaign.lastActivityAt || campaign.updatedAt || campaign.createdAt || null;
}

function getActionDisabled(action, campaign = {}) {
  const safeActions = campaign?.safeActions || {};
  if (action === 'start' && typeof safeActions.canStart === 'boolean') return !safeActions.canStart;
  if (action === 'pause' && typeof safeActions.canPause === 'boolean') return !safeActions.canPause;
  if (action === 'resume' && typeof safeActions.canResume === 'boolean') return !safeActions.canResume;
  if (action === 'stop' && typeof safeActions.canStop === 'boolean') return !safeActions.canStop;
  const bucket = normalizeCampaignStatusBucket(campaign);
  const status = normalizeText(campaign?.status);
  if (action === 'next-step') return ['running', 'queued', 'scheduled'].includes(status) || !getNextCampaignStepConfig(campaign);
  if (action === 'start') return bucket === 'running' || bucket === 'completed' || status === 'paused';
  if (action === 'pause') return bucket !== 'running' && bucket !== 'scheduled';
  if (action === 'resume') return bucket !== 'paused';
  if (action === 'stop') return bucket === 'completed' || bucket === 'failed' || normalizeText(campaign?.status) === 'stopped';
  return false;
}

function getActionLabel(action, campaign = {}) {
  if (action === 'start' && campaign?.safeActions?.actionLabel === 'Retry/Fix Issue') return 'Retry/Fix Issue';
  if (action === 'start' && normalizeCampaignStatusBucket(campaign) === 'failed') return 'Retry/Fix Issue';
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

function getApiMessage(data, fallback) {
  return data?.message || data?.error || data?.code || fallback;
}

function buildPaginationItems(currentPage, totalPages) {
  if (totalPages <= 6) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 5) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis-end', totalPages];
}

function getStepStatus(step = {}) {
  return String(step.status || 'Pending').trim();
}

function isMailSent(step = {}) {
  const status = getStepStatus(step).toLowerCase();
  return Boolean(step.sentAt) || ['sent', 'opened', 'replied', 'delivered', 'auto reply'].includes(status);
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

function CountCard({ card, count, total, loading }) {
  const countValue = Number(count || 0);
  const totalValue = Number(total || 0);
  const percentage = card.key === 'total'
    ? (totalValue > 0 ? 100 : 0)
    : (totalValue > 0 ? Math.round((countValue / totalValue) * 100) : 0);

  return (
    <article className={`campaign-count-card campaign-count-card-${card.tone} stat-card si-${card.tone}`}>
      <div className="campaign-count-card-glow" />
      <div className="campaign-count-card-head stat-row">
        <span className="campaign-count-label stat-label">{card.shortLabel}</span>
        <span className="campaign-count-icon stat-icon" aria-hidden="true">
          <i className={`ti ${card.icon}`} />
        </span>
      </div>
      {loading ? <div className="campaign-count-skeleton" /> : <strong className="stat-num">{countValue.toLocaleString()}</strong>}
      <span className="campaign-count-percent stat-pct">
        {card.key === 'total' ? `${percentage}% - all campaigns` : `${percentage}% ${card.shortLabel.toLowerCase()}`}
      </span>
    </article>
  );
}

function ActionButton({ action, campaign, loadingKey, onAction }) {
  const campaignId = String(campaign?._id || '');
  const key = `${campaignId}:${action}`;
  const loading = loadingKey === key;
  const disabled = getActionDisabled(action, campaign);

  return (
    <Button
      size="sm"
      variant={action === 'stop' ? 'danger' : action === 'start' || action === 'next-step' ? 'primary' : 'secondary'}
      loading={loading}
      disabled={disabled}
      onClick={() => onAction(campaign, action)}
    >
      {getActionLabel(action, campaign)}
    </Button>
  );
}

function CampaignRowActionMenu({ campaign, actionLoadingKey, onAction, onToggleView }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) return;
      menuRef.current.removeAttribute('open');
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        menuRef.current?.removeAttribute('open');
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const closeMenu = () => {
    menuRef.current?.removeAttribute('open');
  };

  const handleView = () => {
    closeMenu();
    onToggleView(campaign._id);
  };

  const handleAction = (selectedCampaign, action) => {
    closeMenu();
    onAction(selectedCampaign, action);
  };

  return (
    <details ref={menuRef} className="campaign-row-actions">
      <summary className="table-action-btn" aria-label={`Campaign actions for ${campaign.name || 'campaign'}`}>
        <i className="ti ti-dots-vertical" aria-hidden="true" />
      </summary>
      <div className="campaign-row-action-menu">
        <Button size="sm" variant="secondary" onClick={handleView}>
          View
        </Button>
        <ActionButton action="next-step" campaign={campaign} loadingKey={actionLoadingKey} onAction={handleAction} />
        <ActionButton action="start" campaign={campaign} loadingKey={actionLoadingKey} onAction={handleAction} />
        <ActionButton action="pause" campaign={campaign} loadingKey={actionLoadingKey} onAction={handleAction} />
        <ActionButton action="resume" campaign={campaign} loadingKey={actionLoadingKey} onAction={handleAction} />
        <ActionButton action="stop" campaign={campaign} loadingKey={actionLoadingKey} onAction={handleAction} />
      </div>
    </details>
  );
}

function CampaignDesktopTable({ campaigns, actionLoadingKey, onAction, onToggleView, startIndex = 0 }) {
  return (
    <div className="campaign-table-wrap">
      <table className="campaign-table data-table">
        <thead>
          <tr>
            <th><input type="checkbox" aria-label="Select all campaigns" /></th>
            <th>SR. NO.</th>
            <th>Campaign Name</th>
            <th>Project</th>
            <th>Status</th>
            <th>Recipients</th>
            <th>Sent</th>
            <th>Pending</th>
            <th>Failed</th>
            <th>Open Count</th>
            <th>Response Count</th>
            <th>Failure Rate</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign, index) => {
            const stats = getStats(campaign);
            const bucket = normalizeCampaignStatusBucket(campaign);

            return (
              <tr key={campaign._id}>
                <td><input type="checkbox" aria-label={`Select ${campaign.name || 'campaign'}`} /></td>
                <td className="num-cell">{startIndex + index + 1}</td>
                <td>
                  <div className="campaign-name-cell">
                    <button
                      type="button"
                      className="campaign-name-link campaign-link"
                      onClick={() => onToggleView(campaign._id)}
                    >
                      {campaign.name || 'Untitled campaign'}
                    </button>
                    <div className="campaign-meta">{campaign.type || campaign.draftType || '-'}</div>
                  </div>
                </td>
                <td className="campaign-project-cell">{getProjectLabel(campaign)}</td>
                <td className="campaign-status-cell">
                  <Badge className={`campaign-status-badge tag-pill tag-${bucket}`} variant={STATUS_BADGE_VARIANTS[bucket] || 'default'}>
                    {getDisplayStatus(campaign)}
                  </Badge>
                </td>
                <td className="num-cell">{stats.total.toLocaleString()}</td>
                <td className="num-cell">{stats.sent.toLocaleString()}</td>
                <td className="num-cell">{stats.pending.toLocaleString()}</td>
                <td className="num-cell">{stats.failed.toLocaleString()}</td>
                <td className="num-cell">{stats.opens.toLocaleString()}</td>
                <td className="campaign-response-cell">{stats.replies.toLocaleString()} {stats.replies === 1 ? 'Reply' : 'Replies'}</td>
                <td className={stats.failed ? 'campaign-failure-rate is-danger' : 'campaign-failure-rate'}>{getFailureRateLabel(stats)}</td>
                <td className="campaign-row-actions-cell">
                  <CampaignRowActionMenu
                    campaign={campaign}
                    actionLoadingKey={actionLoadingKey}
                    onAction={onAction}
                    onToggleView={onToggleView}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CampaignMobileCards({ campaigns, actionLoadingKey, onAction, onToggleView }) {
  return (
    <div className="campaign-mobile-list">
      {campaigns.map((campaign) => {
        const stats = getStats(campaign);
        const bucket = normalizeCampaignStatusBucket(campaign);

        return (
          <article key={`mobile-${campaign._id}`} className="campaign-mobile-card">
            <div className="campaign-mobile-card-head">
              <div>
                <button
                  type="button"
                  className="campaign-name-link"
                  onClick={() => onToggleView(campaign._id)}
                >
                  {campaign.name || 'Untitled campaign'}
                </button>
                <small>{getProjectLabel(campaign)} | {getSenderEmail(campaign)}</small>
              </div>
              <Badge className={`campaign-status-badge tag-pill tag-${bucket}`} variant={STATUS_BADGE_VARIANTS[bucket] || 'default'}>
                {getDisplayStatus(campaign)}
              </Badge>
            </div>
            <div className="campaign-mobile-metrics">
              <span><b>{stats.total}</b>Total</span>
              <span><b>{stats.sent}</b>Sent</span>
              <span><b>{stats.pending}</b>Pending</span>
              <span><b>{stats.failed}</b>Failed</span>
              <span><b>{stats.opens}</b>Opens</span>
              <span><b>{stats.replies}</b>Replies</span>
            </div>
            <div className="campaign-mobile-meta">
              <span>Failure: {getFailureReason(campaign)}</span>
              <span>Last activity: {formatDateTime(getLastActivity(campaign))}</span>
              <span>Created: {formatDateTime(campaign.createdAt)}</span>
              <span>Scheduled: {formatDateTime(getScheduledDate(campaign))}</span>
            </div>
            <div className="campaign-action-row">
              <Button size="sm" variant="secondary" onClick={() => onToggleView(campaign._id)}>
                View
              </Button>
              <ActionButton action="next-step" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
              <ActionButton action="start" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
              <ActionButton action="pause" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
              <ActionButton action="resume" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
              <ActionButton action="stop" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function getStep(log = {}, number) {
  return Array.isArray(log.stepLogs) ? log.stepLogs.find((item) => Number(item.stepNumber) === number) || {} : {};
}

function CampaignDetailsDrawer({ campaignId, onClose, onActionCompleted }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
    const headers = ['Client Name', 'Email', 'Company', 'Designation', 'Status', 'Open Count', 'Reply Count', 'Failure Reason', 'Last Activity'];
    const text = [
      ['Campaign Name', ...headers].join('\t'),
      ...rows.map((row) => [
        row.campaignName || campaign.name,
        row.clientName,
        row.email,
        row.company,
        row.designation,
        row.status,
        row.openCount,
        row.replyCount,
        row.failureReason,
        formatDateTime(row.lastActivityAt)
      ].map((value) => String(value || '')).join('\t'))
    ].join('\n');
    await navigator.clipboard?.writeText(text);
    setNotice('Campaign table copied.');
  };

  const campaign = detail?.summary || detail?.campaign || {};
  const recipients = detail?.recipients || [];
  const timeline = detail?.timeline || [];

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
                    <th>Campaign Name</th>
                    <th>Client Name</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Designation</th>
                    <th>Project</th>
                    <th>Campaign Step</th>
                    {[1, 2, 3, 4, 5].map((step) => <th key={`sent-${step}`}>Mail {step} Sent</th>)}
                    {[1, 2, 3, 4, 5].map((step) => <th key={`status-${step}`}>Mail {step} Status</th>)}
                    <th>Opened</th>
                    <th>Open Count</th>
                    <th>Last Opened At</th>
                    <th>Replied</th>
                    <th>Reply Count</th>
                    <th>Last Reply At</th>
                    <th>Reply Type</th>
                    <th>Reply Preview</th>
                    <th>Follow-up Stopped</th>
                    <th>Failure Reason</th>
                    <th>Last Activity</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((row) => {
                    const hasAnySentMail = [1, 2, 3, 4, 5].some((step) => isMailSent(getStep(row, step)));
                    return (
                      <tr key={row._id || row.email} className={hasAnySentMail ? '' : 'campaign-recipient-unsent-row'}>
                        <td>{getCampaignName(row, campaign.name || 'Untitled campaign')}</td>
                        <td>{row.clientName || '-'}</td>
                        <td>{row.email || '-'}</td>
                        <td>{row.company || '-'}</td>
                        <td>{row.designation || '-'}</td>
                        <td>{row.projectName || getProjectLabel(campaign)}</td>
                        <td>{row.currentStep || '-'}</td>
                        {[1, 2, 3, 4, 5].map((step) => {
                          const stepLog = getStep(row, step);
                          return (
                            <td key={`${row.email}-sent-${step}`} className={isUnsentMailStep(stepLog) ? 'campaign-mail-cell campaign-mail-cell-red' : 'campaign-mail-cell campaign-mail-cell-ok'}>
                              {formatDateTime(stepLog.sentAt)}
                            </td>
                          );
                        })}
                        {[1, 2, 3, 4, 5].map((step) => {
                          const stepLog = getStep(row, step);
                          return (
                            <td key={`${row.email}-status-${step}`} className={getMailStatusClass(stepLog)}>
                              {getStepStatus(stepLog) || 'Pending'}
                            </td>
                          );
                        })}
                        <td>{row.openCount > 0 ? 'Yes' : 'No'}</td>
                        <td>{Number(row.openCount || 0).toLocaleString()}</td>
                        <td>{formatDateTime(row.lastOpenedAt)}</td>
                        <td>{row.replyReceived ? 'Yes' : 'No'}</td>
                        <td>{Number(row.replyCount || 0).toLocaleString()}</td>
                        <td>{formatDateTime(row.lastReplyAt)}</td>
                        <td>{row.replyType || '-'}</td>
                        <td>{row.replyPreview || '-'}</td>
                        <td>{row.followUpStopped ? 'Yes' : 'No'}</td>
                        <td>{row.failureReason || row.followUpStopReason || '-'}</td>
                        <td>{formatDateTime(row.lastActivityAt)}</td>
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
      </section>
    </div>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const campaignListRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState('');
  const activeSection = 'campaign-list';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return undefined;

    const timer = setTimeout(() => {
      campaignListRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [activeSection, isMounted]);

  const loadCampaigns = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      if (!silent) setLoading(true);

      console.debug('[campaigns-page:refetch]', { silent, at: new Date().toISOString() });
      const data = await apiFetchJson('/api/campaigns?limit=100');

      setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
      setCounts({ ...EMPTY_COUNTS, ...(data?.counts || {}) });
      setError('');
    } catch (err) {
      setError(err.message || 'Unable to fetch campaigns');
      if (!silent) {
        setCampaigns([]);
        setCounts(EMPTY_COUNTS);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const hasLiveCampaigns = useMemo(
    () => campaigns.some((campaign) => LIVE_CAMPAIGN_STATUSES.has(normalizeText(getDisplayStatus(campaign)))),
    [campaigns]
  );

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const safeLoad = async (options) => {
      if (!active) return;
      await loadCampaigns(options);
    };

    void safeLoad();
    intervalId = window.setInterval(() => {
      void safeLoad({ silent: true });
    }, hasLiveCampaigns ? 4000 : 30000);

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void safeLoad({ silent: true });
      }
    };

    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadCampaigns, hasLiveCampaigns]);

  const filteredCampaigns = useMemo(() => {
    const query = normalizeText(searchQuery);
    return campaigns
      .filter((campaign) => {
        const bucket = normalizeCampaignStatusBucket(campaign);
        const matchesStatus = statusFilter === 'all' || bucket === statusFilter;
        const matchesSearch = !query || normalizeText(campaign.name).includes(query);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
      });
  }, [campaigns, searchQuery, statusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / CAMPAIGN_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * CAMPAIGN_PAGE_SIZE;
  const pageEndIndex = Math.min(pageStartIndex + CAMPAIGN_PAGE_SIZE, filteredCampaigns.length);
  const paginatedCampaigns = useMemo(
    () => filteredCampaigns.slice(pageStartIndex, pageEndIndex),
    [filteredCampaigns, pageStartIndex, pageEndIndex]
  );
  const paginationItems = useMemo(
    () => buildPaginationItems(safeCurrentPage, totalPages),
    [safeCurrentPage, totalPages]
  );
  const visibleStart = filteredCampaigns.length ? pageStartIndex + 1 : 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortOrder]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleRefresh = useCallback(() => {
    setNotice('');
    void loadCampaigns({ silent: true });
  }, [loadCampaigns]);

  const handleAction = useCallback(async (campaign, action) => {
    const campaignId = String(campaign?._id || '');
    if (!campaignId) return;

    if (action === 'next-step') {
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
      return;
    }

    const nextStatus = {
      start: 'Queued',
      pause: 'Paused',
      resume: 'Queued',
      stop: 'Stopped'
    }[action];

    const key = `${campaignId}:${action}`;
    setActionLoadingKey(key);
    setError('');
    setNotice('');

    if (nextStatus) {
      setCampaigns((items) =>
        items.map((item) => (item._id === campaignId ? { ...item, status: nextStatus, displayStatus: nextStatus, updatedAt: new Date().toISOString() } : item))
      );
    }

    try {
      const data = await apiFetchJson(`/api/campaigns/${campaignId}/${action}`, { method: 'POST' });

      setNotice(getApiMessage(data, `${ACTION_LABELS[action]} request completed.`));
      await loadCampaigns({ silent: true });
    } catch (err) {
      setError(err.message || `${ACTION_LABELS[action]} campaign failed.`);
      await loadCampaigns({ silent: true });
    } finally {
      setActionLoadingKey('');
    }
  }, [loadCampaigns]);

  const openCampaignDetails = useCallback((campaignId) => {
    setSelectedCampaignId(campaignId);
  }, []);

  const handleBackToPreviousPage = useCallback(() => {
    router.back();
  }, [router]);

  if (!isMounted) {
    return (
      <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
        <main className="campaigns-page-shell campaigns-modern-page">
          <section className="campaigns-modern-hero">
            <button type="button" className="page-back-button campaigns-page-back-button" onClick={handleBackToPreviousPage} aria-label="Go back to previous page">
              <i className="ti ti-arrow-left" aria-hidden="true" />
            </button>
            <div>
              <span className="campaigns-page-kicker">Live campaign operations</span>
              <h1>Campaigns</h1>
            </div>
          </section>
          <div className="campaign-table-loading">
            <div />
            <div />
            <div />
            <div />
          </div>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
      <main className="campaigns-page-shell campaigns-modern-page">
        <section className="campaigns-modern-hero">
          <button type="button" className="page-back-button campaigns-page-back-button" onClick={handleBackToPreviousPage} aria-label="Go back to previous page">
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <div>
            <span className="campaigns-page-kicker">Live campaign operations</span>
            <h1>Campaigns</h1>
          </div>
          <div className="campaigns-hero-actions">
            <Button
              variant="secondary"
              size="md"
              loading={refreshing}
              leftIcon={<i className="ti ti-refresh" aria-hidden="true" />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <Button as="a" href="/dashboard/user?workflowStep=1" size="md" leftIcon={<i className="ti ti-plus" aria-hidden="true" />}>
              Create Campaign
            </Button>
          </div>
        </section>

        <section className="campaign-count-grid" aria-label="Campaign counts">
          <div className="campaign-count-row campaign-count-row-top">
            {COUNT_CARDS.slice(0, 4).map((card) => (
              <CountCard
                key={card.key}
                card={card}
                count={counts[card.key]}
                total={counts.total}
                loading={loading}
              />
            ))}
          </div>
          <div className="campaign-count-row campaign-count-row-bottom">
            {COUNT_CARDS.slice(4).map((card) => (
              <CountCard
                key={card.key}
                card={card}
                count={counts[card.key]}
                total={counts.total}
                loading={loading}
              />
            ))}
          </div>
        </section>

        <section className="campaign-panel table-card" ref={campaignListRef}>
          <div className="campaign-table-header table-header">
            <div className="campaign-panel-head table-header-top">
              <div>
                <span className="campaigns-page-kicker table-eyebrow">Campaign library</span>
                <h2 className="table-title">All Campaigns</h2>
              </div>
              <div className="campaign-panel-total">
                Showing {visibleStart.toLocaleString()}-{pageEndIndex.toLocaleString()} of {filteredCampaigns.length.toLocaleString()} campaign{filteredCampaigns.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="campaign-toolbar table-controls">
              <label className="campaign-search-field search-wrapper">
                <span>Search</span>
                <i className="ti ti-search si campaign-search-icon" aria-hidden="true" />
                <input
                  className="table-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by campaign name..."
                />
              </label>
              <label className="campaign-select-field">
                <span>Status</span>
                <select className="mini-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {STATUS_TABS.map((tab) => (
                    <option key={tab.value} value={tab.value}>{tab.label === 'All' ? 'Status: All' : tab.label}</option>
                  ))}
                </select>
              </label>
              <label className="campaign-select-field">
                <span>Sort</span>
                <select className="mini-select" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
              <button
                type="button"
                className="campaign-toolbar-refresh icon-btn"
                title="Refresh"
                aria-label="Refresh campaigns"
                onClick={handleRefresh}
              >
                <i className="ti ti-refresh" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="campaign-status-tabs">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={statusFilter === tab.value ? 'active' : ''}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error ? <div className="campaign-alert campaign-alert-error">{error}</div> : null}
          {notice ? <div className="campaign-alert campaign-alert-success">{notice}</div> : null}

          {loading ? (
            <div className="campaign-table-loading">
              <div />
              <div />
              <div />
              <div />
            </div>
          ) : !filteredCampaigns.length ? (
            <div className="campaign-empty-state">
              <strong>No campaigns found.</strong>
              <p>Adjust your filters or create a new campaign.</p>
            </div>
          ) : (
            <>
              <CampaignDesktopTable
                campaigns={paginatedCampaigns}
                actionLoadingKey={actionLoadingKey}
                onAction={handleAction}
                onToggleView={openCampaignDetails}
                startIndex={pageStartIndex}
              />
              <CampaignMobileCards
                campaigns={paginatedCampaigns}
                actionLoadingKey={actionLoadingKey}
                onAction={handleAction}
                onToggleView={openCampaignDetails}
              />
              <div className="campaign-table-footer table-footer">
                <div className="tf-left">
                  <input type="checkbox" id="campaignSelectAllVisible" />
                  <label htmlFor="campaignSelectAllVisible">Select all visible rows</label>
                </div>
                <div className="pagination">
                  <button
                    type="button"
                    className="page-btn arrow"
                    aria-label="Previous page"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    <i className="ti ti-chevron-left" aria-hidden="true" />
                  </button>
                  {paginationItems.map((item) => (
                    typeof item === 'number' ? (
                      <button
                        key={item}
                        type="button"
                        className={safeCurrentPage === item ? 'page-btn active' : 'page-btn'}
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </button>
                    ) : (
                      <span key={item} className="campaign-pagination-ellipsis">...</span>
                    )
                  ))}
                  <button
                    type="button"
                    className="page-btn arrow"
                    aria-label="Next page"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    <i className="ti ti-chevron-right" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
        {selectedCampaignId ? (
          <CampaignDetailsDrawer
            campaignId={selectedCampaignId}
            onClose={() => setSelectedCampaignId('')}
            onActionCompleted={() => loadCampaigns({ silent: true })}
          />
        ) : null}
      </main>
    </AppLayout>
  );
}
