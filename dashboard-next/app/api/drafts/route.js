import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EmailDraft from '@/models/EmailDraft';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { ALLOWED_DRAFT_TYPES, inferDraftTypeFromDraft, normalizeDraftType } from '@/app/lib/draftTypes';

function shouldUseDevFallback() {
  return String(process.env.DEV_DEMO_DATA || '').trim().toLowerCase() === 'true';
}

function withResolvedDraftType(draft = {}) {
  const draftType = inferDraftTypeFromDraft(draft);
  return {
    ...draft,
    draftType,
    category: draftType
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const { searchParams } = new URL(req.url);
    const requestedDraftType = searchParams.get('draftType') || searchParams.get('category') || '';
    const normalizedDraftType = requestedDraftType ? normalizeDraftType(requestedDraftType) : '';
    const requestedProject = String(searchParams.get('project') || '').trim().toLowerCase();
    const query = buildAuthOwnerFilter(auth);
    if (['tec', 'tut'].includes(requestedProject)) {
      query.project = { $in: [requestedProject, ''] };
    }
    const drafts = (await EmailDraft.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean())
      .map(withResolvedDraftType)
      .filter((draft) => !normalizedDraftType || draft.draftType === normalizedDraftType);
    return NextResponse.json(
      { drafts },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (error) {
    if (shouldUseDevFallback()) {
      return NextResponse.json({
        drafts: [
          {
            _id: 'demo-draft-1',
            category: 'cover_story',
            draftType: 'cover_story',
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
    const { category, draftType, title, subject, body, sector, domain, project } = await req.json();
    const normalizedDraftType = normalizeDraftType(draftType || category);
    if (!normalizedDraftType || !title || !subject || !body) {
      return NextResponse.json({ error: 'draftType, title, subject, and body are required' }, { status: 400 });
    }
    if (!ALLOWED_DRAFT_TYPES.includes(normalizedDraftType)) {
      return NextResponse.json({ error: 'Invalid draftType' }, { status: 400 });
    }
    const draft = await EmailDraft.create({
      userId: auth.currentUser._id,
      userEmail,
      category: normalizedDraftType,
      draftType: normalizedDraftType,
      title,
      project: ['tec', 'tut'].includes(String(project || '').trim().toLowerCase()) ? String(project || '').trim().toLowerCase() : '',
      sector: String(sector || '').trim(),
      domain: String(domain || '').trim().toLowerCase(),
      subject,
      body
    });
    return NextResponse.json({ draft: withResolvedDraftType(draft.toObject()) });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to create draft' }, { status: 500 });
  }
}
