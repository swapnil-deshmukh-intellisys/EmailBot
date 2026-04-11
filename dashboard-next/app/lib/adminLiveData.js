import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import LeadList from '@/models/LeadList';
import SenderAccount from '@/models/SenderAccount';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';

const STATUS_ORDER = ['Running', 'Scheduled', 'Paused', 'Draft', 'Completed', 'Failed'];

function normalizeStatus(value = '') {
  const text = String(value || '').trim();
  if (!text) return 'Draft';
  const found = STATUS_ORDER.find((item) => item.toLowerCase() === text.toLowerCase());
  return found || text;
}

function clampValue(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function getCampaignProgress(campaign = {}) {
  const total = Number(campaign?.stats?.total || 0);
  const sent = Number(campaign?.stats?.sent || 0);
  if (!total) return `${sent}/0`;
  return `${sent}/${total}`;
}

export async function getAdminLiveData() {
  await connectDB();

  const [campaigns, leadLists, senderAccounts, oauthAccounts] = await Promise.all([
    Campaign.find({}).sort({ createdAt: -1 }).lean(),
    LeadList.find({}).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    SenderAccount.find({}).sort({ createdAt: -1 }).lean(),
    GraphOAuthAccount.find({}).sort({ createdAt: -1 }).lean()
  ]);

  const userMap = new Map();
  const registerUser = (email = '') => {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return null;
    if (!userMap.has(normalized)) {
      userMap.set(normalized, {
        email: normalized,
        campaigns: [],
        lists: [],
        senderAccounts: [],
        oauthAccounts: [],
        lastActive: null
      });
    }
    return userMap.get(normalized);
  };

  campaigns.forEach((campaign) => {
    const user = registerUser(campaign.userEmail);
    if (!user) return;
    user.campaigns.push(campaign);
    const candidateDates = [campaign.updatedAt, campaign.createdAt, campaign.startedAt, campaign.finishedAt]
      .map((value) => (value ? new Date(value) : null))
      .filter((value) => value && !Number.isNaN(value.getTime()));
    const latest = candidateDates.sort((a, b) => b - a)[0] || null;
    if (!user.lastActive || (latest && latest > user.lastActive)) {
      user.lastActive = latest;
    }
  });

  leadLists.forEach((list) => {
    const user = registerUser(list.userEmail);
    if (!user) return;
    user.lists.push(list);
    const updatedAt = list.updatedAt ? new Date(list.updatedAt) : (list.createdAt ? new Date(list.createdAt) : null);
    if (updatedAt && !Number.isNaN(updatedAt.getTime()) && (!user.lastActive || updatedAt > user.lastActive)) {
      user.lastActive = updatedAt;
    }
  });

  senderAccounts.forEach((account) => {
    const user = registerUser(account.userEmail);
    if (!user) return;
    user.senderAccounts.push(account);
    const updatedAt = account.updatedAt ? new Date(account.updatedAt) : (account.createdAt ? new Date(account.createdAt) : null);
    if (updatedAt && !Number.isNaN(updatedAt.getTime()) && (!user.lastActive || updatedAt > user.lastActive)) {
      user.lastActive = updatedAt;
    }
  });

  oauthAccounts.forEach((account) => {
    const user = registerUser(account.userEmail);
    if (!user) return;
    user.oauthAccounts.push(account);
    const updatedAt = account.updatedAt ? new Date(account.updatedAt) : (account.createdAt ? new Date(account.createdAt) : null);
    if (updatedAt && !Number.isNaN(updatedAt.getTime()) && (!user.lastActive || updatedAt > user.lastActive)) {
      user.lastActive = updatedAt;
    }
  });

  const campaignRows = campaigns.map((campaign) => ({
    id: String(campaign._id),
    name: campaign.name,
    owner: campaign.userEmail || 'Unknown',
    status: normalizeStatus(campaign.status),
    updated: campaign.updatedAt || campaign.createdAt || null,
    progress: getCampaignProgress(campaign),
    total: Number(campaign?.stats?.total || 0),
    sent: Number(campaign?.stats?.sent || 0),
    pending: Number(campaign?.stats?.pending || 0),
    failed: Number(campaign?.stats?.failed || 0)
  }));

  const users = Array.from(userMap.values())
    .sort((a, b) => {
      const left = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const right = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return right - left;
    })
    .map((user) => {
      const latestCampaign = user.campaigns[0] || null;
      const activeCampaigns = user.campaigns.filter((item) => String(item.status || '').toLowerCase() === 'running').length;
      const pendingCampaigns = user.campaigns.filter((item) => String(item.status || '').toLowerCase() === 'draft').length;
      return {
        email: user.email,
        campaigns: user.campaigns.length,
        activeCampaigns,
        pendingCampaigns,
        lists: user.lists.length,
        senderAccounts: user.senderAccounts.length + user.oauthAccounts.length,
        lastActive: user.lastActive,
        status: activeCampaigns ? 'Active' : pendingCampaigns ? 'Pending' : latestCampaign ? normalizeStatus(latestCampaign.status) : 'Inactive'
      };
    });

  const totalCampaigns = campaigns.length;
  const runningCampaigns = campaigns.filter((item) => String(item.status || '').toLowerCase() === 'running').length;
  const pausedCampaigns = campaigns.filter((item) => String(item.status || '').toLowerCase() === 'paused').length;
  const draftCampaigns = campaigns.filter((item) => String(item.status || '').toLowerCase() === 'draft').length;
  const connectedAccounts = senderAccounts.length + oauthAccounts.length;
  const totalUsers = users.length;
  const totalLists = leadLists.length;
  const totalSent = campaigns.reduce((sum, item) => sum + Number(item?.stats?.sent || 0), 0);

  const summary = [
    { label: 'Campaigns', value: String(totalCampaigns), tone: 'blue' },
    { label: 'Users', value: String(totalUsers), tone: 'green' },
    { label: 'Managers', value: '3', tone: 'violet' }
  ];

  return {
    campaigns: campaignRows,
    users,
    summary,
    totals: {
      campaigns: totalCampaigns,
      runningCampaigns,
      pausedCampaigns,
      draftCampaigns,
      connectedAccounts,
      totalUsers,
      totalLists,
      totalSent
    }
  };
}
