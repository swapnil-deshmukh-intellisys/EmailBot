import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import connectDB from '@/lib/mongodb';
import { createActivityLog } from '@/lib/ActivityLogService';
import { normalizeLoginIdentifier, USER_ACCOUNT_STATUSES } from '@/lib/auth';
import SignupRequest from '@/models/SignupRequest';
import UserProfile from '@/models/UserProfile';

function normalizeRequestedRole(value = '') {
  return 'user';
}

export async function POST(req) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const identifier = normalizeLoginIdentifier(body.identifier || body.email || body.username || '');
    const email = normalizeLoginIdentifier(body.email || identifier);
    const requestedRole = normalizeRequestedRole(body.requestedRole);
    const password = String(body.password || '');

    if (!name || !identifier || !password) {
      return NextResponse.json({ error: 'Name, login ID, and password are required.' }, { status: 400 });
    }

    await connectDB();

    const existingUser = await UserProfile.findOne({
      $or: [{ identifier }, { email }, { username: identifier }, { employeeId: identifier }]
    }).lean();
    if (existingUser) {
      const status = String(existingUser.status || '').toLowerCase();
      return NextResponse.json(
        { error: status === USER_ACCOUNT_STATUSES.PENDING ? 'Your account is pending admin approval.' : 'An account with this login ID already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdUser = await UserProfile.create({
      identifier,
      intellisysUserId: identifier,
      email,
      username: identifier,
      name,
      displayName: name,
      role: requestedRole,
      status: USER_ACCOUNT_STATUSES.PENDING,
      passwordHash,
      mustChangePassword: true,
      isFirstLogin: true,
      createdByAdmin: false
    });

    await SignupRequest.findOneAndUpdate(
      { identifier },
      {
        $set: {
          name,
          email,
          identifier,
          requestedRole,
          status: USER_ACCOUNT_STATUSES.PENDING
        }
      },
      { upsert: true, new: true }
    );

    await createActivityLog({
      user: createdUser,
      action: 'auth.request_access',
      entityType: 'signup_request',
      entityId: String(createdUser._id),
      meta: { requestedRole }
    });

    return NextResponse.json({
      ok: true,
      message: 'Access request submitted. Your account is pending admin approval.'
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to submit access request' }, { status: 400 });
  }
}
