import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EmailDraft from '@/models/EmailDraft';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { ALLOWED_DRAFT_TYPES, inferDraftTypeFromDraft, normalizeDraftType } from '@/app/lib/draftTypes';

export async function GET(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const draft = await EmailDraft.findOne(buildAuthOwnerFilter(auth, { _id: params.id })).lean();
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    const resolvedDraftType = inferDraftTypeFromDraft(draft);
    return NextResponse.json({ draft: { ...draft, draftType: resolvedDraftType, category: resolvedDraftType } });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load draft' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const { id } = params;
    const { category, draftType, title, subject, body, sector, domain, project } = await req.json();
    const normalizedDraftType = normalizeDraftType(draftType || category);
    if (!normalizedDraftType || !title || !subject || !body) {
      return NextResponse.json({ error: 'draftType, title, subject, and body are required' }, { status: 400 });
    }
    if (!ALLOWED_DRAFT_TYPES.includes(normalizedDraftType)) {
      return NextResponse.json({ error: 'Invalid draftType' }, { status: 400 });
    }
    const draft = await EmailDraft.findOneAndUpdate(
      buildAuthOwnerFilter(auth, { _id: id }),
      {
        category: normalizedDraftType,
        draftType: normalizedDraftType,
        title,
        project: ['tec', 'tut'].includes(String(project || '').trim().toLowerCase()) ? String(project || '').trim().toLowerCase() : '',
        sector: String(sector || '').trim(),
        domain: String(domain || '').trim().toLowerCase(),
        subject,
        body
      },
      { new: true, runValidators: true }
    ).lean();
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    const resolvedDraftType = inferDraftTypeFromDraft(draft);
    return NextResponse.json({ draft: { ...draft, draftType: resolvedDraftType, category: resolvedDraftType } });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to update draft' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const { id } = params;
    const draft = await EmailDraft.findOneAndDelete(buildAuthOwnerFilter(auth, { _id: id }));
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to delete draft' }, { status: 500 });
  }
}
