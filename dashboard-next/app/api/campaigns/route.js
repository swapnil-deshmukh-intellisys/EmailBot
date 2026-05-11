import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';

import Campaign from '@/models/Campaign';

import LeadList from '@/models/LeadList';

import EmailTemplate from '@/models/EmailTemplate';

import { resolveSenderAccountById } from '@/lib/senderAccounts';
import { requireAuth, requireUser } from '@/lib/apiAuth';
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
  ensureRecipientLogsForCampaign,
  serializeCampaignForList
} from '@/core-lib/campaign-engine/CampaignAnalyticsService';

const REPLY_CAMPAIGN_TYPES = new Set(['reminder', 'follow_up', 'updated_cost', 'final_cost', 'follow-up', 'updated cost', 'final cost']);
function normalizeCampaignType(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shouldUseDemoData() {
  return String(process.env.DEV_DEMO_DATA || '').trim().toLowerCase() === 'true';
}

function jsonError({ status = 400, code = 'CAMPAIGN_REQUEST_FAILED', message = 'Campaign request failed.' }) {
  console.error(`[api/campaigns] ${code}: ${message}`);
  return NextResponse.json({ success: false, code, message, error: message }, { status });
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

    if (project) {
      query.project = project;
    }
    if (sender) {
      const senderRegex = new RegExp(`^${escapeRegex(sender)}$`, 'i');
      query.$or = [
        { senderFrom: senderRegex },
        { 'senderAccount.from': senderRegex },
        { 'senderAccount.user': senderRegex }
      ];
    }

    const rawCampaigns = await Campaign.find(query).sort({ createdAt: -1 }).lean();
    await Promise.all(rawCampaigns.slice(0, 50).map((campaign) => ensureRecipientLogsForCampaign(campaign).catch(() => [])));
    const campaignIds = rawCampaigns.map((campaign) => campaign._id);
    const recipientLogs = await CampaignRecipientLog.find({ campaignId: { $in: campaignIds } }).lean();
    const logsByCampaign = recipientLogs.reduce((map, item) => {
      const key = String(item.campaignId);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
      return map;
    }, new Map());
    const campaigns = rawCampaigns.map((campaign) => serializeCampaignForList(campaign, logsByCampaign.get(String(campaign._id)) || []));
    const counts = buildCampaignCounts(campaigns);
    const summary = buildLegacyCampaignSummary(counts);

    return NextResponse.json({ success: true, counts, campaigns, summary });

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
      });
    }
    const emptyCounts = getEmptyCampaignCounts();
    return NextResponse.json({ success: false, counts: emptyCounts, campaigns: [], summary: buildLegacyCampaignSummary(emptyCounts), code: 'CAMPAIGNS_LOAD_FAILED', message: errorMessage, error: errorMessage });

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
          project: String(project || '').trim().toLowerCase()
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

    const parsedDelayInterval = Number(String(options?.delayInterval ?? options?.delaySeconds ?? '').trim() || 1);
    if (!Number.isFinite(parsedDelayInterval) || parsedDelayInterval < 1) {
      return jsonError({ status: 400, code: 'INVALID_DELAY_INTERVAL', message: 'Delay interval must be a number greater than or equal to 1.' });
    }

    const normalizedDurationUnit = normalizeDurationUnit(options?.durationUnit || 'seconds');
    const convertedDelaySeconds = convertDelayIntervalToSeconds(parsedDelayInterval, normalizedDurationUnit);
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
      name: String(name || '').trim(),
      listId,
      senderAccountId: senderAccountId || '',
      type: campaignType,
      'inlineTemplate.subject': String(inlineTemplate?.subject || '').trim(),
      'inlineTemplate.body': String(inlineTemplate?.body || '').trim(),
      'options.batchSize': batchSize,
      'options.delayInterval': parsedDelayInterval,
      'options.durationUnit': normalizedDurationUnit,
      'options.delaySeconds': convertedDelaySeconds,
      'options.replyMode': replyMode
    }).lean();

    if (duplicateCampaign) {
      return NextResponse.json({ success: true, campaign: duplicateCampaign, duplicate: true });
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

      draftType: draftType || '',

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
        delayInterval: Math.max(1, Math.floor(parsedDelayInterval)),
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



    return NextResponse.json({ success: true, campaign });

  } catch (error) {

    return jsonError({ status: 500, code: 'CAMPAIGN_CREATE_FAILED', message: error.message || 'Failed to create campaign.' });

  }

}

