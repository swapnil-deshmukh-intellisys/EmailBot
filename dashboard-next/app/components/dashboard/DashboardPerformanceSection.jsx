'use client';

import { Button } from '@/app/components/ui/UiComponentExports';
import { DashboardChartCard } from './DashboardChartCard';

const RANGE_OPTIONS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' }
];

export function DashboardPerformanceSection({
  title = 'Performance Overview',
  description = 'Track campaign momentum and delivery trends.',
  range = '30d',
  onRangeChange = () => {},
  loading = false,
  empty = false,
  summaryCards = [],
  children = null,
  actions = null
}) {
  return (
    <div className="dashboard-performance-section">
      <DashboardChartCard
        title={title}
        description={description}
        loading={loading}
        empty={empty}
        actions={actions || (
          <div className="dashboard-performance-actions">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={range === option.value ? 'primary' : 'ghost'}
                onClick={() => onRangeChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
      >
        {children || <div className="dashboard-performance-placeholder">Connect chart content here.</div>}
      </DashboardChartCard>

      {summaryCards.length ? (
        <div className="dashboard-performance-summary">
          {summaryCards.map((item) => (
            <DashboardChartCard
              key={item.title}
              title={item.title}
              description={item.description}
              empty={!item.children}
              emptyTitle={`No ${item.title.toLowerCase()} data`}
            >
              {item.children}
            </DashboardChartCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}
