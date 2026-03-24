import { NextResponse } from 'next/server';

import connectDB from '@/lib/mongodb';

import Campaign from '@/models/Campaign';

import LeadList from '@/models/LeadList';

import EmailTemplate from '@/models/EmailTemplate';

import { resolveSenderAccountById } from '@/lib/senderAccounts';



export async function GET() {

  try {

    await connectDB();

    const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean();

    return NextResponse.json({ campaigns });

  } catch (error) {

    return NextResponse.json({ campaigns: [], error: error.message || 'Failed to load campaigns' });

  }

}



export async function POST(req) {

  try {

    await connectDB();

    const body = await req.json();



    const { name, listId, templateId, options, draftType, inlineTemplate, senderAccountId } = body;

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

    const total = rowRange ? (rangeEnd - rangeStart + 1) : list.leads.length;
    const batchSize = rangeMatch ? 1 : Math.max(1, Number(options?.batchSize || 1));

    const campaign = await Campaign.create({

      name,

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

        rowRange

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

