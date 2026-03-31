'use client';

import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <div className={cn('ui-select-shell', className)}>
      <select ref={ref} className="ui-select" {...props}>
        {children}
      </select>
      <span className="ui-select-icon" aria-hidden="true">v</span>
    </div>
  );
});

export default Select;
