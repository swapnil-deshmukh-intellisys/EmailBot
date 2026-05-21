import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { publicList, SELECTED_SHEET_KINDS } from '../_dataCenterUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const lists = await LeadList.find({
      ...buildAuthOwnerFilter(auth),
      kind: { $in: SELECTED_SHEET_KINDS }
    }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ ok: true, lists: lists.map(publicList) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load selected sheets.' }, { status: 500 });
  }
}
