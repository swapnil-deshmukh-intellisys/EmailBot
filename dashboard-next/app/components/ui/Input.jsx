'use client';

import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(function Input(
  {
    className = '',
    type = 'text',
    leftIcon = null,
    rightIcon = null,
    error = false,
    disabled = false,
    ...props
  },
  ref
) {
  return (
    <div className={cn('ui-input-field', disabled ? 'is-disabled' : '', className)}>
      {leftIcon ? (
        <span className="ui-input-side ui-input-side-left" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}

      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'ui-input',
          leftIcon ? 'has-left-icon' : '',
          rightIcon ? 'has-right-icon' : '',
          error ? 'has-error' : ''
        )}
        {...props}
      />

      {rightIcon ? (
        <span className="ui-input-side ui-input-side-right" aria-hidden="true">
          {rightIcon}
        </span>
      ) : null}
    </div>
  );
});

export default Input;
