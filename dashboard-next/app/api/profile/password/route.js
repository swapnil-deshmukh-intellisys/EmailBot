import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/mongodb';
import { requireUser } from '@/lib/apiAuth';
import UserProfile from '@/models/UserProfile';

export async function POST(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();
    const body = await req.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const confirmPassword = String(body.confirmPassword || '');

    if (!newPassword || newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 });
    }

    const profile = await UserProfile.findOne({ identifier: userEmail });
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.passwordHash) {
      const ok = await bcrypt.compare(currentPassword, profile.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      }
    }

    profile.passwordHash = await bcrypt.hash(newPassword, 10);
    await profile.save();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to change password' }, { status: 400 });
  }
}
