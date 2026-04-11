export const USER_SUMMARY = [
  { label: 'My Campaigns', value: '12', tone: 'blue' },
  { label: 'My Tasks', value: '4', tone: 'green' },
  { label: 'My Reports', value: '8', tone: 'violet' }
];

export const MANAGER_SUMMARY = [
  { label: 'Team Members', value: '18', tone: 'blue' },
  { label: 'Active Tasks', value: '27', tone: 'green' },
  { label: 'Open Alerts', value: '3', tone: 'amber' }
];

export const ADMIN_SUMMARY = [
  { label: 'Campaigns', value: '24', tone: 'blue' },
  { label: 'Users', value: '48', tone: 'green' },
  { label: 'Managers', value: '6', tone: 'violet' }
];

export const MANAGER_EMPLOYEES = [
  { id: 'EMP-001', name: 'Priyanka Wp', status: 'Active', activity: 'Campaign resumed', score: '92%' },
  { id: 'EMP-002', name: 'Adesh Wu', status: 'Active', activity: 'Draft updated', score: '88%' },
  { id: 'EMP-003', name: 'Vaishnav Sir', status: 'Pending', activity: 'Waiting review', score: '76%' }
];

export const ADMIN_MANAGERS = [
  { id: 'MGR-001', name: 'Team North', employees: 12, status: 'Healthy', access: 'Standard' },
  { id: 'MGR-002', name: 'Team South', employees: 9, status: 'Warning', access: 'Limited' },
  { id: 'MGR-003', name: 'Team East', employees: 16, status: 'Healthy', access: 'Standard' }
];

export const ADMIN_USERS = [
  { id: 'USR-001', name: 'Priyanka Wp', role: 'User', lastActive: '10 mins ago', status: 'Active', campaigns: 4 },
  { id: 'USR-002', name: 'Adesh Wu', role: 'User', lastActive: '1 hour ago', status: 'Active', campaigns: 3 },
  { id: 'USR-003', name: 'Vaishnav Sir', role: 'User', lastActive: 'Today', status: 'Pending', campaigns: 2 },
  { id: 'USR-004', name: 'Sonal Roy', role: 'User', lastActive: 'Today', status: 'Active', campaigns: 5 }
];

export const ADMIN_CAMPAIGNS = [
  { id: 'CMP-001', name: 'priyanka-wp', owner: 'Priyanka Wp', status: 'Completed', updated: '09/04/2026', progress: '100%' },
  { id: 'CMP-002', name: 'Adesh-wu', owner: 'Adesh Wu', status: 'Running', updated: '09/04/2026', progress: '72%' },
  { id: 'CMP-003', name: 'Vaishnav sir', owner: 'Vaishnav Sir', status: 'Draft', updated: '08/04/2026', progress: '18%' },
  { id: 'CMP-004', name: 'Sonal-roy', owner: 'Sonal Roy', status: 'Paused', updated: '07/04/2026', progress: '46%' }
];
