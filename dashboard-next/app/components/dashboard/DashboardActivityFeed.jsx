'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@/app/components/ui/UiComponentExports';
import { DashboardActivityItem } from './DashboardActivityItem';

export function DashboardActivityFeed({
  title = 'Activity Feed',
  description = 'Recent updates across outreach, lists, and workflow activity.',
  items = [],
  children = null,
  emptyTitle = 'No recent activity',
  emptyDescription = 'New dashboard events will show up here.'
}) {
  return (
    <Card className="dashboard-activity-feed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="dashboard-activity-feed-content">
        {children ? children : items.length ? items.map((item, index) => <DashboardActivityItem key={item.id || index} item={item} />) : (
          <EmptyState compact title={emptyTitle} description={emptyDescription} />
        )}
      </CardContent>
    </Card>
  );
}
