import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import { getWarmupSenders, normalizeProject, NO_STORE_HEADERS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const project = normalizeProject(new URL(req.url).searchParams.get('project'));
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project is required.' }, { status: 400, headers: NO_STORE_HEADERS });
    }
    await connectDB();
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const senders = await getWarmupSenders({ userEmail, project });
    return NextResponse.json({ success: true, senders }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load warmup senders' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
