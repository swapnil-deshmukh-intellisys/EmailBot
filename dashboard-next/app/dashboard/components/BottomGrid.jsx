import React from 'react';

function TimelineItem({ item, checked = false, onToggle, onOpen }) {
  const statusText = checked ? 'Completed' : item.status || item.type || 'Pending';
  const normalizedStatus = String(statusText).toLowerCase();
  const statusClass =
    normalizedStatus.includes('complete') || normalizedStatus.includes('done')
      ? 'ab-completed'
      : normalizedStatus.includes('run')
        ? 'ab-running'
        : 'ab-pending';
  const dotClass = statusClass === 'ab-completed' ? 'success' : statusClass === 'ab-running' ? 'pending' : 'failed';

  return (
    <button type="button" className="activity-item" onClick={onOpen}>
      <div className="activity-dot-col">
        <div className={`activity-dot ${dotClass}`}></div>
      </div>
      <div className="activity-text">
        <div className="activity-name">{item.title}</div>
        <div className="activity-meta">{item.time}{item.type ? ` · ${item.type}` : ''}</div>
        <div className="activity-stats">{item.text}</div>
      </div>
      <span className={`activity-status-badge ${statusClass}`}>{statusText}</span>
    </button>
  );
}

export default function BottomGrid({
  inlineTimelineCards,
  timelineDateLabel,
  timelineCompletionMap,
  setTimelineCompletionMap,
  onTimelineTaskStatesChange,
  setSelectedTimelineTask,
  setShowTimelinePopup,
  setShowTimelineAddPopup,
  workspaceOverviewItems,
  openAnchoredPopup,
  setShowLogsPopup
}) {
  const visibleTimelineCards = inlineTimelineCards.slice(0, 3);

  return (
    <div className="dashboard-bottom-grid">
        <section className="panel">
          <div className="activity-header">
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 2 }}>Activity Timeline</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="activity-count">{inlineTimelineCards.length}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>campaign activities</span>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" className="add-task-btn" onClick={() => setShowTimelineAddPopup(true)}>
                <i className="ti ti-plus"></i> Add Task
              </button>
              <button type="button" className="section-link" onClick={() => setShowTimelinePopup(true)}>
                See All <i className="ti ti-arrow-right" style={{ fontSize: 12 }}></i>
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 12 }}>
            Running, pending, paused, completed, failed, and draft campaign actions.
          </div>

          <div className="activity-list">
            {Object.entries(
              visibleTimelineCards.reduce((groups, item, index) => {
                const label = timelineDateLabel(item.date);
                if (!groups[label]) groups[label] = [];
                groups[label].push({ item, index });
                return groups;
              }, {})
            ).map(([label, entries]) => (
              <div key={label}>
                <div className="activity-section-label">{label}</div>
                {entries.map(({ item, index }) => (
                  <TimelineItem
                    key={item.id || `${item.date}-${index}`}
                    item={item}
                    checked={Boolean(timelineCompletionMap[item.id || `${item.date}-${index}`])}
                    onToggle={(checked) => {
                      const key = item.id || `${item.date}-${index}`;
                      setTimelineCompletionMap((current) => {
                        const next = { ...current, [key]: checked };
                        onTimelineTaskStatesChange?.(next);
                        return next;
                      });
                    }}
                    onOpen={() => {
                      setSelectedTimelineTask(item);
                      setShowTimelinePopup(true);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-header" style={{ marginBottom: 14 }}>
            <span className="section-title">Workspace Overview</span>
            <button type="button" className="section-link" onClick={(event) => openAnchoredPopup('logs', setShowLogsPopup)(event)}>
              See All <i className="ti ti-arrow-right" style={{ fontSize: 12 }}></i>
            </button>
          </div>
          <div className="ws-stats">
            {workspaceOverviewItems.map((item) => (
              <article key={item.label} className="ws-stat">
                <div className="ws-stat-label">{item.label}</div>
                <div className="ws-stat-val">{item.value}</div>
                <div className="ws-stat-sub">{item.detail}</div>
              </article>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginTop: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', marginBottom: 10 }}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button type="button" className="btn-ghost" onClick={(event) => openAnchoredPopup('logs', setShowLogsPopup)(event)}>
                <i className="ti ti-upload" aria-hidden="true" /> Upload List
              </button>
              <button type="button" className="btn-ghost" onClick={(event) => openAnchoredPopup('logs', setShowLogsPopup)(event)}>
                <i className="ti ti-speakerphone" aria-hidden="true" /> New Campaign
              </button>
              <button type="button" className="btn-ghost" onClick={(event) => openAnchoredPopup('logs', setShowLogsPopup)(event)}>
                <i className="ti ti-file-plus" aria-hidden="true" /> New Draft
              </button>
              <button type="button" className="btn-ghost" onClick={(event) => openAnchoredPopup('logs', setShowLogsPopup)(event)}>
                <i className="ti ti-chart-bar" aria-hidden="true" /> View Report
              </button>
            </div>
          </div>
        </section>
    </div>
  );
}
