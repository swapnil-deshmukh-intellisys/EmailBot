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

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const activeCount = useMemo(
    () => campaigns.filter((item) => ['Running', 'Scheduled'].includes(String(item?.status || ''))).length,
    [campaigns]
  );
  const pausedCount = useMemo(
    () => campaigns.filter((item) => String(item?.status || '') === 'Paused').length,
    [campaigns]
  );
  const sentToday = useMemo(
    () => campaigns.reduce((sum, item) => sum + Number(item?.stats?.sent || 0), 0),
    [campaigns]
  );

  const healthItems = useMemo(
    () => [
      { title: 'On Track', meta: `${campaigns.filter((item) => String(item?.status || '') === 'Running').length} campaigns are running now` },
      { title: 'Needs Review', meta: `${campaigns.filter((item) => ['Paused', 'Failed'].includes(String(item?.status || ''))).length} campaigns need attention` },
      { title: 'Queued Next', meta: `${campaigns.filter((item) => String(item?.status || '') === 'Scheduled').length} campaigns are waiting for launch` }
    ],
    [campaigns]
  );

  const activityItems = useMemo(
    () =>
      campaigns.slice(0, 3).map((item) => ({
        title: item?.name || 'Campaign',
        meta: `${item?.status || 'Draft'} | ${formatDateTime(item?.updatedAt || item?.createdAt)}`
      })),
    [campaigns]
  );

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
        <PageSection
          title="Overview"
          description="See all campaigns from the database with live status and delivery counts."
        >
          <div className="client-data-stats">
            {[
              { label: 'All Campaigns', value: loading ? '...' : String(campaigns.length) },
              { label: 'Active Campaigns', value: loading ? '...' : String(activeCount) },
              { label: 'Paused', value: loading ? '...' : String(pausedCount) },
              { label: 'Sent Total', value: loading ? '...' : String(sentToday) }
            ].map((card) => (
              <Card key={card.label} className="client-data-stat-card">
                <CardContent>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </CardContent>
              </Card>
            ))}
          </div>
        </PageSection>

        <PageSection
          title="Campaign Workspace"
          description="All campaigns saved in the database are shown here and refresh automatically."
        >
          <div className="client-data-grid">
            <Card className="client-data-panel client-data-panel-large">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Campaign Queue</CardTitle>
                  <CardDescription>All live campaign records from your database.</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  {loading ? '...' : `${campaigns.length} campaigns`}
                </Button>
              </CardHeader>

              <CardContent>
                <div className="client-data-table client-data-table-scroll">
                  <div className="client-data-table-head" style={{ gridTemplateColumns: '1.2fr 1fr .8fr 1fr 1fr' }}>
                    <span>Campaign</span>
                    <span>Audience</span>
                    <span>Status</span>
                    <span>Window</span>
                    <span>Owner</span>
                  </div>

                  {loading ? (
                    <div className="client-data-table-row" style={{ gridTemplateColumns: '1.2fr 1fr .8fr 1fr 1fr' }}>
                      <span>Loading campaigns...</span>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && error ? (
                    <div className="client-data-table-row" style={{ gridTemplateColumns: '1.2fr 1fr .8fr 1fr 1fr' }}>
                      <span>{error}</span>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !error && !campaigns.length ? (
                    <div className="client-data-table-row" style={{ gridTemplateColumns: '1.2fr 1fr .8fr 1fr 1fr' }}>
                      <span>No campaigns found.</span>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !error ? campaigns.map((campaign) => (
                    <div
                      key={campaign._id || campaign.id}
                      className="client-data-table-row"
                      style={{ gridTemplateColumns: '1.2fr 1fr .8fr 1fr 1fr' }}
                    >
                      <span>{campaign?.name || '-'}</span>
                      <span>{getCampaignAudience(campaign)}</span>
                      <span>
                        <Badge variant={badgeToneMap[campaign?.status] || 'default'}>
                          {campaign?.status || 'Draft'}
                        </Badge>
                      </span>
                      <span>{getCampaignWindow(campaign)}</span>
                      <span>{campaign?.senderFrom || campaign?.senderAccount?.from || '-'}</span>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="client-data-panel">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Campaign Health</CardTitle>
                  <CardDescription>Live status summary from the current campaign list.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="client-data-health-list">
                  {healthItems.map((item) => (
                    <div key={item.title}>
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="client-data-panel">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest campaign updates from the database.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="client-data-activity-list">
                  {activityItems.length ? activityItems.map((item) => (
                    <article key={`${item.title}-${item.meta}`}>
                      <strong>{item.title}</strong>
                      <p>{item.meta}</p>
                    </article>
                  )) : (
                    <article>
                      <strong>No recent activity</strong>
                      <p>Campaign updates will appear here automatically.</p>
                    </article>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </PageSection>
      </PageContainer>
    </AppLayout>
  );
}
