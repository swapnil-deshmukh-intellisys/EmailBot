'use client';

import { cn } from '@/app/lib/UiClassNameUtility';

const variantClasses = {
  default: 'ui-badge-default',
  neutral: 'ui-badge-neutral',
  success: 'ui-badge-success',
  warning: 'ui-badge-warning',
  danger: 'ui-badge-danger',
  info: 'ui-badge-info'
};

const sizeClasses = {
  sm: 'ui-badge-sm',
  md: 'ui-badge-md'
};

export function Badge({
  className = '',
  variant = 'default',
  size = 'md',
  dot = false,
  children
}) {
  return (
    <span
      className={cn(
        'ui-badge',
        variantClasses[variant] || variantClasses.default,
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      {dot ? <span className={cn('ui-badge-dot', `ui-badge-dot-${variant}`)} /> : null}
      <span className="ui-badge-label">{children}</span>
    </span>
  );
}

export default Badge;
