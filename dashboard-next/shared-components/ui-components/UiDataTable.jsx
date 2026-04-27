'use client';

import { cn } from '@/app/lib/UiClassNameUtility';
import { EmptyState } from './UiEmptyStatePanel';
import { Spinner } from './UiLoadingSpinner';

export function TableWrapper({
  className = '',
  children,
  empty = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There is no data to display right now.',
  emptyAction = null,
  loading = false,
  loadingLabel = 'Loading...'
}) {
  if (loading) {
    return (
      <div className={cn('ui-table-shell', className)}>
        <div className="ui-table-loading">
          <Spinner size="md" label={loadingLabel} />
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={cn('ui-table-shell', className)}>
        <EmptyState
          compact
          className="ui-table-empty-state"
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className={cn('ui-table-shell', className)}>
      <div className="ui-table-scroll">{children}</div>
    </div>
  );
}

export function Table({ className = '', children, ...props }) {
  return (
    <table className={cn('ui-table', className)} {...props}>
      {children}
    </table>
  );
}

export function TableHeader({ className = '', children, ...props }) {
  return (
    <thead className={cn('ui-table-header', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className = '', children, ...props }) {
  return (
    <tbody className={cn('ui-table-body', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className = '', children, clickable = false, ...props }) {
  return (
    <tr className={cn('ui-table-row', clickable ? 'is-clickable' : '', className)} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ className = '', children, align = 'left', ...props }) {
  return (
    <th className={cn('ui-table-head', `is-${align}`, className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className = '', children, align = 'left', muted = false, ...props }) {
  return (
    <td className={cn('ui-table-cell', `is-${align}`, muted ? 'is-muted' : '', className)} {...props}>
      {children}
    </td>
  );
}

export function TableEmpty({ className = '', children = 'No data available.' }) {
  return (
    <div className={cn('ui-table-empty', className)}>
      {children}
    </div>
  );
}
