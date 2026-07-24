import React from 'react';

const STATS = [
  { label: 'Total Sent', key: 'total', icon: 'ti-send', color: '#4f46e5', bg: '#eef0ff', meta: '18.6% vs last 7 days' },
  { label: 'Delivered', key: 'sent', icon: 'ti-circle-check', color: '#059669', bg: '#ecfdf5' },
  { label: 'Pending', key: 'pending', icon: 'ti-clock-hour-3', color: '#f59e0b', bg: '#fff7ed', meta: 'campaigns in queue' },
  { label: 'Failed', key: 'failed', icon: 'ti-circle-x', color: '#e11d48', bg: '#fff1f2' },
  { label: 'Bounced', key: 'bounced', icon: 'ti-arrow-back-up', color: '#0ea5e9', bg: '#f0f9ff' },
  { label: 'Spam Complaints', key: 'spam', icon: 'ti-alert-triangle', color: '#f97316', bg: '#fff7ed', meta: 'complaint rate' }
];

function normalizeStats(stats) {
  if (!Array.isArray(stats)) return stats || {};
  const map = {};
  stats.forEach((item) => {
    const title = String(item?.title || '').toLowerCase();
    const key =
      title.includes('total') ? 'total' :
      title.includes('delivered') || title.includes('sent') ? 'sent' :
      title.includes('waiting') || title.includes('pending') ? 'pending' :
      title.includes('failed') ? 'failed' :
      title.includes('bounced') ? 'bounced' :
      title.includes('spam') ? 'spam' : '';
    if (!key) return;
    map[key] = Number(item?.value || 0);
    map[`${key}Pct`] = Number(item?.percent ?? item?.trend ?? (key === 'total' ? 100 : 0));
    map[`${key}Meta`] = String(item?.meta || '');
  });
  return map;
}

export default function StatStrip({ stats = {} }) {
  const normalized = normalizeStats(stats);
  return (
    <div className="stat-strip stats-grid">
      {STATS.map((stat) => {
        const value = normalized[stat.key] ?? 0;
        const pct = normalized[`${stat.key}Pct`] ?? (stat.key === 'total' ? 100 : 0);
        const defaultMeta = stat.key === 'total'
          ? (stat.meta || 'vs last 7 days')
          : `${Math.max(0, Math.min(100, Math.round(pct)))}% ${stat.key === 'sent' ? 'sent' : stat.key}`;
        const meta = normalized[`${stat.key}Meta`] || defaultMeta;
        return (
          <div key={stat.key} className={`stat-card si-${stat.key === 'sent' ? 'sent' : stat.key}`}>
            <div className="stat-top">
              <span className="stat-label">{stat.label}</span>
              <div className="stat-icon">
                <i className={`ti ${stat.icon}`} />
              </div>
            </div>
            <div>
              <div className="stat-value">{Number(value || 0).toLocaleString()}</div>
              <div className="stat-pct">{meta}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

