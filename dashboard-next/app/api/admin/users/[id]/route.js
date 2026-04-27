import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import ActivityLog from '@/models/ActivityLogModel';
import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import LeadList from '@/models/LeadList';
import SenderAccount from '@/models/SenderAccount';
import GraphOAuthAccount from '@/models/GraphOAuthAccount';
import UserProfile from '@/models/UserProfile';

export async function GET(req, { params }) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const user = await UserProfile.findById(params.id).lean();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const identifier = String(user.email || user.identifier || '').trim().toLowerCase();
  const [campaigns, drafts, clientLists, senderAccounts, oauthAccounts, activityLogs] = await Promise.all([
    Campaign.find({ userEmail: identifier }).sort({ updatedAt: -1 }).limit(20).lean(),
    EmailDraft.find({ userEmail: identifier }).sort({ updatedAt: -1 }).limit(20).lean(),
    LeadList.find({ userEmail: identifier }).sort({ updatedAt: -1 }).limit(20).lean(),
    SenderAccount.find({ userEmail: identifier }).sort({ updatedAt: -1 }).lean(),
    GraphOAuthAccount.find({ userEmail: identifier }).sort({ updatedAt: -1 }).lean(),
    ActivityLog.find({ userEmail: identifier }).sort({ createdAt: -1 }).limit(50).lean()
  ]);

  return NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      intellisysUserId: user.intellisysUserId || '',
      identifier: user.identifier,
      email: user.email || user.identifier,
      username: user.username || '',
      employeeId: user.employeeId || '',
      name: user.name || user.displayName || '',
      displayName: user.displayName || '',
      role: user.role || 'user',
      status: user.status || 'pending',
      mustChangePassword: Boolean(user.mustChangePassword),
      isFirstLogin: Boolean(user.isFirstLogin),
      passwordChangedAt: user.passwordChangedAt || null,
      createdByAdmin: Boolean(user.createdByAdmin),
      approvedBy: user.approvedBy || '',
      approvedAt: user.approvedAt || null,
      lastLoginAt: user.lastLoginAt || null,
      createdAt: user.createdAt || null,
      updatedAt: user.updatedAt || null
    },
    campaigns,
    drafts,
    clientLists,
    senderAccounts: [
      ...senderAccounts,
      ...oauthAccounts.map((account) => ({
        _id: String(account._id),
        email: account.email,
        provider: 'graph_oauth',
        status: account.status || 'Connected',
        health: account.health || 'Good',
        lastSync: account.lastSync || account.updatedAt || account.createdAt || null
      }))
    ],
    activityLogs
  });
}
