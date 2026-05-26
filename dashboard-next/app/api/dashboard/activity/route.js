import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import ActivityLog from '@/models/ActivityLogModel';
import CalendarEvent from '@/models/CalendarEvent';
import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import LeadList from '@/models/LeadList';
import MailMessageCache from '@/models/MailMessageCache';
import SenderAccount from '@/models/SenderAccount';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function numberValue(...values) {
  for (const value of values) {
    const next = Number(value);
    if (Number.isFinite(next)) return next;
  }
  return 0;
}

function projectValue(row = {}) {
  const text = [
    row.projectId,
    row.project,
    row.projectName,
    row.senderFrom,
    row.senderAccount?.from,
    row.senderAccount?.user,
    row.fromEmail,
    row.from,
    row.subject,
    row.name,
    row.sourceFile
  ].filter(Boolean).join(' ').toLowerCase();
  if (text.includes('tut') || text.includes('unicorn') || text.includes('theunicorntimes.com')) return 'tut';
  if (text.includes('tec') || text.includes('entrepreneurial') || text.includes('theentrepreneurialchronicle.com')) return 'tec';
  return String(row.projectId || row.project || row.projectName || '').trim().toLowerCase();
}

function pushActivity(items, item) {
  const date = dateValue(item.date);
  if (!date) return;
  items.push({
    id: item.id,
    title: item.title,
    type: item.type,
    text: item.text,
    status: item.status || 'pending',
    done: Boolean(item.done),
    date: date.toISOString()
  });
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    await connectDB();

    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(80, Number(url.searchParams.get('limit') || 40) || 40));
    const project = String(url.searchParams.get('project') || '').trim().toLowerCase();
    const sender = String(url.searchParams.get('sender') || '').trim().toLowerCase();
    const ownerQuery = buildAuthOwnerFilter(auth);
    const scopedProject = (rows) => (
      project ? rows.filter((row) => projectValue(row) === project) : rows
    );
    const scopedSender = (rows) => (
      sender
        ? rows.filter((row) => String(row.senderFrom || row.from || row.senderAccount?.from || '').trim().toLowerCase() === sender)
        : rows
    );

    const [campaigns, calendarEvents, mailMessages, drafts, lists, senderAccounts, activityLogs] = await Promise.all([
      Campaign.find(ownerQuery)
        .select('name status stats totalRecipients sentCount pendingCount failedCount openCount replyCount senderFrom senderAccount project projectId createdAt updatedAt startedAt scheduledAt finishedAt lastActivityAt')
        .sort({ lastActivityAt: -1, updatedAt: -1, createdAt: -1 })
        .limit(60)
        .lean(),
      CalendarEvent.find(ownerQuery)
        .select('title description startDate startTime type priority notes createdAt updatedAt')
        .sort({ startDate: -1, createdAt: -1 })
        .limit(40)
        .lean(),
      MailMessageCache.find(ownerQuery)
        .select('subject fromEmail toEmails folder snippet receivedAt sentAt createdAt updatedAt projectId provider isRead')
        .sort({ receivedAt: -1, sentAt: -1, createdAt: -1 })
        .limit(40)
        .lean(),
      EmailDraft.find(ownerQuery)
        .select('title category draftType subject project senderFrom createdAt updatedAt')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(25)
        .lean(),
      LeadList.find(buildAuthOwnerFilter(auth, { deletedAt: null }))
        .select('name sourceFile project projectId leads uploadedAt createdAt updatedAt')
        .sort({ uploadedAt: -1, createdAt: -1 })
        .limit(25)
        .lean(),
      SenderAccount.find(ownerQuery)
        .select('from provider status health sentToday dailyLimit createdAt updatedAt lastSync')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(25)
        .lean(),
      ActivityLog.find(ownerQuery)
        .select('action entityType entityId actorEmail meta createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean()
    ]);

    const activities = [];

    scopedSender(scopedProject(campaigns)).forEach((campaign) => {
      const status = String(campaign.status || 'Pending').trim() || 'Pending';
      const total = numberValue(campaign.totalRecipients, campaign.stats?.total);
      const sent = numberValue(campaign.sentCount, campaign.stats?.sent);
      const pending = numberValue(campaign.pendingCount, campaign.stats?.pending, Math.max(total - sent - numberValue(campaign.failedCount, campaign.stats?.failed), 0));
      const failed = numberValue(campaign.failedCount, campaign.stats?.failed);
      pushActivity(activities, {
        id: `campaign-${campaign._id}`,
        date: campaign.lastActivityAt || campaign.updatedAt || campaign.startedAt || campaign.createdAt,
        title: `${status}: ${campaign.name || 'Campaign'}`,
        type: status,
        text: `${sent} mailed, ${pending} pending, ${failed} failed${total ? ` out of ${total}` : ''}.`,
        status: status.toLowerCase() === 'completed' ? 'done' : status.toLowerCase() === 'failed' ? 'failed' : 'pending',
        done: status.toLowerCase() === 'completed'
      });
      if (sent > 0) {
        pushActivity(activities, {
          id: `mailing-${campaign._id}`,
          date: campaign.lastActivityAt || campaign.updatedAt || campaign.startedAt || campaign.createdAt,
          title: `Mailing activity: ${campaign.name || 'Campaign'}`,
          type: 'Mailing',
          text: `${sent} mails sent from ${campaign.senderFrom || campaign.senderAccount?.from || 'selected sender'}${failed ? `, ${failed} failed` : ''}.`,
          status: failed ? 'pending' : 'done',
          done: !failed
        });
      }
    });

    scopedProject(calendarEvents).forEach((event) => {
      pushActivity(activities, {
        id: `meeting-${event._id}`,
        date: event.startDate || event.createdAt,
        title: `${event.type || 'Meeting'}: ${event.title}`,
        type: event.type || 'Meeting',
        text: [event.startTime, event.description || event.notes || event.priority].filter(Boolean).join(' - ') || 'Scheduled dashboard event.',
        status: 'pending'
      });
    });

    scopedProject(mailMessages).forEach((message) => {
      const folder = String(message.folder || '').toLowerCase();
      const isSent = folder.includes('sent') || Boolean(message.sentAt);
      pushActivity(activities, {
        id: `mail-${message._id}`,
        date: message.sentAt || message.receivedAt || message.updatedAt || message.createdAt,
        title: `${isSent ? 'Mail sent' : 'Mail received'}: ${message.subject || 'No subject'}`,
        type: isSent ? 'Mailing' : 'Mailbox',
        text: isSent
          ? `To ${Array.isArray(message.toEmails) && message.toEmails.length ? message.toEmails.join(', ') : 'recipient'}`
          : `From ${message.fromEmail || 'sender'}${message.snippet ? ` - ${message.snippet}` : ''}`,
        status: message.isRead || isSent ? 'done' : 'pending',
        done: Boolean(message.isRead || isSent)
      });
    });

    scopedSender(scopedProject(drafts)).forEach((draft) => {
      pushActivity(activities, {
        id: `draft-${draft._id}`,
        date: draft.updatedAt || draft.createdAt,
        title: `Draft updated: ${draft.title || draft.subject || 'Email draft'}`,
        type: 'Draft',
        text: `${draft.draftType || draft.category || 'Draft'} template ready for campaign use.`,
        status: 'done',
        done: true
      });
    });

    scopedProject(lists).forEach((list) => {
      pushActivity(activities, {
        id: `client-list-${list._id}`,
        date: list.uploadedAt || list.updatedAt || list.createdAt,
        title: `Client data uploaded: ${list.name || list.sourceFile || 'Client list'}`,
        type: 'Client Data',
        text: `${Array.isArray(list.leads) ? list.leads.length : 0} client records available.`,
        status: 'done',
        done: true
      });
    });

    senderAccounts.forEach((account) => {
      pushActivity(activities, {
        id: `sender-${account._id}`,
        date: account.lastSync || account.updatedAt || account.createdAt,
        title: `Sender ID ${account.status || 'connected'}: ${account.from}`,
        type: 'Sender',
        text: `${account.provider || 'mail'} account, ${numberValue(account.sentToday)} sent today / ${numberValue(account.dailyLimit)} daily limit.`,
        status: String(account.status || '').toLowerCase() === 'connected' ? 'done' : 'pending',
        done: String(account.status || '').toLowerCase() === 'connected'
      });
    });

    activityLogs.forEach((log) => {
      pushActivity(activities, {
        id: `activity-log-${log._id}`,
        date: log.createdAt || log.updatedAt,
        title: `${log.entityType || 'Dashboard'}: ${log.action || 'Activity'}`,
        type: 'Dashboard',
        text: log.meta?.message || log.actorEmail || 'Dashboard account activity.',
        status: 'done',
        done: true
      });
    });

    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    return NextResponse.json({ success: true, activities: activities.slice(0, limit) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { success: false, activities: [], error: error.message || 'Failed to load dashboard activity.' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
