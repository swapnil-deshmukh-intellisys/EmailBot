'use client';

import AppLayout from '@/shared-components/layout-components/SharedAppLayoutShell';
import { cn } from '@/app/lib/UiClassNameUtility';
import { getRoleNavigation } from '@/app/lib/roleNavigation';

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
    { label: 'Overview', onClick: () => { window.location.href = '/dashboard/user/profile#overview'; } },
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
      sidebarProps={{
        primaryItems: nav.primaryItems,
        navItems: nav.navItems,
        brand: 'Intelli Mail Pilot',
        brandHref: '/dashboard/user'
      }}
      topbarProps={{
        title: nav.title,
        subtitle: nav.subtitle,
        actions: topbarActions,
        profile: {
          ...(profile || {}),
          actions: profile?.actions || profileActions
        },
        rightContent
      }}
    >
      {children}
    </AppLayout>
  );
}
