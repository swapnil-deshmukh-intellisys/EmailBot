'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  getSeedEmailPlaceholder,
  getSeedLoginPrefill,
  normalizeLoginType,
  TEMP_AUTH_ROLES
} from '@/app/lib/authDefaults';

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
      className="login-eye-button"
      onClick={onClick}
      aria-label={shown ? 'Hide password' : 'Show password'}
      title={shown ? 'Hide password' : 'Show password'}
    >
      <EyeIcon shown={shown} />
    </button>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState(TEMP_AUTH_ROLES.USER);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const selectedRole = normalizeLoginType(role);

  const validationMessage = useMemo(() => {
    if (!identifier.trim()) return 'Email is required.';
    if (!password.trim()) return 'Password is required.';
    return '';
  }, [identifier, password]);

  useEffect(() => {
    const next = getSeedLoginPrefill(selectedRole);
    setIdentifier(next.identifier);
    setPassword(next.password);
    setError('');
  }, [selectedRole]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password, role: selectedRole })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Invalid email or password.');
        return;
      }
      router.push(data.redirectTo || data.dashboardPath || '/dashboard/user');
      router.refresh();
    } catch {
      setError('Unable to reach login API. Check server logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen dashboard-login-screen">
      <section className="login-shell single-panel">
        <section className="card login-card dashboard-login-card">
          <div className="login-card-head">
            <div className="login-brand-icon" aria-hidden="true">
              <MailIcon />
            </div>
            <div>
              <p className="login-card-kicker">IntelliMailPilot</p>
              <h2>Welcome back</h2>
            </div>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <div className="login-role-toggle" data-role={selectedRole} aria-label="Login type">
                <button
                  type="button"
                  className={selectedRole === TEMP_AUTH_ROLES.USER ? 'active' : ''}
                  onClick={() => setRole(TEMP_AUTH_ROLES.USER)}
                  aria-pressed={selectedRole === TEMP_AUTH_ROLES.USER}
                >
                  User
                </button>
                <button
                  type="button"
                  className={selectedRole === TEMP_AUTH_ROLES.ADMIN ? 'active' : ''}
                  onClick={() => setRole(TEMP_AUTH_ROLES.ADMIN)}
                  aria-pressed={selectedRole === TEMP_AUTH_ROLES.ADMIN}
                >
                  Admin
                </button>
            </div>

            <label className="login-field">
              <span>Email</span>
              <div className="login-input-wrap">
                <span className="login-input-icon" aria-hidden="true">
                  <MailIcon />
                </span>
                <input
                  className="input login-input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={getSeedEmailPlaceholder(selectedRole)}
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-input-wrap">
                <span className="login-input-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <input
                  className="input login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                />
                <EyeButton shown={showPassword} onClick={() => setShowPassword((current) => !current)} />
              </div>
            </label>

            <div className="login-forgot-row">
              <Link href="/forgot-password">Forgot password?</Link>
            </div>

            <button className="button login-button" disabled={loading}>
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRightIcon />
            </button>

            {error ? <p className="login-error" role="alert">{error}</p> : null}

            <p className="login-access-copy">
              Need access? <Link href="/request-access">Contact your admin</Link>
            </p>
          </form>
        </section>
      </section>
    </main>
  );
}
