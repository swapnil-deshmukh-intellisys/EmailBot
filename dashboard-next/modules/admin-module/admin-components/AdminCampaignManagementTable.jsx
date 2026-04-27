'use client';

import { useState } from 'react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '@/app/components/ui/UiComponentExports';

function statusVariant(status = '') {
  const value = String(status).toLowerCase();
  if (value === 'completed' || value === 'healthy' || value === 'active') return 'success';
  if (value === 'running') return 'info';
  if (value === 'paused' || value === 'warning') return 'warning';
  if (value === 'draft' || value === 'pending' || value === 'inactive') return 'neutral';
  return 'default';
}

export default function AdminCampaignsTable({ campaigns = [] }) {
  const [open, setOpen] = useState(true);
  const previewRows = campaigns.slice(0, 2);

  return (
    <Card id="campaigns" className="dashboard-panel admin-campaigns-panel">
      <CardHeader className="dashboard-chart-card-header admin-campaigns-head">
        <div>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>Every campaign across the organization from the live database.</CardDescription>
        </div>
        <div className="admin-campaigns-actions">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Show
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Minimize
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <strong>{campaign.name}</strong>
                      <div className="muted">{campaign.id}</div>
                    </TableCell>
                    <TableCell>{campaign.owner}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(campaign.status)} dot>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign.updated}</TableCell>
                    <TableCell>{campaign.progress}</TableCell>
                    <TableCell>{campaign.sent}</TableCell>
                    <TableCell>{campaign.pending}</TableCell>
                    <TableCell>{campaign.failed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      ) : (
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <strong>{campaign.name}</strong>
                      <div className="muted">{campaign.owner}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(campaign.status)} dot>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign.progress}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      )}
    </Card>
  );
}
