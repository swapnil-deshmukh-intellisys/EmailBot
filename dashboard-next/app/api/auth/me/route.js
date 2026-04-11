import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuthCookieName, verifyAuthToken } from '@/lib/auth';
import { getDashboardPathForRole } from '@/app/lib/roleRouting';
import UserProfile from '@/models/UserProfile';

export async function GET(req) {
  const token = req.cookies.get(getAuthCookieName())?.value;
  const session = token ? verifyAuthToken(token) : null;

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  await connectDB();
  const profile = await UserProfile.findOne({ identifier: String(session.email || '').toLowerCase() }).lean();

  return NextResponse.json({
    authenticated: true,
    user: session,
    dashboardPath: getDashboardPathForRole(session.role),
    profile: profile || null
  });
}
