import { NextResponse } from 'next/server';
import { getAuthCookieName, getAuthCookieOptions, isAllowedUserEmail, isAdminUserEmail, normalizeUserEmail, signAuthToken, validateAdminCredentials } from '@/lib/auth';

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    const normalizedEmail = normalizeUserEmail(email);

    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'JWT_SECRET is not configured' }, { status: 500 });
    }
    if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: 'ADMIN_EMAIL is not configured' }, { status: 500 });
    }
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.ADMIN_PASSWORD &&
      !process.env.ADMIN_PASSWORD_HASH
    ) {
      return NextResponse.json({ error: 'ADMIN_PASSWORD or ADMIN_PASSWORD_HASH is not configured' }, { status: 500 });
    }
    if (!isAllowedUserEmail(normalizedEmail)) {
      return NextResponse.json({ error: 'Login blocked: use an Intellisys email pattern (example: user@intellisys.com or name.intellisys@domain.com).' }, { status: 403 });
    }

    const ok = await validateAdminCredentials(normalizedEmail, password);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signAuthToken({ email: normalizedEmail, role: isAdminUserEmail(normalizedEmail) ? 'admin' : 'user' });
    const res = NextResponse.json({ ok: true, email: normalizedEmail });
    res.cookies.set(getAuthCookieName(), token, getAuthCookieOptions());
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
