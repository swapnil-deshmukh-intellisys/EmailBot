import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import { createActivityLog } from '@/lib/ActivityLogService';
import { getDefaultUserPassword, hashPassword, normalizeLoginIdentifier, normalizeUserRole, USER_ACCOUNT_STATUSES } from '@/lib/auth';
import UserProfile from '@/models/UserProfile';

function buildSearchQuery(search = '') {
  const value = String(search || '').trim();
  if (!value) return {};
  const regex = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return {
    $or: [
      { identifier: regex },
      { email: regex },
      { username: regex },
      { employeeId: regex },
      { displayName: regex },
      { name: regex }
    ]
  };
}

export async function GET(req) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const search = req.nextUrl.searchParams.get('search') || '';
  const users = await UserProfile.find(buildSearchQuery(search))
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json({
    ok: true,
    users: users.map((user) => ({
      id: String(user._id),
      name: user.name || user.displayName || '',
      displayName: user.displayName || '',
      intellisysUserId: user.intellisysUserId || '',
      email: user.email || user.identifier || '',
      username: user.username || '',
      employeeId: user.employeeId || '',
      identifier: user.identifier || '',
      role: normalizeUserRole(user.role || 'user'),
      status: String(user.status || USER_ACCOUNT_STATUSES.PENDING).toLowerCase(),
      mustChangePassword: Boolean(user.mustChangePassword),
      createdByAdmin: Boolean(user.createdByAdmin),
      approvedBy: user.approvedBy || '',
      approvedAt: user.approvedAt || null,
      lastLoginAt: user.lastLoginAt || null,
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null
    }))
  });
}

export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const identifier = normalizeLoginIdentifier(body.identifier || body.email || body.username || body.employeeId || '');
    const intellisysUserId = normalizeLoginIdentifier(body.intellisysUserId || body.employeeId || body.identifier || '');
    const email = normalizeLoginIdentifier(body.email || identifier);
    const username = normalizeLoginIdentifier(body.username || identifier);
    const employeeId = normalizeLoginIdentifier(body.employeeId || '');
    const name = String(body.name || body.displayName || '').trim();
    const role = normalizeUserRole(body.role || 'user');
    const status = String(body.status || USER_ACCOUNT_STATUSES.ACTIVE).toLowerCase();

    if (!identifier) {
      return NextResponse.json({ error: 'Identifier is required.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(getDefaultUserPassword());
    const approved = status === USER_ACCOUNT_STATUSES.ACTIVE;
    const user = await UserProfile.findOneAndUpdate(
      { identifier },
      {
        $set: {
          identifier,
          intellisysUserId,
          email,
          username,
          employeeId,
          name: name || identifier,
          displayName: name || identifier,
          role,
          status,
          passwordHash,
          mustChangePassword: true,
          isFirstLogin: true,
          passwordChangedAt: null,
          createdByAdmin: true,
          approvedBy: approved ? auth.currentUser.identifier : '',
          approvedAt: approved ? new Date() : null
        }
      },
      { new: true, upsert: true }
    );

    await createActivityLog({
      user: auth.currentUser,
      targetUser: user,
      action: 'admin.user.create',
      entityType: 'user',
      entityId: String(user._id),
      meta: { role, status }
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: String(user._id),
        intellisysUserId: user.intellisysUserId || '',
        identifier: user.identifier,
        email: user.email || user.identifier,
        username: user.username || '',
        employeeId: user.employeeId || '',
        name: user.name || user.displayName || '',
        role: normalizeUserRole(user.role),
        status: String(user.status || USER_ACCOUNT_STATUSES.PENDING).toLowerCase(),
        mustChangePassword: Boolean(user.mustChangePassword)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 400 });
  }
}
