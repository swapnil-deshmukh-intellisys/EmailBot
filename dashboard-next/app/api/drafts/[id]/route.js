import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import EmailDraft from '@/models/EmailDraft';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { ALLOWED_DRAFT_TYPES, inferDraftTypeFromDraft, normalizeDraftType } from '@/app/lib/draftTypes';
import { buildEmailParts } from '../../../../components/email/EmailRenderingSystem';

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
    const parts = buildEmailParts({ html: draft.bodyHtml || draft.html || draft.body || '', text: draft.bodyText || '' });
    console.info('[draft_loaded]', {
      draftId: String(draft._id || ''),
      draftType: resolvedDraftType,
      htmlLength: parts.bodyHtml.length,
      textLength: parts.bodyText.length
    });
    return NextResponse.json({ draft: { ...draft, html: parts.bodyHtml, bodyHtml: parts.bodyHtml, bodyText: parts.bodyText, body: parts.bodyHtml, draftType: resolvedDraftType, category: resolvedDraftType } });
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
    const draftParts = buildEmailParts({ html: bodyHtml || html || body || '', text: bodyText || '' });
    const draftHtml = draftParts.bodyHtml;
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
        bodyText: draftParts.bodyText
      },
      { new: true, runValidators: true }
    ).lean();
    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }
    const resolvedDraftType = inferDraftTypeFromDraft(draft);
    const resolvedParts = buildEmailParts({ html: draft.bodyHtml || draft.html || draft.body || '', text: draft.bodyText || '' });
    console.info('[draft_saved]', {
      action: 'update',
      draftId: String(draft._id || ''),
      draftType: resolvedDraftType,
      htmlLength: resolvedParts.bodyHtml.length,
      textLength: resolvedParts.bodyText.length
    });
    return NextResponse.json({ draft: { ...draft, html: resolvedParts.bodyHtml, bodyHtml: resolvedParts.bodyHtml, bodyText: resolvedParts.bodyText, body: resolvedParts.bodyHtml, draftType: resolvedDraftType, category: resolvedDraftType } });
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
