import { NextResponse } from 'next/server';
import { DASHBOARD_ROLES, getDashboardPathForRole, getRoleFromPath } from './app/lib/roleRouting';

const COOKIE_NAME = 'auth_token';

function decodeJwtPayload(token = '') {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4 || 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  const publicPaths = ['/login', '/unauthorized', '/api/auth/login', '/api/graph-oauth/start', '/api/graph-oauth/callback'];
  const isPublic = publicPaths.includes(pathname) || pathname.startsWith('/_next') || pathname.includes('.');
  if (isPublic) {
    if (pathname === '/login') {
      const token = req.cookies.get(COOKIE_NAME)?.value;
      const session = token ? decodeJwtPayload(token) : null;
      if (session?.role) {
        return NextResponse.redirect(new URL(getDashboardPathForRole(session.role), req.url));
      }
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? decodeJwtPayload(token) : null;

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const requiredRole = getRoleFromPath(pathname);
  const sessionRole = String(session.role || '').toLowerCase();
  const sessionPath = String(session.dashboardPath || '');
  const roleMatches = sessionRole === requiredRole;
  const pathMatches = requiredRole ? getRoleFromPath(sessionPath) === requiredRole : true;

  if (requiredRole && !roleMatches && !pathMatches) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/unauthorized', '/api/:path*']
};
