import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import ClientSheet from '@/models/ClientSheet';
import ClientRecord from '@/models/ClientRecord';
import LeadList from '@/models/LeadList';
import UploadFile from '@/models/UploadFile';
import { requireAuth } from '@/lib/apiAuth';
import {
  applyDuplicateFlags,
  CLIENT_SHEET_COLUMNS,
  collectProjectEmailCounts,
  normalizeProject,
  ownerEmail,
  ownerUserId,
  publicSheet,
  rawRowToRecord,
  recordToLead,
  summarizeRecords
} from '../_sheetUtils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_ROWS_PER_SHEET = 10000;
const MAX_COLUMNS = 250;

function readWorkbookSheets(buffer) {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    dense: false,
    cellFormula: false,
    cellHTML: false
  });
  if (!workbook.SheetNames?.length) throw new Error('Uploaded workbook does not contain readable sheets');
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length > MAX_ROWS_PER_SHEET) {
      throw new Error(`Sheet "${sheetName}" has too many rows. Maximum is ${MAX_ROWS_PER_SHEET}.`);
    }
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row || {}).map((key) => String(key || '').trim()).filter(Boolean))));
    if (columns.length > MAX_COLUMNS) throw new Error(`Sheet "${sheetName}" has too many columns.`);
    return { sheetName, rows, columns };
  });
}

export async function POST(req) {
  try {
    const auth = await requireAuth(req);
    if (auth.errorResponse) return auth.errorResponse;
    await connectDB();

    const form = await req.formData();
    const file = form.get('file');
    if (!file) return NextResponse.json({ ok: false, error: 'No file uploaded' }, { status: 400 });
    if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: 'File is too large' }, { status: 400 });
    }

    const originalFileName = String(file.name || 'uploaded-clients.xlsx');
    const project = normalizeProject(form.get('project') || form.get('projectId') || '');
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbookSheets = readWorkbookSheets(buffer);
    const userEmail = ownerEmail(auth);
    const userId = ownerUserId(auth);
    const createdSheets = [];

    const uploadRecord = await UploadFile.create({
      userId,
      userEmail,
      fileName: originalFileName,
      totalRecords: workbookSheets.reduce((sum, sheet) => sum + sheet.rows.length, 0),
      validRecords: 0,
      duplicateRecords: 0,
      invalidRecords: 0,
      uploadedBy: userEmail,
      status: 'Valid',
      previewRows: []
    });

    for (const workbookSheet of workbookSheets) {
      const sheet = await ClientSheet.create({
        userId,
        userEmail,
        project,
        projectId: project,
        sheetName: workbookSheet.sheetName || originalFileName,
        originalFileName,
        kind: 'uploaded',
        columns: CLIENT_SHEET_COLUMNS,
        createdBy: userEmail
      });

      const records = workbookSheet.rows.map((row, index) => rawRowToRecord(row, {
        userId,
        userEmail,
        project,
        projectId: project,
        sheetId: sheet._id,
        rowIndex: index,
        originalFileName,
        sheetName: workbookSheet.sheetName,
        uploadedAt: new Date()
      }));
      const globalCounts = await collectProjectEmailCounts(auth, project);
      const flaggedRecords = applyDuplicateFlags(records, globalCounts);
      if (flaggedRecords.length) await ClientRecord.insertMany(flaggedRecords);
      const summary = summarizeRecords(flaggedRecords);
      Object.assign(sheet, summary);
      await sheet.save();

      const validFreshLeads = flaggedRecords.filter((record) => !record.isInvalid && !record.isRepeated).map(recordToLead);
      const list = await LeadList.create({
        userId,
        userEmail,
        name: `${workbookSheet.sheetName || originalFileName} - ${new Date().toLocaleString()}`,
        project,
        projectId: project,
        sourceFile: originalFileName,
        sourceFileId: String(uploadRecord._id),
        sourceFileName: originalFileName,
        kind: 'uploaded',
        columns: CLIENT_SHEET_COLUMNS,
        dataCenterMeta: {
          sourceType: 'client_sheet_upload',
          clientSheetId: String(sheet._id),
          workbookSheetName: workbookSheet.sheetName,
          ...summary
        },
        leads: validFreshLeads
      });
      sheet.sourceListId = list._id;
      await sheet.save();

      createdSheets.push(publicSheet(sheet));
      uploadRecord.validRecords += summary.freshCount;
      uploadRecord.duplicateRecords += summary.repeatedCount;
      uploadRecord.invalidRecords += summary.invalidCount;
    }
    await uploadRecord.save();

    return NextResponse.json({
      ok: true,
      sheets: createdSheets,
      uploadFileId: String(uploadRecord._id),
      message: `Uploaded ${createdSheets.length} sheet${createdSheets.length === 1 ? '' : 's'} from ${originalFileName}.`
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || 'Failed to upload client workbook' }, { status: 500 });
  }
}
