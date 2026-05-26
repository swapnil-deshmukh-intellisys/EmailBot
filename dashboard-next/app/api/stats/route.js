import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import Campaign from '@/models/Campaign';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { processWarmupAutoReplies } from '@/lib/warmupAutoReply';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function shouldUseDemoData() {
  return String(process.env.DEV_DEMO_DATA || '').trim().toLowerCase() === 'true';
}

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCampaignReferenceDate(campaign) {
  return (
    normalizeDate(campaign?.startedAt) ||
    normalizeDate(campaign?.scheduledAt) ||
    normalizeDate(campaign?.finishedAt) ||
    normalizeDate(campaign?.updatedAt) ||
    normalizeDate(campaign?.createdAt)
  );
}

function shouldIncludeCampaignInWindow(campaign, rangeStart, rangeEnd) {
  if (!rangeStart || !rangeEnd) return true;
  const referenceDate = getCampaignReferenceDate(campaign);
  if (!referenceDate) return false;
  return referenceDate >= rangeStart && referenceDate <= rangeEnd;
}

function shouldCountCampaignStats(campaign) {
  const status = String(campaign?.status || '').trim().toLowerCase();
  if (!status || status === 'draft') return false;
  const total = Number(campaign?.stats?.total || 0);
  return total > 0 || ['scheduled', 'queued', 'running', 'paused', 'completed', 'failed', 'stopped'].includes(status);
}

function normalizeProject(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('tut') || raw.includes('unicorn') || raw.includes('theunicorntimes.com')) return 'tut';
  if (raw.includes('tec') || raw.includes('entrepreneurial') || raw.includes('theentrepreneurialchronicle.com')) return 'tec';
  return raw;
}

function rowProjectValue(row = {}) {
  return normalizeProject([
    row.project,
    row.projectId,
    row.projectName,
    row.senderFrom,
    row.senderAccount?.from,
    row.senderAccount?.user,
    row.name,
    row.sourceFile,
    row.sourceFileName
  ].filter(Boolean).join(' '));
}

