import { NextResponse } from 'next/server';
import connectDB from '../../../../../lib/mongodb';
import Campaign from '../../../../../models/Campaign';
import { getRunnerState } from '../../../../../lib/campaignRunner';

export async function GET(_, { params }) {
  await connectDB();
  const campaign = await Campaign.findById(params.id).lean();
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const runner = getRunnerState(String(campaign._id));
  return NextResponse.json({ campaign, runner });
}
