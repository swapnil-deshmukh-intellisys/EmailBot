'use client';

import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '@/app/components/ui';

const statusVariantMap = {
  Running: 'info',
  Paused: 'warning',
  Completed: 'success',
  Failed: 'danger',
  Draft: 'neutral'
};

export function DashboardRecentCampaignsTable({
  rows = [],
  loading = false,
  onView = null,
  onEdit = null
}) {
  return (
    <TableWrapper
      loading={loading}
      empty={!loading && rows.length === 0}
      emptyTitle="No campaigns yet"
      emptyDescription="Recent campaigns will appear here once they start running."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead align="right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id || row.name}>
              <TableCell>{row.name}</TableCell>
              <TableCell>
                <Badge variant={statusVariantMap[row.status] || 'default'} dot>
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell muted>{row.updatedAt || row.updated || '-'}</TableCell>
              <TableCell align="right">
                <div className="dashboard-inline-actions">
                  {onView ? <Button variant="ghost" size="sm" onClick={() => onView(row)}>View</Button> : null}
                  {onEdit ? <Button variant="secondary" size="sm" onClick={() => onEdit(row)}>Edit</Button> : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}
