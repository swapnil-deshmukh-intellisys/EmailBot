import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { buildAuthOwnerFilter, requireAuth } from '@/lib/apiAuth';
import { activeListFilter, moveExpiredUploadsToBin } from '@/app/api/client-data/_retention';
import {
  CLIENT_DATA_COLUMNS,
  CUSTOM_LIST_KINDS,
  normalizeProjectName,
  publicCustomList,
  rowToLead,
  summarizeLeads
} from '../_dataCenterUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function duplicateNameQuery(auth, name, projectName, excludeId = '') {
  const base = buildAuthOwnerFilter(auth, {
    kind: { $in: CUSTOM_LIST_KINDS },
    name: new RegExp(`^${String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  });
  const project = normalizeProjectName(projectName);
  const query = activeListFilter(base);
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

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const ownerQuery = buildAuthOwnerFilter(auth);
    await moveExpiredUploadsToBin(LeadList, ownerQuery);
    const project = normalizeProjectName(new URL(req.url).searchParams.get('project') || '');
    const query = activeListFilter({ ...ownerQuery, kind: { $in: CUSTOM_LIST_KINDS } });
    if (project) {
      query.$or = [
        { project: new RegExp(`^${project}$`, 'i') },
        { projectName: new RegExp(`^${project}$`, 'i') },
        { projectId: new RegExp(`^${project}$`, 'i') }
      ];
    }
    const lists = await LeadList.find(query)
      .select('name sourceFile kind description project projectId projectName campaignPurpose tags createdBy dataCenterMeta leads uploadedAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ ok: true, lists: lists.map(publicCustomList) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ ok: false, lists: [], error: error.message || 'Failed to load custom lists.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const projectName = String(body.projectName || body.project || '').trim();
    if (!name) return NextResponse.json({ ok: false, error: 'Custom Sheet/List Name is required.' }, { status: 400 });
    if (!rows.length) return NextResponse.json({ ok: false, error: 'Select at least one client before creating a custom list.' }, { status: 400 });

    const existing = await LeadList.findOne(duplicateNameQuery(auth, name, projectName)).select('_id').lean();
    if (existing) {
      return NextResponse.json({ ok: false, error: 'A custom list with this name already exists for this project.' }, { status: 409 });
    }

    const leads = rows.map(rowToLead);
    const summary = summarizeLeads(leads);
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
      sourceFile: `${name}.custom-list`,
      sourceFileName: `${name}.custom-list`,
      kind: 'custom_client_list',
      clonedFrom: Array.isArray(body.parentListIds) ? body.parentListIds.map(String).filter(Boolean).join(',') : '',
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
        ...summary
      }
    });

    return NextResponse.json({
      ok: true,
      message: `Created custom list "${name}" with ${summary.totalClients} clients.`,
      list: publicCustomList(list),
      summary
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to create custom list.' }, { status: 500 });
  }
}
