import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { getAuthCookieName, getBlockedStatusMessage, verifyAuthToken } from '@/lib/auth';
import { getDashboardPathForRole } from '@/app/lib/roleRouting';
import UserProfile from '@/models/UserProfile';

function getDefaultProfile(identifier = '', role = 'user') {
  return {
    identifier,
    role,
    displayName: identifier.split('@')[0] || 'Profile',
    avatarName: '',
    avatarDataUrl: '',
    planName: 'Basic',
    totalCredits: 6000,
    usedCredits: 0,
    remainingCredits: 6000,
    creditUsagePercent: 0,
    targetApprovalStatus: 'approved',
    targetApprovalRequestedAt: null,
    targetApprovalReviewedAt: null,
    targetApprovalReviewer: '',
    targetApprovalRequestNote: '',
    timelineTasks: {},
    timelineCustomTasks: [],
    notificationPrefs: {
      campaignUpdates: true,
      replyAlerts: true,
      weeklyReports: true
    }
  };
}

export async function GET(req) {
  const token = req.cookies.get(getAuthCookieName())?.value;
  const session = token ? verifyAuthToken(token) : null;

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  await connectDB();
  const sessionId = String(session.id || '').trim();
  const sessionIdentifier = String(session.identifier || session.email || '').toLowerCase();
  const sessionIntellisysUserId = String(session.intellisysUserId || '').toLowerCase();
  const profile = (
    (mongoose.Types.ObjectId.isValid(sessionId) ? await UserProfile.findById(sessionId).lean() : null) ||
    await UserProfile.findOne({
      $or: [
        { identifier: sessionIdentifier },
        { email: sessionIdentifier },
        { username: sessionIdentifier },
        { employeeId: sessionIntellisysUserId || sessionIdentifier },
        { intellisysUserId: sessionIntellisysUserId || sessionIdentifier }
      ]
    }).lean()
  );
  const status = String(session?.status || profile?.status || 'active').toLowerCase();

  return NextResponse.json({
    authenticated: true,
    user: session,
    dashboardPath: getDashboardPathForRole(session.role),
    requiresPasswordChange: Boolean(session?.mustChangePassword),
    accountState: {
      status,
      message: getBlockedStatusMessage(status)
    },
    profile: profile || getDefaultProfile(String(session.email || '').toLowerCase(), session.role)
  });
}
