import Badge from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';

export function StatCard({ title, value, onClick, active = false }) {
  return (
    <button
      type="button"
      className="ui-card"
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
    <Card className="fancy-stat-card">
      <CardContent className="fancy-stat-card-body">
        <div className="fancy-stat-top">
          <Badge variant={positive ? 'success' : 'danger'} className={`fancy-stat-badge ${positive ? 'up' : 'down'}`}>
            {positive ? 'Up' : 'Down'} {Math.abs(trend).toFixed(1)}%
          </Badge>
          <span className="fancy-stat-menu">...</span>
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
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }) {
  const key = (status || '').toLowerCase();
  const toneMap = {
    pending: 'warning',
    sent: 'success',
    failed: 'danger',
    running: 'info',
    paused: 'neutral',
    completed: 'success'
  };
  return <Badge variant={toneMap[key] || 'default'} className={`badge ${key}`}>{status}</Badge>;
}
