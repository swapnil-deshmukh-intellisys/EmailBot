'use client';

import { useMemo, useRef, useState } from 'react';
import Button from '@/app/components/ui/Button';

function statusClassName(status) {
  if (status === 'Valid') return 'client-upload-preview-row valid';
  if (status === 'Duplicate') return 'client-upload-preview-row duplicate';
  return 'client-upload-preview-row invalid';
}

function renderInlineField(row, field, updateRowField, type = 'text', placeholder = '') {
  return (
    <label className="client-upload-inline-field">
      <span>{field}</span>
      <input
        className="input"
        type={type}
        value={String(row?.[field] || '')}
        placeholder={placeholder}
        onChange={(event) => updateRowField(row.rowId, field, event.target.value)}
      />
    </label>
  );
}

export default function UploadSheetWorkflow({ buttonClassName = '', onUploadSaved = null }) {
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [columns, setColumns] = useState([]);
  const [fileName, setFileName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savingUpload, setSavingUpload] = useState(false);
  const [editingRows, setEditingRows] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const validCount = useMemo(
    () => previewRows.filter((row) => row.validationStatus === 'Valid').length,
    [previewRows]
  );

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
      onUploadSaved?.(data);
    } catch (err) {
      setError(err.message || 'Failed to save upload');
    } finally {
      setSavingUpload(false);
    }
  };

  const updateRowField = (rowId, field, value) => {
    setPreviewRows((current) =>
      current.map((row) =>
        row.rowId === rowId
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
                        {editingRows ? (
                          <div className="client-upload-inline-stack">
                            {renderInlineField(row, 'Name', updateRowField, 'text', 'First name')}
                            {renderInlineField(row, 'Surname', updateRowField, 'text', 'Surname')}
                            {renderInlineField(row, 'Designation', updateRowField, 'text', 'Designation')}
                          </div>
                        ) : (
                          <div className="client-upload-read-stack">
                            <strong>{[row.Name, row.Surname].filter(Boolean).join(' ') || '-'}</strong>
                            <span>{row.Designation || '-'}</span>
                          </div>
                        )}
                      </div>
                      <div className="client-upload-cell-email">
                        {editingRows ? (
                          <div className="client-upload-inline-stack">
                            {renderInlineField(row, 'Email', updateRowField, 'email', 'Email')}
                            {renderInlineField(row, 'Phone', updateRowField, 'text', 'Phone')}
                            {renderInlineField(row, 'Domain', updateRowField, 'text', 'Domain')}
                          </div>
                        ) : (
                          <div className="client-upload-read-stack">
                            <span>{row.Email || '-'}</span>
                            <span>{row.Phone || '-'}</span>
                            <span>{row.Domain || '-'}</span>
                          </div>
                        )}
                      </div>
                      <div className="client-upload-cell-company">
                        {editingRows ? (
                          <div className="client-upload-inline-stack">
                            {renderInlineField(row, 'Company', updateRowField, 'text', 'Company')}
                            {renderInlineField(row, 'Sector', updateRowField, 'text', 'Sector')}
                            {renderInlineField(row, 'Country', updateRowField, 'text', 'Country')}
                          </div>
                        ) : (
                          <div className="client-upload-read-stack">
                            <span>{row.Company || '-'}</span>
                            <span>{row.Sector || '-'}</span>
                            <span>{row.Country || '-'}</span>
                          </div>
                        )}
                      </div>
                      <span className={`client-upload-cell-status client-upload-status client-upload-status-${String(row.validationStatus || '').toLowerCase()}`}>
                        {row.validationStatus}
                      </span>
                      <span className="client-upload-cell-details">
                        {Array.isArray(row.reasons) && row.reasons.length ? row.reasons.join(', ') : 'Ready to save'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="client-data-upload-empty">
                  <strong>No preview yet.</strong>
                  <p>Choose an Excel or CSV file to preview valid, duplicate, and invalid rows before saving.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
