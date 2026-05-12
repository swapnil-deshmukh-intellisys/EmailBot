import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import { requireAuth } from '@/lib/apiAuth';
import { ensureRecipientLogsForCampaign } from '@/core-lib/campaign-engine/CampaignAnalyticsService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userEmail = normalizeEmail(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '');
  const campaignId = String(params?.id || '').trim();
  if (!mongoose.isValidObjectId(campaignId)) {
    return NextResponse.json({ success: false, error: 'Invalid campaign id' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  await connectDB();
  const campaign = await Campaign.findOne({ _id: campaignId, userEmail }).lean();
  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found for current user' }, { status: 404, headers: NO_STORE_HEADERS });
  }
  await ensureRecipientLogsForCampaign(campaign);

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100)));
  const query = { campaignId: campaign._id };
  const status = String(url.searchParams.get('status') || '').trim();
  const replyType = String(url.searchParams.get('replyType') || '').trim();
  const search = String(url.searchParams.get('search') || '').trim();
  if (status) query.status = new RegExp(`^${status.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (replyType) query.replyType = replyType;
  if (url.searchParams.get('opened') === 'true') query.openCount = { $gt: 0 };
  if (url.searchParams.get('failed') === 'true') query.failureReason = { $ne: '' };
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ clientName: regex }, { email: regex }, { company: regex }, { designation: regex }];
  }

  const [total, recipients] = await Promise.all([
    CampaignRecipientLog.countDocuments(query),
    CampaignRecipientLog.find(query).sort({ lastActivityAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
  ]);

  return NextResponse.json({ success: true, recipients, page, limit, total }, { headers: NO_STORE_HEADERS });
}
