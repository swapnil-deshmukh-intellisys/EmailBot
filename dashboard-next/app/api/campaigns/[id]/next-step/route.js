import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { isInAppCampaignSchedulerEnabled, triggerCampaignSchedulerTick } from '@/lib/campaignScheduler';
import { startCampaignRunner } from '@/lib/campaignRunner';
import Campaign from '@/models/Campaign';
import CampaignRecipientClaim from '@/models/CampaignRecipientClaim';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import EmailDraft from '@/models/EmailDraft';
import draftTemplates from '@/modules/template-module/template-services/DashboardDraftTemplateLibrary';
import { buildEmailHtml } from '../../../../../components/email/EmailRenderingSystem';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

const STEP_CONFIG = {
  1: { type: 'cover_story', label: 'Cover Story' },
  2: { type: 'reminder', label: 'Reminder' },
  3: { type: 'follow_up', label: 'Follow Up' },
  4: { type: 'updated_cost', label: 'Updated Cost' },
  5: { type: 'final_cost', label: 'Final Call' }
};

const DRAFT_TYPE_ALIASES = {
  follow_up: ['follow_up', 'followup', 'open_followup'],
  final_cost: ['final_cost', 'final_followup']
};
const DRAFT_TYPE_TO_STEP = {
  cover_story: 1,
  initial_outreach: 1,
  reminder: 2,
  follow_up: 3,
  followup: 3,
  open_followup: 3,
  updated_cost: 4,
  final_cost: 5,
  final_followup: 5
};

function jsonError({ status = 400, code = 'NEXT_STEP_FAILED', message = 'Unable to queue next campaign mail.', campaignId = '', userEmail = '' }) {
  console.error(`[api/campaigns/[id]/next-step] ${code}: ${message}`, { campaignId, userEmail });
  return NextResponse.json({ success: false, ok: false, code, message, error: message }, { status, headers: NO_STORE_HEADERS });
}

function normalizeProject(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return ['tec', 'tut'].includes(normalized) ? normalized : '';
}

function normalizeDraftType(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'followup' || normalized === 'open_followup') return 'follow_up';
  if (normalized === 'final_followup') return 'final_cost';
  if (normalized === 'initial_outreach') return 'cover_story';
  return normalized;
}

function buildDraftQuery(auth, campaign, draftType) {
  const aliases = DRAFT_TYPE_ALIASES[draftType] || [draftType];
  const query = buildAuthOwnerFilter(auth, { draftType: { $in: aliases } });
  const project = normalizeProject(campaign.project || campaign.projectId || campaign.projectName || '');
  const senderFrom = String(campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user || '').trim().toLowerCase();
  const preferredClauses = [];
  if (project) preferredClauses.push({ project });
  if (senderFrom) preferredClauses.push({ senderFrom });
  return { query, preferredClauses };
}

async function resolveNextTemplate(auth, campaign, nextType) {
  const { query, preferredClauses } = buildDraftQuery(auth, campaign, nextType);
  let draft = null;

  if (preferredClauses.length) {
    draft = await EmailDraft.findOne({ ...query, $or: preferredClauses }).sort({ updatedAt: -1, createdAt: -1 }).lean();
  }
  if (!draft) {
    draft = await EmailDraft.findOne(query).sort({ updatedAt: -1, createdAt: -1 }).lean();
  }

  if (draft) {
    const html = buildEmailHtml(draft.bodyHtml || draft.html || draft.body || '');
    return {
      draftId: draft._id,
      subject: String(draft.subject || '').trim(),
      bodyHtml: html,
      bodyText: draft.bodyText || ''
    };
  }

  const fallback = draftTemplates[nextType] || draftTemplates.reminder;
  const html = buildEmailHtml(fallback?.body || '');
  return {
    draftId: null,
    subject: String(fallback?.subject || `${STEP_CONFIG[2].label}: ${campaign.name}`).trim(),
    bodyHtml: html,
    bodyText: ''
  };
}

