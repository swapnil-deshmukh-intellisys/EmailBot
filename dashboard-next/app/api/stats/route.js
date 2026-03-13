import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';

export async function GET() {
  try {
    await connectDB();

    const lists = await LeadList.find().sort({ createdAt: -1 }).lean();

    let totalUploaded = 0;
    let sent = 0;
    let pending = 0;
    let failed = 0;

    const normalizedLists = lists.map((list) => {
      const leadCount = list.leads.length;
      totalUploaded += leadCount;

      for (const lead of list.leads) {
        if (lead.status === 'Sent') sent += 1;
        else if (lead.status === 'Failed') failed += 1;
        else pending += 1;
      }

      return {
        _id: String(list._id),
        name: list.name,
        sourceFile: list.sourceFile,
        leadCount,
        uploadedAt: list.uploadedAt
      };
    });

    return NextResponse.json({ totalUploaded, sent, pending, failed, lists: normalizedLists });
  } catch (error) {
    return NextResponse.json({
      totalUploaded: 0,
      sent: 0,
      pending: 0,
      failed: 0,
      lists: [],
      error: error.message || 'Failed to load stats'
    });
  }
}
