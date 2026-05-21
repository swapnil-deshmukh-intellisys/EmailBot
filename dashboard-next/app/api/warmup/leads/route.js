import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import { ensureWarmupLeadList, NO_STORE_HEADERS, WARMUP_MIN_LEADS, WARMUP_TARGET_LEADS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const { list, seeded, reusedExisting, missing } = await ensureWarmupLeadList({ userEmail, userId: auth.currentUser._id || null });
    if (missing || !list) {
      return NextResponse.json({
        success: true,
        message: 'No warmup sheet is saved. Upload a sheet to use for warmup.',
        minRequired: WARMUP_MIN_LEADS,
        list: null
      }, { headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({
      success: true,
      seeded,
      reusedExisting,
      minRequired: WARMUP_MIN_LEADS,
      list: {
        id: String(list._id),
        name: list.name,
        kind: list.kind,
        sourceFile: list.sourceFile || '',
        sourceFileName: list.sourceFileName || '',
        columns: Array.isArray(list.columns) ? list.columns : [],
        total: Array.isArray(list.leads) ? Math.min(list.leads.length, WARMUP_TARGET_LEADS) : 0,
        sourceTotal: Array.isArray(list.leads) ? list.leads.length : 0,
        leads: Array.isArray(list.leads) ? list.leads.map((lead) => lead?.data || lead).slice(0, WARMUP_TARGET_LEADS) : []
      }
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load warmup leads' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
