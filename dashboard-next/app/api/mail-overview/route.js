import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import EmailDraft from '@/models/EmailDraft';
import EmailThread from '@/models/EmailThread';
import { requireUser } from '@/lib/apiAuth';
import { isAdminUserEmail } from '@/lib/auth';

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;

    await connectDB();

    const url = new URL(req.url);
    const scope = String(url.searchParams.get('scope') || '').trim().toLowerCase();
    const includeAll = scope === 'all' && isAdminUserEmail(userEmail);
    const campaignQuery = includeAll ? {} : { userEmail };
    const draftQuery = includeAll ? {} : { userEmail };
    const threadQuery = includeAll ? {} : { userEmail };

    const [campaigns, drafts, threads] = await Promise.all([
      Campaign.find(campaignQuery).sort({ updatedAt: -1 }).lean(),
      EmailDraft.find(draftQuery).sort({ updatedAt: -1 }).lean(),
      EmailThread.find(threadQuery).sort({ updatedAt: -1 }).lean()
    ]);

    return NextResponse.json({ campaigns, drafts, threads });
  } catch (error) {
    return NextResponse.json(
      { campaigns: [], drafts: [], threads: [], error: error.message || 'Failed to load mail overview' },
      { status: 500 }
    );
  }
}
