import { NextResponse } from 'next/server';
import { getAuthCookieName, verifyAuthToken } from '../../../../lib/auth';

export async function GET(req) {
  const token = req.cookies.get(getAuthCookieName())?.value;
  const session = token ? verifyAuthToken(token) : null;

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user: session });
}
