'use client';

import { useRouter } from 'next/navigation';

export default function UnauthorizedPage() {
  const router = useRouter();

  const handleReturnToLogin = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
    router.refresh();
  };

  return (
    <main className="container" style={{ maxWidth: 720, paddingTop: 96 }}>
      <div className="card">
        <h1>Access Denied</h1>
        <p>You do not have permission to open this dashboard route.</p>
        <div className="space" />
        <button type="button" className="button" onClick={handleReturnToLogin}>
          Return to Login
        </button>
      </div>
    </main>
  );
}
