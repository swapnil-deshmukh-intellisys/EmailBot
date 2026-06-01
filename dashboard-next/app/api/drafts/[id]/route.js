import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EmailDraft from '@/models/EmailDraft';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { ALLOWED_DRAFT_TYPES, inferDraftTypeFromDraft, normalizeDraftType } from '@/app/lib/draftTypes';
import { buildEmailHtml } from '../../../../components/email/EmailRenderingSystem';

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
    const html = buildEmailHtml(draft.html || draft.bodyHtml || draft.body || '');
    return NextResponse.json({ draft: { ...draft, html, bodyHtml: html, body: html, draftType: resolvedDraftType, category: resolvedDraftType } });
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
    const { category, draftType, title, subject, body, html, bodyHtml, bodyText, sector, city, campaignName, domain, project } = await req.json();
    const normalizedDraftType = normalizeDraftType(draftType || category);
    const draftHtml = buildEmailHtml(html || bodyHtml || body || '');
    if (!normalizedDraftType || !title || !subject || !draftHtml) {
      return NextResponse.json({ error: 'draftType, title, subject, and html are required' }, { status: 400 });
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
        city: String(city || '').trim(),
        campaignName: String(campaignName || '').trim(),
        domain: String(domain || '').trim().toLowerCase(),
        subject,
        html: draftHtml,
        body: draftHtml,
        bodyHtml: draftHtml,
        bodyText: bodyText || ''
      },
      { new: true, runValidators: true }
    ).lean();
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    const resolvedDraftType = inferDraftTypeFromDraft(draft);
    const resolvedHtml = buildEmailHtml(draft.html || draft.bodyHtml || draft.body || '');
    return NextResponse.json({ draft: { ...draft, html: resolvedHtml, bodyHtml: resolvedHtml, body: resolvedHtml, draftType: resolvedDraftType, category: resolvedDraftType } });
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
