import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';
import { createActivityLog } from '@/lib/ActivityLogService';
import { hashPassword, hashResetToken, validatePasswordStrength } from '@/lib/auth';
import UserProfile from '@/models/UserProfile';

export async function POST(req) {
  try {
    const body = await req.json();
    const token = String(body.token || '');
    const newPassword = String(body.newPassword || '');
    const confirmPassword = String(body.confirmPassword || '');

    if (!token) {
      return NextResponse.json({ error: 'Reset token is required.' }, { status: 400 });
    }
    if (!newPassword || newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New password and confirm password must match.' }, { status: 400 });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return NextResponse.json({ error: strengthError }, { status: 400 });
    }

    await connectDB();
    const tokenHash = hashResetToken(token);
    const profile = await UserProfile.findOne({
      resetPasswordTokenHash: tokenHash,
      resetPasswordTokenExpiresAt: { $gt: new Date() }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Reset link is invalid or expired.' }, { status: 400 });
    }

    profile.passwordHash = await hashPassword(newPassword);
    profile.mustChangePassword = false;
    profile.isFirstLogin = false;
    profile.passwordChangedAt = new Date();
    profile.resetPasswordTokenHash = '';
    profile.resetPasswordTokenExpiresAt = null;
    await profile.save();

    await createActivityLog({
      user: profile,
      action: 'auth.reset_password',
      entityType: 'user',
      entityId: String(profile._id)
    });

    return NextResponse.json({ ok: true, message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to reset password' }, { status: 400 });
  }
}
