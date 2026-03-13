import { NextResponse } from 'next/server';
import { getAuthCookieName, getAuthCookieOptions, signAuthToken, validateAdminCredentials } from '../../../../lib/auth';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'JWT_SECRET is not configured' }, { status: 500 });
    }

    const ok = await validateAdminCredentials(email, password);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = signAuthToken({ email, role: 'admin' });
    const res = NextResponse.json({ ok: true, email });
    res.cookies.set(getAuthCookieName(), token, getAuthCookieOptions());
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
