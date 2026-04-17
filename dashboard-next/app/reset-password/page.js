'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

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
        fontSize: 18,
        lineHeight: 1,
        padding: 4,
        minWidth: 'auto'
      }}
    >
      {shown ? '🙈' : '👁'}
    </button>
  );
}

export default function ResetPasswordPage() {
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
    <main className="login-screen dashboard-login-screen">
      <section className="login-shell single-panel">
        <section className="card login-card dashboard-login-card">
          <div className="login-card-head">
            <p className="login-card-kicker">Reset Password</p>
            <h2>Create a new password</h2>
            <p>Use a strong password with uppercase, lowercase, number, and special character.</p>
          </div>
          <form onSubmit={onSubmit} className="login-form">
            <label className="login-field">
              <span>New Password</span>
              <div style={{ position: 'relative' }}>
                <input className="input login-input" type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ paddingRight: 44 }} />
                <EyeButton shown={showNew} onClick={() => setShowNew((current) => !current)} />
              </div>
            </label>
            <label className="login-field">
              <span>Confirm Password</span>
              <div style={{ position: 'relative' }}>
                <input className="input login-input" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{ paddingRight: 44 }} />
                <EyeButton shown={showConfirm} onClick={() => setShowConfirm((current) => !current)} />
              </div>
            </label>
            <button className="button login-button" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
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
