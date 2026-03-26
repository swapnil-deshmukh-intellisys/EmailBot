export function StatCard({ title, value, onClick, active = false }) {
  return (
    <button
      type="button"
      className="card"
      onClick={onClick}
      style={{
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        border: active ? '2px solid #0ea5e9' : undefined
      }}
    >
      <h3>{value}</h3>
      <p>{title}</p>
    </button>
  );
}

export function FancyStatCard({ title, value, percent = 0, trend = 0, color = '#2563eb' }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const positive = trend >= 0;
  return (
    <div className="fancy-stat-card">
      <div className="fancy-stat-top">
        <span className={`fancy-stat-badge ${positive ? 'up' : 'down'}`}>
          {positive ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </span>
        <span className="fancy-stat-menu">⋮</span>
      </div>
      <div className="fancy-stat-body">
        <div>
          <p className="fancy-stat-title">{title}</p>
          <h3 className="fancy-stat-value">{value}</h3>
        </div>
        <div
          className="fancy-stat-ring"
          style={{
            background: `conic-gradient(${color} 0% ${safePercent}%, #f2f4f8 ${safePercent}% 100%)`
          }}
        >
          <div className="fancy-stat-ring-inner">{safePercent}%</div>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const k = (status || '').toLowerCase();
  return <span className={`badge ${k}`}>{status}</span>;
}
