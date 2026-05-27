import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import EmailThread from '@/models/EmailThread';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

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

    const [campaigns, drafts, threads] = await Promise.all([
      Campaign.find(ownerQuery).sort({ updatedAt: -1 }).lean(),
      EmailDraft.find(ownerQuery).sort({ updatedAt: -1 }).lean(),
      EmailThread.find(ownerQuery).sort({ updatedAt: -1 }).lean()
    ]);

    return NextResponse.json({ campaigns, drafts, threads }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { campaigns: [], drafts: [], threads: [], error: error.message || 'Failed to load mail overview' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
