import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import WarmupSheet from '@/models/WarmupSheet';
import { requireAuth } from '@/lib/apiAuth';
import { normalizeProject, NO_STORE_HEADERS } from '../_utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function serialize(sheet) {
  const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
  return {
    id: String(sheet._id),
    projectId: sheet.projectId || '',
    sheetName: sheet.sheetName || '',
    uploadedAt: sheet.uploadedAt || sheet.createdAt || null,
    isDefault: Boolean(sheet.isDefault),
    total: rows.length,
    approved: rows.filter((row) => row.warmupApproved).length,
    parseStats: sheet.parseStats || {},
    rows: rows.slice(0, 25)
  };
}

export async function GET(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const url = new URL(req.url);
    const projectId = normalizeProject(url.searchParams.get('projectId') || url.searchParams.get('project') || '');
    const query = { userEmail };
    if (projectId) query.projectId = projectId;
    const sheets = await WarmupSheet.find(query).sort({ isDefault: -1, uploadedAt: -1, createdAt: -1 }).lean();
    return NextResponse.json({ success: true, sheets: sheets.map(serialize) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to load warmup sheets.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();
    const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
    const body = await req.json().catch(() => ({}));
    const warmupSheetId = String(body.warmupSheetId || body.sheetId || '').trim();
    const projectId = normalizeProject(body.projectId || body.project || '');
    if (!warmupSheetId) {
      return NextResponse.json({ success: false, error: 'Please select a warmup sheet.' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const query = { _id: warmupSheetId, userEmail };
    if (projectId) query.projectId = projectId;
    const sheet = await WarmupSheet.findOne(query);
    if (!sheet) {
      return NextResponse.json({ success: false, error: 'Please select a warmup sheet.' }, { status: 404, headers: NO_STORE_HEADERS });
    }

    await WarmupSheet.updateMany(
      { _id: { $ne: sheet._id }, userEmail, projectId: sheet.projectId },
      { $set: { isDefault: false } }
    );
    sheet.isDefault = true;
    await sheet.save();

    return NextResponse.json({ success: true, sheet: serialize(sheet.toObject()) }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to update warmup sheet.' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
