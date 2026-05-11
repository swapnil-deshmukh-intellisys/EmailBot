import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';
import { requireUser } from '@/lib/apiAuth';
import Campaign from '@/models/Campaign';
import {
  buildCampaignCounts,
  buildLegacyCampaignSummary,
  getEmptyCampaignCounts
} from '@/core-lib/campaign-engine/CampaignStatusSummary';

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;

    await connectDB();

    const query = { userEmail };
    const url = new URL(req.url);
    const project = String(url.searchParams.get('project') || '').trim().toLowerCase();
    const sender = String(url.searchParams.get('sender') || '').trim().toLowerCase();

    if (project) query.project = project;
    if (sender) {
      const senderRegex = new RegExp(`^${escapeRegex(sender)}$`, 'i');
      query.$or = [
        { senderFrom: senderRegex },
        { 'senderAccount.from': senderRegex },
        { 'senderAccount.user': senderRegex }
      ];
    }

    const campaigns = await Campaign.find(query).select('status listId templateId inlineTemplate senderAccountId senderFrom senderAccount stats').lean();
    const counts = buildCampaignCounts(campaigns);

    return NextResponse.json({
      success: true,
      counts,
      campaigns: [],
      summary: buildLegacyCampaignSummary(counts)
    });
  } catch (error) {
    const counts = getEmptyCampaignCounts();
    return NextResponse.json(
      {
        success: false,
        counts,
        campaigns: [],
        summary: buildLegacyCampaignSummary(counts),
        code: 'CAMPAIGN_STATS_LOAD_FAILED',
        message: error.message || 'Unable to fetch campaign stats.',
        error: error.message || 'Unable to fetch campaign stats.'
      },
      { status: 500 }
    );
  }
}
