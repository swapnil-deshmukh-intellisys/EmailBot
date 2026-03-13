import { NextResponse } from 'next/server';

const COOKIE_NAME = 'auth_token';

export function middleware(req) {
  const { pathname } = req.nextUrl;

  const publicPaths = ['/login', '/api/auth/login', '/api/graph-oauth/start', '/api/graph-oauth/callback'];
  const isPublic = publicPaths.includes(pathname) || pathname.startsWith('/_next') || pathname.includes('.');
  if (isPublic) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = Boolean(token);

  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
};
