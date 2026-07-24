export const SIDEBAR_PRIMARY_ITEMS = [
  { label: 'Dashboard', href: '/dashboard/user', tone: 'primary', icon: 'DB', iconClassName: 'ti ti-home' },
  { label: 'Campaigns', href: '/campaigns', icon: 'CP', iconClassName: 'ti ti-send' },
  { label: 'Drafts', href: '/drafts', icon: 'DR', iconClassName: 'ti ti-file-text' },
  { label: 'Client Data', href: '/client-data', icon: 'CD', iconClassName: 'ti ti-users' },
  { label: 'Sender IDs', href: '/sender-emails', icon: 'SI', iconClassName: 'ti ti-user-circle' },
  { label: 'Warm-up', href: '/warm-up', icon: 'WU', iconClassName: 'ti ti-flame' },
  { label: 'Master Inbox', href: '/mail-inbox', icon: 'MI', iconClassName: 'ti ti-mail' },
  { label: 'Templates', href: '/draft-templates', icon: 'TP', iconClassName: 'ti ti-template' }
];

export const SIDEBAR_WORKSPACE_ITEMS = [
  { label: 'All Broadcast Performance', href: '/dashboard/broadcasts', icon: 'AB', iconClassName: 'ti ti-broadcast' },
  { label: 'Reports & Analytics', href: '/report', icon: 'RA', iconClassName: 'ti ti-chart-line' },
  { label: 'Delivery Logs', href: '/dashboard/user?view=logs', icon: 'DL', iconClassName: 'ti ti-clipboard-list' },
  { label: 'Sales Action Center', href: '/dashboard/user?view=sales', icon: 'SA', iconClassName: 'ti ti-target-arrow' },
  { label: 'Daily Work Report', href: '/dashboard/user?view=work-report', icon: 'DW', iconClassName: 'ti ti-calendar-stats' },
  { label: 'To-Do List', href: '/dashboard/user?view=todo', icon: 'TD', iconClassName: 'ti ti-list-check' },
  { label: 'Activity Timeline', href: '/dashboard/user?view=timeline', icon: 'AT', iconClassName: 'ti ti-timeline' },
  { label: 'Daily Timeline & Planning', href: '/dashboard/user?view=planning', icon: 'DP', iconClassName: 'ti ti-calendar-time' },
  { label: 'Profile & Settings', href: '/dashboard/user/profile/settings', icon: 'PS', iconClassName: 'ti ti-user-cog' },
  { label: 'Team & Users', href: '/dashboard/user/profile/team', icon: 'TU', iconClassName: 'ti ti-users-group' },
  { label: 'Billing & Credits', href: '/dashboard/user/profile/billing', icon: 'BC', iconClassName: 'ti ti-credit-card' },
  { label: 'Integrations', href: '/dashboard/user/profile/integrations', icon: 'IN', iconClassName: 'ti ti-plug' }
];

export const TOP_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard/user' },
  { label: 'Client Data', href: '/client-data' },
  { label: 'Drafts', href: '/drafts' },
  { label: 'Campaigns', href: '/campaigns' }
];
