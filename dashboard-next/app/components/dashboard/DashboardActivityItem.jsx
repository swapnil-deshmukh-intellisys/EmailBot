'use client';

import { Badge } from '@/app/components/ui/UiComponentExports';

function getVariant(type) {
  const normalized = String(type || '').toLowerCase();
  if (['success', 'sent', 'completed'].includes(normalized)) return 'success';
  if (['warning', 'pending'].includes(normalized)) return 'warning';
  if (['error', 'failed'].includes(normalized)) return 'danger';
  return 'info';
}

export function DashboardActivityItem({
  item,
  title,
  description,
  time,
  type = 'info',
  icon = null,
  rightContent = null
}) {
  const source = item || {};
  const resolvedTitle = title || source.title;
  const resolvedDescription = description || source.description || source.message;
  const resolvedTime = time || source.time;
  const resolvedType = type || source.type || 'info';
  const resolvedIcon = icon || source.icon || null;

  return (
    <div className="dashboard-activity-item">
      {resolvedIcon ? <div className="dashboard-activity-avatar">{resolvedIcon}</div> : <div className="dashboard-activity-avatar">{source.avatar || 'DB'}</div>}
      <div className="dashboard-activity-copy">
        <strong>{resolvedTitle}</strong>
        {resolvedDescription ? <p>{resolvedDescription}</p> : null}
      </div>
      <div className="dashboard-activity-meta">
        {rightContent || (source.status || resolvedType ? <Badge variant={source.statusVariant || getVariant(source.status || resolvedType)} size="sm">{source.status || resolvedType}</Badge> : null)}
        {resolvedTime ? <span>{resolvedTime}</span> : null}
      </div>
    </div>
  );
}
