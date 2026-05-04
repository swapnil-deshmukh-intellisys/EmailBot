export default function Custom500() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ textAlign: 'center', padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>500</h1>
        <p style={{ marginTop: 12 }}>Internal server error.</p>
      </section>
    </main>
  );
}
