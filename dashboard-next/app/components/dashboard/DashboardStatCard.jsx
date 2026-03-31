'use client';

import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui';

export function DashboardStatCard({
  title,
  value,
  change = '',
  trend = 'neutral',
  badge = null,
  description = ''
}) {
  const badgeVariantMap = {
    up: 'success',
    down: 'danger',
    neutral: 'neutral'
  };

  return (
    <Card className="dashboard-stat-card">
      <CardHeader className="dashboard-stat-card-header">
        <CardTitle>{title}</CardTitle>
        {badge ? <Badge variant="info" size="sm">{badge}</Badge> : null}
      </CardHeader>
      <CardContent className="dashboard-stat-card-content">
        <strong className="dashboard-stat-card-value">{value}</strong>
        {change ? (
          <Badge variant={badgeVariantMap[trend] || 'neutral'} size="sm" dot>
            {change}
          </Badge>
        ) : null}
        {description ? <p className="dashboard-stat-card-description">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
