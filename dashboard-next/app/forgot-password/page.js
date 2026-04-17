'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to start password reset.');
        return;
      }
      setMessage(data.message || 'Please contact admin to reset your password.');
      if (data.resetUrl) {
        setMessage(`${data.message} Development reset link: ${data.resetUrl}`);
      }
    } catch {
      setError('Unable to start password reset right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen dashboard-login-screen">
      <section className="login-shell single-panel">
        <section className="card login-card dashboard-login-card">
          <div className="login-card-head">
            <p className="login-card-kicker">Password Help</p>
            <h2>Forgot Password</h2>
            <p>Enter your Intellisys User ID or registered email to start a reset.</p>
          </div>
          <form onSubmit={onSubmit} className="login-form">
            <label className="login-field">
              <span>Intellisys User ID or Email</span>
              <input className="input login-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </label>
            <button className="button login-button" disabled={loading}>
              {loading ? 'Submitting...' : 'Send Reset'}
            </button>
            {message ? <p className="login-success">{message}</p> : null}
            {error ? <p className="login-error">{error}</p> : null}
          </form>
          <div className="login-card-footer">
            <p><Link href="/login">Back to login</Link></p>
          </div>
        </section>
      </section>
    </main>
  );
}
