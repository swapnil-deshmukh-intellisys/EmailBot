'use client';

import { DashboardStatCard } from './DashboardStatCard';

export function DashboardStatsGrid({ items = [] }) {
  return (
    <div className="dashboard-stats-grid">
      {items.map((item) => (
        <DashboardStatCard
          key={item.title}
          title={item.title}
          value={item.value}
          change={item.change}
          trend={item.trend}
          badge={item.badge}
          description={item.description}
        />
      ))}
    </div>
  );
}
