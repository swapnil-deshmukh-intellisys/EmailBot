'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState('user');
  const [identifier, setIdentifier] = useState('emp001');
  const [password, setPassword] = useState('emp001');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const roleDefaults = {
    user: { identifier: 'emp001', password: 'emp001' },
    manager: { identifier: 'mgr001', password: 'mgr001' },
    admin: { identifier: 'admin001', password: 'admin001' }
  };

  const onRoleChange = (event) => {
    const nextRole = event.target.value;
    setRole(nextRole);
    const defaults = roleDefaults[nextRole] || roleDefaults.user;
    setIdentifier(defaults.identifier);
    setPassword(defaults.password);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      let data = {};
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }

      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      router.push(data.dashboardPath || '/dashboard');
      router.refresh();
    } catch (requestError) {
      setLoading(false);
      setError('Unable to reach login API. Check server logs.');
    }
  };

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <div className="login-brand-mark">IM</div>
          <div>
            <p className="login-eyebrow">Intelli Mail Pilot</p>
            <h1>Sign in to your dashboard</h1>
          <p className="login-subtitle">
              Access the right workspace for your role.
          </p>
        </div>
      </div>

        <form onSubmit={onSubmit} className="login-form">
          <label className="login-field">
            <span>Select role</span>
            <select className="input login-input" value={role} onChange={onRoleChange}>
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <label className="login-field">
            <span>{role === 'user' ? 'User ID' : role === 'manager' ? 'Manager ID' : 'Admin ID'}</span>
            <input
              className="input login-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={role === 'user' ? 'emp001' : role === 'manager' ? 'mgr001' : 'admin001'}
              autoComplete="username"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              className="input login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </label>

          <button className="button login-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {error ? <p className="login-error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
