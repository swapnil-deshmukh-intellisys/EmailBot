import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Campaign from '@/models/Campaign';
import { getRunnerState } from '@/lib/campaignRunner';
import { requireUser } from '@/lib/apiAuth';

export async function GET(req, { params }) {
  const { userEmail, errorResponse } = requireUser(req);
  if (errorResponse) return errorResponse;
  await connectDB();
  const campaign = await Campaign.findOne({ _id: params.id, userEmail }).lean();
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const runner = getRunnerState(String(campaign._id));
  return NextResponse.json({ campaign, runner });
}
