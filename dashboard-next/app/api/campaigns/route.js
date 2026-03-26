import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';

import Campaign from '@/models/Campaign';

import LeadList from '@/models/LeadList';

import EmailTemplate from '@/models/EmailTemplate';

import { resolveSenderAccountById } from '@/lib/senderAccounts';

const REPLY_CAMPAIGN_TYPES = new Set(['reminder', 'follow_up', 'updated_cost', 'final_cost', 'follow-up', 'updated cost', 'final cost']);

function normalizeCampaignType(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


export async function GET(req) {

  try {

    await connectDB();
    const query = {};
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

    const campaigns = await Campaign.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ campaigns });

  } catch (error) {

    return NextResponse.json({ campaigns: [], error: error.message || 'Failed to load campaigns' });

  }

}



export async function POST(req) {

  try {

    await connectDB();

    const body = await req.json();



    const { name, listId, templateId, options, draftType, inlineTemplate, senderAccountId, type, project, senderFrom } = body;

    if (!name || !listId) {

      return NextResponse.json({ error: 'name and listId are required' }, { status: 400 });

    }



    const list = await LeadList.findById(listId).lean();

    if (!list) {

      return NextResponse.json({ error: 'Lead list not found' }, { status: 404 });

    }



    let resolvedTemplateId = templateId || null;

    if (!resolvedTemplateId && (!inlineTemplate?.subject || !inlineTemplate?.body)) {

      const fallback = await EmailTemplate.findOne().sort({ createdAt: -1 }).lean();

      resolvedTemplateId = fallback?._id || null;

    }



    const senderAccount = senderAccountId ? await resolveSenderAccountById(senderAccountId) : null;

    if (senderAccountId && !senderAccount) {

      return NextResponse.json({ error: 'Sender account not found' }, { status: 404 });

    }



    const rawBatchInput = String(options?.batchSize ?? '').trim();
    const rangeMatch = rawBatchInput.match(/^(\d+)\s*-\s*(\d+)$/);
    const rowRange = rangeMatch ? `${rangeMatch[1]}-${rangeMatch[2]}` : '';
    const rangeStart = rangeMatch ? Number(rangeMatch[1]) : null;
    const rangeEnd = rangeMatch ? Number(rangeMatch[2]) : null;

    if (rangeMatch && (!rangeStart || !rangeEnd || rangeStart > rangeEnd || rangeStart < 1 || rangeEnd > list.leads.length)) {

      return NextResponse.json({ error: `Invalid row range. Use values between 1 and ${list.leads.length}.` }, { status: 400 });

    }

    const campaignType = normalizeCampaignType(type || draftType);
    const autoReplyMode = REPLY_CAMPAIGN_TYPES.has(campaignType);
    const replyMode = typeof options?.replyMode === 'boolean' ? options.replyMode : autoReplyMode;
    const total = rowRange ? (rangeEnd - rangeStart + 1) : list.leads.length;
    const batchSize = rangeMatch ? 1 : Math.max(1, Number(options?.batchSize || 1));

    const campaign = await Campaign.create({

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

      options: {

        batchSize,

        delaySeconds: Math.max(60, Number(options?.delaySeconds || 60)),

        rowRange,
        replyMode

      },

      stats: {

        total,

        sent: 0,

        failed: 0,

        pending: total

      },

      logs: [{ level: 'info', message: 'Campaign created', at: new Date() }]

    });



    return NextResponse.json({ campaign });

  } catch (error) {

    return NextResponse.json({ error: error.message || 'Failed to create campaign' }, { status: 500 });

  }

}

