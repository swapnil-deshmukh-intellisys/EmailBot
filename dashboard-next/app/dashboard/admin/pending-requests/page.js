'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function PendingRequestsPage() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetch('/api/admin/pending-requests')
      .then((res) => res.json())
      .then((data) => setRequests(data.requests || []))
      .catch(() => setRequests([]));
  }, []);

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
        <div className="admin-list" style={{ display: 'grid', gap: 10 }}>
          {requests.map((item) => (
            <div key={item._id} className="admin-list-item">
              <strong>{item.name || item.identifier}</strong>
              <p>{item.email || item.identifier}</p>
              <small>{item.requestedRole} | {item.status}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
