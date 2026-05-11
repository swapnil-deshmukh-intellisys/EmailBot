import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { getAuthCookieName, getBlockedStatusMessage, verifyAuthToken } from '@/lib/auth';
import { requireAuth } from '@/lib/apiAuth';
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
    totalCredits: 300,
    usedCredits: 0,
    remainingCredits: 300,
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
  try {
    const token = req.cookies.get(getAuthCookieName())?.value;
    const auth = token ? null : await requireAuth(req, { allowPending: true });
    if (auth?.errorResponse) return auth.errorResponse;
    const session = token ? verifyAuthToken(token) : auth?.session;

    if (!session) {
      return NextResponse.json(
        {
          authenticated: false,
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
          error: 'Authentication is required.'
        },
        { status: 401 }
      );
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
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const devEmail = String(process.env.DEV_BYPASS_EMAIL || process.env.ADMIN_EMAIL || 'akshaymore.intellisys@gmail.com').toLowerCase();
      const devRole = 'admin';
      return NextResponse.json({
        authenticated: true,
        user: {
          id: `seed-${devEmail}`,
          email: devEmail,
          identifier: devEmail,
          role: devRole,
          status: 'active'
        },
        dashboardPath: getDashboardPathForRole(devRole),
        requiresPasswordChange: false,
        accountState: {
          status: 'active',
          message: getBlockedStatusMessage('active')
        },
        profile: getDefaultProfile(devEmail, devRole),
        error: error.message || 'Failed to load profile'
      });
    }
    return NextResponse.json({ authenticated: false, error: error.message || 'Failed to load profile' }, { status: 500 });
  }
}
