'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';

const DELIVERY_CARDS = [
  ['total', 'Total', 'All recipients', 'ti-mail'],
  ['sent', 'Sent', 'Delivered to provider', 'ti-send'],
  ['pending', 'Pending', 'Waiting in queue', 'ti-clock'],
  ['failed', 'Failed', 'Delivery errors', 'ti-alert-triangle'],
  ['bounced', 'Bounced', 'Returned messages', 'ti-arrow-back-up'],
  ['spam', 'Spam', 'Blocked by policy', 'ti-shield-x']
];

function pct(value, total) {
  const denominator = Number(total || 0);
  if (!denominator) return '0%';
  return `${Math.round((Number(value || 0) / denominator) * 100)}%`;
}

function AlertBadge({ severity }) {
  return <span className={`alert-severity alert-${String(severity || 'info').toLowerCase()}`}>{severity}</span>;
}

export default function ReportPage() {
  const [overview, setOverview] = useState(null);
  const [projectWise, setProjectWise] = useState(null);
  const [senderHealth, setSenderHealth] = useState(null);
  const [warmup, setWarmup] = useState(null);
  const [credits, setCredits] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [overviewRes, projectRes, senderRes, warmupRes, creditRes, alertsRes] = await Promise.all([
        fetch('/api/reports/overview', { cache: 'no-store' }),
        fetch('/api/reports/project-wise', { cache: 'no-store' }),
        fetch('/api/reports/sender-health', { cache: 'no-store' }),
        fetch('/api/reports/warmup', { cache: 'no-store' }),
        fetch('/api/reports/credits', { cache: 'no-store' }),
        fetch('/api/alerts', { cache: 'no-store' })
      ]);
      const [overviewData, projectData, senderData, warmupData, creditData, alertsData] = await Promise.all([
        overviewRes.json(), projectRes.json(), senderRes.json(), warmupRes.json(), creditRes.json(), alertsRes.json()
      ]);
      setOverview(overviewData);
      setProjectWise(projectData);
      setSenderHealth(senderData);
      setWarmup(warmupData);
      setCredits(creditData);
      setAlerts(Array.isArray(alertsData.alerts) ? alertsData.alerts : []);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const delivery = overview?.delivery || {};
  const campaigns = overview?.campaignCounts || {};
  const clientCounts = overview?.clientCounts || {};
  const projects = projectWise?.projects || {};
  const deliveryRate = Number(delivery.total || 0)
    ? Math.round((Number(delivery.sent || 0) / Number(delivery.total || 1)) * 100)
    : 0;
  const issueCount = Number(delivery.failed || 0) + Number(delivery.bounced || 0) + Number(delivery.spam || 0);
  const senderHealthRate = Number(senderHealth?.total || 0)
    ? Math.round((Number(senderHealth?.active || 0) / Number(senderHealth?.total || 1)) * 100)
    : 0;
  const creditUsageRate = Number(credits?.totalCredits || 0)
    ? Math.round((Number(credits?.usedCredits || 0) / Number(credits?.totalCredits || 1)) * 100)
    : 0;
  const senderProviderText = useMemo(() => {
    const counts = senderHealth?.providerCounts || {};
    return `Graph ${counts.graph || 0} / SMTP ${counts.smtp || 0}`;
  }, [senderHealth]);

  return (
    <AppLayout>
      <section className="user-dashboard-page report-dashboard-page">
        <header className="report-page-header">
          <div className="report-page-title">
            <span className="user-dashboard-kicker">Reports</span>
            <h1>Campaign performance</h1>
            <p>Delivery, sender health, project activity, warmup, and credit usage in one operational view.</p>
          </div>
          <div className="report-page-actions">
            <span className="report-sync-status">
              <i className={`ti ${loading ? 'ti-loader-2 report-spin' : 'ti-cloud-check'}`} aria-hidden="true" />
              {loading ? 'Syncing data' : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live data'}
            </span>
            <Button variant="secondary" onClick={loadAll} disabled={loading}>
              <i className="ti ti-refresh" aria-hidden="true" />
              {loading ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>
        </header>

        {error ? <div className="dashboard-error-state">{error}</div> : null}

        <section className="report-health-strip">
          <article>
            <i className="ti ti-chart-bar" aria-hidden="true" />
            <div><span>Delivery rate</span><strong>{deliveryRate}%</strong></div>
            <small>{Number(delivery.sent || 0).toLocaleString()} sent</small>
          </article>
          <article>
            <i className="ti ti-activity-heartbeat" aria-hidden="true" />
            <div><span>Sender health</span><strong>{senderHealthRate}%</strong></div>
            <small>{senderHealth?.active || 0} active IDs</small>
          </article>
          <article>
            <i className="ti ti-alert-circle" aria-hidden="true" />
            <div><span>Delivery issues</span><strong>{issueCount.toLocaleString()}</strong></div>
            <small>Failed, bounced, or spam</small>
          </article>
          <article>
            <i className="ti ti-coins" aria-hidden="true" />
            <div><span>Credit usage</span><strong>{creditUsageRate}%</strong></div>
            <small>{Number(credits?.remainingCredits || 0).toLocaleString()} remaining</small>
          </article>
        </section>

        <div className="report-section-heading">
          <div><span>Delivery overview</span><small>Current recipient status across campaigns</small></div>
          <span className="report-section-total">{Number(delivery.total || 0).toLocaleString()} recipients</span>
        </div>

        <div className="report-count-grid report-overview-grid">
          {DELIVERY_CARDS.map(([key, label, caption, icon]) => (
            <article key={key} className={`report-count-card report-overview-card report-overview-card-${key}`}>
              <div><span>{label}</span><em><i className={`ti ${icon}`} aria-hidden="true" /></em></div>
              <strong>{loading ? '...' : Number(delivery[key] || 0).toLocaleString()}</strong>
              <small>{caption}<b>{pct(delivery[key], delivery.total)}</b></small>
              <div className="report-progress"><span style={{ width: pct(delivery[key], delivery.total) }} /></div>
            </article>
          ))}
        </div>

        <div className="report-main-grid">
          <section className="report-panel report-campaign-panel">
            <div className="report-panel-head">
              <div><i className="ti ti-speakerphone" aria-hidden="true" /><span><h2>Campaign activity</h2><small>Status across all campaigns</small></span></div>
              <strong>{campaigns.total || 0} total</strong>
            </div>
            <div className="report-mini-grid">
              {['total', 'running', 'completed', 'failed', 'paused', 'stopped'].map((key) => (
                <article key={key} className={`report-mini-${key}`}><span>{key.replace(/^\w/, (c) => c.toUpperCase())}</span><strong>{campaigns[key] || 0}</strong></article>
              ))}
            </div>
          </section>

          <section className="report-panel report-project-panel">
            <div className="report-panel-head">
              <div><i className="ti ti-folders" aria-hidden="true" /><span><h2>Project comparison</h2><small>Campaign and recipient volume</small></span></div>
            </div>
            <div className="report-project-list">
            {['tec', 'tut'].map((key) => (
              <div key={key} className="report-project-row">
                <span className="report-project-mark">{key.toUpperCase()}</span>
                <div><span>Campaigns</span><strong>{projects[key]?.campaigns || 0}</strong></div>
                <div><span>Clients</span><strong>{projects[key]?.clients || 0}</strong></div>
                <div><span>Sent</span><strong>{projects[key]?.sent || 0}</strong></div>
              </div>
            ))}
            </div>
          </section>

          <section className="report-panel">
            <div className="report-panel-head">
              <div><i className="ti ti-users" aria-hidden="true" /><span><h2>Client coverage</h2><small>Contacts available by project</small></span></div>
            </div>
            <div className="report-mini-grid">
              <article><span>TEC clients</span><strong>{clientCounts.tec || 0}</strong></article>
              <article><span>TUT clients</span><strong>{clientCounts.tut || 0}</strong></article>
              <article><span>Total clients</span><strong>{clientCounts.total || 0}</strong></article>
            </div>
          </section>

          <section className="report-panel">
            <div className="report-panel-head">
              <div><i className="ti ti-heart-rate-monitor" aria-hidden="true" /><span><h2>Sender health</h2><small>{senderProviderText}</small></span></div>
              <span className={`report-health-badge ${senderHealthRate >= 80 ? 'healthy' : 'attention'}`}>{senderHealthRate}% healthy</span>
            </div>
            <div className="report-mini-grid">
              <article><span>Total senders</span><strong>{senderHealth?.total || 0}</strong></article>
              <article><span>Active</span><strong>{senderHealth?.active || 0}</strong></article>
              <article><span>Failed</span><strong>{senderHealth?.failed || 0}</strong></article>
            </div>
          </section>

          <section className="report-panel">
            <div className="report-panel-head">
              <div><i className="ti ti-flame" aria-hidden="true" /><span><h2>Warmup performance</h2><small>Mailbox reputation activity</small></span></div>
              <span className="report-health-badge healthy">{warmup?.health || 'No status'}</span>
            </div>
            <div className="report-mini-grid">
              <article><span>Active accounts</span><strong>{warmup?.activeAccounts || 0}</strong></article>
              <article><span>Sent</span><strong>{warmup?.sent || 0}</strong></article>
              <article><span>Received</span><strong>{warmup?.received || 0}</strong></article>
              <article><span>Failed</span><strong>{warmup?.failed || 0}</strong></article>
            </div>
          </section>

          <section className="report-panel report-credit-panel">
            <div className="report-panel-head">
              <div><i className="ti ti-coins" aria-hidden="true" /><span><h2>Credit usage</h2><small>Current allocation and consumption</small></span></div>
              <strong>{creditUsageRate}% used</strong>
            </div>
            <div className="report-credit-meter"><span style={{ width: `${Math.min(100, creditUsageRate)}%` }} /></div>
            <div className="report-mini-grid">
              <article><span>Total</span><strong>{credits?.totalCredits || 0}</strong></article>
              <article><span>Used</span><strong>{credits?.usedCredits || 0}</strong></article>
              <article><span>Remaining</span><strong>{credits?.remainingCredits || 0}</strong></article>
              <article><span>Used today</span><strong>{credits?.usedToday || 0}</strong></article>
              <article><span>TEC used</span><strong>{credits?.projectWise?.tec || 0}</strong></article>
              <article><span>TUT used</span><strong>{credits?.projectWise?.tut || 0}</strong></article>
            </div>
          </section>
        </div>

        <section className="report-panel report-alert-panel">
          <div className="report-panel-head">
            <div><i className="ti ti-bell" aria-hidden="true" /><span><h2>Alerts</h2><small>Items that may need attention</small></span></div>
            <span className="report-alert-count">{alerts.length}</span>
          </div>
          <div className="alert-list">
            {alerts.length ? alerts.map((alert, index) => (
              <article key={`${alert.title}-${index}`}>
                <AlertBadge severity={alert.severity} />
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.message}</p>
                </div>
              </article>
            )) : (
              <div className="report-empty-alerts">
                <i className="ti ti-circle-check" aria-hidden="true" />
                <div><strong>No active alerts</strong><p>Your reporting signals look clear right now.</p></div>
              </div>
            )}
          </div>
        </section>
      </section>
    </AppLayout>
  );
}
