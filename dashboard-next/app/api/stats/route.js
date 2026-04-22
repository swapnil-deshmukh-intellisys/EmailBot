import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import Campaign from '@/models/Campaign';
import { requireUser } from '@/lib/apiAuth';
import { processWarmupAutoReplies } from '@/lib/warmupAutoReply';

const STATS_CACHE_TTL_MS = 10000;

function getStatsCache() {
  if (!global.__dashboardStatsCache) {
    global.__dashboardStatsCache = new Map();
  }
  return global.__dashboardStatsCache;
}

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    const cache = getStatsCache();
    const cacheKey = `${userEmail}::${req.url}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.payload);
    }

    await connectDB();
    void processWarmupAutoReplies(userEmail).catch(() => {});

    const url = new URL(req.url);
    const selectedDate = String(url.searchParams.get('date') || '').trim();
    const selectedRange = String(url.searchParams.get('range') || '').trim();
    const customStartDate = String(url.searchParams.get('startDate') || '').trim();
    const customEndDate = String(url.searchParams.get('endDate') || '').trim();
    const lists = await LeadList.find({ userEmail }).sort({ createdAt: -1 }).lean();

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

    const normalizedLists = lists.map((list) => {
      const leadCount = list.leads.length;
      const listUploadedAt = list.uploadedAt ? new Date(list.uploadedAt) : null;

      if (!selectedDayEnd || (listUploadedAt && listUploadedAt <= selectedDayEnd)) {
        totalUploaded += leadCount;
      }

      for (const lead of list.leads) {
        const sentAt = lead.sentAt ? new Date(lead.sentAt) : null;
        const failedAt = lead.failedAt ? new Date(lead.failedAt) : null;

        if (selectedDayStart && selectedDayEnd) {
          const sentOnSelectedDay = sentAt && sentAt >= selectedDayStart && sentAt <= selectedDayEnd;
          const failedOnSelectedDay = failedAt && failedAt >= selectedDayStart && failedAt <= selectedDayEnd;
          const existedBySelectedDay = listUploadedAt && listUploadedAt <= selectedDayEnd;
          const resolvedBySelectedDay =
            (sentAt && sentAt <= selectedDayEnd) || (failedAt && failedAt <= selectedDayEnd);

          if (sentOnSelectedDay || String(lead.status || '').toLowerCase() === 'sent') sent += 1;
          if (failedOnSelectedDay || String(lead.status || '').toLowerCase() === 'failed') failed += 1;
          if (String(lead.status || '').toLowerCase() === 'bounced') bounced += 1;
          if (String(lead.status || '').toLowerCase() === 'spam') spam += 1;
          if (existedBySelectedDay && !resolvedBySelectedDay) pending += 1;
        } else {
          const status = String(lead.status || '').toLowerCase();
          if (status === 'sent') sent += 1;
          else if (status === 'failed') failed += 1;
          else if (status === 'bounced') bounced += 1;
          else if (status === 'spam') spam += 1;
          else pending += 1;
        }

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
        uploadedAt: list.uploadedAt
      };
    });

    const dailyMailCounts = Array.from(dayCountMap.entries()).map(([date, count]) => ({ date, count }));

    const payload = {
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

    cache.set(cacheKey, {
      payload,
      expiresAt: now + STATS_CACHE_TTL_MS
    });

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({
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
    });
  }
}
