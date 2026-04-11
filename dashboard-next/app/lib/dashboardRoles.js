import bcrypt from 'bcryptjs';

export const DASHBOARD_ROLES = {
  USER: 'user',
  MANAGER: 'manager',
  ADMIN: 'admin'
};

export const ROLE_LABELS = {
  [DASHBOARD_ROLES.USER]: 'User',
  [DASHBOARD_ROLES.MANAGER]: 'Manager',
  [DASHBOARD_ROLES.ADMIN]: 'Admin'
};

export const ROLE_DASHBOARD_PATHS = {
  [DASHBOARD_ROLES.USER]: '/dashboard/user',
  [DASHBOARD_ROLES.MANAGER]: '/dashboard/manager',
  [DASHBOARD_ROLES.ADMIN]: '/dashboard/admin'
};

export const TEMP_LOGIN_ACCOUNTS = [
  { identifier: 'emp001', password: 'emp001', role: DASHBOARD_ROLES.USER, label: 'Employee 001' },
  { identifier: 'emp002', password: 'emp002', role: DASHBOARD_ROLES.USER, label: 'Employee 002' },
  { identifier: 'mgr001', password: 'mgr001', role: DASHBOARD_ROLES.MANAGER, label: 'Manager 001' },
  { identifier: 'mgr002', password: 'mgr002', role: DASHBOARD_ROLES.MANAGER, label: 'Manager 002' },
  { identifier: 'admin001', password: 'admin001', role: DASHBOARD_ROLES.ADMIN, label: 'Admin 001' }
];

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

function normalize(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isEmailLike(value = '') {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalize(value));
}

export function normalizeRole(role = '') {
  const normalized = normalize(role);
  if (Object.values(DASHBOARD_ROLES).includes(normalized)) return normalized;
  return DASHBOARD_ROLES.USER;
}

export function getDashboardPathForRole(role = '') {
  return ROLE_DASHBOARD_PATHS[normalizeRole(role)] || ROLE_DASHBOARD_PATHS[DASHBOARD_ROLES.USER];
}

export function getRoleNavigation(role = '') {
  return ROLE_NAVIGATION[normalizeRole(role)] || ROLE_NAVIGATION[DASHBOARD_ROLES.USER];
}

export function getRoleFromLoginIdentifier(identifier = '') {
  const normalized = normalize(identifier);
  const temp = TEMP_LOGIN_ACCOUNTS.find((item) => item.identifier === normalized);
  if (temp) return temp.role;

  const adminEmail = normalize(process.env.ADMIN_EMAIL || '');
  const managerEmail = normalize(process.env.MANAGER_EMAIL || '');
  const userEmail = normalize(process.env.USER_EMAIL || '');

  if (normalized && isEmailLike(normalized)) {
    if (normalized === adminEmail) return DASHBOARD_ROLES.ADMIN;
    if (normalized === managerEmail) return DASHBOARD_ROLES.MANAGER;
    if (normalized === userEmail) return DASHBOARD_ROLES.USER;
  }

  return '';
}

export function verifyLoginCredentials(identifier = '', password = '') {
  const normalizedIdentifier = normalize(identifier);
  const temp = TEMP_LOGIN_ACCOUNTS.find((item) => item.identifier === normalizedIdentifier);
  if (temp) {
    return temp.password === normalize(password)
      ? { role: temp.role, identifier: temp.identifier, source: 'temp' }
      : null;
  }

  const adminEmail = normalize(process.env.ADMIN_EMAIL || '');
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '');
  const managerEmail = normalize(process.env.MANAGER_EMAIL || '');
  const managerPassword = String(process.env.MANAGER_PASSWORD || '');
  const managerPasswordHash = String(process.env.MANAGER_PASSWORD_HASH || '');
  const userEmail = normalize(process.env.USER_EMAIL || '');
  const userPassword = String(process.env.USER_PASSWORD || '');
  const userPasswordHash = String(process.env.USER_PASSWORD_HASH || '');

  if (normalizedIdentifier === adminEmail) {
    if (adminPassword && String(password || '') === adminPassword) {
      return { role: DASHBOARD_ROLES.ADMIN, identifier: normalizedIdentifier, source: 'env' };
    }
    if (adminPasswordHash && bcrypt.compareSync(String(password || ''), adminPasswordHash)) {
      return { role: DASHBOARD_ROLES.ADMIN, identifier: normalizedIdentifier, source: 'hash' };
    }
    return null;
  }
  if (normalizedIdentifier === managerEmail) {
    if (managerPassword && String(password || '') === managerPassword) {
      return { role: DASHBOARD_ROLES.MANAGER, identifier: normalizedIdentifier, source: 'env' };
    }
    if (managerPasswordHash && bcrypt.compareSync(String(password || ''), managerPasswordHash)) {
      return { role: DASHBOARD_ROLES.MANAGER, identifier: normalizedIdentifier, source: 'hash' };
    }
    return null;
  }
  if (normalizedIdentifier === userEmail) {
    if (userPassword && String(password || '') === userPassword) {
      return { role: DASHBOARD_ROLES.USER, identifier: normalizedIdentifier, source: 'env' };
    }
    if (userPasswordHash && bcrypt.compareSync(String(password || ''), userPasswordHash)) {
      return { role: DASHBOARD_ROLES.USER, identifier: normalizedIdentifier, source: 'hash' };
    }
    return null;
  }

  return null;
}

