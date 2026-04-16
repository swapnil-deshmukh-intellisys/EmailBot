import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireUser } from '@/lib/apiAuth';
import { DASHBOARD_ROLES } from '@/app/lib/dashboardRoles';
import UserProfile from '@/models/UserProfile';

function isAdmin(session) {
  return String(session?.role || '').toLowerCase() === DASHBOARD_ROLES.ADMIN;
}

function normalizeIdentifier(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value = '') {
  const role = String(value || '').trim().toLowerCase();
  if ([DASHBOARD_ROLES.USER, DASHBOARD_ROLES.MANAGER, DASHBOARD_ROLES.ADMIN].includes(role)) return role;
  return DASHBOARD_ROLES.USER;
}

export async function GET(req) {
  const { session, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  await connectDB();
  const accounts = await UserProfile.find(
    {},
    { identifier: 1, role: 1, displayName: 1, passwordHash: 1, createdAt: 1, updatedAt: 1 }
  )
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json({
    ok: true,
    accounts: accounts.map((account) => ({
      identifier: account.identifier,
      role: account.role || DASHBOARD_ROLES.USER,
      displayName: account.displayName || '',
      hasPassword: Boolean(account.passwordHash),
      createdAt: account.createdAt || null,
      updatedAt: account.updatedAt || null
    }))
  });
}

export async function POST(req) {
  const { session, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const identifier = normalizeIdentifier(body.identifier);
    const role = normalizeRole(body.role);
    const password = String(body.password || '').trim();
    const displayName = String(body.displayName || '').trim();

    if (!identifier) {
      return NextResponse.json({ error: 'Identifier is required' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    await connectDB();
    const passwordHash = await bcrypt.hash(password, 10);
    const account = await UserProfile.findOneAndUpdate(
      { identifier },
      {
        $set: {
          identifier,
          role,
          displayName: displayName || identifier.split('@')[0] || identifier,
          passwordHash
        }
      },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({
      ok: true,
      account: {
        identifier: account.identifier,
        role: account.role,
        displayName: account.displayName
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to save account' }, { status: 400 });
  }
}
