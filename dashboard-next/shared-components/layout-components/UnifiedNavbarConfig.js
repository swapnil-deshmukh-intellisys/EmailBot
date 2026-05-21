export const UNIFIED_NAVBAR_ITEMS = [
  { label: 'Dashboard', href: '/dashboard/user' },
  { label: 'Client Data', href: '/client-data' },
  { label: 'Drafts', href: '/drafts' },
  { label: 'Campaigns', href: '/campaigns' },
  { label: 'Mailbox', href: '/mail-inbox' },
  { label: 'Notifications', href: '/dashboard/user/profile#notifications' }
];

export const UNIFIED_NAVBAR_TOPBAR_PROPS = {
  showTabs: true,
  title: '',
  subtitle: '',
  tabs: UNIFIED_NAVBAR_ITEMS
};
