import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';

import Campaign from '@/models/Campaign';

import LeadList from '@/models/LeadList';

import EmailTemplate from '@/models/EmailTemplate';

import { resolveSenderAccountById } from '@/lib/senderAccounts';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { getRunnerState } from '@/lib/campaignRunner';
import {
  buildScheduledDateTimeInZone,
  convertDelayIntervalToSeconds,
  isFutureScheduledDate,
  normalizeDurationUnit
} from '@/modules/campaign-module/campaign-utils/CampaignScheduleHelper';
import {
  buildCampaignCounts,
  buildLegacyCampaignSummary,
  getEmptyCampaignCounts
} from '@/core-lib/campaign-engine/CampaignStatusSummary';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import {
  serializeCampaignForList
} from '@/core-lib/campaign-engine/CampaignAnalyticsService';
import { normalizeDraftType } from '@/app/lib/draftTypes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MIN_CAMPAIGN_SEND_GAP_SECONDS = 60;
const MAX_SCHEDULE_DELAY_MINUTES = 1440;
const MAX_SCHEDULE_DELAY_HOURS = 24;
const MAX_SCHEDULE_DELAY_SECONDS = 86400;

function getScheduleDelayLimit(unit = 'minutes') {
  const normalizedUnit = normalizeDurationUnit(unit);
  if (normalizedUnit === 'hours') return MAX_SCHEDULE_DELAY_HOURS;
  if (normalizedUnit === 'seconds') return MAX_SCHEDULE_DELAY_SECONDS;
  return MAX_SCHEDULE_DELAY_MINUTES;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

const REPLY_CAMPAIGN_TYPES = new Set(['reminder', 'followup', 'open_followup', 'final_followup', 'follow_up', 'final_cost']);
function normalizeCampaignType(value = '') {
  return normalizeDraftType(value);
}

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

function shouldUseDemoData() {
  return String(process.env.DEV_DEMO_DATA || '').trim().toLowerCase() === 'true';
}

function jsonError({ status = 400, code = 'CAMPAIGN_REQUEST_FAILED', message = 'Campaign request failed.' }) {
  console.error(`[api/campaigns] ${code}: ${message}`);
  return NextResponse.json({ success: false, ok: false, code, message, error: message }, { status, headers: NO_STORE_HEADERS });
}

export async function GET(req) {
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    await connectDB();
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const filters = {};
    const url = new URL(req.url);
    const project = String(url.searchParams.get('project') || '').trim().toLowerCase();
    const sender = String(url.searchParams.get('sender') || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 80) || 80));
    const skip = Math.max(0, Number(url.searchParams.get('skip') || 0) || 0);

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

    const [totalCount, countSourceCampaigns, rawCampaigns] = await Promise.all([
      Campaign.countDocuments(query),
      Campaign.find(query)
        .select({
          status: 1,
          displayStatus: 1,
          workerStatus: 1,
          sentCount: 1,
          pendingCount: 1,
          failedCount: 1,
          stats: 1,
          listId: 1,
          templateId: 1,
          draftId: 1,
          senderAccountId: 1,
          senderFrom: 1,
          'senderAccount.from': 1,
          'senderAccount.user': 1,
          'inlineTemplate.subject': 1,
          'inlineTemplate.body': 1
        })
        .lean(),
      Campaign.find(query)
      .select({
        userId: 1,
        userEmail: 1,
        name: 1,
        project: 1,
        projectId: 1,
        projectName: 1,
        senderFrom: 1,
        type: 1,
        listId: 1,
        templateId: 1,
        draftId: 1,
        draftType: 1,
        'inlineTemplate.subject': 1,
        senderAccountId: 1,
        'senderAccount.provider': 1,
        'senderAccount.label': 1,
        'senderAccount.from': 1,
        'senderAccount.user': 1,
        status: 1,
        scheduleMode: 1,
        country: 1,
        timezone: 1,
        tracking: 1,
        trackingStats: 1,
        workflowStep: 1,
        workflowStepLabel: 1,
        scheduledAt: 1,
        stats: 1,
        totalRecipients: 1,
        sentCount: 1,
        pendingCount: 1,
        failedCount: 1,
        openCount: 1,
        replyCount: 1,
        positiveReplyCount: 1,
        negativeReplyCount: 1,
        followUpStoppedCount: 1,
        failureReason: 1,
        pauseReason: 1,
        stopReason: 1,
        lastError: 1,
        lastErrorAt: 1,
        lastActivityAt: 1,
        options: 1,
        scheduledStart: 1,
        queueRequestedAt: 1,
        queueReason: 1,
        workerStatus: 1,
        workerLockedBy: 1,
        workerId: 1,
        workerLockedAt: 1,
        workerHeartbeatAt: 1,
        lastRunError: 1,
        lastRunErrorAt: 1,
        startedAt: 1,
        finishedAt: 1,
        completedAt: 1,
        createdAt: 1,
        updatedAt: 1
      })
      .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);
    const campaignIds = rawCampaigns.map((campaign) => campaign._id);
    const recipientLogSummaries = campaignIds.length
      ? await CampaignRecipientLog.aggregate([
          { $match: { campaignId: { $in: campaignIds } } },
          {
            $group: {
              _id: '$campaignId',
              sentCount: { $sum: { $cond: [{ $eq: ['$status', 'Sent'] }, 1, 0] } },
              failedCount: { $sum: { $cond: [{ $in: ['$status', ['Failed', 'Bounced', 'Spam']] }, 1, 0] } },
              bouncedCount: { $sum: { $cond: [{ $eq: ['$status', 'Bounced'] }, 1, 0] } },
              spamCount: { $sum: { $cond: [{ $eq: ['$status', 'Spam'] }, 1, 0] } },
              skippedCount: { $sum: { $cond: [{ $or: [{ $eq: ['$status', 'Skipped'] }, '$followUpStopped'] }, 1, 0] } },
              openCount: { $sum: { $ifNull: ['$openCount', 0] } },
              replyCount: { $sum: { $ifNull: ['$replyCount', 0] } },
              positiveReplyCount: { $sum: { $cond: [{ $eq: ['$replyType', 'positive'] }, 1, 0] } },
              negativeReplyCount: { $sum: { $cond: [{ $in: ['$replyType', ['negative', 'unsubscribe']] }, 1, 0] } },
              followUpStoppedCount: { $sum: { $cond: ['$followUpStopped', 1, 0] } },
              lastActivityAt: { $max: { $ifNull: ['$lastActivityAt', '$updatedAt'] } }
            }
          }
        ])
      : [];
    const logsByCampaign = recipientLogSummaries.reduce((map, item) => {
      map.set(String(item._id), [{ ...item, __summary: true, campaignId: item._id }]);
      return map;
    }, new Map());
    const campaigns = rawCampaigns.map((campaign) => serializeCampaignForList(campaign, logsByCampaign.get(String(campaign._id)) || []));
    const counts = buildCampaignCounts(countSourceCampaigns);
    const summary = buildLegacyCampaignSummary(counts);
    console.info('[api/campaigns] response', {
      ms: Date.now() - startedAt,
      count: campaigns.length,
      total: totalCount,
      skip,
      limit,
      project,
      sender
    });

    return NextResponse.json(
      { success: true, ok: true, data: campaigns, counts, campaigns, summary, pagination: { total: totalCount, limit, skip, hasMore: skip + campaigns.length < totalCount } },
      { headers: NO_STORE_HEADERS }
    );

  } catch (error) {
    const errorMessage = error.message || 'Failed to load campaigns';
    if (shouldUseDemoData()) {
      const demoCampaigns = [
          {
            _id: 'demo-campaign-1',
            name: 'Demo Outreach Campaign',
            status: 'Running',
            type: 'cover_sent',
            project: 'tec',
            stats: { total: 50, sent: 22, failed: 1, bounced: 0, spam: 0, pending: 27 },
            createdAt: new Date().toISOString()
          }
        ];
      return NextResponse.json({
        success: true,
        campaigns: demoCampaigns,
        counts: buildCampaignCounts(demoCampaigns),
        summary: buildLegacyCampaignSummary(buildCampaignCounts(demoCampaigns)),
        error: errorMessage
      }, { headers: NO_STORE_HEADERS });
    }
    const emptyCounts = getEmptyCampaignCounts();
    return NextResponse.json(
      { success: false, counts: emptyCounts, campaigns: [], summary: buildLegacyCampaignSummary(emptyCounts), code: 'CAMPAIGNS_LOAD_FAILED', message: errorMessage, error: errorMessage },
      { headers: NO_STORE_HEADERS }
    );

  }

}



