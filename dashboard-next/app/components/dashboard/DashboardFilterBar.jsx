'use client';

import { Button, Input, Select } from '@/app/components/ui/UiComponentExports';

export function DashboardFilterBar({
  range = '',
  onRangeChange = () => {},
  searchValue = '',
  onSearchChange = () => {},
  actions = null
}) {
  return (
    <div className="dashboard-filter-bar">
      <div className="dashboard-filter-bar-main">
        <div className="dashboard-filter-bar-search">
          <Input value={searchValue} onChange={onSearchChange} placeholder="Search dashboard..." />
        </div>
        <div className="dashboard-filter-bar-range">
          <Select value={range} onChange={(event) => onRangeChange(event.target.value)}>
            <option value="">Select range</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </Select>
        </div>
      </div>
      <div className="dashboard-filter-bar-actions">
        {actions || <Button variant="secondary">Export</Button>}
      </div>
    </div>
  );
}
