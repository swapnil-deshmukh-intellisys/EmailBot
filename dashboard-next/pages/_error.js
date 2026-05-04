function ErrorPage({ statusCode }) {
  const code = Number(statusCode || 500);
  const message = code === 404 ? 'Page not found.' : 'Internal server error.';

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ textAlign: 'center', padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>{code}</h1>
        <p style={{ marginTop: 12 }}>{message}</p>
      </section>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode = res?.statusCode || err?.statusCode || 500;
  return { statusCode };
};

export default ErrorPage;
