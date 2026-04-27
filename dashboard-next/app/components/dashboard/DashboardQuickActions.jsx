'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/UiComponentExports';

const defaultActions = [
  { id: 'create-campaign', label: 'Create Campaign' },
  { id: 'upload-list', label: 'Upload List' },
  { id: 'open-drafts', label: 'Open Drafts' }
];

export function DashboardQuickActions({ actions = defaultActions, onAction = null }) {
  return (
    <Card className="dashboard-quick-actions">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Jump into the most common admin flows.</CardDescription>
      </CardHeader>
      <CardContent className="dashboard-quick-actions-grid">
        {actions.map((action) => (
          <Button key={action.id} variant="secondary" onClick={() => onAction?.(action)}>
            {action.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
