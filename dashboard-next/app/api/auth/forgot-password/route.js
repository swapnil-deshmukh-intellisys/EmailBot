import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';
import { createActivityLog } from '@/lib/ActivityLogService';
import { createResetToken, normalizeLoginIdentifier } from '@/lib/auth';
import UserProfile from '@/models/UserProfile';

function isEmailResetEnabled() {
  return String(process.env.EMAIL_RESET_ENABLED || '').toLowerCase() === 'true';
}

export async function POST(req) {
  try {
    const body = await req.json();
    const loginId = normalizeLoginIdentifier(body.identifier || body.email || '');
    if (!loginId) {
      return NextResponse.json({ error: 'Intellisys User ID or email is required.' }, { status: 400 });
    }

    await connectDB();
    const profile = await UserProfile.findOne({
      $or: [
        { intellisysUserId: loginId },
        { identifier: loginId },
        { email: loginId },
        { username: loginId },
        { employeeId: loginId }
      ]
    });

    if (!profile) {
      return NextResponse.json({ ok: true, message: 'Please contact admin to reset your password.' });
    }

    if (!isEmailResetEnabled()) {
      await createActivityLog({
        user: profile,
        action: 'auth.forgot_password_requested',
        entityType: 'user',
        entityId: String(profile._id),
        meta: { mode: 'admin_fallback' }
      });
      return NextResponse.json({ ok: true, message: 'Please contact admin to reset your password.' });
    }

    const { rawToken, tokenHash } = createResetToken();
    profile.resetPasswordTokenHash = tokenHash;
    profile.resetPasswordTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await profile.save();

    const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || '').trim();
    const resetUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}` : '';

    await createActivityLog({
      user: profile,
      action: 'auth.forgot_password_requested',
      entityType: 'user',
      entityId: String(profile._id),
      meta: { mode: 'email_link' }
    });

    return NextResponse.json({
      ok: true,
      message: 'Reset link has been sent to your registered email.',
      resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to start password reset' }, { status: 400 });
  }
}
