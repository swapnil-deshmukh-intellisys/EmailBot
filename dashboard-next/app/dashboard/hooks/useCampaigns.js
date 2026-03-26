import { useMemo } from 'react';

function isCampaignFinished(campaign) {
  const status = String(campaign?.status || '').toLowerCase();
  if (status === 'completed' || status === 'failed') {
    return true;
  }

  const total = Number(campaign?.stats?.total || 0);
  const sent = Number(campaign?.stats?.sent || 0);
  const failed = Number(campaign?.stats?.failed || 0);

  return total > 0 && sent + failed >= total;
}

function shouldShowInActiveCampaigns(campaign) {
  if (!campaign || isCampaignFinished(campaign)) return false;

  const status = String(campaign?.status || '').toLowerCase();
  if (status && status !== 'draft') {
    return true;
  }

  return Boolean(campaign?.startedAt || campaign?.scheduledStart?.at);
}

export function getCampaignTimeLabel(campaign) {
  if (campaign?.scheduledStart?.at) {
    const when = new Date(campaign.scheduledStart.at);
    return {
      text: `Scheduled Start: ${campaign.scheduledStart.label || when.toLocaleString()}`,
      color: '#166534',
      strong: true
    };
  }
  if (campaign?.startedAt) {
    return {
      text: `Started: ${new Date(campaign.startedAt).toLocaleString()}`,
      color: 'var(--muted)',
      strong: false
    };
  }
  return null;
}

export default function useCampaigns(campaigns = [], preferredActiveCampaignId = '') {
  const activeCampaigns = useMemo(
    () =>
      campaigns
        .filter((c) => shouldShowInActiveCampaigns(c))
        .sort((a, b) => {
          if (preferredActiveCampaignId) {
            if (a._id === preferredActiveCampaignId) return -1;
            if (b._id === preferredActiveCampaignId) return 1;
          }

          const aRunning = String(a.status || '').toLowerCase() === 'running';
          const bRunning = String(b.status || '').toLowerCase() === 'running';
          if (aRunning !== bRunning) {
            return aRunning ? -1 : 1;
          }

          const aTime = new Date(a.startedAt || a.scheduledStart?.at || a.createdAt || 0).getTime();
          const bTime = new Date(b.startedAt || b.scheduledStart?.at || b.createdAt || 0).getTime();
          return bTime - aTime;
        }),
    [campaigns, preferredActiveCampaignId]
  );

  const historyCampaigns = useMemo(
    () => campaigns.filter((c) => isCampaignFinished(c)),
    [campaigns]
  );

  const activeCampaign = useMemo(() => activeCampaigns[0] || null, [activeCampaigns]);
  const activeCampaignIds = useMemo(() => activeCampaigns.map((c) => c._id), [activeCampaigns]);
  const historyCampaignIds = useMemo(() => historyCampaigns.map((c) => c._id), [historyCampaigns]);
  const progressText = activeCampaign
    ? `${activeCampaign.stats?.sent || 0}/${activeCampaign.stats?.total || 0} emails sent`
    : '0/0 emails sent';

  return {
    activeCampaigns,
    historyCampaigns,
    activeCampaign,
    activeCampaignIds,
    historyCampaignIds,
    progressText
  };
}
