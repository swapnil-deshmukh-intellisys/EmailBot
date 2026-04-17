'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    name: '',
    identifier: '',
    email: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to submit request');
        return;
      }
      setMessage(data.message || 'Access request submitted.');
      setForm({ name: '', identifier: '', email: '', password: '' });
    } catch {
      setError('Unable to reach the server right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen dashboard-login-screen">
      <section className="login-shell single-panel">
        <section className="card login-card dashboard-login-card">
          <div className="login-card-head">
            <p className="login-card-kicker">Request Access</p>
            <h2>Create a pending account request</h2>
            <p>Your request will stay pending until an admin approves it.</p>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <label className="login-field">
              <span>Name</span>
              <input className="input login-input" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
            </label>
            <label className="login-field">
              <span>Login ID</span>
              <input className="input login-input" value={form.identifier} onChange={(e) => updateField('identifier', e.target.value)} />
            </label>
            <label className="login-field">
              <span>Email</span>
              <input className="input login-input" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
            </label>
            <label className="login-field">
              <span>Password</span>
              <input className="input login-input" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} />
            </label>
            <button className="button login-button" disabled={loading}>
              {loading ? 'Submitting...' : 'Request Access'}
            </button>
            {message ? <p className="login-success">{message}</p> : null}
            {error ? <p className="login-error">{error}</p> : null}
          </form>

          <div className="login-card-footer">
            <span>Already approved?</span>
            <p>
              <Link href="/login">Back to login</Link>
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