export async function POST(req, { params }) {
  const campaignId = String(params?.id || '').trim();
  let userEmail = '';

  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    if (!mongoose.isValidObjectId(campaignId)) {
      return jsonError({ status: 400, code: 'INVALID_CAMPAIGN_ID', message: 'Invalid campaign id.', campaignId, userEmail });
    }

    await connectDB();
    const ownerQuery = buildAuthOwnerFilter(auth, { _id: campaignId });
    const campaign = await Campaign.findOne(ownerQuery);
    if (!campaign) {
      return jsonError({ status: 404, code: 'CAMPAIGN_NOT_FOUND', message: 'Campaign not found for current user.', campaignId, userEmail });
    }

    const currentStatus = String(campaign.status || '');
    if (['Running', 'Queued', 'Scheduled'].includes(currentStatus)) {
      return jsonError({
        status: 409,
        code: 'CAMPAIGN_ALREADY_ACTIVE',
        message: 'This campaign is already active. Wait for it to finish before sending the next mail.',
        campaignId,
        userEmail
      });
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const completedStepSummary = await CampaignRecipientLog.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $addFields: {
          completedStep: {
            $max: {
              $map: {
                input: { $ifNull: ['$stepLogs', []] },
                as: 'step',
                in: {
                  $cond: [
                    { $in: ['$$step.status', ['Sent', 'Opened', 'Replied']] },
                    { $ifNull: ['$$step.stepNumber', 0] },
                    0
                  ]
                }
              }
            }
          }
        }
      },
      { $group: { _id: '$campaignId', completedStep: { $max: '$completedStep' } } }
    ]);
    const currentStepFromHistory = Math.floor(Number(completedStepSummary?.[0]?.completedStep || 0) || 0);
    const currentStepFromWorkflow = Math.floor(Number(campaign.workflowStep || 0) || 0);
    const currentStepFromType = DRAFT_TYPE_TO_STEP[normalizeDraftType(campaign.draftType || campaign.type || '')] || 0;
    const currentStep = Math.max(1, Math.min(5, currentStepFromHistory || currentStepFromType || currentStepFromWorkflow || 1));
    const requestedStep = Number(body?.step || 0);
    const requestedType = normalizeDraftType(body?.draftType || body?.type || '');
    const requestedTypeStep = DRAFT_TYPE_TO_STEP[requestedType] || 0;
    const nextStep = requestedStep >= 2 && requestedStep <= 5 ? requestedStep : requestedTypeStep >= 2 ? requestedTypeStep : currentStep + 1;
    const nextConfig = STEP_CONFIG[nextStep];
    if (!nextConfig) {
      return jsonError({
        status: 409,
        code: 'NO_NEXT_STEP',
        message: 'This campaign is already at the final mail step.',
        campaignId,
        userEmail
      });
    }

    const recipientCount = await CampaignRecipientLog.countDocuments({ campaignId: campaign._id });
    const totalRecipients = Number(campaign.totalRecipients || campaign.stats?.total || recipientCount || 0);
    const reviewedInlineTemplate = body?.inlineTemplate && typeof body.inlineTemplate === 'object' ? body.inlineTemplate : null;
    const reviewedSubject = String(reviewedInlineTemplate?.subject || '').trim();
    const reviewedBody = String(reviewedInlineTemplate?.bodyHtml || reviewedInlineTemplate?.body || '').trim();
    const nextTemplate = reviewedSubject && reviewedBody
      ? {
          draftId: body?.draftId && mongoose.isValidObjectId(String(body.draftId)) ? body.draftId : null,
          subject: reviewedSubject,
          bodyHtml: buildEmailHtml(reviewedBody),
          bodyText: String(reviewedInlineTemplate?.bodyText || '')
        }
      : await resolveNextTemplate(auth, campaign, nextConfig.type);
    const now = new Date();

    await CampaignRecipientClaim.deleteMany({ campaignId: campaign._id });

    campaign.workflowStep = nextStep;
    campaign.workflowStepLabel = nextConfig.label;
    campaign.type = nextConfig.type;
    campaign.draftType = nextConfig.type;
    campaign.draftId = nextTemplate.draftId;
    campaign.templateId = null;
    campaign.inlineTemplate = {
      subject: nextTemplate.subject,
      body: nextTemplate.bodyHtml,
      bodyHtml: nextTemplate.bodyHtml,
      bodyText: nextTemplate.bodyText
    };
    campaign.options = {
      ...(campaign.options || {}),
      ...(body?.options && typeof body.options === 'object' ? body.options : {})
    };
    campaign.tracking = {
      ...(campaign.tracking || {}),
      ...(body?.tracking && typeof body.tracking === 'object' ? body.tracking : {})
    };
    campaign.status = 'Queued';
    campaign.scheduleMode = 'send_now';
    campaign.scheduledAt = null;
    campaign.scheduledStart = {
      country: campaign.country || 'India',
      slot: '',
      timezone: campaign.timezone || 'Asia/Kolkata',
      label: '',
      at: null
    };
    campaign.queueRequestedAt = now;
    campaign.queueReason = `Queued for ${nextConfig.label}`;
    campaign.workerStatus = '';
    campaign.workerId = '';
    campaign.workerLockedBy = '';
    campaign.workerLockedAt = null;
    campaign.workerHeartbeatAt = null;
    campaign.finishedAt = null;
    campaign.lastRunError = '';
    campaign.lastRunErrorAt = null;
    campaign.failureReason = '';
    campaign.lastError = '';
    campaign.lastErrorAt = null;
    campaign.stats = {
      ...(campaign.stats || {}),
      total: totalRecipients,
      sent: 0,
      failed: 0,
      bounced: 0,
      spam: 0,
      pending: totalRecipients
    };
    campaign.totalRecipients = totalRecipients;
    campaign.sentCount = 0;
    campaign.failedCount = 0;
    campaign.pendingCount = totalRecipients;
    campaign.lastActivityAt = now;
    campaign.logs = campaign.logs || [];
    campaign.logs.push({
      level: 'info',
      message: `Same campaign queued for ${nextConfig.label} (step ${nextStep}). Recipient claims reset for next mail.`,
      at: now
    });

    await campaign.save();

    let runnerResult = null;
    if (isInAppCampaignSchedulerEnabled()) {
      runnerResult = await startCampaignRunner(String(campaign._id), { trigger: 'manual-next-step' });
    } else {
      await triggerCampaignSchedulerTick();
    }

    const latest = await Campaign.findOne(ownerQuery).lean();
    return NextResponse.json({
      success: true,
      ok: true,
      campaign: latest,
      step: nextStep,
      stepLabel: nextConfig.label,
      queued: !runnerResult?.started,
      started: Boolean(runnerResult?.started),
      message: runnerResult?.started
        ? `${nextConfig.label} started for the same campaign.`
        : `${nextConfig.label} queued for the same campaign.`
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return jsonError({
      status: 500,
      code: 'NEXT_STEP_FAILED',
      message: error.message || 'Unable to queue next campaign mail.',
      campaignId,
      userEmail
    });
  }
}
