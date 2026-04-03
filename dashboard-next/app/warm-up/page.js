'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import PageContainer from '@/app/components/layout/PageContainer';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/Card';
import PageSection from '@/app/components/ui/PageSection';

const badgeToneMap = {
  Connected: 'success',
  'Not configured': 'warning'
};

function getWarmupStatus(account) {
  return account?.status || 'Connected';
}

function getWarmupTrend(account) {
  if (String(account?.status || '').toLowerCase() === 'connected') return 'Ready';
  return 'Needs Setup';
}

export default function WarmUpPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadAccounts = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const response = await fetch('/api/accounts', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch warm-up accounts');
        }

        if (!active) return;
        setError('');
        setAccounts(Array.isArray(data?.accounts) ? data.accounts : []);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to fetch warm-up accounts');
        if (!silent) {
          setAccounts([]);
        }
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadAccounts({ silent: true });
      }
    };

    void loadAccounts();
    intervalId = window.setInterval(() => {
      void loadAccounts({ silent: true });
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

  const connectedCount = useMemo(
    () => accounts.filter((item) => String(getWarmupStatus(item)).toLowerCase() === 'connected').length,
    [accounts]
  );

  const notConfiguredCount = useMemo(
    () => accounts.filter((item) => String(getWarmupStatus(item)).toLowerCase() !== 'connected').length,
    [accounts]
  );

  const healthItems = useMemo(
    () => [
      { title: 'Ready for Warmup', meta: `${connectedCount} accounts are connected and available` },
      { title: 'Needs Attention', meta: `${notConfiguredCount} accounts still need configuration` },
      { title: 'Available Providers', meta: `${new Set(accounts.map((item) => item.provider).filter(Boolean)).size} providers available` }
    ],
    [accounts, connectedCount, notConfiguredCount]
  );

  const activityItems = useMemo(
    () =>
      accounts.slice(0, 3).map((item) => ({
        title: item?.from || item?.label || 'Sender account',
        meta: `${item?.provider || 'provider'} | ${getWarmupStatus(item)}`
      })),
    [accounts]
  );

  return (
    <AppLayout
      topbarProps={{
        title: 'Warm-Up',
        subtitle: 'Track all warm-up related sender accounts from one live page.',
        actions: (
          <>
            <Button variant="secondary">Adjust Limits</Button>
            <Button>Start Warmup</Button>
          </>
        )
      }}
    >
      <PageContainer>
        <PageSection
          title="Overview"
          description="All connected sender accounts used for warm-up are shown here with live status."
        >
          <div className="client-data-stats">
            {[
              { label: 'Warmup Accounts', value: loading ? '...' : String(accounts.length) },
              { label: 'Connected', value: loading ? '...' : String(connectedCount) },
              { label: 'Needs Setup', value: loading ? '...' : String(notConfiguredCount) },
              { label: 'Providers', value: loading ? '...' : String(new Set(accounts.map((item) => item.provider).filter(Boolean)).size) }
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
          title="Warmup Workspace"
          description="All sender accounts related to warm-up are shown here and update automatically."
        >
          <div className="client-data-grid">
            <Card className="client-data-panel client-data-panel-large">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Warmup Overview</CardTitle>
                  <CardDescription>All live sender accounts currently available for warm-up.</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  {loading ? '...' : `${accounts.length} accounts`}
                </Button>
              </CardHeader>

              <CardContent>
                <div className="client-data-table client-data-table-scroll">
                  <div className="client-data-table-head" style={{ gridTemplateColumns: '1.2fr .9fr .8fr 1fr .8fr' }}>
                    <span>Mailbox</span>
                    <span>Provider</span>
                    <span>Status</span>
                    <span>Label</span>
                    <span>Trend</span>
                  </div>

                  {loading ? (
                    <div className="client-data-table-row" style={{ gridTemplateColumns: '1.2fr .9fr .8fr 1fr .8fr' }}>
                      <span>Loading warm-up accounts...</span>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && error ? (
                    <div className="client-data-table-row" style={{ gridTemplateColumns: '1.2fr .9fr .8fr 1fr .8fr' }}>
                      <span>{error}</span>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !error && !accounts.length ? (
                    <div className="client-data-table-row" style={{ gridTemplateColumns: '1.2fr .9fr .8fr 1fr .8fr' }}>
                      <span>No warm-up accounts found.</span>
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !error ? accounts.map((account) => (
                    <div
                      key={account.id || account.from}
                      className="client-data-table-row"
                      style={{ gridTemplateColumns: '1.2fr .9fr .8fr 1fr .8fr' }}
                    >
                      <span>{account?.from || '-'}</span>
                      <span>{account?.provider || '-'}</span>
                      <span>
                        <Badge variant={badgeToneMap[getWarmupStatus(account)] || 'default'}>
                          {getWarmupStatus(account)}
                        </Badge>
                      </span>
                      <span>{account?.label || '-'}</span>
                      <span>{getWarmupTrend(account)}</span>
                    </div>
                  )) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="client-data-panel">
              <CardHeader className="client-data-panel-head">
                <div>
                  <CardTitle>Warmup Segments</CardTitle>
                  <CardDescription>Live status summary across warm-up accounts.</CardDescription>
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
                  <CardTitle>Warmup Activity</CardTitle>
                  <CardDescription>Latest account availability from the database and runtime configuration.</CardDescription>
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
                      <strong>No recent warm-up activity</strong>
                      <p>Warm-up accounts will appear here automatically.</p>
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
