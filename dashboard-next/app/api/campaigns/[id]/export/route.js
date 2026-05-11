import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import { requireAuth } from '@/lib/apiAuth';
import { ensureRecipientLogsForCampaign } from '@/core-lib/campaign-engine/CampaignAnalyticsService';

function csvEscape(value = '') {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowFromLog(item = {}, campaign = {}) {
  const steps = Array.from({ length: 5 }, (_, index) => item.stepLogs?.find((step) => Number(step.stepNumber) === index + 1) || {});
  return {
    'Campaign Name': item.campaignName || campaign.name || '',
    'Client Name': item.clientName || '',
    Email: item.email || '',
    Company: item.company || '',
    Designation: item.designation || '',
    Project: item.projectName || '',
    'Campaign Step': item.currentStep || '',
    'Mail 1 Sent': steps[0].sentAt || '',
    'Mail 1 Status': steps[0].status || '',
    'Mail 2 Sent': steps[1].sentAt || '',
    'Mail 2 Status': steps[1].status || '',
    'Mail 3 Sent': steps[2].sentAt || '',
    'Mail 3 Status': steps[2].status || '',
    'Mail 4 Sent': steps[3].sentAt || '',
    'Mail 4 Status': steps[3].status || '',
    'Mail 5 Sent': steps[4].sentAt || '',
    'Mail 5 Status': steps[4].status || '',
    Opened: item.openCount > 0 ? 'Yes' : 'No',
    'Open Count': item.openCount || 0,
    'Last Opened At': item.lastOpenedAt || '',
    Replied: item.replyReceived ? 'Yes' : 'No',
    'Reply Count': item.replyCount || 0,
    'Last Reply At': item.lastReplyAt || '',
    'Reply Type': item.replyType || '',
    'Reply Message Preview': item.replyPreview || '',
    'Follow-up Stopped': item.followUpStopped ? 'Yes' : 'No',
    'Failure Reason': item.failureReason || '',
    'Last Activity': item.lastActivityAt || '',
    Notes: item.notes || ''
  };
}

export async function GET(req, { params }) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
  const campaignId = String(params?.id || '').trim();
  if (!mongoose.isValidObjectId(campaignId)) return NextResponse.json({ error: 'Invalid campaign id' }, { status: 400 });
  await connectDB();
  const campaign = await Campaign.findOne({ _id: campaignId, userEmail }).lean();
  if (!campaign) return NextResponse.json({ error: 'Campaign not found for current user' }, { status: 404 });
  await ensureRecipientLogsForCampaign(campaign);
  const rows = (await CampaignRecipientLog.find({ campaignId: campaign._id }).sort({ clientName: 1 }).lean())
    .map((item) => rowFromLog(item, campaign));
  const format = String(new URL(req.url).searchParams.get('format') || 'csv').toLowerCase();
  const baseName = String(campaign.name || 'campaign-report').replace(/[^\w-]+/g, '-').slice(0, 80);

  if (format === 'xlsx' || format === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Campaign Results');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseName}.xlsx"`
      }
    });
  }

  const headers = Object.keys(rows[0] || rowFromLog({}, campaign));
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${baseName}.csv"`
    }
  });
}
