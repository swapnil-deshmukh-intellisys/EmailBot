'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import PageContainer from '@/app/components/layout/PageContainer';
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
  { key: 'total', label: 'Total Campaigns', shortLabel: 'Total', icon: 'T', description: 'All campaigns created by this user.', tone: 'total' },
  { key: 'running', label: 'Running Campaigns', shortLabel: 'Running', icon: 'R', description: 'Actively sending or worker-owned.', tone: 'running' },
  { key: 'paused', label: 'Paused Campaigns', shortLabel: 'Paused', icon: 'P', description: 'Temporarily held campaigns.', tone: 'paused' },
  { key: 'failed', label: 'Failed Campaigns', shortLabel: 'Failed', icon: '!', description: 'Campaigns that ended with errors.', tone: 'failed' },
  { key: 'incomplete', label: 'Incomplete / Draft', shortLabel: 'Incomplete', icon: 'D', description: 'Drafts or campaigns missing launch data.', tone: 'incomplete' },
  { key: 'completed', label: 'Completed Campaigns', shortLabel: 'Completed', icon: 'C', description: 'Finished campaigns.', tone: 'completed' },
  { key: 'scheduled', label: 'Scheduled Campaigns', shortLabel: 'Scheduled', icon: 'S', description: 'Scheduled or queued for launch.', tone: 'scheduled' }
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
  stop: 'Stop'
};

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
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
  const total = Number(campaign?.stats?.total || 0);
  const sent = Number(campaign?.stats?.sent || 0);
  const failed = Number(campaign?.stats?.failed || 0);
  const pendingFromStats = campaign?.stats?.pending;
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
  if (action === 'start') return bucket === 'running' || bucket === 'completed' || status === 'paused';
  if (action === 'pause') return bucket !== 'running' && bucket !== 'scheduled';
  if (action === 'resume') return bucket !== 'paused';
  if (action === 'stop') return bucket === 'completed' || bucket === 'failed' || normalizeText(campaign?.status) === 'stopped';
  return false;
}

function getActionLabel(action, campaign = {}) {
  if (action === 'start' && campaign?.safeActions?.actionLabel === 'Retry/Fix Issue') return 'Retry/Fix Issue';
  if (action === 'start' && normalizeCampaignStatusBucket(campaign) === 'failed') return 'Retry/Fix Issue';
  return ACTION_LABELS[action] || action;
}

