'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Spinner } from '@/app/components/ui';

export function DashboardChartCard({
  title,
  description = '',
  actions = null,
  children,
  loading = false,
  empty = false,
  emptyTitle = 'No chart data',
  emptyDescription = 'Chart information will appear here once data is available.'
}) {
  return (
    <Card className="dashboard-chart-card">
      <CardHeader className="dashboard-chart-card-header">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="dashboard-chart-card-content">
        {loading ? <Spinner center label="Loading..." /> : empty ? <EmptyState compact title={emptyTitle} description={emptyDescription} /> : children}
      </CardContent>
    </Card>
  );
}
