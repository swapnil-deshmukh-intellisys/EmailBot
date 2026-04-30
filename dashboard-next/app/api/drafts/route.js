import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EmailDraft from '@/models/EmailDraft';
import { requireAuth, requireUser } from '@/lib/apiAuth';
import { isAdminUserEmail } from '@/lib/auth';

const ALLOWED_CATEGORIES = ['cover_story', 'reminder', 'follow_up', 'updated_cost', 'final_cost'];
function shouldUseDevFallback() {
  return String(process.env.DEV_DEMO_DATA || '').trim().toLowerCase() === 'true';
}

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
    if (shouldUseDevFallback()) {
      return NextResponse.json({
        drafts: [
          {
            _id: 'demo-draft-1',
            category: 'cover_story',
            title: 'Demo Cover Story Draft',
            subject: 'Feature opportunity for {{Name}}',
            body: '<p>Hello {{Name}},</p><p>We would love to feature {{Company}}.</p>',
            createdAt: new Date().toISOString()
          }
        ],
        error: error.message || 'Failed to fetch drafts'
      });
    }
    return NextResponse.json({ drafts: [], error: error.message || 'Failed to fetch drafts' });
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
