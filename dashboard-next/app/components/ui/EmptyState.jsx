'use client';

import { cn } from '../../lib/utils';

export function EmptyState({
  className = '',
  icon = null,
  title = 'No data available',
  description = 'There is nothing to display here yet.',
  action = null,
  children = null,
  compact = false
}) {
  return (
    <div className={cn('ui-empty-state', compact ? 'compact' : '', className)}>
      {icon ? <div className="ui-empty-state-icon">{icon}</div> : null}
      <div className="ui-empty-state-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children ? <div className="ui-empty-state-children">{children}</div> : null}
      {action ? <div className="ui-empty-state-action">{action}</div> : null}
    </div>
  );
}

export default EmptyState;
