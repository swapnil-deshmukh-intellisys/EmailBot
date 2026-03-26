import React from 'react';

function ActivityPanel({ activeCampaign, progressText, onStop, onClearLogs, onDelete }) {
  if (!activeCampaign) return null;

  return (
    <section className="card grid">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>Live Logs: {activeCampaign.name}</h3>
        <div className="row">
          <button className="button danger" onClick={() => onStop(activeCampaign._id)}>Stop</button>
          <button className="button danger" onClick={() => onClearLogs(activeCampaign._id)}>Clear Logs</button>
          <button className="button danger" onClick={() => onDelete(activeCampaign._id)}>Delete</button>
        </div>
      </div>
      <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12 }}>
        <p style={{ marginTop: 0 }}>{progressText}</p>
        <div style={{ maxHeight: 220, overflow: 'auto', background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 10 }}>
          {(activeCampaign.logs || []).slice(-40).map((log, idx) => (
            <div key={idx} style={{ fontSize: 13, marginBottom: 4 }}>
              [{new Date(log.at).toLocaleTimeString()}] {log.message}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default React.memo(ActivityPanel);
