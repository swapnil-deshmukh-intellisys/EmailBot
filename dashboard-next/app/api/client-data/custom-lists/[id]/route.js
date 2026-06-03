import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter } from '@/app/api/client-data/_retention';
import {
  CLIENT_DATA_COLUMNS,
  CUSTOM_LIST_KINDS,
  normalizeProjectName,
  publicCustomList,
  rowToLead,
  summarizeLeads
} from '../../_dataCenterUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function duplicateNameQuery(auth, name, projectName, excludeId = '') {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const query = activeListFilter(buildAuthOwnerFilter(auth, {
    kind: { $in: CUSTOM_LIST_KINDS },
    name: new RegExp(`^${escaped}$`, 'i')
  }));
  const project = normalizeProjectName(projectName);
  if (project) {
    query.$or = [
      { project: new RegExp(`^${project}$`, 'i') },
      { projectName: new RegExp(`^${project}$`, 'i') },
      { projectId: new RegExp(`^${project}$`, 'i') }
    ];
  }
  if (excludeId) query._id = { $ne: excludeId };
  return query;
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const list = await LeadList.findOne(activeListFilter(buildAuthOwnerFilter(auth, {
      _id: params.id,
      kind: { $in: CUSTOM_LIST_KINDS }
    })));
    if (!list) return NextResponse.json({ ok: false, error: 'Custom list not found.' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const nextName = String(body.name ?? list.name).trim();
    const nextProjectName = String(body.projectName ?? body.project ?? list.projectName ?? list.project ?? '').trim();
    if (!nextName) return NextResponse.json({ ok: false, error: 'Custom list name is required.' }, { status: 400 });

    if (nextName.toLowerCase() !== String(list.name || '').trim().toLowerCase() || normalizeProjectName(nextProjectName) !== normalizeProjectName(list.projectName || list.project)) {
      const duplicate = await LeadList.findOne(duplicateNameQuery(auth, nextName, nextProjectName, params.id)).select('_id').lean();
      if (duplicate) return NextResponse.json({ ok: false, error: 'A custom list with this name already exists for this project.' }, { status: 409 });
    }

    list.name = nextName;
    if (body.description !== undefined) list.description = String(body.description || '').trim();
    if (body.project !== undefined || body.projectName !== undefined) {
      list.project = nextProjectName;
      list.projectName = nextProjectName;
      list.projectId = String(body.projectId || list.projectId || nextProjectName).trim();
    }
    if (body.campaignPurpose !== undefined) list.campaignPurpose = String(body.campaignPurpose || '').trim();
    if (body.tags !== undefined) list.tags = normalizeTags(body.tags);
    if (Array.isArray(body.rows)) {
      const leads = body.rows.map(rowToLead);
      list.columns = CLIENT_DATA_COLUMNS;
      list.leads = leads;
      list.dataCenterMeta = {
        ...(list.dataCenterMeta || {}),
        ...summarizeLeads(leads),
        updatedDate: new Date()
      };
    }
    list.dataCenterMeta = {
      ...(list.dataCenterMeta || {}),
      description: list.description || '',
      campaignPurpose: list.campaignPurpose || '',
      tags: list.tags || []
    };
    await list.save();

    return NextResponse.json({ ok: true, list: publicCustomList(list) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to update custom list.' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const deleted = await LeadList.findOneAndUpdate(
      activeListFilter(buildAuthOwnerFilter(auth, {
        _id: params.id,
        kind: { $in: CUSTOM_LIST_KINDS }
      })),
      {
        $set: {
          deletedAt: new Date(),
          deleteReason: 'Deleted custom client list',
          originalKind: 'custom_client_list'
        }
      },
      { new: true }
    );
    if (!deleted) return NextResponse.json({ ok: false, error: 'Custom list not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, deletedId: String(params.id) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to delete custom list.' }, { status: 500 });
  }
}
