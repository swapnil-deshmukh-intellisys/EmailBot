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

    const list = await LeadList.findOne(buildAuthOwnerFilter(auth, { _id: listId })).select('_id name leads').lean();
    if (!list) {
      return NextResponse.json({ ok: false, error: 'Selected sheet was not found for this user.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      listId: String(list._id),
      name: list.name,
      count: Array.isArray(list.leads) ? list.leads.length : 0,
      redirectUrl: '/campaigns'
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to use selected sheet for campaign.' }, { status: 500 });
  }
}
