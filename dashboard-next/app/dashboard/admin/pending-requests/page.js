'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function PendingRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [message, setMessage] = useState('');

  const loadRequests = () => {
    Promise.all([
      fetch('/api/admin/pending-requests')
      .then((res) => res.json())
        .catch(() => ({})),
      fetch('/api/admin/upgrade-requests')
        .then((res) => res.json())
        .catch(() => ({}))
    ])
      .then(([accessData, upgradeData]) => {
        setRequests(accessData.requests || []);
        setUpgradeRequests(upgradeData.requests || []);
      })
      .catch(() => {
        setRequests([]);
        setUpgradeRequests([]);
      });
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const reviewUpgrade = async (id, decision) => {
    setMessage('');
    const res = await fetch(`/api/admin/upgrade-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      setMessage(data?.error || 'Failed to review upgrade request.');
      return;
    }
    setMessage(data.message || 'Upgrade request reviewed.');
    loadRequests();
  };

  return (
    <main className="dashboard-content-shell" style={{ padding: 24 }}>
      <section className="premium-panel">
        <div className="premium-panel-head">
          <div>
            <span className="premium-section-kicker">Admin</span>
            <h3>Pending Requests</h3>
          </div>
          <Link href="/dashboard/admin/users" className="ghost">All Users</Link>
        </div>
        {message ? <p className="dashboard-profile-note">{message}</p> : null}
        <h4>Mail Limit Upgrades</h4>
        <div className="admin-list" style={{ display: 'grid', gap: 10, marginBottom: 18 }}>
          {upgradeRequests.length ? upgradeRequests.map((item) => (
            <div key={item._id} className="admin-list-item">
              <strong>{item.userEmail}</strong>
              <p>{item.currentPlan} to {item.requestedPlan}</p>
              <small>
                Daily limit: {Number(item.requestedDailyLimit || 500).toLocaleString()} | {item.status} | {item.requestedAt ? new Date(item.requestedAt).toLocaleString() : 'Requested'}
              </small>
              <div className="admin-table-actions" style={{ marginTop: 10 }}>
                <button className="admin-inline-action approve" onClick={() => reviewUpgrade(item._id, 'approved')}>Approve</button>
                <button className="admin-inline-action reject" onClick={() => reviewUpgrade(item._id, 'rejected')}>Reject</button>
              </div>
            </div>
          )) : <p className="dashboard-profile-note">No pending mail limit upgrade requests.</p>}
        </div>
        <h4>Access Requests</h4>
        <div className="admin-list" style={{ display: 'grid', gap: 10 }}>
          {requests.length ? requests.map((item) => (
            <div key={item._id} className="admin-list-item">
              <strong>{item.name || item.identifier}</strong>
              <p>{item.email || item.identifier}</p>
              <small>{item.requestedRole} | {item.status}</small>
            </div>
          )) : <p className="dashboard-profile-note">No pending access requests.</p>}
        </div>
      </section>
    </main>
  );
}
