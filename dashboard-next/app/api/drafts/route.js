import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EmailDraft from '@/models/EmailDraft';
import { requireAuth, requireUser } from '@/lib/apiAuth';
import { isAdminUserEmail } from '@/lib/auth';

const ALLOWED_CATEGORIES = ['cover_story', 'reminder', 'follow_up', 'updated_cost', 'final_cost'];

export async function GET(req) {
  try {
    const { userEmail, errorResponse } = requireUser(req);
    if (errorResponse) return errorResponse;
    await connectDB();
    const scope = req.nextUrl.searchParams.get('scope');
    const query = scope === 'all' && isAdminUserEmail(userEmail) ? {} : { userEmail };
    const drafts = await EmailDraft.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ drafts });
  } catch (error) {
    return NextResponse.json({ drafts: [], error: error.message || 'Failed to fetch drafts' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const { category, title, subject, body, sector, domain } = await req.json();
    if (!category || !title || !subject || !body) {
      return NextResponse.json({ error: 'category, title, subject, and body are required' }, { status: 400 });
    }
    if (!ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    const draft = await EmailDraft.create({
      userId: auth.currentUser._id,
      userEmail,
      category,
      title,
      sector: String(sector || '').trim(),
      domain: String(domain || '').trim().toLowerCase(),
      subject,
      body
    });
    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to create draft' }, { status: 500 });
  }
}
