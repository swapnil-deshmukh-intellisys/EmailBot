'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/app/components/ui/Button';

const SHEET_FIELDS = ['Name', 'Surname', 'Designation', 'Email', 'Phone', 'Domain', 'Company', 'Sector', 'Country'];

function statusClassName(status) {
  if (status === 'Valid') return 'client-upload-preview-row valid';
  if (status === 'Duplicate') return 'client-upload-preview-row duplicate';
  return 'client-upload-preview-row invalid';
}

export default function UploadSheetWorkflow({ buttonClassName = '', onUploadSaved = null }) {
  const fileInputRef = useRef(null);
  const spreadsheetRefs = useRef({});
  const [open, setOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [columns, setColumns] = useState([]);
  const [fileName, setFileName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savingUpload, setSavingUpload] = useState(false);
  const [editingRows, setEditingRows] = useState(false);
  const [activeCell, setActiveCell] = useState({ rowIndex: 0, colIndex: 0 });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savedSheets, setSavedSheets] = useState([]);
  const [sheetEditingId, setSheetEditingId] = useState('');
  const [sheetDraftName, setSheetDraftName] = useState('');
  const [sheetSavingId, setSheetSavingId] = useState('');
  const [sheetDeletingId, setSheetDeletingId] = useState('');

  const validCount = useMemo(
    () => previewRows.filter((row) => row.validationStatus === 'Valid').length,
    [previewRows]
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    const loadSheets = async () => {
      try {
        const response = await fetch('/api/client-data/list', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error || 'Failed to load sheets');
        }
        if (!active) return;
        setSavedSheets(Array.isArray(data?.lists) ? data.lists : []);
      } catch (err) {
        if (!active) return;
        setSavedSheets([]);
      }
    };
    void loadSheets();
    return () => {
      active = false;
    };
  }, [open]);

  const requestPreview = async (payload, isMultipart = false) => {
    const response = await fetch('/api/uploads/preview', {
      method: 'POST',
      ...(isMultipart ? {} : { headers: { 'Content-Type': 'application/json' } }),
      body: payload
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to preview upload');
    }
    setPreviewRows(Array.isArray(data?.rows) ? data.rows : []);
    setSummary(data?.summary || null);
    setColumns(Array.isArray(data?.columns) ? data.columns : []);
    setFileName(String(data?.fileName || fileName || 'upload-sheet'));
    setError('');
    setMessage('');
  };

  const handleChooseFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setLoadingPreview(true);
      setEditingRows(false);
      setError('');
      setMessage('');
      const form = new FormData();
      form.append('file', file);
      await requestPreview(form, true);
    } catch (err) {
      setError(err.message || 'Failed to preview upload');
    } finally {
      setLoadingPreview(false);
      event.target.value = '';
    }
  };

  const handleRevalidate = async () => {
    try {
      setLoadingPreview(true);
      await requestPreview(
        JSON.stringify({
          fileName,
          columns,
          rows: previewRows.map((row) => ({
            ...(row?.data || {}),
            Name: row.Name,
            Surname: row.Surname,
            Company: row.Company,
            Designation: row.Designation,
            Email: row.Email,
            Phone: row.Phone,
            Domain: row.Domain,
            Sector: row.Sector,
            Country: row.Country
          }))
        })
      );
      setMessage('Customized data revalidated.');
    } catch (err) {
      setError(err.message || 'Failed to revalidate data');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCustomizeData = async () => {
    try {
      setLoadingPreview(true);
      setEditingRows(false);
      await requestPreview(
        JSON.stringify({
          fileName,
          columns,
          rows: previewRows.map((row) => ({
            ...(row?.data || {}),
            Name: row.Name,
            Surname: row.Surname,
            Company: row.Company,
            Designation: row.Designation,
            Email: row.Email,
            Phone: row.Phone,
            Domain: row.Domain,
            Sector: row.Sector,
            Country: row.Country
          }))
        })
      );
      setEditingRows(true);
      setMessage('Automatic corrections applied. Remaining invalid or duplicate rows can be edited below.');
    } catch (err) {
      setError(err.message || 'Failed to customize data');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    try {
      setSavingUpload(true);
      const response = await fetch('/api/uploads/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, columns, rows: previewRows, summary })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save upload');
      }
      setMessage(`Saved ${data?.summary?.validRecords || validCount} valid rows from ${fileName}.`);
      setError('');
      setSavedSheets((current) => [
        {
          _id: data?.listId || `${Date.now()}`,
          name: data?.listName || fileName,
          sourceFile: fileName,
          kind: 'uploaded',
          uploadedAt: new Date().toISOString(),
          leadCount: Number(data?.summary?.validRecords || validCount || 0)
        },
        ...current
      ]);
      onUploadSaved?.(data);
    } catch (err) {
      setError(err.message || 'Failed to save upload');
    } finally {
      setSavingUpload(false);
    }
  };

  const updateCellByIndex = (rowIndex, field, value) => {
    setPreviewRows((current) =>
      current.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              [field]: value,
              data: {
                ...(row.data || {}),
                [field]: value
              }
            }
          : row
      )
    );
  };

  const handleEditSheet = (sheet) => {
    setSheetEditingId(String(sheet?._id || ''));
    setSheetDraftName(String(sheet?.name || '').trim());
  };

  const handleUpdateSheet = async (sheetId) => {
    try {
      setSheetSavingId(String(sheetId));
      const response = await fetch(`/api/lists/${encodeURIComponent(sheetId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to update sheet');
      setSavedSheets((current) =>
        current.map((item) =>
          String(item._id) === String(sheetId)
            ? {
                ...item,
                name: data?.name || item.name,
                sourceFile: data?.sourceFile || item.sourceFile,
                uploadedAt: data?.uploadedAt || item.uploadedAt,
                leadCount: Array.isArray(data?.leads) ? data.leads.length : Number(item?.leadCount || 0)
              }
            : item
        )
      );
      setMessage('Sheet updated.');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to update sheet');
      setMessage('');
    } finally {
      setSheetSavingId('');
    }
  };

  const handleSaveSheet = async (sheetId) => {
    const nextName = String(sheetDraftName || '').trim();
    if (!nextName) return;
    try {
      setSheetSavingId(String(sheetId));
      const response = await fetch(`/api/lists/${encodeURIComponent(sheetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to save sheet');
      setSavedSheets((current) =>
        current.map((item) => (String(item._id) === String(sheetId) ? { ...item, name: nextName } : item))
      );
      setSheetEditingId('');
      setSheetDraftName('');
      setMessage('Sheet saved.');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to save sheet');
      setMessage('');
    } finally {
      setSheetSavingId('');
    }
  };

  const handleDeleteSheet = async (sheetId) => {
    if (!window.confirm('Delete this sheet?')) return;
    try {
      setSheetDeletingId(String(sheetId));
      const response = await fetch(`/api/lists/${encodeURIComponent(sheetId)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to delete sheet');
      setSavedSheets((current) => current.filter((item) => String(item._id) !== String(sheetId)));
      setMessage('Sheet deleted.');
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to delete sheet');
      setMessage('');
    } finally {
      setSheetDeletingId('');
    }
  };

  const focusCell = (rowIndex, colIndex) => {
    const key = `${rowIndex}-${colIndex}`;
    const input = spreadsheetRefs.current[key];
    if (input) {
      input.focus();
      input.select();
    }
    setActiveCell({ rowIndex, colIndex });
  };

  const handleCellKeyDown = (event, rowIndex, colIndex) => {
    const maxRow = Math.max(0, previewRows.length - 1);
    const maxCol = Math.max(0, SHEET_FIELDS.length - 1);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCell(rowIndex, Math.min(maxCol, colIndex + 1));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCell(rowIndex, Math.max(0, colIndex - 1));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusCell(Math.min(maxRow, rowIndex + 1), colIndex);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusCell(Math.max(0, rowIndex - 1), colIndex);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      focusCell(Math.min(maxRow, rowIndex + 1), colIndex);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        focusCell(rowIndex, Math.max(0, colIndex - 1));
      } else {
        focusCell(rowIndex, Math.min(maxCol, colIndex + 1));
      }
    }
  };

  const handleCellPaste = (event, startRowIndex, startColIndex) => {
    const rawText = event.clipboardData?.getData('text/plain');
    if (!rawText || !rawText.trim()) return;
    event.preventDefault();

    const pastedRows = rawText
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.split('\t'));

    if (!pastedRows.length) return;

    setPreviewRows((current) =>
      current.map((row, rowIndex) => {
        const relativeRow = rowIndex - startRowIndex;
        if (relativeRow < 0 || relativeRow >= pastedRows.length) return row;
        const sourceValues = pastedRows[relativeRow];
        const nextData = { ...(row.data || {}) };
        let touched = false;
        const nextRow = { ...row };

        sourceValues.forEach((cellValue, offsetCol) => {
          const targetCol = startColIndex + offsetCol;
          if (targetCol < 0 || targetCol >= SHEET_FIELDS.length) return;
          const field = SHEET_FIELDS[targetCol];
          nextRow[field] = cellValue;
          nextData[field] = cellValue;
          touched = true;
        });

        if (!touched) return row;
        nextRow.data = nextData;
        return nextRow;
      })
    );
  };

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => {
          setOpen(true);
          setError('');
          setMessage('');
        }}
      >
        Upload Sheet
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv"
        className="client-data-hidden-file-input"
        onChange={handleChooseFile}
      />

      {open ? (
        <div className="client-upload-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="client-upload-modal" onClick={(event) => event.stopPropagation()}>
            <div className="client-upload-modal-head">
              <div>
                <h3>Upload Sheet</h3>
                <p>Upload Excel or CSV, preview the rows, mark duplicates or invalid data, and save all valid clients.</p>
              </div>
              <button type="button" className="client-upload-modal-close" onClick={() => setOpen(false)}>x</button>
            </div>

            <div className="client-upload-modal-actions">
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={loadingPreview}>
                {loadingPreview ? 'Parsing...' : 'Choose XLSX / CSV'}
              </Button>
              {previewRows.length ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => setEditingRows((value) => !value)}>
                    {editingRows ? 'Done Editing' : 'Edit Manually'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleCustomizeData} disabled={loadingPreview}>
                    {loadingPreview ? 'Customizing...' : 'Customize Data'}
                  </Button>
                  {editingRows ? (
                    <Button type="button" variant="secondary" onClick={handleRevalidate} disabled={loadingPreview}>
                      Revalidate Data
                    </Button>
                  ) : null}
                  <Button type="button" onClick={handleSave} disabled={savingUpload || !validCount}>
                    {savingUpload ? 'Saving...' : 'Save All Valid'}
                  </Button>
                </>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>

            {summary ? (
              <div className="client-upload-summary">
                <article><span>Total Records</span><strong>{summary.totalRecords}</strong></article>
                <article><span>Valid Records</span><strong>{summary.validRecords}</strong></article>
                <article><span>Duplicate Records</span><strong>{summary.duplicateRecords}</strong></article>
                <article><span>Invalid Records</span><strong>{summary.invalidRecords}</strong></article>
              </div>
            ) : null}

            {error ? <p className="client-data-custom-note error">{error}</p> : null}
            {message ? <p className="client-data-custom-note success">{message}</p> : null}

            <div className="client-upload-preview">
              <div className="client-upload-preview-head">
                <span>File Name</span>
                <strong>{fileName || 'No file selected'}</strong>
              </div>

              {previewRows.length ? (
                <div className="client-upload-preview-table">
                  {editingRows ? (
                    <div className="client-upload-sheet-wrapper">
                      <p className="client-upload-sheet-hint">
                        Excel mode: click any cell, type, then use Enter/Tab/Arrow keys. You can copy and paste blocks from Excel directly.
                      </p>
                      <div className="client-upload-sheet-table">
                        <div className="client-upload-sheet-row client-upload-sheet-row-head client-directory-excel-head">
                          <span className="client-directory-excel-head-cell">#</span>
                          {SHEET_FIELDS.map((field) => (
                            <span key={`head-${field}`} className="client-directory-excel-head-cell">{field}</span>
                          ))}
                          <span className="client-directory-excel-head-cell">Status</span>
                          <span className="client-directory-excel-head-cell">Details</span>
                        </div>
                        {previewRows.map((row, rowIndex) => (
                          <div key={row.rowId} className={`client-upload-sheet-row client-directory-excel-row ${statusClassName(row.validationStatus)}`}>
                            <span className="client-directory-excel-cell">{rowIndex + 1}</span>
                            {SHEET_FIELDS.map((field, colIndex) => (
                              <div
                                key={`${row.rowId}-${field}`}
                                ref={(node) => {
                                  spreadsheetRefs.current[`${rowIndex}-${colIndex}`] = node;
                                }}
                                className={`client-directory-excel-cell client-upload-sheet-input ${
                                  activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex ? 'active' : ''
                                }`}
                                contentEditable
                                suppressContentEditableWarning
                                onFocus={() => setActiveCell({ rowIndex, colIndex })}
                                onInput={(event) => updateCellByIndex(rowIndex, field, event.currentTarget.textContent || '')}
                                onKeyDown={(event) => handleCellKeyDown(event, rowIndex, colIndex)}
                                onPaste={(event) => handleCellPaste(event, rowIndex, colIndex)}
                              >
                                {String(row?.[field] || '')}
                              </div>
                            ))}
                            <span className={`client-directory-excel-cell client-upload-cell-status client-upload-status client-upload-status-${String(row.validationStatus || '').toLowerCase()}`}>
                              {row.validationStatus}
                            </span>
                            <span className="client-directory-excel-cell client-upload-cell-details">
                              {Array.isArray(row.reasons) && row.reasons.length ? row.reasons.join(', ') : 'Ready to save'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="client-upload-preview-grid client-upload-preview-grid-head">
                        <span className="client-upload-cell-name">Name</span>
                        <span className="client-upload-cell-email">Email</span>
                        <span className="client-upload-cell-company">Company</span>
                        <span className="client-upload-cell-status">Status</span>
                        <span className="client-upload-cell-details">Details</span>
                      </div>

                      {previewRows.map((row) => (
                        <div key={row.rowId} className={`client-upload-preview-grid ${statusClassName(row.validationStatus)}`}>
                          <div className="client-upload-cell-name">
                            <div className="client-upload-read-stack">
                              <strong>{[row.Name, row.Surname].filter(Boolean).join(' ') || '-'}</strong>
                              <span>{row.Designation || '-'}</span>
                            </div>
                          </div>
                          <div className="client-upload-cell-email">
                            <div className="client-upload-read-stack">
                              <span>{row.Email || '-'}</span>
                              <span>{row.Phone || '-'}</span>
                              <span>{row.Domain || '-'}</span>
                            </div>
                          </div>
                          <div className="client-upload-cell-company">
                            <div className="client-upload-read-stack">
                              <span>{row.Company || '-'}</span>
                              <span>{row.Sector || '-'}</span>
                              <span>{row.Country || '-'}</span>
                            </div>
                          </div>
                          <span className={`client-upload-cell-status client-upload-status client-upload-status-${String(row.validationStatus || '').toLowerCase()}`}>
                            {row.validationStatus}
                          </span>
                          <span className="client-upload-cell-details">
                            {Array.isArray(row.reasons) && row.reasons.length ? row.reasons.join(', ') : 'Ready to save'}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="client-data-upload-empty">
                  <strong>No preview yet.</strong>
                  <p>Choose an Excel or CSV file to preview valid, duplicate, and invalid rows before saving.</p>
                </div>
              )}
            </div>

            <div className="client-upload-preview" style={{ marginTop: 10 }}>
              <div className="client-upload-preview-head">
                <span>Saved Sheets</span>
                <strong>{savedSheets.length}</strong>
              </div>
              <div className="client-data-health-list">
                {savedSheets.length ? savedSheets.slice(0, 12).map((sheet) => (
                  <div key={sheet._id} style={{ display: 'grid', gap: 8 }}>
                    <strong>
                      {sheetEditingId === String(sheet._id) ? (
                        <input
                          className="input"
                          value={sheetDraftName}
                          onChange={(event) => setSheetDraftName(event.target.value)}
                        />
                      ) : (
                        sheet.name
                      )}
                    </strong>
                    <span>{sheet.sourceFile || '-'} | {Number(sheet.leadCount || 0)} contacts</span>
                    <div className="client-data-sheet-savebar" style={{ justifyContent: 'flex-start' }}>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleEditSheet(sheet)}>Edit</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleUpdateSheet(sheet._id)} disabled={sheetSavingId === String(sheet._id)}>
                        {sheetSavingId === String(sheet._id) ? 'Updating...' : 'Update'}
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => handleSaveSheet(sheet._id)} disabled={sheetEditingId !== String(sheet._id) || sheetSavingId === String(sheet._id)}>
                        {sheetSavingId === String(sheet._id) ? 'Saving...' : 'Save'}
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={() => handleDeleteSheet(sheet._id)} disabled={sheetDeletingId === String(sheet._id)}>
                        {sheetDeletingId === String(sheet._id) ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div>
                    <strong>No saved sheets yet.</strong>
                    <span>Upload and save a sheet to manage it here.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
