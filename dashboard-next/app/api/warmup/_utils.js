import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import LeadList from '@/models/LeadList';
import PresetSender from '@/models/PresetSender';
import SenderAccount from '@/models/SenderAccount';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import { getPresetSenderEmails, getRuntimeSenderAccounts, resolveSenderAccountById } from '@/lib/senderAccounts';
import { getWarmupAutoReplySetting } from '@/lib/warmupAutoReply';
import { isGraphAppOnlyEnabled } from '@/core-lib/mail-engine/MicrosoftGraphOAuthScopes';

export const WARMUP_MIN_LEADS = 1;
export const WARMUP_TARGET_LEADS = 46;
export const WARMUP_MASTER_KIND = 'warmup';
export const WARMUP_CAMPAIGN_LIST_KIND = 'warmup-campaign';
export const WARMUP_DRAFT_TYPE = 'cover_story';
export const WARMUP_PROJECTS = [
  { value: 'tec', label: 'TEC' },
  { value: 'tut', label: 'TUT' }
];

const PROJECT_DOMAINS = {
  tec: 'theentrepreneurialchronicle.com',
  tut: 'theunicorntimes.com'
};

export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};

export function normalizeProject(value = '') {
  const project = String(value || '').trim().toLowerCase();
  return ['tec', 'tut'].includes(project) ? project : '';
}

export function inferProjectFromEmail(email = '') {
  const value = String(email || '').trim().toLowerCase();
  if (!value) return '';
  if (value.endsWith(`@${PROJECT_DOMAINS.tec}`)) return 'tec';
  if (value.endsWith(`@${PROJECT_DOMAINS.tut}`)) return 'tut';
  if (getPresetSenderEmails('tec').includes(value)) return 'tec';
  if (getPresetSenderEmails('tut').includes(value)) return 'tut';
  return '';
}

export function toProjectLabel(project = '') {
  return WARMUP_PROJECTS.find((item) => item.value === project)?.label || String(project || '').toUpperCase();
}

function toPublicAccount(account = {}) {
  const from = String(account.from || account.email || '').trim().toLowerCase();
  return {
    id: account.id,
    provider: account.provider || 'graph',
    label: account.label || 'Sender',
    from,
    project: normalizeProject(account.project) || inferProjectFromEmail(from),
    status: account.status || 'Connected',
    dailyLimit: Number(account.dailyLimit || 250),
    sentToday: Number(account.sentToday || 0)
  };
}

export async function getWarmupProjects(userEmail = '') {
  const [draftProjects, listProjects, campaignProjects, presetProjects] = await Promise.all([
    EmailDraft.distinct('project', { userEmail }),
    LeadList.distinct('project', { userEmail }),
    Campaign.distinct('project', { userEmail }),
    PresetSender.distinct('project', {})
  ]);
  const values = new Set(['tec', 'tut']);
  [...draftProjects, ...listProjects, ...campaignProjects, ...presetProjects].forEach((value) => {
    const project = normalizeProject(value);
    if (project) values.add(project);
  });
  return Array.from(values).map((value) => ({ value, label: toProjectLabel(value) }));
}

export async function getWarmupSenders({ userEmail, project }) {
  const normalizedProject = normalizeProject(project);
  if (!normalizedProject) return [];
  const [dbAccounts, oauthAccounts, presetSenders] = await Promise.all([
    SenderAccount.find({ userEmail }).sort({ createdAt: -1 }).lean(),
    GraphOAuthAccount.find({ userEmail }).sort({ createdAt: -1 }).lean(),
    PresetSender.find({ project: normalizedProject }).lean()
  ]);

  const graphReady = isGraphAppOnlyEnabled();
  const runtime = getRuntimeSenderAccounts(normalizedProject).map((account) => toPublicAccount({ ...account, project: normalizedProject }));
  const db = dbAccounts.map((account) => toPublicAccount({
    id: `db:${String(account._id)}`,
    provider: account.provider,
    label: account.label || 'Sender',
    from: account.from,
    status: account.status || 'Connected',
    dailyLimit: account.dailyLimit,
    sentToday: account.sentToday
  }));
  const oauth = oauthAccounts.map((account) => toPublicAccount({
    id: `oauth:${String(account._id)}`,
    provider: 'graph_oauth',
    label: 'Outlook / Microsoft 365',
    from: account.email,
    status: account.status || 'Connected'
  }));
  const preset = presetSenders.map((entry) => toPublicAccount({
    id: `graphapp:${String(entry.email || '').trim().toLowerCase()}`,
    provider: graphReady ? 'graph' : 'graph_oauth',
    label: graphReady ? 'Outlook / Microsoft 365 (Graph App)' : 'Outlook / Microsoft 365',
    from: entry.email,
    project: normalizedProject,
    status: graphReady ? 'Connected' : 'Not connected'
  }));

  const allowed = new Set(getPresetSenderEmails(normalizedProject));
  const map = new Map();
  [...runtime, ...db, ...oauth, ...preset].forEach((account) => {
    const from = String(account.from || '').trim().toLowerCase();
    const accountProject = normalizeProject(account.project) || inferProjectFromEmail(from);
    if (!from || accountProject !== normalizedProject) return;
    if (!allowed.has(from) && String(account.id || '').startsWith('graphapp:')) return;
    if (!map.has(account.id)) map.set(account.id, { ...account, project: normalizedProject });
  });
  return Array.from(map.values()).sort((a, b) => a.from.localeCompare(b.from));
}

