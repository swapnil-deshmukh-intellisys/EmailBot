import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import EmailThread from '@/models/EmailThread';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';

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

    return NextResponse.json({ campaigns, drafts, threads });
  } catch (error) {
    return NextResponse.json(
      { campaigns: [], drafts: [], threads: [], error: error.message || 'Failed to load mail overview' },
      { status: 500 }
    );
  }
}
