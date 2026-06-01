'use client';

import AppLayout from '../../layout-components/SharedAppLayoutShell';

export default function DashboardPlaceholderShell({ children = null }) {
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}
