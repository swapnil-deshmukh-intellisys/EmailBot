import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import { createActivityLog } from '@/lib/ActivityLogService';
import { USER_ACCOUNT_STATUSES } from '@/lib/auth';
import SignupRequest from '@/models/SignupRequest';
import UserProfile from '@/models/UserProfile';

const ALLOWED_STATUSES = new Set([
  USER_ACCOUNT_STATUSES.PENDING,
  USER_ACCOUNT_STATUSES.ACTIVE,
  USER_ACCOUNT_STATUSES.BLOCKED,
  USER_ACCOUNT_STATUSES.REJECTED,
  USER_ACCOUNT_STATUSES.INACTIVE
]);

export async function PATCH(req, { params }) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const body = await req.json();
  const status = String(body.status || '').trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const user = await UserProfile.findById(params.id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  user.status = status;
  user.approvedBy = status === USER_ACCOUNT_STATUSES.ACTIVE ? auth.currentUser.identifier : user.approvedBy || '';
  user.approvedAt = status === USER_ACCOUNT_STATUSES.ACTIVE ? new Date() : user.approvedAt || null;
  await user.save();

  await SignupRequest.updateMany(
    { $or: [{ identifier: user.identifier }, { email: user.email || user.identifier }] },
    {
      $set: {
        status:
          status === USER_ACCOUNT_STATUSES.ACTIVE
            ? 'approved'
            : status === USER_ACCOUNT_STATUSES.REJECTED
              ? 'rejected'
              : status === USER_ACCOUNT_STATUSES.BLOCKED
                ? 'blocked'
                : 'pending',
        reviewedBy: auth.currentUser.identifier,
        reviewedAt: new Date()
      }
    }
  );

  await createActivityLog({
    user: auth.currentUser,
    targetUser: user,
    action: 'admin.user.status_update',
    entityType: 'user',
    entityId: String(user._id),
    meta: { status }
  });

  return NextResponse.json({ ok: true, status });
}
