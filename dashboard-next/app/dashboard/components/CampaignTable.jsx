import React from 'react';
import { StatusBadge } from './DashboardUiBits';
import { getCampaignTimeLabel } from '../hooks/useCampaigns';

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
  onDelete,
  emptyText
}) {
  return (
    <section className="card grid" id={title === 'Campaigns' ? 'campaigns-panel' : undefined}>
      <h3>{title}</h3>
      <div style={{ border: '1px solid #d7e0ea', borderRadius: 12, padding: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="button danger" type="button" onClick={onDeleteSelected} disabled={!selectedIds.length}>
            Delete Selected
          </button>
          {onDeleteAll ? (
            <button className="button danger" type="button" onClick={onDeleteAll} disabled={!campaigns.length}>
              Delete All
            </button>
          ) : null}
          <button className="button secondary" type="button" onClick={onToggleSelectAll}>
            {allSelected ? 'Clear Selection' : 'Select All'}
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
            {selectedIds.length} selected
          </span>
        </div>
        {!campaigns.length ? <p style={{ margin: 0, color: 'var(--muted)' }}>{emptyText}</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 56 }}>
                  <input type="checkbox" checked={allSelected} onChange={onToggleSelectAll} />
                </th>
                <th style={{ width: 72 }}>Sr. No.</th>
                <th>Name</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Stats</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, idx) => {
                const total = c.stats?.total || 0;
                const sent = c.stats?.sent || 0;
                const percent = total ? Math.round((sent / total) * 100) : 0;
                const timeLabel = getCampaignTimeLabel(c);
                const isChecked = selectedIds.includes(c._id);
                return (
                  <tr key={c._id}>
                    <td>
                      <input type="checkbox" checked={isChecked} onChange={() => onToggleSelect(c._id)} />
                    </td>
                    <td>{idx + 1}</td>
                    <td>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <span>{c.name}</span>
                        {timeLabel ? (
                          <small style={{ color: timeLabel.color, fontWeight: timeLabel.strong ? 700 : 500 }}>
                            {timeLabel.text}
                          </small>
                        ) : null}
                      </div>
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <div className="progress"><div style={{ width: `${percent}%` }} /></div>
                      <small>{percent}%</small>
                    </td>
                    <td>{sent}/{total} sent, {c.stats?.failed || 0} failed</td>
                    <td className="row">
                      <button className="button" onClick={() => onStart(c._id)}>Start</button>
                      <button className="button warn" onClick={() => onPause(c._id)}>Pause</button>
                      <button className="button danger" onClick={() => onStop(c._id)}>Stop</button>
                      <button className="button secondary" onClick={() => onResume(c._id)}>Resume</button>
                      <button className="button danger" onClick={() => onDelete(c._id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {showHistoryButton ? (
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="button secondary" type="button" onClick={onToggleHistory}>
              {showHistory ? 'Hide History' : 'History'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default React.memo(CampaignTable);
