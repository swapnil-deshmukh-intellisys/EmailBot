import React from 'react';
import DailyTimelinePlanningCenter from './DailyTimelinePlanningCenter';

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
  workspaceOverviewItems,
  openAnchoredPopup,
  setShowLogsPopup,
  onShowMessage
}) {
  const visibleTimelineCards = inlineTimelineCards.slice(0, 3);

  return (
    <div className="dashboard-bottom-grid">
      <DailyTimelinePlanningCenter onShowMessage={onShowMessage} />

      <div className="dashboard-bottom-stack">
        <section className="panel activity-timeline-card">
          <div className="activity-header">
            <div>
              <div className="activity-eyebrow">Activity Timeline</div>
              <div className="activity-title-row">
                <span className="activity-count">{inlineTimelineCards.length}</span>
                <span>campaign activities</span>
              </div>
            </div>
            <div className="activity-header-actions">
              <button type="button" className="section-link" onClick={() => setShowTimelinePopup(true)}>
                See All <i className="ti ti-arrow-right"></i>
              </button>
            </div>
          </div>
          <div className="activity-desc">
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

        <section className="panel workspace-overview-card">
          <div className="section-header workspace-overview-head">
            <span className="section-title">Workspace Overview</span>
            <button type="button" className="section-link" onClick={(event) => openAnchoredPopup('logs', setShowLogsPopup)(event)}>
              See All <i className="ti ti-arrow-right"></i>
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
        </section>
      </div>
    </div>
  );
}
