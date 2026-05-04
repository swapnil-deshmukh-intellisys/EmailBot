'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ textAlign: 'center', padding: 24 }}>
            <h1 style={{ margin: 0, fontSize: 32 }}>500</h1>
            <p style={{ marginTop: 12 }}>Something went wrong.</p>
            <button type="button" onClick={() => reset()} style={{ marginTop: 16, padding: '8px 14px' }}>
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
