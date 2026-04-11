import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import { requireUser } from '@/lib/apiAuth';
import UserProfile from '@/models/UserProfile';

function displayNameFromIdentifier(identifier = '') {
  const localPart = String(identifier || '')
    .trim()
    .toLowerCase()
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim();

  if (!localPart) return 'Profile';

  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function getProfile(identifier, role) {
  const existing = await UserProfile.findOne({ identifier }).lean();
  if (existing) return existing;
  return {
    identifier,
    role,
    displayName: displayNameFromIdentifier(identifier),
    avatarName: '',
    avatarDataUrl: '',
    notificationPrefs: {
      campaignUpdates: true,
      replyAlerts: true,
      weeklyReports: true
    }
  };
}

export async function GET(req) {
  const { userEmail, session, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();
  const profile = await getProfile(userEmail, session?.role || 'user');
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(req) {
  try {
    const { userEmail, session, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();
    const body = await req.json();

    const update = {
      identifier: userEmail,
      role: session?.role || 'user'
    };

    if (typeof body.displayName === 'string') update.displayName = body.displayName.trim();
    if (typeof body.avatarName === 'string') update.avatarName = body.avatarName.trim();
    if (typeof body.avatarDataUrl === 'string') update.avatarDataUrl = body.avatarDataUrl;
    if (body.notificationPrefs && typeof body.notificationPrefs === 'object') {
      update.notificationPrefs = {
        campaignUpdates: Boolean(body.notificationPrefs.campaignUpdates),
        replyAlerts: Boolean(body.notificationPrefs.replyAlerts),
        weeklyReports: Boolean(body.notificationPrefs.weeklyReports)
      };
    }

    if (typeof body.password === 'string' && body.password.trim()) {
      update.passwordHash = await bcrypt.hash(body.password, 10);
    }

    const profile = await UserProfile.findOneAndUpdate(
      { identifier: userEmail },
      { $set: update, $setOnInsert: { identifier: userEmail, role: session?.role || 'user' } },
      { upsert: true, new: true }
    ).lean();

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 400 });
  }
}