export async function getWarmupDrafts({ userEmail, project, senderId }) {
  const normalizedProject = normalizeProject(project);
  const normalizedSenderId = String(senderId || '').trim();
  if (!normalizedProject || !normalizedSenderId) return [];
  const sender = await resolveSenderAccountById(normalizedSenderId, { userEmail, project: normalizedProject });
  const senderFrom = String(sender?.from || '').trim().toLowerCase();
  const drafts = await EmailDraft.find({
    userEmail,
    draftType: WARMUP_DRAFT_TYPE,
    $or: [
      { project: normalizedProject },
      { project: '' },
      { project: { $exists: false } }
    ]
  }).sort({ senderAccountId: -1, senderFrom: -1, updatedAt: -1, createdAt: -1 }).lean();
  return drafts.sort((a, b) => {
    const aScore =
      (String(a.senderAccountId || '') === normalizedSenderId ? 4 : 0) +
      (senderFrom && String(a.senderFrom || '').toLowerCase() === senderFrom ? 3 : 0) +
      (String(a.project || '') === normalizedProject ? 2 : 0);
    const bScore =
      (String(b.senderAccountId || '') === normalizedSenderId ? 4 : 0) +
      (senderFrom && String(b.senderFrom || '').toLowerCase() === senderFrom ? 3 : 0) +
      (String(b.project || '') === normalizedProject ? 2 : 0);
    return bScore - aScore;
  });
}

function getLeadEmail(lead = {}) {
  return String(lead.Email || lead.email || lead.data?.Email || lead.data?.email || '').trim().toLowerCase();
}

function isDummyWarmupList(list = {}) {
  const source = `${list.name || ''} ${list.sourceFile || ''} ${list.sourceFileName || ''}`.toLowerCase();
  const leads = Array.isArray(list.leads) ? list.leads : [];
  const firstEmail = getLeadEmail(leads[0]);
  return source.includes('permanent-warmup-clients') || firstEmail.endsWith('@example.com') || firstEmail.startsWith('warmup.client.');
}

function scoreWarmupList(list = {}) {
  const text = `${list.name || ''} ${list.sourceFile || ''} ${list.sourceFileName || ''}`.toLowerCase();
  const leads = Array.isArray(list.leads) ? list.leads : [];
  const firstEmails = leads.slice(0, 10).map(getLeadEmail).filter(Boolean);
  const externalEmailCount = firstEmails.filter((email) => !email.includes('intellisys') && !email.endsWith('@example.com')).length;
  let score = 0;
  if (String(list.kind || '') === WARMUP_MASTER_KIND) score += 20;
  if (text.includes('freshmailauto')) score += 260;
  if (text.includes('client_warmup') || text.includes('client warmup')) score += 180;
  else if (text.includes('warmup') || text.includes('warm-up')) score += 100;
  if (text.includes('client') || text.includes('lead')) score += 10;
  if (externalEmailCount) score += externalEmailCount * 20;
  if (firstEmails.some((email) => email.includes('intellisys'))) score -= 80;
  score += Math.max(0, 320 - Math.abs(leads.length - WARMUP_TARGET_LEADS) * 18);
  score += Math.min(leads.length, 500) / 10;
  return score;
}

export async function ensureWarmupLeadList({ userEmail, userId = null }) {
  // Warmup uses only the sheet explicitly saved from the Warmup page.
  const setting = await getWarmupAutoReplySetting(userEmail, { lean: true });
  const activeListId = setting?.workspace?.listId ? String(setting.workspace.listId) : '';
  if (activeListId) {
    const savedActive = await LeadList.findOne({
      _id: activeListId,
      userEmail
    });
    if (savedActive && !isDummyWarmupList(savedActive)) {
      if (savedActive.kind !== WARMUP_MASTER_KIND) {
        savedActive.kind = WARMUP_MASTER_KIND;
        await savedActive.save();
      }
      return { list: savedActive, seeded: false, reusedExisting: false, explicit: true };
    }
  }

  return { list: null, seeded: false, reusedExisting: false, missing: true };
}

export async function cloneWarmupLeadListForCampaign({ masterList, userEmail, userId, project, senderFrom }) {
  const leads = masterList.leads.map((lead) => {
    const raw = lead.toObject ? lead.toObject() : lead;
    return {
      ...raw,
      status: 'Pending',
      error: '',
      sentAt: null,
      failedAt: null,
      sendingStartedAt: null,
      data: { ...(raw.data || {}) }
    };
  }).slice(0, WARMUP_TARGET_LEADS);
  return LeadList.create({
    userId,
    userEmail,
    name: `Warmup ${toProjectLabel(project)} ${senderFrom}`,
    project,
    projectId: project,
    sourceFile: masterList.sourceFile || 'permanent-warmup-clients',
    sourceFileName: masterList.sourceFileName || 'permanent-warmup-clients',
    kind: WARMUP_CAMPAIGN_LIST_KIND,
    clonedFrom: String(masterList._id),
    columns: masterList.columns?.length ? masterList.columns : ['Name', 'Email', 'Company'],
    leads,
    uploadedAt: new Date()
  });
}

export function serializeWarmupCampaign(campaign = {}) {
  return {
    id: String(campaign._id || campaign.id || ''),
    name: campaign.name || 'Warmup campaign',
    project: campaign.project || '',
    senderAccountId: campaign.senderAccountId || '',
    senderFrom: campaign.senderFrom || campaign.senderAccount?.from || '',
    draftId: campaign.draftId ? String(campaign.draftId) : '',
    status: campaign.status || 'Draft',
    total: Number(campaign.totalRecipients ?? campaign.stats?.total ?? 0),
    sent: Number(campaign.sentCount ?? campaign.stats?.sent ?? 0),
    pending: Number(campaign.pendingCount ?? campaign.stats?.pending ?? 0),
    failed: Number(campaign.failedCount ?? campaign.stats?.failed ?? 0),
    createdAt: campaign.createdAt || null,
    updatedAt: campaign.updatedAt || null
  };
}
