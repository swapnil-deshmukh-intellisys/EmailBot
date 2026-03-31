'use client';

import { useState } from 'react';
import AppLayout from './layout/AppLayout';
import Input from './ui/Input';

export default function DashboardPlaceholderShell({ children = null }) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <AppLayout
      topbarActions={(
        <div className={`dashboard-topbar-search dashboard-sidebar-search ${searchQuery ? 'active' : ''}`}>
          <span className="dashboard-topbar-search-icon">⌕</span>
          <Input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Search"
            placeholder="Search"
          />
        </div>
      )}
    >
      {children}
    </AppLayout>
  );
}
