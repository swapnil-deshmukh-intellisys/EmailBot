import Link from 'next/link';

export default function PendingAccountPage() {
  return (
    <main className="login-screen dashboard-login-screen">
      <section className="login-shell single-panel">
        <section className="card login-card dashboard-login-card">
          <div className="login-card-head">
            <p className="login-card-kicker">Approval Pending</p>
            <h2>Your account is pending admin approval.</h2>
            <p>You will be able to sign in after an admin approves your request.</p>
          </div>
          <div className="login-card-footer">
            <p><Link href="/login">Back to login</Link></p>
          </div>
        </section>
      </section>
    </main>
  );
}
