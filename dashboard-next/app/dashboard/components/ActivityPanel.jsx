import React from 'react';
import Button from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';

function ActivityPanel({ activeCampaign, progressText, onStop, onClearLogs, onDelete }) {
  if (!activeCampaign) return null;

  return (
    <Card className="ui-panel-card">
      <CardHeader className="ui-panel-card-header">
        <CardTitle>Live Logs: {activeCampaign.name}</CardTitle>
        <div className="ui-toolbar ui-toolbar-wrap">
          <Button variant="danger" onClick={() => onStop(activeCampaign._id)}>Stop</Button>
          <Button variant="danger" onClick={() => onClearLogs(activeCampaign._id)}>Clear Logs</Button>
          <Button variant="danger" onClick={() => onDelete(activeCampaign._id)}>Delete</Button>
        </div>
      </CardHeader>
      <CardContent className="ui-panel-card-content">
        <div className="ui-log-shell">
          <p className="ui-log-summary">{progressText}</p>
          <div className="ui-log-stream">
            {(activeCampaign.logs || []).slice(-40).map((log, idx) => (
              <div key={idx} className="ui-log-line">
                [{new Date(log.at).toLocaleTimeString()}] {log.message}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default React.memo(ActivityPanel);
