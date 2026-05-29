import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import LeadList from '@/models/LeadList';
import UploadFile from '@/models/UploadFile';
import ClientSheet from '@/models/ClientSheet';
import ClientRecord from '@/models/ClientRecord';
import { requireAuth } from '@/lib/apiAuth';
import { hasMeaningfulLeadData } from '@/core-lib/client-data-config/UploadSheetValidation';
import {
  applyDuplicateFlags,
  collectProjectEmailCounts,
  normalizeProject,
  rawRowToRecord,
  recordToLead,
  summarizeRecords
} from '@/app/api/client-sheets/_sheetUtils';

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
    const rows = Array.isArray(body.rows) ? body.rows.filter(hasMeaningfulLeadData) : [];
    const sheets = Array.isArray(body.sheets) ? body.sheets : [];
    const summary = body.summary && typeof body.summary === 'object' ? body.summary : {};
    const duplicateAction = String(body.duplicateAction || 'skip').trim().toLowerCase();
    const validRows = rows.filter((row) => String(row?.validationStatus || row?.status || '') === 'Valid');

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }
    if (!validRows.length && !sheets.length && duplicateAction !== 'update_existing') {
      return NextResponse.json({ error: 'No valid rows available to save' }, { status: 400 });
    }

    let updatedDuplicates = 0;
    if (duplicateAction === 'update_existing') {
      const duplicateRows = rows.filter((row) => String(row?.validationStatus || row?.status || '') === 'Duplicate' && Array.isArray(row?.duplicateMatches) && row.duplicateMatches.length);
      for (const row of duplicateRows) {
        const firstMatch = row.duplicateMatches[0]?.existing;
        if (!firstMatch?.sourceListId && !firstMatch?.leadIndex && firstMatch?.leadIndex !== 0) continue;
        const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
        const list = await LeadList.findOne({
          _id: firstMatch.sourceListId,
          $or: [{ userId: auth.currentUser._id }, { userEmail }]
        });
        if (!list || !Array.isArray(list.leads) || !list.leads[firstMatch.leadIndex]) continue;
        const currentLead = list.leads[firstMatch.leadIndex];
        currentLead.Name = String(row?.Name || currentLead.Name || '');
        currentLead.Surname = String(row?.Surname || currentLead.Surname || '');
        currentLead.Email = String(row?.Email || currentLead.Email || '').trim().toLowerCase();
        currentLead.Company = String(row?.Company || currentLead.Company || '');
        currentLead.companyName = String(row?.Company || currentLead.companyName || '');
        currentLead.Designation = String(row?.Designation || currentLead.Designation || '');
        currentLead.Phone = String(row?.Phone || currentLead.Phone || '');
        currentLead.linkedinUrl = String(row?.LinkedInUrl || row?.linkedinUrl || currentLead.linkedinUrl || '');
        currentLead.Domain = String(row?.Domain || currentLead.Domain || '');
        currentLead.Sector = String(row?.Sector || currentLead.Sector || '');
        currentLead.Country = String(row?.Country || currentLead.Country || '');
        currentLead.data = {
          ...(currentLead.data || {}),
          ...(row?.data || {}),
          Name: currentLead.Name,
          Surname: currentLead.Surname,
          Email: currentLead.Email,
          Company: currentLead.Company,
          Phone: currentLead.Phone,
          LinkedInUrl: currentLead.linkedinUrl
        };
        list.markModified(`leads.${firstMatch.leadIndex}`);
        await list.save();
        updatedDuplicates += 1;
      }
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
        linkedinUrl: String(row?.LinkedInUrl || row?.linkedinUrl || row?.data?.LinkedInUrl || row?.data?.linkedinUrl || ''),
        Domain: String(row?.Domain || ''),
        Sector: String(row?.Sector || ''),
        Country: String(row?.Country || ''),
        validationStatus: String(row?.validationStatus || row?.status || 'Valid'),
        reasons: Array.isArray(row?.reasons) ? row.reasons.map((item) => String(item || '')) : []
      }))
    });

    if (sheets.length) {
      const userEmail = String(auth.currentUser.email || auth.currentUser.identifier || '').toLowerCase();
      const project = normalizeProject(body.project || body.projectId || '');
      const createdSheets = [];
      for (const item of sheets) {
        const sheetName = String(item.sheetName || item.name || fileName).trim() || fileName;
        const sheetRows = Array.isArray(item.rows) ? item.rows.filter(hasMeaningfulLeadData) : [];
        const sheetColumns = Array.isArray(item.columns) && item.columns.length ? item.columns.map(String) : columns;
        const clientSheet = await ClientSheet.create({
          userId: auth.currentUser._id,
          userEmail,
          project,
          projectId: project,
          sheetName,
          originalFileName: fileName,
          kind: 'uploaded',
          columns: sheetColumns,
          createdBy: userEmail
        });
        const records = sheetRows.map((row, index) => rawRowToRecord(row, {
          userId: auth.currentUser._id,
          userEmail,
          project,
          projectId: project,
          sheetId: clientSheet._id,
          rowIndex: index,
          originalFileName: fileName,
          sheetName,
          uploadedAt: uploadRecord.uploadedDate
        }));
        const globalCounts = await collectProjectEmailCounts(auth, project);
        const flaggedRecords = applyDuplicateFlags(records, globalCounts);
        if (flaggedRecords.length) await ClientRecord.insertMany(flaggedRecords);
        const sheetSummary = summarizeRecords(flaggedRecords);
        Object.assign(clientSheet, sheetSummary);

        const leadList = await LeadList.create({
          userId: auth.currentUser._id,
          userEmail,
          name: `${sheetName} - ${new Date().toLocaleString()}`,
          project,
          projectId: project,
          sourceFile: fileName,
          sourceFileId: String(uploadRecord._id),
          sourceFileName: fileName,
          uploadDate: uploadRecord.uploadedDate,
          validationStatus: inferUploadStatus(sheetSummary),
          kind: 'uploaded',
          columns: sheetColumns,
          dataCenterMeta: {
            sourceType: 'client_sheet_upload',
            clientSheetId: String(clientSheet._id),
            workbookSheetName: sheetName,
            ...sheetSummary
          },
          leads: flaggedRecords.filter((record) => !record.isInvalid && !record.isRepeated).map(recordToLead)
        });
        clientSheet.sourceListId = leadList._id;
        await clientSheet.save();
        createdSheets.push({ _id: String(clientSheet._id), sheetName, ...sheetSummary });
      }

      return NextResponse.json({
        ok: true,
        uploadFileId: String(uploadRecord._id),
        fileName,
        sheets: createdSheets,
        summary: {
          totalRecords: createdSheets.reduce((sum, sheet) => sum + Number(sheet.totalRows || 0), 0),
          validRecords: createdSheets.reduce((sum, sheet) => sum + Number(sheet.freshCount || 0), 0),
          duplicateRecords: createdSheets.reduce((sum, sheet) => sum + Number(sheet.repeatedCount || 0), 0),
          invalidRecords: createdSheets.reduce((sum, sheet) => sum + Number(sheet.invalidCount || 0), 0),
          updatedDuplicates
        }
      });
    }

    let list = null;
    if (validRows.length) {
      list = await LeadList.create({
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
          LinkedInUrl: String(row?.LinkedInUrl || row?.linkedinUrl || row?.data?.LinkedInUrl || row?.data?.linkedinUrl || ''),
          Domain: String(row?.Domain || ''),
          Sector: String(row?.Sector || ''),
          Country: String(row?.Country || ''),
          Source: fileName
        },
        status: 'Pending'
      }))
      });
    }

    if (list?._id) {
      uploadRecord.sourceListId = list._id;
      await uploadRecord.save();
    }

    return NextResponse.json({
      ok: true,
      uploadFileId: String(uploadRecord._id),
      listId: list?._id ? String(list._id) : '',
      fileName,
      uploadedDate: uploadRecord.uploadedDate,
      summary: {
        totalRecords: uploadRecord.totalRecords,
        validRecords: uploadRecord.validRecords,
        duplicateRecords: uploadRecord.duplicateRecords,
        invalidRecords: uploadRecord.invalidRecords,
        updatedDuplicates
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to save uploaded sheet' }, { status: 500 });
  }
}
