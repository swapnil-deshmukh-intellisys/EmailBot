'use client';

import AppLayout from '@/shared-components/layout-components/SharedAppLayoutShell';
import { Sidebar } from '@/shared-components/layout-components/LayoutComponentExports';
import { cn } from '@/app/lib/UiClassNameUtility';
import { getRoleNavigation } from '@/app/lib/roleNavigation';
import Button from '@/shared-components/ui-components/UiActionButton';

export default function RoleDashboardShell({
  role = 'user',
  children,
  className = '',
  topbarActions = null,
  rightContent = null,
  profile = null
}) {
  const nav = getRoleNavigation(role);
  const profileActions = [
    { label: 'Profile', onClick: () => { window.location.href = '/dashboard/user/profile#profile'; } },
    { label: 'Settings', onClick: () => { window.location.href = '/dashboard/user/profile#settings'; } },
    { label: 'Notifications', onClick: () => { window.location.href = '/dashboard/user/profile#notifications'; } },
    { label: 'Billing', onClick: () => { window.location.href = '/dashboard/user/profile#billing'; } },
    { label: 'Security', onClick: () => { window.location.href = '/dashboard/user/profile#security'; } },
    { label: 'Log out', tone: 'danger', onClick: async () => {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = '/login';
    } }
  ];

  return (
    <AppLayout
      className={cn(className)}
      sidebar={
        <Sidebar
          primaryItems={nav.primaryItems}
          navItems={nav.navItems}
          brand="Intelli Mail Pilot"
          brandHref="/dashboard"
        />
      }
      topbarProps={{
        title: nav.title,
        subtitle: nav.subtitle,
        actions: topbarActions,
        profile: {
          ...(profile || {}),
          actions: profile?.actions || profileActions
        },
        rightContent: rightContent || (
          <Button variant="ghost" className="dashboard-topbar-profile">
            <span className="dashboard-topbar-avatar">{role === 'admin' ? 'AD' : role === 'manager' ? 'MG' : 'US'}</span>
            <span>{nav.title}</span>
          </Button>
        )
      }}
    >
      {children}
    </AppLayout>
  );
}
