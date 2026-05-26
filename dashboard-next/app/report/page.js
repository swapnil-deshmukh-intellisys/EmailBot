'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';

const DELIVERY_CARDS = [
  ['total', 'Total', 'Backend count', '#'],
  ['sent', 'Sent', 'Live status', 'OK'],
  ['pending', 'Pending', 'Waiting to send', '..'],
  ['failed', 'Failed', 'Delivery error', '!'],
  ['bounced', 'Bounced', 'Delivery bounce', 'R'],
  ['spam', 'Spam', 'Blocked/policy', 'X']
];

function pct(value, total) {
  const denominator = Number(total || 0);
  if (!denominator) return '0%';
  return `${Math.round((Number(value || 0) / denominator) * 100)}%`;
}

function AlertBadge({ severity }) {
  return <span className={`alert-severity alert-${String(severity || 'info').toLowerCase()}`}>{severity}</span>;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function SummaryMetric({ label, value, tone = '' }) {
  return (
    <article className={`report-summary-metric ${tone ? `tone-${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </article>
  );
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
  const senderProviderText = useMemo(() => {
    const counts = senderHealth?.providerCounts || {};
    return `Graph ${counts.graph || 0} / SMTP ${counts.smtp || 0}`;
  }, [senderHealth]);
  const warmupHealth = warmup?.health || '-';

  return (
    <AppLayout>
      <section className="user-dashboard-page report-dashboard-page">
        <div className="user-dashboard-hero">
          <div>
            <span className="user-dashboard-kicker">Reports</span>
            <h1>Live campaign performance report</h1>
            <p>Campaign counts, project performance, sender health, warmup, credits, and alerts in one fast dashboard.</p>
          </div>
          <div className="user-dashboard-actions">
            <Button variant="secondary" onClick={loadAll} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
          </div>
        </div>

        {error ? <div className="dashboard-error-state">{error}</div> : null}

        <div className="report-count-grid report-overview-grid">
          {DELIVERY_CARDS.map(([key, label, caption, icon]) => (
            <article key={key} className={`report-count-card report-overview-card report-overview-card-${key}`}>
              <div><span>{label}</span><em>{icon}</em></div>
              <strong>{loading ? '...' : Number(delivery[key] || 0).toLocaleString()}</strong>
              <small>{caption} - {pct(delivery[key], delivery.total)}</small>
              <div className="report-progress"><span style={{ width: pct(delivery[key], delivery.total) }} /></div>
            </article>
          ))}
        </div>

        <section className="report-panel report-alert-panel">
          <h2>Alerts</h2>
          <div className="alert-list">
            {alerts.map((alert, index) => (
              <article key={`${alert.title}-${index}`}>
                <AlertBadge severity={alert.severity} />
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.message}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="report-operations-section" aria-label="Report operations summary">
          <div className="report-section-title">
            <span>Operations Summary</span>
            <h2>Counts, clients, sender health, warmup, and credits</h2>
          </div>

          <div className="report-summary-strip">
            <article className="report-summary-card tone-campaigns">
              <div className="report-summary-card-head">
                <span>Campaign Counts</span>
                <strong>{formatNumber(campaigns.total)}</strong>
              </div>
              <div className="report-summary-metrics">
                <SummaryMetric label="Running" value={campaigns.running} tone="live" />
                <SummaryMetric label="Completed" value={campaigns.completed} tone="success" />
                <SummaryMetric label="Failed" value={campaigns.failed} tone="danger" />
                <SummaryMetric label="Paused" value={campaigns.paused} />
                <SummaryMetric label="Stopped" value={campaigns.stopped} />
              </div>
            </article>

            <article className="report-summary-card tone-projects">
              <div className="report-summary-card-head">
                <span>Project Wise</span>
                <strong>{formatNumber((projects.tec?.campaigns || 0) + (projects.tut?.campaigns || 0))}</strong>
              </div>
              <div className="report-project-stack">
                {['tec', 'tut'].map((key) => (
                  <div key={key} className="report-project-pill">
                    <strong>{key.toUpperCase()}</strong>
                    <span>{formatNumber(projects[key]?.campaigns)} campaigns</span>
                    <span>{formatNumber(projects[key]?.clients)} clients</span>
                    <span>{formatNumber(projects[key]?.sent)} sent</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="report-summary-card tone-clients">
              <div className="report-summary-card-head">
                <span>Client Counts</span>
                <strong>{formatNumber(clientCounts.total)}</strong>
              </div>
              <div className="report-summary-metrics three">
                <SummaryMetric label="TEC clients" value={clientCounts.tec} tone="success" />
                <SummaryMetric label="TUT clients" value={clientCounts.tut} tone="live" />
                <SummaryMetric label="Total clients" value={clientCounts.total} />
              </div>
            </article>

            <article className="report-summary-card tone-senders">
              <div className="report-summary-card-head">
                <span>Sender ID Health</span>
                <strong>{formatNumber(senderHealth?.total)}</strong>
              </div>
              <div className="report-summary-metrics three">
                <SummaryMetric label="Active" value={senderHealth?.active} tone="success" />
                <SummaryMetric label="Failed" value={senderHealth?.failed} tone="danger" />
                <SummaryMetric label="Total senders" value={senderHealth?.total} />
              </div>
              <p>{senderProviderText}</p>
            </article>

            <article className="report-summary-card tone-warmup">
              <div className="report-summary-card-head">
                <span>Warmup</span>
                <strong>{formatNumber(warmup?.activeAccounts)}</strong>
              </div>
              <div className="report-summary-metrics">
                <SummaryMetric label="Sent" value={warmup?.sent} tone="success" />
                <SummaryMetric label="Received" value={warmup?.received} tone="live" />
                <SummaryMetric label="Failed" value={warmup?.failed} tone="danger" />
                <SummaryMetric label="Active accounts" value={warmup?.activeAccounts} />
              </div>
              <p className={String(warmupHealth).toLowerCase().includes('attention') ? 'is-warning' : ''}>Health: {warmupHealth}</p>
            </article>

            <article className="report-summary-card tone-credits">
              <div className="report-summary-card-head">
                <span>Credits</span>
                <strong>{formatNumber(credits?.remainingCredits)}</strong>
              </div>
              <div className="report-summary-metrics">
                <SummaryMetric label="Total" value={credits?.totalCredits} />
                <SummaryMetric label="Used" value={credits?.usedCredits} tone="danger" />
                <SummaryMetric label="Remaining" value={credits?.remainingCredits} tone="success" />
                <SummaryMetric label="Used today" value={credits?.usedToday} tone="live" />
                <SummaryMetric label="TEC used" value={credits?.projectWise?.tec} />
                <SummaryMetric label="TUT used" value={credits?.projectWise?.tut} />
              </div>
            </article>
          </div>
        </section>
      </section>
    </AppLayout>
  );
}
