'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import PageContainer from '@/app/components/layout/PageContainer';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/Card';
import PageSection from '@/app/components/ui/PageSection';

const badgeToneMap = {
  Draft: 'default',
  Scheduled: 'warning',
  Running: 'success',
  Paused: 'warning',
  Completed: 'success',
  Failed: 'danger'
};

const CAMPAIGNS_PAGE_WORKFLOW_STEPS = [
  { index: 1, icon: '^', title: 'Upload List', label: 'Upload List', action: 'Next', chip: 'upload' },
  { index: 2, icon: '[]', title: 'Review List', label: 'Review List', action: 'Review', chip: 'review' },
  { index: 3, icon: '*', title: 'Campaign', label: 'Campaign', action: 'Next', chip: 'campaign' },
  { index: 4, icon: '[]', title: 'Select Draft', label: 'Select Draft', action: 'Drafts', chip: 'draft' },
  { index: 5, icon: '#', title: 'Draft Summary', label: 'Summary', action: 'Next', chip: 'summary' },
  { index: 6, icon: '@', title: 'Test Email', label: 'Test', action: 'Next', chip: 'test' },
  { index: 7, icon: 'T', title: 'Schedule Sending', label: 'Schedule', action: 'Schedule', chip: 'schedule' }
];

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function getCampaignWindow(campaign) {
  return (
    campaign?.scheduledStart?.label ||
    formatDateTime(campaign?.scheduledAt) ||
    formatDateTime(campaign?.createdAt)
  );
}

function getCampaignAudience(campaign) {
  return `${Number(campaign?.stats?.total || 0)} contacts`;
}

