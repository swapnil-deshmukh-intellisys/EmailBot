'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

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

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validationMessage = useMemo(() => {
    if (!currentPassword.trim()) return 'Current password is required.';
    if (!newPassword.trim()) return 'New password is required.';
    if (newPassword !== confirmPassword) return 'Confirm password must match.';
    return '';
  }, [currentPassword, newPassword, confirmPassword]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to change password.');
        return;
      }
      router.push(data.dashboardPath || '/dashboard');
      router.refresh();
    } catch {
      setError('Unable to change password right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen dashboard-login-screen">
      <section className="login-shell single-panel">
        <section className="card login-card dashboard-login-card">
          <div className="login-card-head">
            <p className="login-card-kicker">Security Update</p>
            <h2>Change your password</h2>
            <p>You must change your password before continuing to the dashboard.</p>
          </div>
          <form onSubmit={onSubmit} className="login-form">
            <label className="login-field">
              <span>Current Password</span>
              <div style={{ position: 'relative' }}>
                <input className="input login-input" type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={{ paddingRight: 44 }} />
                <EyeButton shown={showCurrent} onClick={() => setShowCurrent((current) => !current)} />
              </div>
            </label>
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
              {loading ? 'Updating...' : 'Update Password'}
            </button>
            {error ? <p className="login-error">{error}</p> : null}
          </form>
        </section>
      </section>
    </main>
  );
}
