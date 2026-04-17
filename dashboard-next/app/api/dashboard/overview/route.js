import { NextResponse } from 'next/server';

import { requireAuth } from '@/lib/apiAuth';
import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import LeadList from '@/models/LeadList';
import EmailTemplate from '@/models/EmailTemplate';
import SenderAccount from '@/models/SenderAccount';

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
  const [campaigns, drafts, clientLists, templates, senderAccounts] = await Promise.all([
    Campaign.countDocuments({ userEmail }),
    EmailDraft.countDocuments({ userEmail }),
    LeadList.countDocuments({ userEmail }),
    EmailTemplate.countDocuments({ userEmail }),
    SenderAccount.countDocuments({ userEmail })
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
