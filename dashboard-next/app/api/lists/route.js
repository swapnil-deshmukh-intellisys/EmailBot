import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter, moveExpiredUploadsToBin } from '@/app/api/client-data/_retention';

function jsonError(status = 500, message = 'Failed to load lead lists.') {
  return NextResponse.json(
    { success: false, code: 'LEAD_LISTS_LOAD_FAILED', message, error: message },
    { status }
  );
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;

    await connectDB();
    const ownerQuery = buildAuthOwnerFilter(auth);
    await moveExpiredUploadsToBin(LeadList, ownerQuery);
    const lists = await LeadList.find(activeListFilter(ownerQuery))
      .select('_id name sourceFile sourceFileName sourceFileId validationStatus kind leads createdAt updatedAt uploadedAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      lists: lists.map((list) => ({
        ...list,
        _id: String(list._id),
        leadCount: Array.isArray(list.leads) ? list.leads.length : 0,
        leads: undefined
      }))
    });
  } catch (error) {
    return jsonError(500, error.message || 'Failed to load lead lists.');
  }
}
