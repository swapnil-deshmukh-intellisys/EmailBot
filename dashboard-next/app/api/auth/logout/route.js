import { NextResponse } from 'next/server';
import { getAuthCookieName, getAuthCookieOptions } from '../../../../lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(getAuthCookieName(), '', { ...getAuthCookieOptions(0), maxAge: 0 });
  return res;
}
