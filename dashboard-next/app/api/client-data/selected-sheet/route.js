import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireAuth } from '@/lib/apiAuth';
import {
  CLIENT_DATA_COLUMNS,
  CUSTOM_LIST_KINDS,
  normalizeProjectName,
  publicList,
  publicCustomList,
  rowToLead,
  summarizeLeads
} from '../_dataCenterUtils';
import { activeListFilter } from '@/app/api/client-data/_retention';
import { buildAuthOwnerFilter } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const name = String(body.name || '').trim() || `Selected Clients ${new Date().toLocaleDateString()}`;
    const projectName = String(body.projectName || body.project || '').trim();
    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'Select at least one client first.' }, { status: 400 });
    }
    const duplicateQuery = activeListFilter(buildAuthOwnerFilter(auth, {
      kind: { $in: CUSTOM_LIST_KINDS },
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    }));
    const normalizedProject = normalizeProjectName(projectName);
    if (normalizedProject) {
      duplicateQuery.$or = [
        { project: new RegExp(`^${normalizedProject}$`, 'i') },
        { projectName: new RegExp(`^${normalizedProject}$`, 'i') },
        { projectId: new RegExp(`^${normalizedProject}$`, 'i') }
      ];
    }
    const existing = await LeadList.findOne(duplicateQuery).select('_id').lean();
    if (existing) {
      return NextResponse.json({ ok: false, error: 'A custom list with this name already exists for this project.' }, { status: 409 });
    }

    const leads = rows.map(rowToLead);
    const summary = summarizeLeads(leads);
    const parentListIds = Array.isArray(body.parentListIds) ? body.parentListIds.map(String).filter(Boolean) : [];
    const sourceFile = String(body.sourceFile || '').trim() || `${name}.selected`;
    const tags = normalizeTags(body.tags);
    const list = await LeadList.create({
      userId: auth.currentUser?._id || null,
      userEmail,
      name,
      description: String(body.description || '').trim(),
      project: projectName,
      projectId: String(body.projectId || '').trim() || projectName,
      projectName,
      campaignPurpose: String(body.campaignPurpose || '').trim(),
      tags,
      createdBy: userEmail,
      sourceFile,
      sourceFileName: sourceFile,
      kind: 'custom_client_list',
      clonedFrom: parentListIds.join(','),
      columns: CLIENT_DATA_COLUMNS,
      leads,
      dataCenterMeta: {
        sourceType: 'custom_client_list',
        description: String(body.description || '').trim(),
        campaignPurpose: String(body.campaignPurpose || '').trim(),
        tags,
        clientIds: Array.isArray(body.clientIds) ? body.clientIds.map(String).filter(Boolean) : [],
        createdBy: auth.currentUser?._id || null,
        createdByEmail: userEmail,
        createdDate: new Date(),
        parentListIds,
        ...summary
      }
    });

    return NextResponse.json({
      ok: true,
      message: `Created custom list "${name}" with ${summary.totalClients} clients.`,
      list: publicCustomList(list),
      ...publicList(list),
      summary
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to create selected sheet.' }, { status: 500 });
  }
}
