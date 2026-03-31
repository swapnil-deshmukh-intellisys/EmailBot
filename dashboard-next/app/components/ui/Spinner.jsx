'use client';

import { cn } from '../../lib/utils';

export function Spinner({
  className = '',
  size = 'md',
  label = '',
  center = false
}) {
  const classes = cn('ui-spinner', `ui-spinner-${size}`, className);
  const content = (
    <div className={classes} role="status" aria-label={label || 'Loading'}>
      <span className="ui-spinner-dot" aria-hidden="true" />
      {label ? <span className="ui-spinner-label">{label}</span> : null}
    </div>
  );

  if (center) {
    return <div className="ui-spinner-center">{content}</div>;
  }

  return content;
}

export default Spinner;