function listProjectValue(list = {}, campaignsByListId = new Map()) {
  const explicit = rowProjectValue(list);
  if (explicit === 'tec' || explicit === 'tut') return explicit;
  const campaigns = campaignsByListId.get(String(list._id || '')) || [];
  const counts = campaigns.reduce((acc, campaign) => {
    const key = rowProjectValue(campaign);
    if (key === 'tec' || key === 'tut') acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
  if (counts.tec || counts.tut) {
    return Number(counts.tec || 0) >= Number(counts.tut || 0) ? 'tec' : 'tut';
  }
  return explicit;
}

export async function GET(req) {
  const startedAt = Date.now();
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').toLowerCase();

    await connectDB();
    void processWarmupAutoReplies(userEmail).catch(() => {});

    const url = new URL(req.url);
    const selectedDate = String(url.searchParams.get('date') || '').trim();
    const selectedRange = String(url.searchParams.get('range') || '').trim();
    const customStartDate = String(url.searchParams.get('startDate') || '').trim();
    const customEndDate = String(url.searchParams.get('endDate') || '').trim();
    const requestedProject = normalizeProject(url.searchParams.get('project') || '');
    const ownerQuery = buildAuthOwnerFilter(auth);
    const [lists, campaigns] = await Promise.all([
      LeadList.find(ownerQuery)
        .select({
          name: 1,
          sourceFile: 1,
          kind: 1,
          project: 1,
          projectId: 1,
          projectName: 1,
          uploadedAt: 1,
          uploadDate: 1,
          createdAt: 1,
          'leads.Email': 1,
          'leads.status': 1,
          'leads.sentAt': 1,
          'leads.failedAt': 1,
          'leads.data': 1
        })
        .sort({ createdAt: -1 })
        .lean(),
      Campaign.find(ownerQuery)
        .select({
          status: 1,
          project: 1,
          projectId: 1,
          projectName: 1,
          senderFrom: 1,
          'senderAccount.from': 1,
          'senderAccount.user': 1,
          listId: 1,
          stats: 1,
          totalRecipients: 1,
          sentCount: 1,
          pendingCount: 1,
          failedCount: 1,
          startedAt: 1,
          scheduledAt: 1,
          finishedAt: 1,
          updatedAt: 1,
          createdAt: 1
        })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const campaignsByListId = campaigns.reduce((map, campaign) => {
      const listId = String(campaign?.listId || '');
      if (!listId) return map;
      if (!map.has(listId)) map.set(listId, []);
      map.get(listId).push(campaign);
      return map;
    }, new Map());
    const scopedLists = requestedProject ? lists.filter((list) => listProjectValue(list, campaignsByListId) === requestedProject) : lists;
    const scopedCampaigns = requestedProject ? campaigns.filter((campaign) => rowProjectValue(campaign) === requestedProject) : campaigns;

    let total = 0;
    let totalUploaded = 0;
    let sent = 0;
    let pending = 0;
    let failed = 0;
    let bounced = 0;
    let spam = 0;
    let last10DaysStats = 0;
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const dayCountMap = new Map();
    let selectedDayStart = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;
    let selectedDayEnd = selectedDate ? new Date(`${selectedDate}T23:59:59.999`) : null;

    if (selectedRange) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      selectedDayEnd = today;

      if (selectedRange === 'customize' && customStartDate && customEndDate) {
        selectedDayStart = new Date(`${customStartDate}T00:00:00`);
        selectedDayEnd = new Date(`${customEndDate}T23:59:59.999`);
      } else {
        const start = new Date(today);
        if (selectedRange === 'today') start.setDate(start.getDate());
        else if (selectedRange === '7d') start.setDate(start.getDate() - 6);
        else if (selectedRange === '15d') start.setDate(start.getDate() - 14);
        else if (selectedRange === '30d') start.setDate(start.getDate() - 29);
        else if (selectedRange === 'quarter') start.setMonth(start.getMonth() - 3);
        start.setHours(0, 0, 0, 0);
        selectedDayStart = start;
      }
    }

    for (let i = 9; i >= 0; i -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      dayCountMap.set(key, 0);
    }

    const campaignSummaries = scopedCampaigns.filter((campaign) => (
      shouldCountCampaignStats(campaign) &&
      shouldIncludeCampaignInWindow(campaign, selectedDayStart, selectedDayEnd)
    ));

    for (const campaign of campaignSummaries) {
      total += Math.max(0, Number(campaign?.totalRecipients ?? campaign?.stats?.total ?? 0));
      sent += Math.max(0, Number(campaign?.sentCount ?? campaign?.stats?.sent ?? 0));
      pending += Math.max(0, Number(campaign?.pendingCount ?? campaign?.stats?.pending ?? 0));
      failed += Math.max(0, Number(campaign?.failedCount ?? campaign?.stats?.failed ?? 0));
      bounced += Math.max(0, Number(campaign?.stats?.bounced || 0));
      spam += Math.max(0, Number(campaign?.stats?.spam || 0));
    }

    const normalizedLists = scopedLists.map((list) => {
      const meaningfulLeads = Array.isArray(list.leads) ? list.leads.filter(hasMeaningfulLeadData) : [];
      const leadCount = meaningfulLeads.length;
      const listUploadedAt = list.uploadedAt ? new Date(list.uploadedAt) : null;

      if (!selectedDayEnd || (listUploadedAt && listUploadedAt <= selectedDayEnd)) {
        totalUploaded += leadCount;
      }

      for (const lead of meaningfulLeads) {
        const sentAt = lead.sentAt ? new Date(lead.sentAt) : null;
        const failedAt = lead.failedAt ? new Date(lead.failedAt) : null;

        if (lead.status === 'Sent' && sentAt && sentAt >= tenDaysAgo) {
          last10DaysStats += 1;
          const sentDate = new Date(sentAt);
          sentDate.setHours(0, 0, 0, 0);
          const key = sentDate.toISOString().slice(0, 10);
          if (dayCountMap.has(key)) {
            dayCountMap.set(key, Number(dayCountMap.get(key) || 0) + 1);
          }
        }
      }

      return {
        _id: String(list._id),
        name: list.name,
        sourceFile: list.sourceFile,
        kind: list.kind || 'uploaded',
        leadCount,
        uploadedAt: list.uploadedAt,
        uploadDate: list.uploadDate || null,
        createdAt: list.createdAt || null
      };
    });

    const dailyMailCounts = Array.from(dayCountMap.entries()).map(([date, count]) => ({ date, count }));

    const payload = {
      total,
      totalUploaded,
      sent,
      pending,
      failed,
      bounced,
      spam,
      last10DaysStats,
      dailyMailCounts,
      selectedDate,
      selectedRange,
      customStartDate,
      customEndDate,
      lists: normalizedLists
    };

    console.info('[api/stats] response', {
      ms: Date.now() - startedAt,
      campaigns: campaigns.length,
      lists: lists.length,
      range: selectedRange || selectedDate || 'all'
    });

    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (shouldUseDemoData()) {
      const today = new Date().toISOString().slice(0, 10);
      return NextResponse.json({
        total: 50,
        totalUploaded: 50,
        sent: 22,
        pending: 27,
        failed: 1,
        bounced: 0,
        spam: 0,
        last10DaysStats: 22,
        dailyMailCounts: [{ date: today, count: 22 }],
        selectedRange: '',
        customStartDate: '',
        customEndDate: '',
        lists: [{ _id: 'demo-list-1', name: 'Demo Leads', sourceFile: 'demo.xlsx', kind: 'uploaded', leadCount: 50, uploadedAt: new Date().toISOString() }],
        error: error.message || 'Failed to load stats'
      }, { headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({
      total: 0,
      totalUploaded: 0,
      sent: 0,
      pending: 0,
      failed: 0,
      bounced: 0,
      spam: 0,
      last10DaysStats: 0,
      dailyMailCounts: [],
      selectedRange: '',
      customStartDate: '',
      customEndDate: '',
      lists: [],
      error: error.message || 'Failed to load stats'
    }, { headers: NO_STORE_HEADERS });
  }
}
