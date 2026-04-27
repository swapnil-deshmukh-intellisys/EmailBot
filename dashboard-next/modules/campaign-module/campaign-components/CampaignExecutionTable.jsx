import React from 'react';
import Button from '@/shared-components/ui-components/UiActionButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared-components/ui-components/UiContentCard';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow, TableWrapper } from '@/shared-components/ui-components/UiDataTable';
import { StatusBadge } from '@/app/dashboard/components/DashboardUiPrimitives';
import { getCampaignTimeLabel } from '../campaign-hooks/UseCampaignCollection';

function CampaignTable({
  title,
  campaigns,
  selectedIds,
  allSelected,
  onToggleSelectAll,
  onToggleSelect,
  onDeleteSelected,
  onDeleteAll,
  onToggleHistory,
  showHistoryButton = false,
  showHistory,
  onStart,
  onPause,
  onStop,
  onResume,
  onResumeDraft,
  onDelete,
  emptyText
}) {
  return (
    <Card className="ui-panel-card" id={title === 'Campaigns' ? 'campaigns-panel' : undefined}>
      <CardHeader className="ui-panel-card-header">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="ui-panel-card-content">
        <div className="ui-toolbar ui-toolbar-wrap">
          <Button variant="danger" onClick={onDeleteSelected} disabled={!selectedIds.length}>
            Delete Selected
          </Button>
          {onDeleteAll ? (
            <Button variant="danger" onClick={onDeleteAll} disabled={!campaigns.length}>
              Delete All
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onToggleSelectAll}>
            {allSelected ? 'Clear Selection' : 'Select All'}
          </Button>
          <span className="ui-toolbar-meta">{selectedIds.length} selected</span>
        </div>
        {!campaigns.length ? <TableEmpty>{emptyText}</TableEmpty> : null}
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 56 }}>
                  <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} />
                </TableHead>
                <TableHead style={{ width: 72 }}>Sr. No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign, idx) => {
                const total = campaign.stats?.total || 0;
                const sent = campaign.stats?.sent || 0;
                const percent = total ? Math.round((sent / total) * 100) : 0;
                const timeLabel = getCampaignTimeLabel(campaign);
                const isChecked = selectedIds.includes(campaign._id);
                return (
                  <TableRow key={campaign._id}>
                    <TableCell>
                      <input type="checkbox" checked={isChecked} onChange={() => onToggleSelect(campaign._id)} />
                    </TableCell>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>
                      <div className="ui-stack-tight">
                        <span>{campaign.name}</span>
                        {String(campaign.status || '').toLowerCase() === 'draft' ? (
                          <button
                            type="button"
                            className="campaign-resume-badge"
                            onClick={() => {
                              if (onResumeDraft) {
                                onResumeDraft(campaign);
                                return;
                              }
                              window.dispatchEvent(
                                new CustomEvent('dashboard:resume-campaign-draft', {
                                  detail: { campaign }
                                })
                              );
                            }}
                          >
                            Resume from: {campaign.workflowStepLabel || `Step ${campaign.workflowStep || 1}`}
                          </button>
                        ) : null}
                        {timeLabel ? (
                          <small style={{ color: timeLabel.color, fontWeight: timeLabel.strong ? 700 : 500 }}>
                            {timeLabel.text}
                          </small>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={campaign.status} /></TableCell>
                    <TableCell>
                      <div className="progress"><div style={{ width: `${percent}%` }} /></div>
                      <small>{percent}%</small>
                    </TableCell>
                    <TableCell>{sent}/{total} sent, {campaign.stats?.failed || 0} failed</TableCell>
                    <TableCell className="ui-table-actions-cell">
                      <div className="ui-table-actions">
                        <Button size="sm" onClick={() => onStart(campaign._id)}>Start</Button>
                        <Button size="sm" className="button warn" onClick={() => onPause(campaign._id)}>Pause</Button>
                        <Button size="sm" variant="danger" onClick={() => onStop(campaign._id)}>Stop</Button>
                        <Button size="sm" variant="secondary" onClick={() => onResume(campaign._id)}>Resume</Button>
                        {String(campaign.status || '').toLowerCase() === 'draft' && onResumeDraft ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              if (onResumeDraft) {
                                onResumeDraft(campaign);
                                return;
                              }
                              window.dispatchEvent(
                                new CustomEvent('dashboard:resume-campaign-draft', {
                                  detail: { campaign }
                                })
                              );
                            }}
                          >
                            Resume Draft
                          </Button>
                        ) : null}
                        <Button size="sm" variant="danger" onClick={() => onDelete(campaign._id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
        {showHistoryButton ? (
          <div className="ui-table-footer-center">
            <Button variant="secondary" onClick={onToggleHistory}>
              {showHistory ? 'Hide History' : 'History'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default React.memo(CampaignTable);
