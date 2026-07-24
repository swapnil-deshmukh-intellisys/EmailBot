import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const body = await req.json().catch(() => ({}));
    const listId = String(body.listId || '').trim();
    if (!listId) {
      return NextResponse.json({ ok: false, error: 'Selected sheet id is required.' }, { status: 400 });
    }

    const now = new Date();
    const list = await LeadList.findOneAndUpdate(
      buildAuthOwnerFilter(auth, { _id: listId }),
      {
        $set: {
          'dataCenterMeta.lastUsedAt': now,
          'dataCenterMeta.campaignLastUsedAt': now,
          'dataCenterMeta.lastCampaignSelectionBy': String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '')
        }
      },
      { new: true }
    ).select('_id name leads project projectName projectId dataCenterMeta').lean();
    if (!list) {
      return NextResponse.json({ ok: false, error: 'Selected sheet was not found for this user.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      listId: String(list._id),
      name: list.name,
      count: Array.isArray(list.leads) ? list.leads.length : 0,
      clientIds: Array.isArray(list.leads) ? list.leads.map((lead, index) => String(lead._id || lead.id || lead.Email || lead.email || index)).filter(Boolean) : [],
      project: list.project || list.projectName || list.projectId || '',
      lastUsed: list.dataCenterMeta?.lastUsedAt || list.dataCenterMeta?.campaignLastUsedAt || null,
      redirectUrl: '/campaigns'
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to use selected sheet for campaign.' }, { status: 500 });
  }
}
