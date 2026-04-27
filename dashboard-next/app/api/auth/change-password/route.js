import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/apiAuth';
import {
  comparePassword,
  getAuthCookieName,
  getAuthCookieOptions,
  hashPassword,
  signAuthToken,
  validatePasswordStrength,
  buildSessionPayload
} from '@/lib/auth';
import { createActivityLog } from '@/lib/ActivityLogService';
import { getDashboardPathForRole } from '@/app/lib/roleRouting';

export async function POST(req) {
  try {
    const auth = await requireAuth(req, { allowPending: false });
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const confirmPassword = String(body.confirmPassword || '');

    if (!newPassword || newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New password and confirm password must match.' }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    const profile = auth.currentUser;
    const hasCurrentPassword = String(profile.passwordHash || '').trim().length > 0;
    if (hasCurrentPassword) {
      const ok = await comparePassword(currentPassword, profile.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      }
    }

    profile.passwordHash = await hashPassword(newPassword);
    profile.mustChangePassword = false;
    profile.isFirstLogin = false;
    profile.passwordChangedAt = new Date();
    profile.resetPasswordTokenHash = '';
    profile.resetPasswordTokenExpiresAt = null;
    await profile.save();

    const dashboardPath = getDashboardPathForRole(profile.role);
    const token = signAuthToken(buildSessionPayload(profile, dashboardPath));
    const res = NextResponse.json({ ok: true, dashboardPath });
    res.cookies.set(getAuthCookieName(), token, getAuthCookieOptions());

    await createActivityLog({
      user: profile,
      action: 'auth.change_password',
      entityType: 'user',
      entityId: String(profile._id)
    });

    return res;
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to change password' }, { status: 400 });
  }
}
