import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter } from '@/app/api/client-data/_retention';
import { CUSTOM_LIST_KINDS, publicCustomList } from '@/app/api/client-data/_dataCenterUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const lists = await LeadList.find(activeListFilter(buildAuthOwnerFilter(auth, {
      kind: { $in: CUSTOM_LIST_KINDS }
    })))
      .select('name sourceFile kind description project projectId projectName campaignPurpose tags createdBy dataCenterMeta leads uploadedAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, lists: lists.map(publicCustomList) });
  } catch (error) {
    return NextResponse.json({ ok: false, lists: [], error: error.message || 'Failed to load campaign custom lists.' }, { status: 500 });
  }
}
