'use client';

import { cn } from '../../lib/utils';
import PageContainer from './PageContainer';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export function AppLayout({
  children,
  className = '',
  sidebarProps = {},
  topbarProps = {},
  sidebar = null,
  topbar = null,
  topbarActions = null
}) {
  return (
    <main className={cn('dashboard-shell', className)}>
      {sidebar || <Sidebar {...sidebarProps} />}
      <PageContainer>
        {topbar || <Topbar {...topbarProps} actions={topbarProps.actions || topbarActions} />}
        {children}
      </PageContainer>
    </main>
  );
}

export default AppLayout;
