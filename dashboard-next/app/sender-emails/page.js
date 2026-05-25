'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';

export default function SenderEmailsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/reports/sender-health?t=${Date.now()}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to load sender health');
      setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (err) {
      setError(err.message || 'Failed to load sender health');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const runHealthCheck = async () => {
    setChecking(true);
    setMessage('');
    setError('');
    try {
      await loadAccounts();
      setMessage('Sender health check completed.');
    } catch (err) {
      setError(err.message || 'Health check failed');
    } finally {
      setChecking(false);
    }
  };

  const connectSender = () => {
    window.location.href = `/api/graph-oauth/start?returnTo=${encodeURIComponent('/sender-emails')}`;
  };

  return (
    <AppLayout>
      <section className="workspace-page">
        <div className="workspace-hero">
          <div>
            <span className="workspace-kicker">Sender Emails</span>
            <h1>Sender health and connections</h1>
            <p>Connect sender mailboxes and verify which accounts are ready for campaigns.</p>
          </div>
          <div className="workspace-hero-actions">
            <Button variant="secondary" loading={checking} onClick={runHealthCheck}>
              {checking ? 'Checking...' : 'Run Health Check'}
            </Button>
            <Button onClick={connectSender}>Connect Sender</Button>
          </div>
        </div>

        {error ? <div className="dashboard-error-state">{error}</div> : null}
        {message ? <div className="dashboard-success-state">{message}</div> : null}

        <section className="workspace-panel">
          <div className="workspace-panel-head">
            <div>
              <h2>Connected Sender Accounts</h2>
              <p>{loading ? 'Loading sender accounts...' : `${accounts.length} sender accounts loaded`}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={loadAccounts}>Refresh</Button>
          </div>
          <div className="workspace-table">
            <div className="workspace-table-head" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
              <span>Sender</span>
              <span>Provider</span>
              <span>Status</span>
              <span>Health</span>
              <span>Last Sync</span>
            </div>
            {loading ? (
              <div className="workspace-table-row" style={{ gridTemplateColumns: '1fr' }}><span>Loading...</span></div>
            ) : accounts.length ? accounts.map((account) => (
              <div key={account.from || account.id} className="workspace-table-row" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                <span>{account.from || account.email || '-'}</span>
                <span>{account.provider || 'mail'}</span>
                <span>{account.status || 'Connected'}</span>
                <span>{account.health || (Number(account.errorCount || 0) ? 'Needs attention' : 'Good')}</span>
                <span>{account.updatedAt ? new Date(account.updatedAt).toLocaleString() : '-'}</span>
              </div>
            )) : (
              <div className="workspace-table-row" style={{ gridTemplateColumns: '1fr' }}><span>No senders connected yet.</span></div>
            )}
          </div>
        </section>
      </section>
    </AppLayout>
  );
}
