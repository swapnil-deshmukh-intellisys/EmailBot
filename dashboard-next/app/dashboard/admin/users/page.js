'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', identifier: '', intellisysUserId: '', email: '', role: 'user' });
  const [message, setMessage] = useState('');

  const loadUsers = async (query = '') => {
    const res = await fetch(`/api/admin/users${query ? `?search=${encodeURIComponent(query)}` : ''}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok) setUsers(data.users || []);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const onCreate = async (event) => {
    event.preventDefault();
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || 'Unable to create user');
      return;
    }
    setMessage('User created successfully with default password Pilote@123.');
    setForm({ name: '', identifier: '', intellisysUserId: '', email: '', role: 'user' });
    loadUsers(search);
  };

  return (
    <main className="dashboard-content-shell" style={{ padding: 24 }}>
      <section className="premium-panel" style={{ marginBottom: 24 }}>
        <div className="premium-panel-head">
          <div>
            <span className="premium-section-kicker">Admin</span>
            <h3>Users</h3>
          </div>
          <Link href="/dashboard/admin/pending-requests" className="ghost">Pending Requests</Link>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); loadUsers(search); }} className="admin-form-grid" style={{ display: 'grid', gap: 12 }}>
          <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" />
          <button className="button" type="submit">Search</button>
        </form>
      </section>

      <section className="premium-panel" style={{ marginBottom: 24 }}>
        <div className="premium-panel-head">
          <h3>Add User</h3>
        </div>
        <form onSubmit={onCreate} className="admin-form-grid" style={{ display: 'grid', gap: 12 }}>
          <input className="input" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} placeholder="Name" />
          <input className="input" value={form.identifier} onChange={(e) => setForm((c) => ({ ...c, identifier: e.target.value }))} placeholder="Login ID" />
          <input className="input" value={form.intellisysUserId} onChange={(e) => setForm((c) => ({ ...c, intellisysUserId: e.target.value }))} placeholder="Intellisys User ID" />
          <input className="input" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} placeholder="Email" />
          <select className="input" value={form.role} onChange={(e) => setForm((c) => ({ ...c, role: e.target.value }))}>
            <option value="user">User</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button className="button" type="submit">Create User</button>
          {message ? <p>{message}</p> : null}
        </form>
      </section>

      <section className="premium-panel">
        <div className="premium-panel-head">
          <h3>All Users</h3>
        </div>
        <div className="admin-list" style={{ display: 'grid', gap: 10 }}>
          {users.map((user) => (
            <div key={user.id} className="admin-list-item" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <strong>{user.name || user.identifier}</strong>
                <p>{user.email || user.identifier}</p>
                <small>{user.intellisysUserId || user.identifier} | {user.role} | {user.status}</small>
              </div>
              <Link href={`/dashboard/admin/users/${user.id}`} className="ghost">Open</Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
