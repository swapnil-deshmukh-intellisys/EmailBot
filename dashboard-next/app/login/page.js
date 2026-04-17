'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  getSeedEmailPlaceholder,
  getSeedHeadingForRole,
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
      router.push(data.redirectTo || data.dashboardPath || '/dashboard');
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
            <p className="login-card-kicker">IntelliMailPilot</p>
            <h2>{getSeedHeadingForRole(selectedRole)}</h2>
            <p aria-hidden="true" style={{ visibility: 'hidden' }}>
              Role based sign-in
            </p>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <div className="login-field" style={{ display: 'grid', gap: 10 }}>
              <span>Login Type</span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 10
                }}
              >
                <button
                  type="button"
                  className="input login-input"
                  onClick={() => setRole(TEMP_AUTH_ROLES.ADMIN)}
                  aria-pressed={selectedRole === TEMP_AUTH_ROLES.ADMIN}
                  style={{
                    borderColor: selectedRole === TEMP_AUTH_ROLES.ADMIN ? 'var(--accent)' : undefined,
                    boxShadow: selectedRole === TEMP_AUTH_ROLES.ADMIN ? '0 0 0 1px var(--accent)' : 'none',
                    fontWeight: 600
                  }}
                >
                  Admin Login
                </button>
                <button
                  type="button"
                  className="input login-input"
                  onClick={() => setRole(TEMP_AUTH_ROLES.USER)}
                  aria-pressed={selectedRole === TEMP_AUTH_ROLES.USER}
                  style={{
                    borderColor: selectedRole === TEMP_AUTH_ROLES.USER ? 'var(--accent)' : undefined,
                    boxShadow: selectedRole === TEMP_AUTH_ROLES.USER ? '0 0 0 1px var(--accent)' : 'none',
                    fontWeight: 600
                  }}
                >
                  User Login
                </button>
              </div>
            </div>

            <label className="login-field">
              <span>Email</span>
              <input
                className="input login-input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={getSeedEmailPlaceholder(selectedRole)}
                autoComplete="username"
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <div style={{ position: 'relative' }}>
                <input
                  className="input login-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  style={{ paddingRight: 44 }}
                />
                <EyeButton shown={showPassword} onClick={() => setShowPassword((current) => !current)} />
              </div>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
              <Link href="/forgot-password">Forgot Password?</Link>
            </div>

            <button className="button login-button" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>

            {error ? <p className="login-error" role="alert">{error}</p> : null}
          </form>
        </section>
      </section>
    </main>
  );
}
