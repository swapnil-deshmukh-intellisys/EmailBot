import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import UpgradeRequest from '@/models/UpgradeRequest';

export async function GET(req) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const status = String(req.nextUrl.searchParams.get('status') || 'pending').trim().toLowerCase();
  const query = status === 'all' ? {} : { status };
  const requests = await UpgradeRequest.find(query).sort({ requestedAt: -1 }).limit(100).lean();

  return NextResponse.json({
    ok: true,
    requests: requests.map((request) => ({
      ...request,
      _id: String(request._id),
      userId: request.userId ? String(request.userId) : null
    }))
  });
}
