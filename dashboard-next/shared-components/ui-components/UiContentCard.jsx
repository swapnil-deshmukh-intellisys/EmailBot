'use client';

import React from 'react';
import { cn } from '@/app/lib/UiClassNameUtility';

export const Card = React.forwardRef(function Card(
  { className = '', children, ...props },
  ref
) {
  return (
    <section
      ref={ref}
      className={cn('ui-card', className)}
      {...props}
    >
      {children}
    </section>
  );
});

export const CardHeader = React.forwardRef(function CardHeader(
  { className = '', children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('ui-card-header', className)}
      {...props}
    >
      {children}
    </div>
  );
});

export const CardTitle = React.forwardRef(function CardTitle(
  { className = '', children, ...props },
  ref
) {
    return (
      <h3
        ref={ref}
        className={cn('ui-card-title', className)}
        {...props}
      >
        {children}
      </h3>
    );
});

export const CardDescription = React.forwardRef(function CardDescription(
  { className = '', children, ...props },
  ref
) {
  return (
    <p
      ref={ref}
      className={cn('ui-card-description', className)}
      {...props}
    >
      {children}
    </p>
  );
});

export const CardContent = React.forwardRef(function CardContent(
  { className = '', children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('ui-card-content', className)}
      {...props}
    >
      {children}
    </div>
  );
});

export const CardFooter = React.forwardRef(function CardFooter(
  { className = '', children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn('ui-card-footer', className)}
      {...props}
    >
      {children}
    </div>
  );
});
