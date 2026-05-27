import { NextResponse } from 'next/server';

import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import LeadList from '@/models/LeadList';
import EmailTemplate from '@/models/EmailTemplate';
import SenderAccount from '@/models/SenderAccount';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    await connectDB();
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
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { ok: false, overview: { campaigns: 0, drafts: 0, clientLists: 0, templates: 0, senderAccounts: 0 }, error: error.message || 'Failed to load dashboard overview' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
