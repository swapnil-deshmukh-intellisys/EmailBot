'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const roleMeta = {
  user: {
    title: 'Welcome back',
    subtitle: 'Continue to your dashboard',
    accent: 'Pick your role, enter your credentials, and sign in.'
  },
  manager: {
    title: 'Welcome back',
    subtitle: 'Continue to your dashboard',
    accent: 'Pick your role, enter your credentials, and sign in.'
  },
  admin: {
    title: 'Welcome back',
    subtitle: 'Continue to your dashboard',
    accent: 'Pick your role, enter your credentials, and sign in.'
  }
};

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
    admin: { identifier: 'akshaymore.intellisys@gmail.com', password: '1234512345@i' }
  };

  const onRoleChange = (event) => {
    const nextRole = event.target.value;
    setRole(nextRole);
    const defaults = roleDefaults[nextRole] || roleDefaults.user;
    setIdentifier(defaults.identifier);
    setPassword(defaults.password);
    setError('');
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

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      router.push(data.dashboardPath || '/dashboard');
      router.refresh();
    } catch (requestError) {
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
            <p className="login-card-kicker">Welcome back</p>
            <h2>Continue to your dashboard</h2>
            <p>Pick your role, enter your credentials, and sign in.</p>
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
                placeholder={role === 'user' ? 'emp001' : role === 'manager' ? 'mgr001' : 'akshaymore.intellisys@gmail.com'}
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

            {error ? <p className="login-error" role="alert">{error}</p> : null}
          </form>

          <div className="login-card-footer">
            <span>Tip</span>
            <p>Use the role dropdown to auto-fill the demo credentials for that workspace.</p>
          </div>
        </section>
      </section>
    </main>
  );
}
