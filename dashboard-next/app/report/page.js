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

        <div className="report-count-grid">
          {DELIVERY_CARDS.map(([key, label, caption, icon]) => (
            <article key={key} className="report-count-card">
              <div><span>{label}</span><em>{icon}</em></div>
              <strong>{loading ? '...' : Number(delivery[key] || 0).toLocaleString()}</strong>
              <small>{caption} - {pct(delivery[key], delivery.total)}</small>
              <div className="report-progress"><span style={{ width: pct(delivery[key], delivery.total) }} /></div>
            </article>
          ))}
        </div>

        <div className="report-section-grid">
          <section className="report-panel">
            <h2>Campaign Counts</h2>
            <div className="report-mini-grid">
              {['total', 'running', 'completed', 'failed', 'paused', 'stopped'].map((key) => (
                <article key={key}><span>{key.replace(/^\w/, (c) => c.toUpperCase())}</span><strong>{campaigns[key] || 0}</strong></article>
              ))}
            </div>
          </section>

          <section className="report-panel">
            <h2>Project Wise</h2>
            {['tec', 'tut'].map((key) => (
              <div key={key} className="report-project-row">
                <strong>{key.toUpperCase()}</strong>
                <span>{projects[key]?.campaigns || 0} campaigns</span>
                <span>{projects[key]?.clients || 0} clients</span>
                <span>{projects[key]?.sent || 0} sent</span>
              </div>
            ))}
          </section>

          <section className="report-panel">
            <h2>Client Counts</h2>
            <div className="report-mini-grid">
              <article><span>TEC clients</span><strong>{clientCounts.tec || 0}</strong></article>
              <article><span>TUT clients</span><strong>{clientCounts.tut || 0}</strong></article>
              <article><span>Total clients</span><strong>{clientCounts.total || 0}</strong></article>
            </div>
          </section>

          <section className="report-panel">
            <h2>Sender ID Health</h2>
            <div className="report-mini-grid">
              <article><span>Total senders</span><strong>{senderHealth?.total || 0}</strong></article>
              <article><span>Active</span><strong>{senderHealth?.active || 0}</strong></article>
              <article><span>Failed</span><strong>{senderHealth?.failed || 0}</strong></article>
            </div>
            <p>{senderProviderText}</p>
          </section>

          <section className="report-panel">
            <h2>Warmup</h2>
            <div className="report-mini-grid">
              <article><span>Active accounts</span><strong>{warmup?.activeAccounts || 0}</strong></article>
              <article><span>Sent</span><strong>{warmup?.sent || 0}</strong></article>
              <article><span>Received</span><strong>{warmup?.received || 0}</strong></article>
              <article><span>Failed</span><strong>{warmup?.failed || 0}</strong></article>
            </div>
            <p>Health: {warmup?.health || '-'}</p>
          </section>

          <section className="report-panel">
            <h2>Credits</h2>
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
      </section>
    </AppLayout>
  );
}
