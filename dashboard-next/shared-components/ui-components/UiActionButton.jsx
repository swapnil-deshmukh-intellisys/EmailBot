'use client';

import React from 'react';
import { cn } from '@/app/lib/UiClassNameUtility';
import { Spinner } from './UiLoadingSpinner';

const variantClasses = {
  primary: 'ui-button-primary',
  secondary: 'ui-button-secondary',
  ghost: 'ui-button-ghost',
  danger: 'ui-button-danger',
  icon: 'ui-button-ghost ui-button-icon-only'
};

const sizeClasses = {
  sm: 'ui-button-sm',
  md: 'ui-button-md',
  lg: 'ui-button-lg',
  icon: 'ui-button-icon-size'
};

export const Button = React.forwardRef(function Button(
  {
    as: Component = 'button',
    className = '',
    variant = 'primary',
    size = 'md',
    leftIcon = null,
    rightIcon = null,
    loading = false,
    disabled = false,
    fullWidth = false,
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  const isIconOnly = variant === 'icon' || size === 'icon';
  const classes = cn(
    'ui-button',
    variantClasses[variant] || variantClasses.primary,
    sizeClasses[isIconOnly ? 'icon' : size] || sizeClasses.md,
    fullWidth ? 'ui-button-full' : '',
    className
  );
  const content = (
    <>
      {loading ? <Spinner size="sm" label="" className="ui-button-spinner-wrap" /> : leftIcon ? <span className="ui-button-icon">{leftIcon}</span> : null}
      {children ? <span className={cn('ui-button-label', isIconOnly ? 'ui-sr-only' : '')}>{children}</span> : null}
      {!loading && rightIcon ? <span className="ui-button-icon">{rightIcon}</span> : null}
    </>
  );

  if (Component === 'button') {
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={classes}
        {...props}
      >
        {content}
      </button>
    );
  }

  return (
    <Component
      ref={ref}
      className={classes}
      aria-disabled={isDisabled || undefined}
      {...props}
    >
      {content}
    </Component>
  );
});

export default Button;
