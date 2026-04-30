import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import UploadFile from '@/models/UploadFile';
import { requireAuth } from '@/lib/apiAuth';

function inferUploadStatus(summary = {}) {
  if (Number(summary.invalidRecords || 0) > 0) return 'Invalid';
  if (Number(summary.duplicateRecords || 0) > 0) return 'Duplicate';
  return 'Valid';
}

export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.errorResponse) return auth.errorResponse;
  await connectDB();

  try {
    const body = await req.json().catch(() => ({}));
    const fileName = String(body.fileName || '').trim();
    const columns = Array.isArray(body.columns) ? body.columns.map((item) => String(item || '').trim()).filter(Boolean) : [];
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const summary = body.summary && typeof body.summary === 'object' ? body.summary : {};
    const validRows = rows.filter((row) => String(row?.validationStatus || row?.status || '') === 'Valid');

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }
    if (!validRows.length) {
      return NextResponse.json({ error: 'No valid rows available to save' }, { status: 400 });
    }

    const uploadRecord = await UploadFile.create({
      userId: auth.currentUser._id,
      userEmail: String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase(),
      fileName,
      totalRecords: Number(summary.totalRecords || rows.length || 0),
      validRecords: Number(summary.validRecords || validRows.length || 0),
      duplicateRecords: Number(summary.duplicateRecords || 0),
      invalidRecords: Number(summary.invalidRecords || 0),
      uploadedBy: String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase(),
      status: inferUploadStatus(summary),
      previewRows: rows.map((row) => ({
        rowNumber: Number(row?.rowNumber || 0),
        Name: String(row?.Name || ''),
        Surname: String(row?.Surname || ''),
        Company: String(row?.Company || ''),
        Designation: String(row?.Designation || ''),
        Email: String(row?.Email || ''),
        Phone: String(row?.Phone || ''),
        Domain: String(row?.Domain || ''),
        Sector: String(row?.Sector || ''),
        Country: String(row?.Country || ''),
        validationStatus: String(row?.validationStatus || row?.status || 'Valid'),
        reasons: Array.isArray(row?.reasons) ? row.reasons.map((item) => String(item || '')) : []
      }))
    });

    const list = await LeadList.create({
      userId: auth.currentUser._id,
      userEmail: String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase(),
      name: `${fileName} - ${new Date().toLocaleString()}`,
      sourceFile: fileName,
      sourceFileId: String(uploadRecord._id),
      sourceFileName: fileName,
      uploadDate: uploadRecord.uploadedDate,
      validationStatus: inferUploadStatus(summary),
      kind: 'uploaded',
      columns,
      sheetStyle: {
        fontFamily: 'Segoe UI',
        fontSize: 14,
        headerBg: '#edf2f7',
        headerColor: '#1e293b',
        cellBg: '#ffffff',
        cellColor: '#0f172a',
        columnWidths: {}
      },
      leads: validRows.map((row) => ({
        Name: String(row?.Name || ''),
        Surname: String(row?.Surname || ''),
        Email: String(row?.Email || '').trim().toLowerCase(),
        Company: String(row?.Company || ''),
        Designation: String(row?.Designation || ''),
        Phone: String(row?.Phone || ''),
        Domain: String(row?.Domain || ''),
        Sector: String(row?.Sector || ''),
        Country: String(row?.Country || ''),
        sourceFileId: String(uploadRecord._id),
        sourceFileName: fileName,
        uploadDate: uploadRecord.uploadedDate,
        validationStatus: 'Valid',
        data: {
          ...(row?.data || {}),
          Name: String(row?.Name || ''),
          Surname: String(row?.Surname || ''),
          Email: String(row?.Email || '').trim().toLowerCase(),
          Company: String(row?.Company || ''),
          Designation: String(row?.Designation || ''),
          Phone: String(row?.Phone || ''),
          Domain: String(row?.Domain || ''),
          Sector: String(row?.Sector || ''),
          Country: String(row?.Country || ''),
          Source: fileName
        },
        status: 'Pending'
      }))
    });

    uploadRecord.sourceListId = list._id;
    await uploadRecord.save();

    return NextResponse.json({
      ok: true,
      uploadFileId: String(uploadRecord._id),
      listId: String(list._id),
      fileName,
      uploadedDate: uploadRecord.uploadedDate,
      summary: {
        totalRecords: uploadRecord.totalRecords,
        validRecords: uploadRecord.validRecords,
        duplicateRecords: uploadRecord.duplicateRecords,
        invalidRecords: uploadRecord.invalidRecords
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to save uploaded sheet' }, { status: 500 });
  }
}
