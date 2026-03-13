'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data = {};
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          data = {};
        }
      }

      setLoading(false);

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setLoading(false);
      setError('Unable to reach login API. Check server logs.');
    }
  };

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h2>Email Automation Login</h2>
        <div className="space" />
        <p>Use your admin credentials to access campaigns and uploads.</p>
        <div className="space" />
        <form onSubmit={onSubmit} className="grid">
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          <button className="button" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
          {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}
        </form>
      </div>
    </main>
  );
}
