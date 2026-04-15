import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireUser } from '@/lib/apiAuth';
import UserProfile from '@/models/UserProfile';
import TargetApproval from '@/models/TargetApproval';

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req) {
  const { userEmail, session, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();

  const targetIdentifier = String(new URL(req.url).searchParams.get('identifier') || userEmail).trim().toLowerCase();
  const scope = String(new URL(req.url).searchParams.get('scope') || '').trim().toLowerCase();
  if (scope === 'manager' || scope === 'admin') {
    const approvals = await TargetApproval.find({}).sort({ createdAt: -1 }).limit(50).lean();
    return NextResponse.json({
      ok: true,
      approvals: approvals.map((item) => ({
        id: String(item._id),
        employee: item.requesterEmail.split('@')[0] || item.requesterEmail,
        email: item.requesterEmail,
        target: `${String(item.targetPeriod || 'daily').replace(/^./, (c) => c.toUpperCase())} ${item.targetDailyCount || 300} mails`,
        period: String(item.targetPeriod || 'daily').replace(/^./, (c) => c.toUpperCase()),
        status: String(item.status || 'pending').replace(/^./, (c) => c.toUpperCase()),
        requestedAt: item.requestedAt ? new Date(item.requestedAt).toLocaleString() : item.createdAt ? new Date(item.createdAt).toLocaleString() : null,
        reviewer: item.reviewerEmail || '',
        reviewedAt: item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : null,
        note: item.requestNote || ''
      }))
    });
  }

  const profile = await UserProfile.findOne({ identifier: targetIdentifier }).lean();
  const latestApproval = await TargetApproval.findOne({ requesterEmail: targetIdentifier }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({
    ok: true,
    approval: {
      status: latestApproval?.status || profile?.targetApprovalStatus || 'approved',
      requestedAt: latestApproval?.requestedAt ? new Date(latestApproval.requestedAt).toLocaleString() : profile?.targetApprovalRequestedAt ? new Date(profile.targetApprovalRequestedAt).toLocaleString() : null,
      reviewedAt: latestApproval?.reviewedAt ? new Date(latestApproval.reviewedAt).toLocaleString() : profile?.targetApprovalReviewedAt ? new Date(profile.targetApprovalReviewedAt).toLocaleString() : null,
      reviewer: latestApproval?.reviewerEmail || profile?.targetApprovalReviewer || '',
      note: latestApproval?.requestNote || profile?.targetApprovalRequestNote || '',
      period: latestApproval?.targetPeriod || 'daily',
      role: session?.role || 'user'
    }
  });
}

export async function PATCH(req) {
  try {
    const { userEmail, session, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const targetIdentifier = String(body.identifier || userEmail || '').trim().toLowerCase();

    const status = String(body.status || '').trim().toLowerCase();
    if (!['approved', 'pending', 'review', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid target approval status' }, { status: 400 });
    }

    const actingRole = String(session?.role || '').toLowerCase();
    const canApproveOthers = actingRole === 'manager' || actingRole === 'admin';
    if (targetIdentifier !== userEmail && !canApproveOthers) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const update = {
      targetApprovalStatus: status === 'review' ? 'pending' : status
    };

    const latestRecord = {
      requesterEmail: targetIdentifier,
      requesterRole: session?.role || 'user',
      targetPeriod: String(body.period || 'daily').trim() || 'daily',
      targetDailyCount: Number.isFinite(Number(body.dailyTarget)) ? Math.max(0, Number(body.dailyTarget)) : 300,
      status: status === 'review' ? 'pending' : status,
      requestNote: String(body.note || '').trim()
    };

    if (status === 'pending') {
      update.targetApprovalRequestedAt = new Date();
      update.targetApprovalReviewedAt = null;
      update.targetApprovalReviewer = '';
      update.targetApprovalRequestNote = String(body.note || '').trim();
      await TargetApproval.create({
        ...latestRecord,
        requestedAt: new Date()
      });
    } else if (status === 'approved') {
      update.targetApprovalReviewedAt = new Date();
      update.targetApprovalReviewer = String(body.reviewer || session?.email || '').trim();
      await TargetApproval.create({
        ...latestRecord,
        requestedAt: new Date(),
        reviewedAt: new Date(),
        reviewerEmail: String(body.reviewer || session?.email || '').trim(),
        reviewerRole: String(session?.role || '').trim(),
        reviewNote: String(body.reviewNote || 'Target approved.').trim() || 'Target approved.'
      });
    } else if (status === 'rejected') {
      update.targetApprovalReviewedAt = new Date();
      update.targetApprovalReviewer = String(body.reviewer || session?.email || '').trim();
      await TargetApproval.create({
        ...latestRecord,
        status: 'rejected',
        requestedAt: new Date(),
        reviewedAt: new Date(),
        reviewerEmail: String(body.reviewer || session?.email || '').trim(),
        reviewerRole: String(session?.role || '').trim(),
        reviewNote: String(body.reviewNote || 'Target rejected.').trim() || 'Target rejected.'
      });
    }

    const profile = await UserProfile.findOneAndUpdate(
      { identifier: targetIdentifier },
      { $set: update },
      { new: true }
    ).lean();

    return NextResponse.json({ ok: true, approval: profile });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update target approval' }, { status: 400 });
  }
}
