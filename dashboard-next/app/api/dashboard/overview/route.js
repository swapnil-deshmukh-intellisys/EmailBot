import { NextResponse } from 'next/server';

import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import LeadList from '@/models/LeadList';
import EmailTemplate from '@/models/EmailTemplate';
import SenderAccount from '@/models/SenderAccount';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const ownerQuery = buildAuthOwnerFilter(auth);
  const [campaigns, drafts, clientLists, templates, senderAccounts] = await Promise.all([
    Campaign.countDocuments(ownerQuery),
    EmailDraft.countDocuments(ownerQuery),
    LeadList.countDocuments(ownerQuery),
    EmailTemplate.countDocuments(ownerQuery),
    SenderAccount.countDocuments(ownerQuery)
  ]);

  return NextResponse.json({
    ok: true,
    overview: {
      campaigns,
      drafts,
      clientLists,
      templates,
      senderAccounts
    }
  });
}
