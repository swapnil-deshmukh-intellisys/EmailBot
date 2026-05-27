import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import Campaign from '@/models/Campaign';
import {
  buildCampaignCounts,
  buildLegacyCampaignSummary,
  getEmptyCampaignCounts
} from '@/core-lib/campaign-engine/CampaignStatusSummary';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildProjectFilter(project = '') {
  const normalized = String(project || '').trim().toLowerCase();
  if (!normalized) return null;
  const projectRegex = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  const clauses = [
    { project: projectRegex },
    { projectId: projectRegex },
    { projectName: projectRegex }
  ];
  if (normalized === 'tec') {
    clauses.push(
      { projectName: /entrepreneurial/i },
      { senderFrom: /@theentrepreneurialchronicle\.com$/i },
      { 'senderAccount.from': /@theentrepreneurialchronicle\.com$/i },
      { 'senderAccount.user': /@theentrepreneurialchronicle\.com$/i }
    );
  }
  if (normalized === 'tut') {
    clauses.push(
      { projectName: /unicorn/i },
      { senderFrom: /@theunicorntimes\.com$/i },
      { 'senderAccount.from': /@theunicorntimes\.com$/i },
      { 'senderAccount.user': /@theunicorntimes\.com$/i }
    );
  }
  return { $or: clauses };
}

export async function GET(req) {
  const startedAt = Date.now();
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    await connectDB();

    const filters = {};
    const url = new URL(req.url);
    const project = String(url.searchParams.get('project') || '').trim().toLowerCase();
    const sender = String(url.searchParams.get('sender') || '').trim().toLowerCase();

    const andClauses = [];
    const projectFilter = buildProjectFilter(project);
    if (projectFilter) andClauses.push(projectFilter);
    if (sender) {
      const senderRegex = new RegExp(`^${escapeRegex(sender)}$`, 'i');
      andClauses.push({ $or: [
        { senderFrom: senderRegex },
        { 'senderAccount.from': senderRegex },
        { 'senderAccount.user': senderRegex }
      ] });
    }
    if (andClauses.length) filters.$and = andClauses;
    const query = buildAuthOwnerFilter(auth, filters);

    const campaigns = await Campaign.find(query).select('status listId templateId inlineTemplate senderAccountId senderFrom senderAccount stats').lean();
    const counts = buildCampaignCounts(campaigns);

    console.info('[api/campaigns/stats] response', {
      ms: Date.now() - startedAt,
      count: campaigns.length,
      project,
      sender
    });

    return NextResponse.json({
      success: true,
      counts,
      campaigns: [],
      summary: buildLegacyCampaignSummary(counts)
    }, { headers: NO_STORE_HEADERS });
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
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
