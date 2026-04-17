import Link from 'next/link';

export default function DisabledAccountPage() {
  return (
    <main className="login-screen dashboard-login-screen">
      <section className="login-shell single-panel">
        <section className="card login-card dashboard-login-card">
          <div className="login-card-head">
            <p className="login-card-kicker">Account Disabled</p>
            <h2>Your account has been disabled. Contact admin.</h2>
            <p>An administrator must reactivate your account before you can log in again.</p>
          </div>
          <div className="login-card-footer">
            <p><Link href="/login">Back to login</Link></p>
          </div>
        </section>
      </section>
    </main>
  );
}
