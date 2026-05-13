import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';

export function normalizeProject(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('tut') || raw.includes('unicorn') || raw.includes('theunicorntimes.com')) return 'tut';
  if (raw.includes('tec') || raw.includes('entrepreneurial') || raw.includes('theentrepreneurialchronicle.com')) return 'tec';
  return raw || 'unassigned';
}

export function campaignProjectKey(campaign = {}) {
  return normalizeProject([
    campaign.project,
    campaign.projectId,
    campaign.projectName,
    campaign.senderFrom,
    campaign.senderAccount?.from,
    campaign.senderAccount?.user
  ].filter(Boolean).join(' '));
}

export function campaignsByListId(campaigns = []) {
  return campaigns.reduce((map, campaign) => {
    const listId = String(campaign?.listId || '');
    if (!listId) return map;
    if (!map.has(listId)) map.set(listId, []);
    map.get(listId).push(campaign);
    return map;
  }, new Map());
}

export function listProjectKey(list = {}, campaignsMap = new Map()) {
  const explicit = normalizeProject([
    list.project,
    list.projectId,
    list.projectName
  ].filter(Boolean).join(' '));
  if (explicit === 'tec' || explicit === 'tut') return explicit;

  const campaigns = campaignsMap.get(String(list._id)) || [];
  const counts = campaigns.reduce((acc, campaign) => {
    const key = campaignProjectKey(campaign);
    if (key === 'tec' || key === 'tut') acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  if (counts.tec || counts.tut) {
    return Number(counts.tec || 0) >= Number(counts.tut || 0) ? 'tec' : 'tut';
  }

  const fromListText = normalizeProject(`${list.name || ''} ${list.sourceFile || ''} ${list.sourceFileName || ''}`);
  return fromListText === 'tec' || fromListText === 'tut' ? fromListText : 'unassigned';
}

export function countMeaningfulLeads(list = {}) {
  return Array.isArray(list.leads) ? list.leads.filter(hasMeaningfulLeadData).length : 0;
}

export function campaignMetrics(campaign = {}) {
  const stats = campaign.stats || {};
  const total = Math.max(0, Number(campaign.totalRecipients ?? stats.total ?? 0));
  const sent = Math.max(0, Number(campaign.sentCount ?? stats.sent ?? 0));
  const failed = Math.max(0, Number(campaign.failedCount ?? stats.failed ?? 0));
  const bounced = Math.max(0, Number(stats.bounced ?? 0));
  const spam = Math.max(0, Number(stats.spam ?? 0));
  const storedPending = campaign.pendingCount ?? stats.pending;
  const pending = storedPending === undefined || storedPending === null
    ? Math.max(0, total - sent - failed - bounced - spam)
    : Math.max(0, Number(storedPending || 0));
  return { total, sent, pending, failed, bounced, spam };
}

export function emptyProjectMetrics() {
  return { campaigns: 0, running: 0, completed: 0, failed: 0, paused: 0, stopped: 0, clients: 0, sent: 0, pending: 0, bounced: 0, spam: 0 };
}
