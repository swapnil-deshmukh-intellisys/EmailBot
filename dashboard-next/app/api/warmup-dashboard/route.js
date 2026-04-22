import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import SenderAccount from '@/models/SenderAccount';
import Campaign from '@/models/Campaign';
import WarmupAutoReplyLog from '@/models/WarmupAutoReplyLog';
import { requireUser } from '@/lib/apiAuth';
import { getRuntimeSenderAccounts } from '@/lib/senderAccounts';
import { getWarmupAutoReplySetting, processWarmupAutoReplies } from '@/lib/warmupAutoReply';

function toPublicAccount(a) {
  return {
    id: a.id,
    provider: a.provider,
    label: a.label,
    from: a.from,
    status: 'Connected'
  };
}

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();

    const [setting, oauthAccounts, senderAccounts, logs, storedCampaigns] = await Promise.all([
      getWarmupAutoReplySetting(userEmail, { lean: true }),
      GraphOAuthAccount.find({ userEmail }).sort({ updatedAt: -1 }).lean(),
      SenderAccount.find({ userEmail }).sort({ updatedAt: -1 }).lean(),
      WarmupAutoReplyLog.find({ userEmail }).sort({ repliedAt: -1, createdAt: -1 }).limit(50).lean(),
      Campaign.find({ userEmail, project: 'warmup' }).sort({ createdAt: -1 }).limit(25).lean()
    ]);

    const campaigns = await Campaign.find({ userEmail, project: 'warmup' }).sort({ createdAt: -1 }).limit(25).lean();

    const envAccounts = getRuntimeSenderAccounts().map(toPublicAccount);
    const oauthPublic = oauthAccounts.map((a) => ({
      id: `oauth:${String(a._id)}`,
      provider: 'graph_oauth',
      label: 'Outlook / Microsoft 365',
      from: a.email,
      status: 'Connected'
    }));
    const senderPublic = senderAccounts.map((a) => ({
      id: `db:${String(a._id)}`,
      provider: a.provider,
      label: a.label || (a.provider === 'gmail' ? 'Gmail' : 'SMTP'),
      from: a.from,
      status: 'Connected'
    }));

    const accountMap = new Map();
    [...envAccounts, ...oauthPublic, ...senderPublic].forEach((account) => {
      const key = String(account.from || '').trim().toLowerCase();
      if (key && !accountMap.has(key)) {
        accountMap.set(key, account);
      }
    });
    const accounts = Array.from(accountMap.values()).sort((a, b) => String(a.from || '').localeCompare(String(b.from || '')));

    const logCountByMailbox = logs.reduce((acc, log) => {
      const mailbox = String(log.mailboxEmail || '').trim().toLowerCase();
      if (!mailbox) return acc;
      acc[mailbox] = acc[mailbox] || { replied: 0, failed: 0, latestAt: null };
      if (log.status === 'replied') acc[mailbox].replied += 1;
      if (log.status === 'failed') acc[mailbox].failed += 1;
      const repliedAt = log.repliedAt ? new Date(log.repliedAt) : null;
      if (repliedAt && (!acc[mailbox].latestAt || repliedAt > new Date(acc[mailbox].latestAt))) {
        acc[mailbox].latestAt = repliedAt;
      }
      return acc;
    }, {});

    const rows = accounts.map((account) => {
      const mailbox = String(account.from || '').trim().toLowerCase();
      const mailboxStats = logCountByMailbox[mailbox] || { replied: 0, failed: 0, latestAt: null };
      return {
        ...account,
        trend: account.status === 'Connected' ? 'Ready' : 'Needs setup',
        repliedCount: mailboxStats.replied,
        failedCount: mailboxStats.failed,
        lastReplyAt: mailboxStats.latestAt
      };
    });

    const repliedLogs = logs.filter((log) => log.status === 'replied');
    const failedLogs = logs.filter((log) => log.status === 'failed');

    return NextResponse.json({
      setting,
      accounts: rows,
      stats: {
        totalAccounts: rows.length,
        connected: rows.filter((row) => String(row.status).toLowerCase() === 'connected').length,
        needsSetup: rows.filter((row) => String(row.status).toLowerCase() !== 'connected').length,
        providers: new Set(rows.map((row) => String(row.provider || '').toLowerCase()).filter(Boolean)).size,
        totalReplies: repliedLogs.length,
        totalFailedReplies: failedLogs.length,
        totalWarmupCampaigns: campaigns.length,
        runningWarmupCampaigns: campaigns.filter((campaign) => String(campaign.status || '').toLowerCase() === 'running').length
      },
      campaigns: campaigns.map((campaign) => ({
        id: String(campaign._id),
        name: campaign.name || 'Warmup campaign',
        status: campaign.status || 'Draft',
        senderFrom: campaign.senderFrom || campaign.senderAccount?.from || '',
        draftType: campaign.draftType || campaign.type || '',
        total: Number(campaign?.stats?.total || 0),
        sent: Number(campaign?.stats?.sent || 0),
        pending: Number(campaign?.stats?.pending || 0),
        failed: Number(campaign?.stats?.failed || 0),
        createdAt: campaign.createdAt || null,
        lastLog: Array.isArray(campaign.logs) && campaign.logs.length ? campaign.logs[campaign.logs.length - 1] : null,
        logs: Array.isArray(campaign.logs) ? campaign.logs.slice(-10).reverse() : []
      })),
      activity: logs.map((log) => ({
        id: String(log._id),
        mailboxEmail: log.mailboxEmail,
        fromEmail: log.fromEmail,
        subject: log.subject,
        status: log.status,
        note: log.note,
        replyBody: log.replyBody || '',
        repliedAt: log.repliedAt
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load warmup dashboard' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    const body = await req.json().catch(() => ({}));
    const setting = await getWarmupAutoReplySetting(userEmail);

    if (Object.prototype.hasOwnProperty.call(body, 'enabled')) {
      setting.enabled = Boolean(body.enabled);
    }
    await setting.save();

    const run = body.runNow ? await processWarmupAutoReplies(userEmail, { force: true }) : null;
    return NextResponse.json({ ok: true, setting, run });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update warmup dashboard' }, { status: 500 });
  }
}


