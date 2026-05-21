import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { requireAuth } from '@/lib/apiAuth';
import { getWarmupProjects, NO_STORE_HEADERS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const projects = await getWarmupProjects(userEmail);
    return NextResponse.json({ success: true, projects }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load warmup projects' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
