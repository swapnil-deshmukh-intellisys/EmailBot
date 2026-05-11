import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import { requireAuth } from '@/lib/apiAuth';
import { buildTimeline } from '@/core-lib/campaign-engine/CampaignAnalyticsService';

export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
  const campaignId = String(params?.id || '').trim();
  if (!mongoose.isValidObjectId(campaignId)) {
    return NextResponse.json({ success: false, error: 'Invalid campaign id' }, { status: 400 });
  }
  await connectDB();
  const campaign = await Campaign.findOne({ _id: campaignId, userEmail }).lean();
  if (!campaign) return NextResponse.json({ success: false, error: 'Campaign not found for current user' }, { status: 404 });
  const recipients = await CampaignRecipientLog.find({ campaignId: campaign._id }).lean();
  return NextResponse.json({ success: true, activity: buildTimeline(campaign, recipients) });
}
