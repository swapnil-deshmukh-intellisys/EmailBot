import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/apiAuth';
import LeadList from '@/models/LeadList';
import UserProfile from '@/models/UserProfile';

export async function GET(req, { params }) {
  const auth = await requireAdmin(req);
  if (auth.errorResponse) return auth.errorResponse;

  const user = await UserProfile.findById(params.id).lean();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const clientLists = await LeadList.find({ userEmail: String(user.email || user.identifier || '').toLowerCase() })
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json({ ok: true, clientLists });
}
