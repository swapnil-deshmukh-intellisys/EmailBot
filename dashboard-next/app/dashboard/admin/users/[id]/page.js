'use client';

import { useEffect, useState } from 'react';

export default function AdminUserDetailPage({ params }) {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const res = await fetch(`/api/admin/users/${params.id}`);
    const payload = await res.json().catch(() => ({}));
    if (res.ok) setData(payload);
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const updateStatus = async (status) => {
    const res = await fetch(`/api/admin/users/${params.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? `Status updated to ${status}.` : (payload.error || 'Unable to update status'));
    if (res.ok) load();
  };

  const resetPassword = async () => {
    const res = await fetch(`/api/admin/users/${params.id}/reset-password`, { method: 'PATCH' });
    const payload = await res.json().catch(() => ({}));
    setMessage(res.ok ? (payload.message || 'Password reset complete.') : (payload.error || 'Unable to reset password'));
    if (res.ok) load();
  };

  if (!data) {
    return <main className="dashboard-content-shell" style={{ padding: 24 }}><p>Loading user details...</p></main>;
  }

  const { user, campaigns, drafts, clientLists, senderAccounts, activityLogs } = data;

  return (
    <main className="dashboard-content-shell" style={{ padding: 24 }}>
      <section className="premium-panel" style={{ marginBottom: 24 }}>
        <div className="premium-panel-head">
          <div>
            <span className="premium-section-kicker">Admin</span>
            <h3>{user.name || user.identifier}</h3>
          </div>
        </div>
        <p>{user.email}</p>
        <p>{user.intellisysUserId || user.identifier}</p>
        <p>{user.role} | {user.status}</p>
        <p>{user.mustChangePassword ? 'Temporary password still active' : 'Password already changed'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="button" onClick={() => updateStatus('active')}>Approve / Activate</button>
          <button className="button secondary" onClick={() => updateStatus('blocked')}>Block</button>
          <button className="button secondary" onClick={() => updateStatus('rejected')}>Reject</button>
          <button className="button secondary" onClick={() => updateStatus('inactive')}>Deactivate</button>
          <button className="button secondary" onClick={resetPassword}>Reset to Temporary Password</button>
        </div>
        {message ? <p>{message}</p> : null}
      </section>

      <section className="premium-panel" style={{ marginBottom: 24 }}>
        <h3>Campaigns</h3>
        {campaigns.map((item) => <p key={item._id}>{item.name} | {item.status}</p>)}
      </section>

      <section className="premium-panel" style={{ marginBottom: 24 }}>
        <h3>Drafts</h3>
        {drafts.map((item) => <p key={item._id}>{item.title} | {item.category}</p>)}
      </section>

      <section className="premium-panel" style={{ marginBottom: 24 }}>
        <h3>Client Lists</h3>
        {clientLists.map((item) => <p key={item._id}>{item.name} | {item.sourceFile}</p>)}
      </section>

      <section className="premium-panel" style={{ marginBottom: 24 }}>
        <h3>Sender Accounts</h3>
        {senderAccounts.map((item) => <p key={item._id || item.email}>{item.email || item.from} | {item.provider}</p>)}
      </section>

      <section className="premium-panel">
        <h3>Activity Logs</h3>
        {activityLogs.map((item) => <p key={item._id}>{item.action} | {new Date(item.createdAt).toLocaleString()}</p>)}
      </section>
    </main>
  );
}