export async function POST(req) {

  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();

    await connectDB();

    const body = await req.json();



    const {
      name,
      listId,
      templateId,
      options,
      draftType,
      draftId,
      inlineTemplate,
      senderAccountId,
      type,
      project,
      senderFrom,
      workflowStep,
      workflowStepLabel,
      tracking,
      scheduleMode,
      scheduledAt,
      scheduledDate,
      scheduledTime,
      timezone,
      country
    } = body;

    if (!name || !listId) {

      return jsonError({ status: 400, code: 'CAMPAIGN_REQUIRED_FIELDS_MISSING', message: 'Campaign name and lead list are required.' });

    }



    const list = await LeadList.findOne({ _id: listId, userEmail }).lean();

    if (!list) {

      return jsonError({ status: 404, code: 'LEAD_LIST_NOT_FOUND', message: 'Lead list not found for current user.' });

    }



    let resolvedTemplateId = templateId || null;

    if (!resolvedTemplateId && (!inlineTemplate?.subject || !inlineTemplate?.body)) {

      const fallback = await EmailTemplate.findOne({ userEmail }).sort({ createdAt: -1 }).lean();

      resolvedTemplateId = fallback?._id || null;

    }



    const senderAccount = senderAccountId
      ? await resolveSenderAccountById(senderAccountId, {
          userEmail,
          project: String(project || '').trim().toLowerCase(),
          senderFrom
        })
      : null;

    if (senderAccountId && !senderAccount) {

      const isPresetGraphAccount = String(senderAccountId || '').startsWith('graphapp:');
      return jsonError({
        status: isPresetGraphAccount ? 400 : 404,
        code: isPresetGraphAccount ? 'SENDER_ACCOUNT_NOT_CONNECTED' : 'SENDER_ACCOUNT_NOT_FOUND',
        message: isPresetGraphAccount
          ? 'Selected sender is not connected. Connect this Mail ID or configure Microsoft Graph app credentials before creating a campaign.'
          : 'Sender account not found or not connected for current user.'
      });

    }



    const rawBatchInput = String(options?.batchSize ?? '').trim();
    const parsedBatchSize = Number(rawBatchInput || 1);

    if (!Number.isFinite(parsedBatchSize) || parsedBatchSize < 1) {

      return jsonError({ status: 400, code: 'INVALID_BATCH_SIZE', message: 'Batch size must be a number greater than or equal to 1.' });

    }

    const normalizedDurationUnit = normalizeDurationUnit(options?.durationUnit || 'seconds');
    const parsedDelayInterval = Number(String(options?.delayInterval ?? options?.delaySeconds ?? '').trim() || MIN_CAMPAIGN_SEND_GAP_SECONDS);
    if (!Number.isFinite(parsedDelayInterval) || parsedDelayInterval < 1) {
      return jsonError({ status: 400, code: 'INVALID_DELAY_INTERVAL', message: 'Delay interval must be a number greater than or equal to 1.' });
    }
    if (parsedDelayInterval > getScheduleDelayLimit(normalizedDurationUnit)) {
      return jsonError({
        status: 400,
        code: 'DELAY_INTERVAL_TOO_LARGE',
        message: `Delay interval cannot be more than ${getScheduleDelayLimit(normalizedDurationUnit)} ${normalizedDurationUnit}.`
      });
    }

    const convertedDelaySeconds = Math.max(
      MIN_CAMPAIGN_SEND_GAP_SECONDS,
      convertDelayIntervalToSeconds(parsedDelayInterval, normalizedDurationUnit)
    );
    const storedDelayInterval = normalizedDurationUnit === 'seconds'
      ? Math.max(MIN_CAMPAIGN_SEND_GAP_SECONDS, Math.floor(parsedDelayInterval))
      : Math.max(1, Math.floor(parsedDelayInterval));
    const normalizedScheduleMode = String(scheduleMode || 'send_now').trim().toLowerCase() === 'scheduled' ? 'scheduled' : 'send_now';
    const normalizedCountry = String(country || '').trim() || 'India';
    const normalizedTimezone = String(timezone || '').trim() || 'Asia/Kolkata';
    const computedScheduledAt = scheduledAt
      ? new Date(scheduledAt)
      : buildScheduledDateTimeInZone(scheduledDate, scheduledTime, normalizedTimezone);

    if (normalizedScheduleMode === 'scheduled') {
      if (!(computedScheduledAt instanceof Date) || Number.isNaN(computedScheduledAt.getTime())) {
        return jsonError({ status: 400, code: 'INVALID_SCHEDULE_TIME', message: 'Valid scheduled date and time are required.' });
      }
      if (!isFutureScheduledDate(computedScheduledAt)) {
        return jsonError({ status: 400, code: 'SCHEDULE_TIME_NOT_FUTURE', message: 'Scheduled time must be in the future.' });
      }
    }

    const campaignType = normalizeCampaignType(type || draftType);
    const autoReplyMode = REPLY_CAMPAIGN_TYPES.has(campaignType);
    const replyMode = typeof options?.replyMode === 'boolean' ? options.replyMode : autoReplyMode;
    const total = list.leads.length;
    const batchSize = Math.max(1, Math.floor(parsedBatchSize));
    const duplicateCampaign = await Campaign.findOne({
      userEmail,
      status: 'Draft',
      name: String(name || '').trim(),
      listId,
      senderAccountId: senderAccountId || '',
      draftId: draftId || null,
      type: campaignType,
      'inlineTemplate.subject': String(inlineTemplate?.subject || '').trim(),
      'inlineTemplate.body': String(inlineTemplate?.body || '').trim(),
      'options.batchSize': batchSize,
      'options.delayInterval': storedDelayInterval,
      'options.durationUnit': normalizedDurationUnit,
      'options.delaySeconds': convertedDelaySeconds,
      'options.replyMode': replyMode
    }).lean();

    if (duplicateCampaign) {
      return NextResponse.json({ success: true, ok: true, data: duplicateCampaign, campaign: duplicateCampaign, duplicate: true }, { headers: NO_STORE_HEADERS });
    }

    const campaign = await Campaign.create({

      userId: auth.currentUser._id,
      userEmail,
      name,
      project: String(project || '').trim().toLowerCase(),
      projectId: String(project || '').trim().toLowerCase(),
      projectName: String(project || '').trim().toUpperCase(),
      senderFrom: String(senderFrom || senderAccount?.from || '').trim().toLowerCase(),
      type: campaignType,

      listId,

      templateId: resolvedTemplateId,

      draftType: campaignType,
      draftId: draftId || null,

      inlineTemplate: {

        subject: inlineTemplate?.subject || '',

        body: inlineTemplate?.body || ''

      },
      senderAccountId: senderAccountId || '',
      senderAccount: senderAccount ? { provider: senderAccount.provider, label: senderAccount.label, from: senderAccount.from } : undefined,
      workflowStep: Number.isFinite(Number(workflowStep)) ? Number(workflowStep) : 1,
      workflowStepLabel: String(workflowStepLabel || '').trim(),
      scheduleMode: normalizedScheduleMode,
      country: normalizedCountry,
      timezone: normalizedTimezone,
      scheduledAt: normalizedScheduleMode === 'scheduled' ? computedScheduledAt : null,
      status: normalizedScheduleMode === 'scheduled' ? 'Draft' : 'Draft',
      scheduledStart: {
        country: normalizedCountry,
        slot: String(scheduledTime || '').trim(),
        timezone: normalizedTimezone,
        label: '',
        at: normalizedScheduleMode === 'scheduled' ? computedScheduledAt : null
      },
      tracking: {
        enabled: Boolean(tracking?.enabled),
        opens: Boolean(tracking?.opens),
        clicks: Boolean(tracking?.clicks),
        replies: Boolean(tracking?.replies),
        updatedAt: new Date()
      },

      options: {

        batchSize: Math.max(1, Math.floor(parsedBatchSize)),
        delayInterval: storedDelayInterval,
        durationUnit: normalizedDurationUnit,
        delaySeconds: convertedDelaySeconds,

        rowRange: '',
        replyMode

      },

      stats: {

        total,

        sent: 0,

        failed: 0,

        bounced: 0,

        spam: 0,

        pending: total

      },
      totalRecipients: total,
      sentCount: 0,
      pendingCount: total,
      failedCount: 0,
      openCount: 0,
      replyCount: 0,
      lastActivityAt: new Date(),

      logs: [{ level: 'info', message: 'Campaign created', at: new Date() }]

    });



    return NextResponse.json({ success: true, ok: true, data: campaign, campaign }, { headers: NO_STORE_HEADERS });

  } catch (error) {

    return jsonError({ status: 500, code: 'CAMPAIGN_CREATE_FAILED', message: error.message || 'Failed to create campaign.' });

  }

}

