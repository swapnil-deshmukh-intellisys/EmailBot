'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function EyeIcon({ shown }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shown ? (
        <>
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12c.92-2.6 2.63-4.78 4.88-6.32" />
          <path d="M10.58 10.58A2 2 0 1 0 13.41 13.41" />
          <path d="M1 1l22 22" />
          <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.8 11.8 0 0 1-1.67 2.68" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function EyeButton({ shown, onClick }) {
  return (
    <button
      type="button"
      className="ghost subtle"
      onClick={onClick}
      aria-label={shown ? 'Hide password' : 'Show password'}
      title={shown ? 'Hide password' : 'Show password'}
      style={{
        position: 'absolute',
        right: 10,
        top: '50%',
        transform: 'translateY(-50%)',
        lineHeight: 1,
        padding: 4,
        minWidth: 'auto'
      }}
    >
      <EyeIcon shown={shown} />
    </button>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = String(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to reset password.');
        return;
      }
      setMessage(data.message || 'Password reset successful.');
    } catch {
      setError('Unable to reset password right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="login-form">
      <label className="login-field">
        <span>New Password</span>
        <div style={{ position: 'relative' }}>
          <input
            className="input login-input"
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ paddingRight: 44 }}
          />
          <EyeButton shown={showNew} onClick={() => setShowNew((current) => !current)} />
        </div>
      </label>
      <label className="login-field">
        <span>Confirm Password</span>
        <div style={{ position: 'relative' }}>
          <input
            className="input login-input"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={{ paddingRight: 44 }}
          />
          <EyeButton shown={showConfirm} onClick={() => setShowConfirm((current) => !current)} />
        </div>
      </label>
      <button className="button login-button" disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
      {message ? <p className="login-success">{message}</p> : null}
      {error ? <p className="login-error">{error}</p> : null}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="login-screen dashboard-login-screen">
      <section className="login-shell single-panel">
        <section className="card login-card dashboard-login-card">
          <div className="login-card-head">
            <p className="login-card-kicker">Reset Password</p>
            <h2>Create a new password</h2>
            <p>Use a strong password with uppercase, lowercase, number, and special character.</p>
          </div>
          <Suspense fallback={<div className="login-form"><p>Loading reset form...</p></div>}>
            <ResetPasswordForm />
          </Suspense>
          <div className="login-card-footer">
            <p><Link href="/login">Back to login</Link></p>
          </div>
        </section>
      </section>
    </main>
  );
}
