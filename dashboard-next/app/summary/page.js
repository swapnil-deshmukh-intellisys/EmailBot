export default function SummaryPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(180deg, #eef2ff 0%, #f8fafc 100%)'
      }}
    >
      <div
        style={{
          width: 'min(1100px, 100%)',
          minHeight: '70vh',
          borderRadius: 28,
          border: '1px solid #d7e0ea',
          background: '#ffffff',
          boxShadow: '0 24px 50px rgba(15, 23, 42, 0.12)'
        }}
      />
    </main>
  );
}
