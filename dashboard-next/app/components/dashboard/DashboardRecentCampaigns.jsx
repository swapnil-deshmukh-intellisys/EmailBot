'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/UiComponentExports';
import { DashboardRecentCampaignsTable } from './DashboardRecentCampaignsTable';

export function DashboardRecentCampaigns({
  rows = [],
  loading = false,
  onView = null,
  onEdit = null,
  title = 'Recent Campaigns',
  description = 'Monitor the latest campaign activity and status changes.',
  children = null
}) {
  return (
    <Card className="dashboard-recent-campaigns">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children || (
          <DashboardRecentCampaignsTable rows={rows} loading={loading} onView={onView} onEdit={onEdit} />
        )}
      </CardContent>
    </Card>
  );
}
