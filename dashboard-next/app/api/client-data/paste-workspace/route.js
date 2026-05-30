import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import { requireAuth } from '@/lib/apiAuth';
import { CLIENT_DATA_COLUMNS, rowToLead } from '../_dataCenterUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WORKSPACE_KIND = 'paste_workspace';

function workspaceFilter(userEmail) {
  return { userEmail, kind: WORKSPACE_KIND, deletedAt: null };
}

function leadToRow(lead = {}, index = 0) {
  const data = lead?.data || {};
  const val = (key, ...alts) => {
    for (const k of [key, ...alts]) {
      const v = String(lead?.[k] ?? data?.[k] ?? '').trim();
      if (v) return v;
    }
    return '';
  };
  return {
    _rowId: `ws-${index}-${Date.now()}`,
    name: val('Name', 'name'),
    surname: val('Surname', 'surname'),
    designation: val('Designation', 'designation', 'Title'),
    cmpName: val('Company', 'company', 'Company Name', 'companyName'),
    sector: val('Sector', 'sector'),
    country: val('Country', 'country'),
    email: val('Email', 'email'),
    source: val('Source', 'source'),
    leadType: val('Lead Type', 'LeadType', 'leadType'),
    sourcer: val('Sourcer', 'sourcer'),
    userId: val('User ID', 'UserId', 'userId'),
    projectApproach: val('Project Approach', 'ProjectApproach', 'projectApproach'),
    senderId: val('Sender ID', 'SenderId', 'senderId'),
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    let workspace = await LeadList.findOne(workspaceFilter(userEmail)).lean();

    if (!workspace) {
      workspace = await LeadList.create({
        userId: auth.currentUser?._id || null,
        userEmail,
        name: 'Paste Workspace',
        sourceFile: 'paste-workspace',
        kind: WORKSPACE_KIND,
        columns: CLIENT_DATA_COLUMNS,
        leads: [],
        dataCenterMeta: { sourceType: WORKSPACE_KIND, createdDate: new Date() }
      });
      workspace = workspace.toObject ? workspace.toObject() : workspace;
    }

    const rows = (workspace.leads || []).map((lead, i) => leadToRow(lead, i));

    return NextResponse.json({
      ok: true,
      workspaceId: String(workspace._id),
      rows,
      total: rows.length
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to load paste workspace.' }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const userEmail = String(auth.currentUser?.email || auth.currentUser?.identifier || auth.session?.email || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows : [];

    const leads = rows.map(rowToLead);

    const workspace = await LeadList.findOneAndUpdate(
      workspaceFilter(userEmail),
      {
        $set: {
          leads,
          'dataCenterMeta.lastUpdated': new Date(),
          'dataCenterMeta.totalRows': leads.length
        },
        $setOnInsert: {
          userId: auth.currentUser?._id || null,
          userEmail,
          name: 'Paste Workspace',
          sourceFile: 'paste-workspace',
          kind: WORKSPACE_KIND,
          columns: CLIENT_DATA_COLUMNS,
          'dataCenterMeta.sourceType': WORKSPACE_KIND,
          'dataCenterMeta.createdDate': new Date()
        }
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      ok: true,
      workspaceId: String(workspace._id),
      total: leads.length,
      message: `Workspace saved with ${leads.length} rows.`
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to save paste workspace.' }, { status: 500 });
  }
}
