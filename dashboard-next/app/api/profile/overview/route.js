import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import Campaign from '@/models/Campaign';
import CampaignRecipientLog from '@/models/CampaignRecipientLog';
import LeadList from '@/models/LeadList';
import SenderAccount from '@/models/SenderAccount';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import EmailDraft from '@/models/EmailDraft';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};

function numberValue(...values) {
  for (const value of values) {
    const next = Number(value);
    if (Number.isFinite(next)) return next;
  }
  return 0;
}

function statusKey(value = '') {
  return String(value || 'Draft').trim() || 'Draft';
}

function campaignProject(campaign = {}) {
  const id = String(campaign.projectId || campaign.project || campaign.projectName || 'default').trim() || 'default';
  const name = String(campaign.projectName || campaign.project || campaign.projectId || 'Default project').trim() || 'Default project';
  return { id, name };
}

function buildDirectOwnerMatch(user = {}, session = {}) {
  const userId = String(user?._id || user?.id || '').trim();
  const userEmail = String(user?.email || user?.identifier || session?.email || session?.identifier || '').trim().toLowerCase();
  const intellisysUserId = String(user?.intellisysUserId || user?.employeeId || user?.identifier || session?.intellisysUserId || '').trim().toLowerCase();
  const or = [];
  if (userId && mongoose.Types.ObjectId.isValid(userId)) or.push({ userId: new mongoose.Types.ObjectId(userId) });
  if (userEmail) or.push({ userEmail });
  if (intellisysUserId) or.push({ intellisysUserId });
  return or.length ? { $or: or } : { _id: null };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    await connectDB();
    const ownerQuery = buildAuthOwnerFilter(auth);
    const user = auth.currentUser || auth.session || {};
    const userId = String(user?._id || user?.id || '').trim();
    const userEmail = String(user?.email || user?.identifier || auth.session?.email || '').trim().toLowerCase();
    const ownerMatch = buildDirectOwnerMatch(user, auth.session);
    const activeListMatch = { $and: [ownerMatch, { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }] };

    const [
      campaignCount,
      campaignStatusRows,
      campaignTotalsRows,
      projectRows,
      campaigns,
      recipientSummary,
      listCount,
      listProjectRows,
      senderAccounts,
      graphAccounts,
      draftCount
    ] = await Promise.all([
      Campaign.countDocuments(ownerQuery),
      Campaign.aggregate([
        { $match: ownerMatch },
        { $group: { _id: { $ifNull: ['$status', 'Draft'] }, count: { $sum: 1 } } }
      ]).catch(() => []),
      Campaign.aggregate([
        { $match: ownerMatch },
        {
          $group: {
            _id: null,
            recipients: { $sum: { $ifNull: ['$totalRecipients', { $ifNull: ['$stats.total', 0] }] } },
            sent: { $sum: { $ifNull: ['$sentCount', { $ifNull: ['$stats.sent', 0] }] } },
            failed: { $sum: { $ifNull: ['$failedCount', { $ifNull: ['$stats.failed', 0] }] } },
            pending: { $sum: { $ifNull: ['$pendingCount', { $ifNull: ['$stats.pending', 0] }] } },
            opens: { $sum: { $ifNull: ['$openCount', { $ifNull: ['$trackingStats.openCount', 0] }] } },
            replies: { $sum: { $ifNull: ['$replyCount', { $ifNull: ['$trackingStats.replyCount', 0] }] } }
          }
        }
      ]).catch(() => []),
      Campaign.aggregate([
        { $match: ownerMatch },
        {
          $group: {
            _id: { $ifNull: ['$projectId', { $ifNull: ['$project', 'default'] }] },
            name: { $first: { $ifNull: ['$projectName', { $ifNull: ['$project', '$projectId'] }] } },
            campaigns: { $sum: 1 },
            running: { $sum: { $cond: [{ $eq: ['$status', 'Running'] }, 1, 0] } },
            sent: { $sum: { $ifNull: ['$sentCount', { $ifNull: ['$stats.sent', 0] }] } },
            failed: { $sum: { $ifNull: ['$failedCount', { $ifNull: ['$stats.failed', 0] }] } },
            senders: { $addToSet: { $ifNull: ['$senderFrom', { $ifNull: ['$senderAccount.from', '$senderAccount.user'] }] } },
            lastUpdatedAt: { $max: { $ifNull: ['$lastActivityAt', '$updatedAt'] } }
          }
        },
        { $sort: { campaigns: -1, lastUpdatedAt: -1 } }
      ]).catch(() => []),
      Campaign.find(ownerQuery)
        .select('name status project projectId projectName senderFrom senderAccount senderAccountId sentCount failedCount pendingCount totalRecipients stats openCount replyCount createdAt updatedAt lastActivityAt')
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
      CampaignRecipientLog.aggregate([
        { $match: ownerMatch },
        {
          $group: {
            _id: null,
            recipients: { $sum: 1 },
            sent: { $sum: '$sentCount' },
            failed: { $sum: '$failedCount' },
            pending: { $sum: '$pendingCount' },
            opens: { $sum: '$openCount' },
            replies: { $sum: '$replyCount' }
          }
        }
      ]).catch(() => []),
      LeadList.countDocuments({ $and: [ownerQuery, { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }] }),
      LeadList.aggregate([
        { $match: activeListMatch },
        {
          $group: {
            _id: { $ifNull: ['$projectId', { $ifNull: ['$project', 'default'] }] },
            name: { $first: { $ifNull: ['$project', '$projectId'] } },
            lists: { $sum: 1 },
            lastUpdatedAt: { $max: { $ifNull: ['$updatedAt', '$uploadedAt'] } }
          }
        }
      ]).catch(() => []),
      SenderAccount.find(userEmail ? { userEmail } : ownerQuery).select('from provider label status health sentToday dailyLimit errorCount updatedAt createdAt').sort({ updatedAt: -1 }).lean().catch(() => []),
      GraphOAuthAccount.find(userEmail ? { userEmail } : { _id: null }).select('email status health updatedAt createdAt').sort({ updatedAt: -1 }).lean().catch(() => []),
      EmailDraft.countDocuments(ownerQuery).catch(() => 0)
    ]);

    const campaignStatusCounts = campaignStatusRows.reduce((acc, row) => {
      const key = statusKey(row._id);
      acc[key] = Number(row.count || 0);
      return acc;
    }, {});

    const campaignTotals = campaignTotalsRows[0] || { recipients: 0, sent: 0, failed: 0, pending: 0, opens: 0, replies: 0 };
    const logTotals = recipientSummary[0] || {};
    const mailTotals = {
      recipients: Math.max(campaignTotals.recipients, numberValue(logTotals.recipients)),
      sent: Math.max(campaignTotals.sent, numberValue(logTotals.sent)),
      failed: Math.max(campaignTotals.failed, numberValue(logTotals.failed)),
      pending: Math.max(campaignTotals.pending, numberValue(logTotals.pending)),
      opens: Math.max(campaignTotals.opens, numberValue(logTotals.opens)),
      replies: Math.max(campaignTotals.replies, numberValue(logTotals.replies))
    };

    const projectMap = new Map();
    projectRows.forEach((projectRow) => {
      const id = String(projectRow._id || 'default').trim() || 'default';
      projectMap.set(id, {
        id,
        name: String(projectRow.name || projectRow._id || 'Default project').trim() || 'Default project',
        campaigns: Number(projectRow.campaigns || 0),
        running: Number(projectRow.running || 0),
        sent: Number(projectRow.sent || 0),
        failed: Number(projectRow.failed || 0),
        lists: 0,
        senders: new Set((projectRow.senders || []).filter(Boolean)),
        lastUpdatedAt: projectRow.lastUpdatedAt || null
      });
    });
    listProjectRows.forEach((listRow) => {
      const id = String(listRow._id || 'default').trim() || 'default';
      if (!projectMap.has(id)) {
        projectMap.set(id, {
          id,
          name: String(listRow.name || listRow._id || 'Default project').trim() || 'Default project',
          campaigns: 0,
          running: 0,
          sent: 0,
          failed: 0,
          lists: 0,
          senders: new Set(),
          lastUpdatedAt: listRow.lastUpdatedAt || null
        });
      }
      const row = projectMap.get(id);
      row.lists = Number(listRow.lists || 0);
      if (listRow.lastUpdatedAt && (!row.lastUpdatedAt || new Date(listRow.lastUpdatedAt) > new Date(row.lastUpdatedAt))) {
        row.lastUpdatedAt = listRow.lastUpdatedAt;
      }
    });

    const projects = Array.from(projectMap.values()).map((project) => ({
      ...project,
      senders: Array.from(project.senders)
    }));

    const connectedMailIds = [
      ...senderAccounts.map((account) => ({
        id: String(account._id || account.id || account.from || ''),
        email: account.from,
        provider: account.provider || 'SMTP',
        status: account.status || 'Connected',
        health: account.health || (Number(account.errorCount || 0) ? 'Needs attention' : 'Good'),
        sentToday: numberValue(account.sentToday),
        dailyLimit: numberValue(account.dailyLimit, 250),
        updatedAt: account.updatedAt || account.createdAt || null
      })),
      ...graphAccounts.map((account) => ({
        id: String(account._id || account.email || ''),
        email: account.email,
        provider: 'Microsoft Graph',
        status: account.status || 'Connected',
        health: account.health || 'Good',
        sentToday: 0,
        dailyLimit: 250,
        updatedAt: account.updatedAt || account.createdAt || null
      }))
    ].filter((account) => account.email);

    return NextResponse.json({
      ok: true,
      user: {
        id: userId || userEmail,
        email: userEmail,
        role: user?.role || auth.session?.role || 'user',
        intellisysUserId: user?.intellisysUserId || user?.employeeId || userId || userEmail
      },
      totals: {
        campaigns: campaignCount,
        runningCampaigns: numberValue(campaignStatusCounts.Running),
        completedCampaigns: numberValue(campaignStatusCounts.Completed),
        failedCampaigns: numberValue(campaignStatusCounts.Failed),
        lists: listCount,
        drafts: draftCount,
        mailIds: connectedMailIds.length,
        ...mailTotals
      },
      campaignStatusCounts,
      projects,
      connectedMailIds,
      recentCampaigns: campaigns.slice(0, 12).map((campaign) => {
        const project = campaignProject(campaign);
        return {
          id: String(campaign._id || ''),
          name: campaign.name || 'Campaign',
          status: statusKey(campaign.status),
          projectId: project.id,
          projectName: project.name,
          sender: campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user || '',
          sent: numberValue(campaign.sentCount, campaign.stats?.sent),
          failed: numberValue(campaign.failedCount, campaign.stats?.failed),
          updatedAt: campaign.lastActivityAt || campaign.updatedAt || campaign.createdAt || null
        };
      })
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to load profile overview' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
