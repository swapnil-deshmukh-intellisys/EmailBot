import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
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
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    await connectDB();

    const filters = {};
    const url = new URL(req.url);
    const project = String(url.searchParams.get('project') || '').trim().toLowerCase();
    const sender = String(url.searchParams.get('sender') || '').trim().toLowerCase();

    if (project) filters.project = project;
    if (sender) {
      const senderRegex = new RegExp(`^${escapeRegex(sender)}$`, 'i');
      filters.$or = [
        { senderFrom: senderRegex },
        { 'senderAccount.from': senderRegex },
        { 'senderAccount.user': senderRegex }
      ];
    }
    const query = buildAuthOwnerFilter(auth, filters);

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
