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
    if (typeof body.planName === 'string') update.planName = body.planName.trim() || 'Basic';
    if (Number.isFinite(Number(body.totalCredits))) update.totalCredits = Math.max(0, Number(body.totalCredits));
    if (Number.isFinite(Number(body.usedCredits))) update.usedCredits = Math.max(0, Number(body.usedCredits));
    if (Number.isFinite(Number(body.remainingCredits))) update.remainingCredits = Math.max(0, Number(body.remainingCredits));
    if (Number.isFinite(Number(body.creditUsagePercent))) update.creditUsagePercent = Math.max(0, Math.min(100, Number(body.creditUsagePercent)));
    if (typeof body.targetApprovalStatus === 'string') update.targetApprovalStatus = body.targetApprovalStatus.trim() || 'approved';
    if (Object.prototype.hasOwnProperty.call(body, 'targetApprovalRequestedAt')) {
      update.targetApprovalRequestedAt = body.targetApprovalRequestedAt ? new Date(body.targetApprovalRequestedAt) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'targetApprovalReviewedAt')) {
      update.targetApprovalReviewedAt = body.targetApprovalReviewedAt ? new Date(body.targetApprovalReviewedAt) : null;
    }
    if (typeof body.targetApprovalReviewer === 'string') update.targetApprovalReviewer = body.targetApprovalReviewer.trim();
    if (typeof body.targetApprovalRequestNote === 'string') update.targetApprovalRequestNote = body.targetApprovalRequestNote.trim();
    if (body.timelineTasks && typeof body.timelineTasks === 'object') {
      update.timelineTasks = Object.fromEntries(
        Object.entries(body.timelineTasks).map(([key, value]) => [key, Boolean(value)])
      );
    }
    if (Array.isArray(body.timelineCustomTasks)) {
      update.timelineCustomTasks = body.timelineCustomTasks.map((task, index) => ({
        id: String(task?.id || `task-${Date.now()}-${index}`),
        date: String(task?.date || '').trim(),
        time: String(task?.time || '').trim(),
        title: String(task?.title || '').trim(),
        text: String(task?.text || '').trim(),
        type: String(task?.type || 'Reminder').trim() || 'Reminder',
        status: String(task?.status || 'pending').trim() || 'pending',
        done: Boolean(task?.done)
      }));
    }
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
