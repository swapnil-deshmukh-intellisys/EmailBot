import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import { getAuthCookieName, getAuthCookieOptions, normalizeUserEmail, signAuthToken } from '@/lib/auth';
import {
  DASHBOARD_ROLES,
  getDashboardPathForRole,
  isStrongEnoughPassword,
  isValidLoginIdentifier,
  verifyLoginCredentials
} from '@/app/lib/dashboardRoles';
import UserProfile from '@/models/UserProfile';

function displayNameFromLoginId(identifier = '') {
  const normalized = String(identifier || '').trim().toLowerCase();
  const tempLabels = {
    emp001: 'Employee 001',
    emp002: 'Employee 002',
    mgr001: 'Manager 001',
    mgr002: 'Manager 002',
    admin001: 'Admin 001'
  };

  if (tempLabels[normalized]) return tempLabels[normalized];

  const localPart = normalized.split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!localPart) return 'Profile';
  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function POST(req) {
  try {
    const { identifier, email, password } = await req.json();
    const loginId = normalizeUserEmail(identifier || email || '');

    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'JWT_SECRET is not configured' }, { status: 500 });
    }
    if (!loginId) {
      return NextResponse.json({ error: 'Login ID is required' }, { status: 400 });
    }
    if (!isValidLoginIdentifier(loginId)) {
      return NextResponse.json({ error: 'Unknown login ID' }, { status: 400 });
    }
    if (!isStrongEnoughPassword(password)) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    await connectDB();
    const savedProfile = await UserProfile.findOne({ identifier: loginId }).lean();
    let resolved = null;

    if (savedProfile?.passwordHash) {
      const ok = bcrypt.compareSync(String(password || ''), savedProfile.passwordHash);
      if (ok) {
        resolved = {
          role: savedProfile.role || DASHBOARD_ROLES.USER,
          identifier: loginId,
          source: 'profile'
        };
      }
    }

    if (!resolved) {
      resolved = verifyLoginCredentials(loginId, password);
    }

    if (!resolved) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const role = resolved.role || DASHBOARD_ROLES.USER;
    const dashboardPath = getDashboardPathForRole(role);
    await UserProfile.findOneAndUpdate(
      { identifier: loginId },
      {
        $setOnInsert: {
          identifier: loginId,
          role,
          displayName: displayNameFromLoginId(loginId),
          notificationPrefs: {
            campaignUpdates: true,
            replyAlerts: true,
            weeklyReports: true
          }
        }
      },
      { upsert: true, new: true }
    );
    const token = signAuthToken({
      email: loginId,
      role,
      dashboardPath
    });
    const res = NextResponse.json({ ok: true, email: loginId, role, dashboardPath });
    res.cookies.set(getAuthCookieName(), token, getAuthCookieOptions());
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
