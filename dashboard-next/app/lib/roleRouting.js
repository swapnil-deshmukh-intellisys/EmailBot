export const DASHBOARD_ROLES = {
  USER: 'user',
  MANAGER: 'manager',
  ADMIN: 'admin'
};

export const ROLE_DASHBOARD_PATHS = {
  [DASHBOARD_ROLES.USER]: '/user/dashboard',
  [DASHBOARD_ROLES.MANAGER]: '/dashboard/manager',
  [DASHBOARD_ROLES.ADMIN]: '/admin/dashboard'
};

export function normalizeRole(role = '') {
  const normalized = String(role || '').trim().toLowerCase();
  if (Object.values(DASHBOARD_ROLES).includes(normalized)) return normalized;
  return DASHBOARD_ROLES.USER;
}

export function getDashboardPathForRole(role = '') {
  return ROLE_DASHBOARD_PATHS[normalizeRole(role)] || ROLE_DASHBOARD_PATHS[DASHBOARD_ROLES.USER];
}

export function getRoleFromPath(pathname = '') {
  if (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/user') ||
    pathname.startsWith('/user/dashboard')
  ) return DASHBOARD_ROLES.USER;
  if (pathname.startsWith('/dashboard/manager')) return DASHBOARD_ROLES.MANAGER;
  if (pathname.startsWith('/dashboard/admin') || pathname.startsWith('/admin/dashboard')) return DASHBOARD_ROLES.ADMIN;
  return '';
}
