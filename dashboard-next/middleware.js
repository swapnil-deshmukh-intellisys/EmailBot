import { NextResponse } from 'next/server';
import { DASHBOARD_ROLES, getDashboardPathForRole, getRoleFromPath } from './app/lib/roleRouting';

const COOKIE_NAME = 'auth_token';
function shouldBypassAuthInDev() {
  const raw = String(process.env.DEV_BYPASS_AUTH || '').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return process.env.NODE_ENV !== 'production';
}

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
  const bypassAuth = shouldBypassAuthInDev();

  const publicPaths = [
    '/login',
    '/request-access',
    '/change-password',
    '/forgot-password',
    '/reset-password',
    '/unauthorized',
    '/account/pending',
    '/account/disabled',
    '/api/auth/login',
    '/api/auth/request-access',
    '/api/graph-oauth/start',
    '/api/graph-oauth/callback'
  ];
  const isPublic = publicPaths.includes(pathname) || pathname.startsWith('/_next') || pathname.includes('.');
  if (isPublic) {
    if (pathname === '/login') {
      const token = req.cookies.get(COOKIE_NAME)?.value;
      const session = token ? decodeJwtPayload(token) : null;
      if (session?.role) {
        const nextPath = session?.mustChangePassword ? '/change-password' : getDashboardPathForRole(session.role);
        return NextResponse.redirect(new URL(nextPath, req.url));
      }
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? decodeJwtPayload(token) : null;

  if (!session && !bypassAuth) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session?.mustChangePassword && !pathname.startsWith('/api/auth/change-password') && pathname !== '/change-password') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'You must change your password before continuing.' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/change-password', req.url));
  }

  const requiredRole = getRoleFromPath(pathname);
  const sessionRole = String(session?.role || '').toLowerCase();
  const sessionPath = String(session?.dashboardPath || '');
  const roleMatches = sessionRole === requiredRole;
  const pathMatches = requiredRole ? getRoleFromPath(sessionPath) === requiredRole : true;

  if (requiredRole && !roleMatches && !pathMatches) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/user/:path*', '/login', '/unauthorized', '/api/:path*']
};
