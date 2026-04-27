import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import { createActivityLog } from '@/lib/ActivityLogService';
import { getDefaultUserPassword, hashPassword } from '@/lib/auth';
import UserProfile from '@/models/UserProfile';

export async function PATCH(req, { params }) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const user = await UserProfile.findById(params.id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  user.passwordHash = await hashPassword(getDefaultUserPassword());
  user.mustChangePassword = true;
  user.isFirstLogin = true;
  user.passwordChangedAt = null;
  user.resetPasswordTokenHash = '';
  user.resetPasswordTokenExpiresAt = null;
  await user.save();

  await createActivityLog({
    user: auth.currentUser,
    targetUser: user,
    action: 'admin.user.reset_password',
    entityType: 'user',
    entityId: String(user._id)
  });

  return NextResponse.json({
    ok: true,
    message: 'Password reset to default password.',
    password: process.env.NODE_ENV === 'development' ? getDefaultUserPassword() : undefined
  });
}
