'use client';

import React from 'react';
import { cn } from '../../lib/utils';

export function PageSection({
  title,
  description,
  actions,
  children,
  className = '',
  contentClassName = '',
  compact = false
}) {
  return (
    <section className={cn('ui-page-section', compact ? 'compact' : '', className)}>
      {title || description || actions ? (
        <div className="ui-page-section-header">
          <div className="ui-page-section-copy">
            {title ? <h2 className="ui-page-section-title">{title}</h2> : null}
            {description ? <p className="ui-page-section-description">{description}</p> : null}
          </div>
          {actions ? <div className="ui-page-section-actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn('ui-page-section-content', contentClassName)}>
        {children}
      </div>
    </section>
  );
}

export default PageSection;
