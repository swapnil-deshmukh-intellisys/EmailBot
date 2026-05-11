const EMPTY_COUNTS = {
  total: 0,
  running: 0,
  paused: 0,
  failed: 0,
  incomplete: 0,
  completed: 0,
  scheduled: 0
};

function normalizeText(value = '') {
  return String(value || '').trim().toLowerCase();
}

function hasRequiredCampaignData(campaign = {}) {
  const hasList = Boolean(campaign.listId);
  const hasTemplate = Boolean(campaign.templateId || (campaign.inlineTemplate?.subject && campaign.inlineTemplate?.body));
  const hasSender = Boolean(campaign.senderAccountId || campaign.senderFrom || campaign.senderAccount?.from || campaign.senderAccount?.user);
  const total = Number(campaign.stats?.total || 0);
  return hasList && hasTemplate && hasSender && total > 0;
}

export function normalizeCampaignStatusBucket(campaign = {}) {
  const status = normalizeText(campaign?.status || 'Draft');

  if (status === 'running') return 'running';
  if (status === 'paused') return 'paused';
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'completed';
  if (status === 'scheduled') return 'scheduled';

  if (status === 'draft' || status === 'incomplete' || status === 'created' || status === 'stopped') {
    return 'incomplete';
  }

  if (status === 'queued') {
    return hasRequiredCampaignData(campaign) ? 'scheduled' : 'incomplete';
  }

  return 'incomplete';
}

export function buildCampaignCounts(campaigns = []) {
  return campaigns.reduce(
    (counts, campaign) => {
      const bucket = normalizeCampaignStatusBucket(campaign);
      counts.total += 1;
      counts[bucket] = Number(counts[bucket] || 0) + 1;
      return counts;
    },
    { ...EMPTY_COUNTS }
  );
}

export function buildLegacyCampaignSummary(counts = EMPTY_COUNTS) {
  return {
    live: Number(counts.running || 0) + Number(counts.scheduled || 0),
    complete: Number(counts.completed || 0),
    draftIncomplete: Number(counts.incomplete || 0) + Number(counts.failed || 0),
    paused: Number(counts.paused || 0),
    total: Number(counts.total || 0)
  };
}

export function getEmptyCampaignCounts() {
  return { ...EMPTY_COUNTS };
}
