import { DASHBOARD_ROLES } from './roleRouting';

export const ROLE_NAVIGATION = {
  [DASHBOARD_ROLES.USER]: {
    primaryItems: [
      { label: 'Dashboard', href: '/dashboard/user', tone: 'primary', icon: 'DB' }
    ],
    navItems: [
      { label: 'My Activity', href: '/dashboard/user#activity', icon: 'AC' },
      { label: 'My Reports', href: '/dashboard/user#reports', icon: 'RP' },
      { label: 'Notifications', href: '/dashboard/user#notifications', icon: 'NT' },
      { label: 'Profile', href: '/dashboard/user#profile', icon: 'PR' }
    ],
    title: 'User Dashboard',
    subtitle: 'Personal campaigns, reports, activity, and notifications.'
  },
  [DASHBOARD_ROLES.MANAGER]: {
    primaryItems: [
      { label: 'Dashboard', href: '/dashboard/manager', tone: 'primary', icon: 'DB' }
    ],
    navItems: [
      { label: 'Team Overview', href: '/dashboard/manager#team-overview', icon: 'TO' },
      { label: 'Employees', href: '/dashboard/manager#employees', icon: 'EM' },
      { label: 'Employee History', href: '/dashboard/manager#history', icon: 'EH' },
      { label: 'Team Reports', href: '/dashboard/manager#reports', icon: 'TR' },
      { label: 'Team Activity', href: '/dashboard/manager#activity', icon: 'TA' },
      { label: 'Profile', href: '/dashboard/manager#profile', icon: 'PR' }
    ],
    title: 'Manager Dashboard',
    subtitle: 'Team overview, employee activity, and reporting.'
  },
  [DASHBOARD_ROLES.ADMIN]: {
    primaryItems: [
      { label: 'Dashboard', href: '/dashboard/admin', tone: 'primary', icon: 'DB' }
    ],
    navItems: [
      { label: 'Organization Overview', href: '/dashboard/admin#overview', icon: 'OO' },
      { label: 'Managers', href: '/dashboard/admin#managers', icon: 'MG' },
      { label: 'Employees', href: '/dashboard/admin#employees', icon: 'EM' },
      { label: 'Role Management', href: '/dashboard/admin#roles', icon: 'RM' },
      { label: 'Access Control', href: '/dashboard/admin#access', icon: 'AC' },
      { label: 'Reports', href: '/dashboard/admin#reports', icon: 'RP' },
      { label: 'Activity Logs', href: '/dashboard/admin#activity', icon: 'AL' },
      { label: 'Settings', href: '/dashboard/admin#settings', icon: 'ST' },
      { label: 'Profile', href: '/dashboard/admin#profile', icon: 'PR' }
    ],
    title: 'Admin Dashboard',
    subtitle: 'Global overview, roles, access control, and system settings.'
  }
};

export function getRoleNavigation(role = '') {
  return ROLE_NAVIGATION[String(role || '').trim().toLowerCase()] || ROLE_NAVIGATION[DASHBOARD_ROLES.USER];
}
