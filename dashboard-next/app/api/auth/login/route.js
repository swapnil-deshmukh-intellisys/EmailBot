import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';
import {
  buildSessionPayload,
  comparePassword,
  getConfiguredAdminEmail,
  getConfiguredAdminPassword,
  getDefaultUserPassword,
  getAuthCookieName,
  getAuthCookieOptions,
  getBlockedStatusMessage,
  hashPassword,
  isActiveAccountStatus,
  normalizeLoginIdentifier,
  normalizeUserRole,
  signAuthToken,
  USER_ACCOUNT_STATUSES
} from '@/lib/auth';
import {
  DEFAULT_ADMIN_LOGIN_ID,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_USER_PASSWORD,
  isSeedAdminEmail,
  isSeedUserEmail,
  normalizeLoginType
} from '@/app/lib/authDefaults';
import { createActivityLog } from '@/lib/activityLog';
import UserProfile from '@/models/UserProfile';
import SignupRequest from '@/models/SignupRequest';
import { getDashboardPathForRole } from '@/app/lib/roleRouting';

function displayNameFromLoginId(identifier = '') {
  const normalized = String(identifier || '').trim().toLowerCase();
  const localPart = normalized.split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!localPart) return 'Profile';
  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getAdminBootstrapIdentifier() {
  return normalizeLoginIdentifier(getConfiguredAdminEmail());
}

function isBootstrapAdminLogin(loginId = '') {
  return Boolean(loginId) && loginId === getAdminBootstrapIdentifier();
}

async function resolveBootstrapAdmin(loginId = '', password = '') {
  const adminIdentifier = getAdminBootstrapIdentifier();
  const adminPassword = String(getConfiguredAdminPassword() || '');
  const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '');
  if (!adminIdentifier || loginId !== adminIdentifier) return null;

  let valid = false;
  if (adminPassword && password === adminPassword) {
    valid = true;
  } else if (adminPasswordHash) {
    valid = await comparePassword(String(password || ''), adminPasswordHash);
  }
  if (!valid) return null;

  return UserProfile.findOneAndUpdate(
    { identifier: adminIdentifier },
    {
      $set: {
        identifier: adminIdentifier,
        email: adminIdentifier,
        username: adminIdentifier,
        name: displayNameFromLoginId(adminIdentifier),
        displayName: displayNameFromLoginId(adminIdentifier),
        role: 'admin',
        status: USER_ACCOUNT_STATUSES.ACTIVE,
        passwordHash: adminPassword ? await hashPassword(adminPassword) : undefined,
        mustChangePassword: false,
        isFirstLogin: false,
        createdByAdmin: true,
        approvedBy: adminIdentifier,
        approvedAt: new Date()
      }
    },
    { new: true, upsert: true }
  );
}