function getWorkflowStepLabel(campaign) {
  const step = Number(campaign?.workflowStep || 1);
  const savedLabel = String(campaign?.workflowStepLabel || '').trim();
  if (savedLabel) return savedLabel;
  if (step === 2) return 'Overview';
  if (step === 3) return 'Campaign';
  if (step === 4) return 'Draft';
  if (step === 5) return 'Summary';
  if (step === 6) return 'Test';
  if (step >= 7) return 'Schedule';
  return `Step ${step}`;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campaignsWorkflowCurrentStep, setCampaignsWorkflowCurrentStep] = useState(1);
  const [libraryFilter, setLibraryFilter] = useState('all');

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadCampaigns = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const response = await fetch('/api/campaigns', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch campaigns');
        }

        if (!active) return;
        setError('');
        setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to fetch campaigns');
        if (!silent) {
          setCampaigns([]);
        }
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadCampaigns({ silent: true });
      }
    };

    void loadCampaigns();
    intervalId = window.setInterval(() => {
      void loadCampaigns({ silent: true });
    }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const liveCampaigns = useMemo(
    () => campaigns.filter((item) => ['running', 'scheduled'].includes(String(item?.status || '').toLowerCase())),
    [campaigns]
  );
  const completedCampaigns = useMemo(
    () => campaigns.filter((item) => String(item?.status || '').toLowerCase() === 'completed'),
    [campaigns]
  );
  const pausedCampaigns = useMemo(
    () => campaigns.filter((item) => String(item?.status || '').toLowerCase() === 'paused'),
    [campaigns]
  );
  const draftIncompleteCampaigns = useMemo(
    () => campaigns.filter((item) => ['draft', 'failed'].includes(String(item?.status || '').toLowerCase())),
    [campaigns]
  );
  const totalCampaigns = useMemo(() => campaigns, [campaigns]);

  const campaignBuckets = useMemo(
    () => [
      {
        key: 'live',
        label: 'Live',
        description: 'Running and scheduled campaigns.',
        tone: 'live',
        items: liveCampaigns
      },
      {
        key: 'complete',
        label: 'Complete',
        description: 'Campaigns that finished successfully.',
        tone: 'complete',
        items: completedCampaigns
      },
      {
        key: 'draft-incomplete',
        label: 'Draft/Incomplete',
        description: 'Draft and failed campaigns that still need action.',
        tone: 'draft',
        items: draftIncompleteCampaigns
      },
      {
        key: 'paused',
        label: 'Paused',
        description: 'Campaigns paused by user or system.',
        tone: 'paused',
        items: pausedCampaigns
      },
      {
        key: 'total',
        label: 'Total',
        description: 'All campaigns from workflow and database.',
        tone: 'total',
        items: totalCampaigns
      }
    ],
    [liveCampaigns, completedCampaigns, draftIncompleteCampaigns, pausedCampaigns, totalCampaigns]
  );

  const libraryFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      { value: 'live', label: 'Live' },
      { value: 'complete', label: 'Complete' },
      { value: 'draft-incomplete', label: 'Draft/Incomplete' },
      { value: 'paused', label: 'Paused' }
    ],
    []
  );

  const filteredLibraryCampaigns = useMemo(() => {
    if (libraryFilter === 'live') return liveCampaigns;
    if (libraryFilter === 'complete') return completedCampaigns;
    if (libraryFilter === 'draft-incomplete') return draftIncompleteCampaigns;
    if (libraryFilter === 'paused') return pausedCampaigns;
    return campaigns;
  }, [libraryFilter, liveCampaigns, completedCampaigns, draftIncompleteCampaigns, pausedCampaigns, campaigns]);

  return (
    <AppLayout
      topbarProps={{
        title: 'Campaigns',
        subtitle: 'Track all campaign activity, status, and launch timing from one live page.',
        actions: (
          <>
            <Button variant="secondary">Open Calendar</Button>
            <Button>New Campaign</Button>
          </>
        )
      }}
    >
      <PageContainer>
        <div className="campaigns-page-shell">
          <div className="campaigns-page-hero">
            <span className="campaigns-page-kicker">Live database view</span>
            <h2>Campaign Overview</h2>
            <p>Track launch timing, delivery status, draft resumes, and campaign health from one place.</p>
          </div>
          <PageSection
            title="Overview"
            description="See all campaigns from the database with live status and delivery counts."
          >
            <div className="client-data-stats">
              {campaignBuckets.map((bucket) => (
                <Card key={bucket.key} className="client-data-stat-card">
                  <CardContent>
                    <div className={`campaigns-bucket-jump campaigns-bucket-jump-${bucket.tone}`}>
                      <span>{bucket.label}</span>
                      <strong>{loading ? '...' : String(bucket.items.length)}</strong>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </PageSection>

          <section className="premium-stepper-shell">
            <div
              className="premium-stepper-row"
              style={{
                color: 'var(--text-primary)',
                '--workflow-progress': Math.max(campaignsWorkflowCurrentStep - 1, 0)
              }}
            >
              <div className="premium-workflow-title">
                <h3>Campaign Workflow</h3>
              </div>
              {CAMPAIGNS_PAGE_WORKFLOW_STEPS.map((step) => {
                const isCurrent = campaignsWorkflowCurrentStep === step.index;
                const isCompleted = campaignsWorkflowCurrentStep > step.index;
                return (
                  <article
                    key={`campaigns-workflow-step-${step.index}`}
                    className={[
                      'premium-step-card',
                      `premium-step-tone-${step.index}`,
                      `premium-step-action-${step.index}`,
                      isCurrent ? 'is-current' : '',
                      isCompleted ? 'is-completed' : ''
                    ].join(' ').trim()}
                  >
                    <div className="premium-step-track">
                      <span className="premium-step-index">{step.index}</span>
                    </div>
                    <strong>
                      <span className="premium-step-title-icon">{step.icon}</span>
                      <span>{step.title}</span>
                    </strong>
                    <span className={`premium-step-chip premium-step-chip-${step.chip}`}>{step.label}</span>
                    <button type="button" onClick={() => setCampaignsWorkflowCurrentStep(step.index)}>
                      {step.action}
                    </button>
                  </article>
                );
              })}
              <button
                type="button"
                className="premium-stepper-start"
                onClick={() => setCampaignsWorkflowCurrentStep(1)}
                style={{
                  color: '#ffffff',
                  background: 'linear-gradient(180deg, #22c55e, #15803d)',
                  border: '1px solid #166534'
                }}
              >
                START
              </button>
            </div>
          </section>

          <PageSection
            title="Campaign Library"
            description="All campaigns in one clean place with filters and basic details."
          >
            <Card className="client-data-panel client-data-panel-large">
              <CardHeader className="client-data-panel-head">
                <div>
                  <span className="campaigns-page-section-kicker campaigns-page-section-kicker-total">Campaign Files</span>
                  <CardTitle>Combined Campaign List</CardTitle>
                  <CardDescription>Includes workflow-created campaigns with status, owner, audience, and step info.</CardDescription>
                </div>
                <div className="campaign-library-filters">
                  {libraryFilterOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`campaign-library-filter ${libraryFilter === option.value ? 'active' : ''}`}
                      onClick={() => setLibraryFilter(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="campaign-library-list">
                  {!loading && !error && !filteredLibraryCampaigns.length ? (
                    <article className="campaign-library-item campaign-library-empty">
                      <div className="campaign-library-file-icon">F</div>
                      <div className="campaign-library-main">
                        <strong>No campaigns found for this filter.</strong>
                        <p>Try switching filter to see more campaign records.</p>
                      </div>
                    </article>
                  ) : null}

                  {!loading && !error
                    ? filteredLibraryCampaigns.map((campaign) => (
                        <article key={`library-${campaign._id || campaign.id}`} className="campaign-library-item">
                          <div className="campaign-library-file-icon">F</div>
                          <div className="campaign-library-main">
                            <div className="campaign-library-title-row">
                              <strong>{campaign?.name || '-'}</strong>
                              <div className="campaign-library-tags">
                                <Badge variant={badgeToneMap[campaign?.status] || 'default'}>
                                  {campaign?.status || 'Draft'}
                                </Badge>
                                <Badge variant="warning">{getWorkflowStepLabel(campaign)}</Badge>
                              </div>
                            </div>
                            <p>
                              Audience: {getCampaignAudience(campaign)} | Owner: {campaign?.senderFrom || campaign?.senderAccount?.from || '-'}
                            </p>
                            <small>
                              Window: {getCampaignWindow(campaign)} | Updated: {formatDateTime(campaign?.updatedAt || campaign?.createdAt)}
                            </small>
                          </div>
                        </article>
                      ))
                    : null}
                </div>
              </CardContent>
            </Card>
          </PageSection>

        </div>
      </PageContainer>
    </AppLayout>
  );
}

