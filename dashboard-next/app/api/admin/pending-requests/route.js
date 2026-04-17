import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import SignupRequest from '@/models/SignupRequest';

export async function GET(req) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const requests = await SignupRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ ok: true, requests });
}
