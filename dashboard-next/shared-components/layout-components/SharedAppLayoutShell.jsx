'use client';

import { useState } from 'react';
import { cn } from '@/app/lib/UiClassNameUtility';
import PageContainer from './SharedPageContainer';
import Sidebar from './SharedSidebarNavigation';
import Topbar from './SharedTopbarNavigation';

export function AppLayout({
  children,
  className = '',
  sidebarProps = {},
  topbarProps = {},
  sidebar = null,
  topbar = null,
  topbarActions = null
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <main className={cn('dashboard-shell', className)}>
      <div
        className={`dashboard-sidebar-backdrop ${mobileSidebarOpen ? 'open' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
      />
      {sidebar || (
        <Sidebar
          {...sidebarProps}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
      )}
      <PageContainer>
        {topbar || (
          <Topbar
            {...topbarProps}
            actions={topbarProps.actions || topbarActions}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          />
        )}
        {children}
      </PageContainer>
    </main>
  );
}

export default AppLayout;
