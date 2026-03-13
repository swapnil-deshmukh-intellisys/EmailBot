import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import LeadList from '../../../../models/LeadList';

export async function GET(_, { params }) {
  await connectDB();
  const list = await LeadList.findById(params.id).lean();
  if (!list) {
    return NextResponse.json({ error: 'List not found' }, { status: 404 });
  }

  return NextResponse.json({
    _id: String(list._id),
    name: list.name,
    sourceFile: list.sourceFile,
    leads: list.leads
  });
}
