import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import SenderAccount from '@/models/SenderAccount';
import Campaign from '@/models/Campaign';
import LeadList from '@/models/LeadList';
import WarmupAutoReplyLog from '@/models/WarmupAutoReplyLog';
import { requireUser } from '@/lib/apiAuth';
import { getRuntimeSenderAccounts } from '@/lib/senderAccounts';
import { getWarmupAutoReplySetting, processWarmupAutoReplies } from '@/lib/warmupAutoReply';

const WARMUP_DRAFT_TYPE = 'cover_story';

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
    await processWarmupAutoReplies(userEmail).catch(() => null);

    const [setting, oauthAccounts, senderAccounts, logs] = await Promise.all([
      getWarmupAutoReplySetting(userEmail, { lean: true }),
      GraphOAuthAccount.find({ userEmail }).sort({ updatedAt: -1 }).lean(),
      SenderAccount.find({ userEmail }).sort({ updatedAt: -1 }).lean(),
      WarmupAutoReplyLog.find({ userEmail }).sort({ repliedAt: -1, createdAt: -1 }).limit(50).lean()
    ]);

    const workspace = setting?.workspace || {};
    const savedListId = workspace?.listId ? String(workspace.listId) : '';
    const [campaigns, savedSheet] = await Promise.all([
      Campaign.find({
        userEmail,
        $or: [
          { project: 'warmup' },
          { name: /^Warmup\b/i },
          { type: WARMUP_DRAFT_TYPE },
          { draftType: WARMUP_DRAFT_TYPE }
        ]
      }).sort({ updatedAt: -1, createdAt: -1 }).limit(50).lean(),
      savedListId ? LeadList.findOne({ _id: savedListId, userEmail }).lean() : Promise.resolve(null)
    ]);

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
      workspace: {
        project: String(workspace.project || ''),
        senderAccountId: String(workspace.senderAccountId || ''),
        draftType: String(workspace.draftType || 'cover_story'),
        draftId: workspace.draftId ? String(workspace.draftId) : '',
        listId: savedListId,
        fileName: String(workspace.fileName || savedSheet?.sourceFile || savedSheet?.name || ''),
        updatedAt: workspace.updatedAt || null
      },
      savedSheet: savedSheet ? {
        _id: String(savedSheet._id),
        name: savedSheet.name || '',
        sourceFile: savedSheet.sourceFile || '',
        columns: Array.isArray(savedSheet.columns) ? savedSheet.columns : [],
        leads: Array.isArray(savedSheet.leads) ? savedSheet.leads : []
      } : null,
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
        updatedAt: campaign.updatedAt || campaign.lastActivityAt || campaign.createdAt || null,
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
    if (body.workspace && typeof body.workspace === 'object') {
      const workspace = body.workspace;
      if (!setting.workspace) setting.workspace = {};
      const project = String(workspace.project || '').trim().toLowerCase();
      const senderAccountId = String(workspace.senderAccountId || '').trim();
      const draftType = String(workspace.draftType || '').trim();
      const draftId = String(workspace.draftId || '').trim();
      const listId = String(workspace.listId || '').trim();
      const fileName = String(workspace.fileName || '').trim();

      if (project || project === '') setting.workspace.project = project;
      if (senderAccountId || senderAccountId === '') setting.workspace.senderAccountId = senderAccountId;
      if (draftType) setting.workspace.draftType = draftType;
      if (draftId || Object.prototype.hasOwnProperty.call(workspace, 'draftId')) {
        setting.workspace.draftId = draftId || null;
      }
      if (listId) {
        const list = await LeadList.findOne({ _id: listId, userEmail }).select('_id sourceFile name').lean();
        if (!list) {
          return NextResponse.json({ error: 'Warmup sheet not found for current user' }, { status: 404 });
        }
        setting.workspace.listId = list._id;
        setting.workspace.fileName = fileName || list.sourceFile || list.name || '';
      } else if (Object.prototype.hasOwnProperty.call(workspace, 'listId')) {
        setting.workspace.listId = null;
        setting.workspace.fileName = fileName;
      } else if (fileName || fileName === '') {
        setting.workspace.fileName = fileName;
      }
      setting.workspace.updatedAt = new Date();
    }
    await setting.save();

    const run = body.runNow ? await processWarmupAutoReplies(userEmail, { force: true }) : null;
    return NextResponse.json({ ok: true, setting, run });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update warmup dashboard' }, { status: 500 });
  }
}


