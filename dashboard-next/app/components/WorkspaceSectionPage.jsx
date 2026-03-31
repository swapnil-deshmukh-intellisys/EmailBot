'use client';

import DashboardPlaceholderShell from './DashboardPlaceholderShell';
import Button from './ui/Button';

const STATUS_VARIANTS = {
  active: 'info',
  approved: 'success',
  assigned: 'info',
  archived: 'neutral',
  awaiting: 'warning',
  closed: 'neutral',
  contacted: 'info',
  new: 'success',
  paused: 'warning',
  qualified: 'success',
  resolved: 'success',
  review: 'warning',
  scheduled: 'info',
  unread: 'warning'
};

function renderWorkspaceCell(cell) {
  const text = String(cell || '');
  const normalized = text.toLowerCase().trim();
  const badgeVariant = STATUS_VARIANTS[normalized];

  if (badgeVariant) {
    return <span className={`workspace-status-badge workspace-status-${badgeVariant}`}>{text}</span>;
  }

  return <span>{text}</span>;
}

export default function WorkspaceSectionPage({
  section,
  title,
  description,
  primaryAction,
  secondaryAction,
  stats,
  tableTitle,
  tableDescription,
  columns,
  rows,
  sideTitle,
  sideDescription,
  sideItems,
  activityTitle,
  activityDescription,
  activityItems,
  accent = '#f97316'
}) {
  return (
    <DashboardPlaceholderShell>
      <section className="workspace-page" style={{ '--workspace-accent': accent }}>
        <div className="workspace-hero">
          <div>
            <span className="workspace-kicker">{section}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="workspace-hero-actions">
            <Button variant="secondary" className="workspace-secondary">{secondaryAction}</Button>
            <Button className="workspace-primary">{primaryAction}</Button>
          </div>
        </div>

        <div className="workspace-stats">
          {stats.map((card) => (
            <article key={card.label} className="workspace-stat-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>

        <div className="workspace-grid">
          <section className="workspace-panel workspace-panel-large">
            <div className="workspace-panel-head">
              <div>
                <h2>{tableTitle}</h2>
                <p>{tableDescription}</p>
              </div>
              <Button variant="ghost" size="sm">View All</Button>
            </div>

            <div className="workspace-table">
              <div className="workspace-table-head" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                {columns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>
              {rows.map((row, index) => (
                <div key={index} className="workspace-table-row" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
                  {row.map((cell, cellIndex) => (
                    <span key={cellIndex}>{renderWorkspaceCell(cell)}</span>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>{sideTitle}</h2>
                <p>{sideDescription}</p>
              </div>
            </div>
            <div className="workspace-list">
              {sideItems.map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>{activityTitle}</h2>
                <p>{activityDescription}</p>
              </div>
            </div>
            <div className="workspace-activity">
              {activityItems.map((item) => (
                <article key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </DashboardPlaceholderShell>
  );
}