export async function POST(req) {
  try {
    const { identifier, email, password, role: selectedRole } = await req.json();
    const loginId = normalizeLoginIdentifier(identifier || email || '');
    const loginType = normalizeLoginType(selectedRole);

    if (!process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'JWT_SECRET is not configured' }, { status: 500 });
    }
    if (!loginId) {
      return NextResponse.json({ error: 'Login ID is required' }, { status: 400 });
    }
    if (!String(password || '').trim()) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (loginType === 'admin') {
      if (!isSeedAdminEmail(loginId)) {
        return NextResponse.json({ error: 'You are not authorized for admin login.' }, { status: 403 });
      }
      if (String(password || '') !== DEFAULT_ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      const dashboardPath = getDashboardPathForRole('admin');
      const token = signAuthToken(
        buildSessionPayload(
          {
            id: 'seed-admin',
            email: DEFAULT_ADMIN_LOGIN_ID,
            identifier: DEFAULT_ADMIN_LOGIN_ID,
            intellisysUserId: DEFAULT_ADMIN_LOGIN_ID,
            role: 'admin',
            status: USER_ACCOUNT_STATUSES.ACTIVE,
            mustChangePassword: false
          },
          dashboardPath
        )
      );

      const res = NextResponse.json({
        ok: true,
        user: {
          id: 'seed-admin',
          email: DEFAULT_ADMIN_LOGIN_ID,
          identifier: DEFAULT_ADMIN_LOGIN_ID,
          intellisysUserId: DEFAULT_ADMIN_LOGIN_ID,
          role: 'admin',
          status: USER_ACCOUNT_STATUSES.ACTIVE,
          mustChangePassword: false
        },
        dashboardPath,
        requiresPasswordChange: false,
        redirectTo: dashboardPath
      });
      res.cookies.set(getAuthCookieName(), token, getAuthCookieOptions());
      return res;
    }

    if (loginType === 'user') {
      if (!isSeedUserEmail(loginId)) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }
      if (String(password || '') !== DEFAULT_USER_PASSWORD) {
        return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
      }

      const dashboardPath = getDashboardPathForRole('user');
      const token = signAuthToken(
        buildSessionPayload(
          {
            id: `seed-user:${loginId}`,
            email: loginId,
            identifier: loginId,
            intellisysUserId: loginId,
            role: 'user',
            status: USER_ACCOUNT_STATUSES.ACTIVE,
            mustChangePassword: false
          },
          dashboardPath
        )
      );

      const res = NextResponse.json({
        ok: true,
        user: {
          id: `seed-user:${loginId}`,
          email: loginId,
          identifier: loginId,
          intellisysUserId: loginId,
          role: 'user',
          status: USER_ACCOUNT_STATUSES.ACTIVE,
          mustChangePassword: false
        },
        dashboardPath,
        requiresPasswordChange: false,
        redirectTo: dashboardPath
      });
      res.cookies.set(getAuthCookieName(), token, getAuthCookieOptions());
      return res;
    }

    await connectDB();

    let profile = await UserProfile.findOne({
      $or: [
        { intellisysUserId: loginId },
        { identifier: loginId },
        { email: loginId },
        { username: loginId },
        { employeeId: loginId }
      ]
    });

    const bootstrapAdmin = await resolveBootstrapAdmin(loginId, password);
    if (bootstrapAdmin) {
      profile = bootstrapAdmin;
    }

    if (!profile) {
      const pendingRequest = await SignupRequest.findOne({
        $or: [{ identifier: loginId }, { email: loginId }],
        status: USER_ACCOUNT_STATUSES.PENDING
      }).lean();
      if (pendingRequest) {
        return NextResponse.json(
          { error: 'Your account is pending admin approval.', status: USER_ACCOUNT_STATUSES.PENDING },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (isBootstrapAdminLogin(loginId) && !bootstrapAdmin && !isActiveAccountStatus(profile.status || '')) {
      return NextResponse.json({ error: 'Invalid Intellisys ID or password.' }, { status: 401 });
    }

    const status = String(profile.status || USER_ACCOUNT_STATUSES.PENDING).toLowerCase();
    if (!isActiveAccountStatus(status)) {
      return NextResponse.json(
        { error: getBlockedStatusMessage(status), status },
        { status: 403 }
      );
    }

    const passwordHash = String(profile.passwordHash || '');
    if (!passwordHash || !(await comparePassword(String(password || ''), passwordHash))) {
      return NextResponse.json({ error: 'Invalid Intellisys ID or password.' }, { status: 401 });
    }

    const resolvedRole = normalizeUserRole(profile.role || 'user');
    const dashboardPath = getDashboardPathForRole(resolvedRole);
    const isUsingDefaultPassword = String(password || '') === getDefaultUserPassword();
    const mustChangePassword = Boolean(profile.mustChangePassword || profile.isFirstLogin || isUsingDefaultPassword);
    profile.lastLoginAt = new Date();
    if (!profile.email) profile.email = loginId;
    if (!profile.username) profile.username = loginId;
    if (!profile.displayName) profile.displayName = profile.name || displayNameFromLoginId(loginId);
    await profile.save();

    const token = signAuthToken(buildSessionPayload({ ...profile.toObject(), mustChangePassword }, dashboardPath));
    const res = NextResponse.json({
      ok: true,
      user: {
        id: String(profile._id),
        intellisysUserId: profile.intellisysUserId || profile.employeeId || profile.identifier,
        identifier: profile.identifier,
        email: profile.email || profile.identifier,
        role: resolvedRole,
        status,
        mustChangePassword
      },
      dashboardPath,
      requiresPasswordChange: mustChangePassword,
      redirectTo: mustChangePassword ? '/change-password' : dashboardPath,
      message: mustChangePassword ? 'You must change your password before continuing.' : ''
    });
    res.cookies.set(getAuthCookieName(), token, getAuthCookieOptions());

    await createActivityLog({
      user: profile,
      action: 'auth.login',
      entityType: 'user',
      entityId: String(profile._id),
      meta: { role: resolvedRole, status }
    });

    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
