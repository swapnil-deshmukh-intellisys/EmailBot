import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import { getWarmupDrafts, normalizeProject, NO_STORE_HEADERS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const url = new URL(req.url);
    const project = normalizeProject(url.searchParams.get('project'));
    const senderId = String(url.searchParams.get('senderId') || '').trim();
    if (!project || !senderId) {
      return NextResponse.json({ success: false, error: 'Project and sender ID are required.' }, { status: 400, headers: NO_STORE_HEADERS });
    }
    await connectDB();
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const drafts = await getWarmupDrafts({ userEmail, project, senderId });
    return NextResponse.json({ success: true, drafts }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load warmup drafts' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