function getApiMessage(data, fallback) {
  return data?.message || data?.error || data?.code || fallback;
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

function CountCard({ card, count, loading }) {
  return (
    <article className={`campaign-count-card campaign-count-card-${card.tone}`}>
      <div className="campaign-count-card-glow" />
      <div className="campaign-count-card-head">
        <span className="campaign-count-icon" aria-hidden="true">{card.icon}</span>
        <span className="campaign-count-label">{card.shortLabel}</span>
      </div>
      {loading ? <div className="campaign-count-skeleton" /> : <strong>{Number(count || 0).toLocaleString()}</strong>}
      <p>{card.description}</p>
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
      variant={action === 'stop' ? 'danger' : action === 'start' ? 'primary' : 'secondary'}
      loading={loading}
      disabled={disabled}
      onClick={() => onAction(campaign, action)}
    >
      {getActionLabel(action, campaign)}
    </Button>
  );
}

function CampaignDesktopTable({ campaigns, actionLoadingKey, onAction, onToggleView }) {
  return (
    <div className="campaign-table-wrap">
      <table className="campaign-table">
        <thead>
          <tr>
            <th>Campaign Name</th>
            <th>Project</th>
            <th>Status</th>
            <th>Recipients</th>
            <th>Sent</th>
            <th>Pending</th>
            <th>Failed</th>
            <th>Open Count</th>
            <th>Response Count</th>
            <th>Failure Reason</th>
            <th>Last Activity</th>
            <th>Created</th>
            <th>Scheduled</th>
            <th>Sender</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const stats = getStats(campaign);
            const bucket = normalizeCampaignStatusBucket(campaign);

            return (
              <tr key={campaign._id}>
                <td>
                  <div className="campaign-name-cell">
                    <button
                      type="button"
                      className="campaign-name-link"
                      onClick={() => onToggleView(campaign._id)}
                    >
                      {campaign.name || 'Untitled campaign'}
                    </button>
                    <small>{campaign.type || campaign.draftType || '-'}</small>
                  </div>
                </td>
                <td>{getProjectLabel(campaign)}</td>
                <td>
                  <Badge variant={STATUS_BADGE_VARIANTS[bucket] || 'default'} dot>
                    {getDisplayStatus(campaign)}
                  </Badge>
                </td>
                <td>{stats.total.toLocaleString()}</td>
                <td>{stats.sent.toLocaleString()}</td>
                <td>{stats.pending.toLocaleString()}</td>
                <td>{stats.failed.toLocaleString()}</td>
                <td>{stats.opens.toLocaleString()}</td>
                <td>{stats.replies.toLocaleString()} Replies</td>
                <td>{getFailureReason(campaign)}</td>
                <td>{formatDateTime(getLastActivity(campaign))}</td>
                <td>{formatDateTime(campaign.createdAt)}</td>
                <td>{formatDateTime(getScheduledDate(campaign))}</td>
                <td className="campaign-sender-cell">{getSenderEmail(campaign)}</td>
                <td>
                  <div className="campaign-action-row">
                    <Button size="sm" variant="secondary" onClick={() => onToggleView(campaign._id)}>
                      View
                    </Button>
                    <ActionButton action="start" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
                    <ActionButton action="pause" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
                    <ActionButton action="resume" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
                    <ActionButton action="stop" campaign={campaign} loadingKey={actionLoadingKey} onAction={onAction} />
                  </div>
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
              <Badge variant={STATUS_BADGE_VARIANTS[bucket] || 'default'} dot>
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
    <div className="dashboard-subscription-modal-backdrop" onClick={onClose}>
      <section className="dashboard-subscription-modal campaign-detail-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dashboard-subscription-modal-head">
          <div>
            <span>Campaign Details</span>
            <h2>{campaign.name || 'Campaign'}</h2>
            <p>{getProjectLabel(campaign)} | {getSenderEmail(campaign)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close campaign details">x</button>
        </div>

        {loading ? <p>Loading campaign details...</p> : null}
        {error ? <div className="campaign-alert campaign-alert-error">{error}</div> : null}
        {notice ? <div className="campaign-alert campaign-alert-success">{notice}</div> : null}

        {!loading ? (
          <>
            <div className="dashboard-subscription-modal-grid">
              <article><span>Status</span><strong>{getDisplayStatus(campaign)}</strong></article>
              <article><span>Total recipients</span><strong>{Number(campaign.stats?.total || campaign.totalRecipients || recipients.length || 0).toLocaleString()}</strong></article>
              <article><span>Sent</span><strong>{Number(campaign.stats?.sent || campaign.sentCount || 0).toLocaleString()}</strong></article>
              <article><span>Pending</span><strong>{Number(campaign.stats?.pending || campaign.pendingCount || 0).toLocaleString()}</strong></article>
              <article><span>Failed</span><strong>{Number(campaign.stats?.failed || campaign.failedCount || 0).toLocaleString()}</strong></article>
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

            <div className="dashboard-subscription-modal-actions">
              <Button variant="secondary" size="sm" loading={refreshing} onClick={() => loadDetail({ silent: true })}>Refresh</Button>
              <Button variant="secondary" size="sm" onClick={syncReplies}>Sync Replies</Button>
              <Button as="a" href={`/api/campaigns/${campaignId}/export?format=csv`} variant="secondary" size="sm">Export CSV</Button>
              <Button as="a" href={`/api/campaigns/${campaignId}/export?format=xlsx`} variant="secondary" size="sm">Export Excel</Button>
              <Button variant="secondary" size="sm" onClick={copyTable}>Copy Table</Button>
              <span>Last updated at {formatDateTime(detail?.lastUpdatedAt || new Date())}</span>
            </div>

            <div className="dashboard-subscription-transactions">
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

            <div className="campaign-table-wrap">
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
          </>
        ) : null}
      </section>
    </div>
  );
}

export default function CampaignsPage() {
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
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [actionLoadingKey, setActionLoadingKey] = useState('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadCampaigns = useCallback(async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true);
      if (!silent) setLoading(true);

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
    }, 8000);

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
  }, [loadCampaigns]);

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

  const handleRefresh = useCallback(() => {
    setNotice('');
    void loadCampaigns({ silent: true });
  }, [loadCampaigns]);

  const handleAction = useCallback(async (campaign, action) => {
    const campaignId = String(campaign?._id || '');
    if (!campaignId) return;

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
        items.map((item) => (item._id === campaignId ? { ...item, status: nextStatus, displayStatus: nextStatus } : item))
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

  if (!isMounted) {
    return (
      <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
        <PageContainer>
          <main className="campaigns-page-shell campaigns-modern-page">
            <section className="campaigns-modern-hero">
              <div>
                <span className="campaigns-page-kicker">Live campaign operations</span>
                <h1>Campaigns</h1>
                <p>Manage, monitor, pause, resume and track all email campaigns.</p>
              </div>
            </section>
            <div className="campaign-table-loading">
              <div />
              <div />
              <div />
              <div />
            </div>
          </main>
        </PageContainer>
      </AppLayout>
    );
  }

  return (
    <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
      <PageContainer>
        <main className="campaigns-page-shell campaigns-modern-page">
          <section className="campaigns-modern-hero">
            <div>
              <span className="campaigns-page-kicker">Live campaign operations</span>
              <h1>Campaigns</h1>
              <p>Manage, monitor, pause, resume and track all email campaigns.</p>
            </div>
            <div className="campaigns-hero-actions">
              <Button as="a" href="/dashboard?workflowStep=1" size="md">
                Create Campaign
              </Button>
              <Button variant="secondary" size="md" loading={refreshing} onClick={handleRefresh}>
                Refresh
              </Button>
            </div>
          </section>

          <section className="campaign-count-grid" aria-label="Campaign counts">
            {COUNT_CARDS.map((card) => (
              <CountCard
                key={card.key}
                card={card}
                count={counts[card.key]}
                loading={loading}
              />
            ))}
          </section>

          <section className="campaign-panel">
            <div className="campaign-panel-head">
              <div>
                <span className="campaigns-page-kicker">Campaign library</span>
                <h2>All Campaigns</h2>
                <p>Live database records for the current logged-in user.</p>
              </div>
              <div className="campaign-panel-total">
                Showing {filteredCampaigns.length.toLocaleString()} campaign{filteredCampaigns.length === 1 ? '' : 's'}
              </div>
            </div>

            <div className="campaign-toolbar">
              <label className="campaign-search-field">
                <span>Search</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by campaign name"
                />
              </label>
              <label className="campaign-select-field">
                <span>Status</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  {STATUS_TABS.map((tab) => (
                    <option key={tab.value} value={tab.value}>{tab.label}</option>
                  ))}
                </select>
              </label>
              <label className="campaign-select-field">
                <span>Sort</span>
                <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
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
                  campaigns={filteredCampaigns}
                  actionLoadingKey={actionLoadingKey}
                  onAction={handleAction}
                  onToggleView={openCampaignDetails}
                />
                <CampaignMobileCards
                  campaigns={filteredCampaigns}
                  actionLoadingKey={actionLoadingKey}
                  onAction={handleAction}
                  onToggleView={openCampaignDetails}
                />
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
      </PageContainer>
    </AppLayout>
  );
}
