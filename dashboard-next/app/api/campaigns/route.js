import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';

import Campaign from '@/models/Campaign';

import LeadList from '@/models/LeadList';

import EmailTemplate from '@/models/EmailTemplate';

import { resolveSenderAccountById } from '@/lib/senderAccounts';
import { requireAuth, requireUser } from '@/lib/apiAuth';
import { getRunnerState, startCampaignRunner } from '@/lib/campaignRunner';

const REPLY_CAMPAIGN_TYPES = new Set(['reminder', 'follow_up', 'updated_cost', 'final_cost', 'follow-up', 'updated cost', 'final cost']);
const FIXED_CAMPAIGN_DELAY_SECONDS = Math.max(60, Number(process.env.FIXED_CAMPAIGN_DELAY_SECONDS || 60));

function normalizeCampaignType(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

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

    const storedCampaigns = await Campaign.find(query).sort({ createdAt: -1 }).lean();

    for (const campaign of storedCampaigns) {
      if (String(campaign?.status || '') !== 'Running') continue;
      const runner = getRunnerState(String(campaign._id));
      if (runner?.running) continue;
      try {
        await startCampaignRunner(String(campaign._id), { trigger: 'recovery' });
      } catch (error) {
        // Keep the campaign visible even if recovery fails; the runner logs capture the reason.
      }
    }

    const campaigns = await Campaign.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ campaigns });

  } catch (error) {

    return NextResponse.json({ campaigns: [], error: error.message || 'Failed to load campaigns' });

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
      tracking
    } = body;

    if (!name || !listId) {

      return NextResponse.json({ error: 'name and listId are required' }, { status: 400 });

    }



    const list = await LeadList.findOne({ _id: listId, userEmail }).lean();

    if (!list) {

      return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });

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

      return NextResponse.json({ error: 'Sender account not found' }, { status: 404 });

    }



    const rawBatchInput = String(options?.batchSize ?? '').trim();
    const parsedBatchSize = Number(rawBatchInput || 1);

    if (!Number.isFinite(parsedBatchSize) || parsedBatchSize < 1) {

      return NextResponse.json({ error: 'Batch size must be a number greater than or equal to 1.' }, { status: 400 });

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
      'options.batchSize': 1,
      'options.delaySeconds': FIXED_CAMPAIGN_DELAY_SECONDS,
      'options.replyMode': replyMode
    }).lean();

    if (duplicateCampaign) {
      return NextResponse.json({ campaign: duplicateCampaign, duplicate: true });
    }

    const campaign = await Campaign.create({

      userId: auth.currentUser._id,
      userEmail,
      name,
      project: String(project || '').trim().toLowerCase(),
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
      tracking: {
        enabled: Boolean(tracking?.enabled),
        opens: Boolean(tracking?.opens),
        clicks: Boolean(tracking?.clicks),
        replies: Boolean(tracking?.replies),
        updatedAt: new Date()
      },

      options: {

        batchSize: 1,
        delaySeconds: FIXED_CAMPAIGN_DELAY_SECONDS,

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

      logs: [{ level: 'info', message: 'Campaign created', at: new Date() }]

    });



    return NextResponse.json({ campaign });

  } catch (error) {

    return NextResponse.json({ error: error.message || 'Failed to create campaign' }, { status: 500 });

  }

}

