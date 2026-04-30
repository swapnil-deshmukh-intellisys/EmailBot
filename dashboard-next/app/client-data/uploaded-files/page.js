'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';
import UploadSheetWorkflow from '@/app/client-data/components/UploadSheetWorkflow';

function formatUploadedAt(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatDateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function matchesPreviewFilter(previewRows = [], predicate) {
  return previewRows.some(predicate);
}

export default function UploadedFilesPage() {
  const router = useRouter();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [searchDraft, setSearchDraft] = useState('');
  const [filterDateDraft, setFilterDateDraft] = useState('');
  const [filterStatusDraft, setFilterStatusDraft] = useState('');
  const [filterNameDraft, setFilterNameDraft] = useState('');
  const [filterDesignationDraft, setFilterDesignationDraft] = useState('');
  const [filterSectorDraft, setFilterSectorDraft] = useState('');
  const [filterCountryDraft, setFilterCountryDraft] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    date: '',
    status: '',
    name: '',
    designation: '',
    sector: '',
    country: ''
  });

  useEffect(() => {
    let active = true;

    const loadUploads = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/uploads', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Failed to load upload history');
        if (!active) return;
        setUploads(Array.isArray(data?.uploads) ? data.uploads : []);
        setError('');
      } catch (err) {
        if (!active) return;
        setUploads([]);
        setError(err.message || 'Failed to load upload history');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadUploads();
    return () => {
      active = false;
    };
  }, [refreshNonce]);

  const sectorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          uploads.flatMap((upload) =>
            (upload.previewRows || []).map((row) => String(row?.Sector || '').trim()).filter(Boolean)
          )
        )
      ).sort((a, b) => a.localeCompare(b)),
    [uploads]
  );

  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          uploads.flatMap((upload) =>
            (upload.previewRows || []).map((row) => String(row?.Country || '').trim()).filter(Boolean)
          )
        )
      ).sort((a, b) => a.localeCompare(b)),
    [uploads]
  );

  const filteredUploads = useMemo(
    () =>
      uploads.filter((upload) => {
        const fileName = String(upload?.fileName || '').toLowerCase();
        const matchesSearch = !appliedFilters.search || fileName.includes(appliedFilters.search.toLowerCase());
        const matchesDate = !appliedFilters.date || formatDateOnly(upload?.uploadedDate) === appliedFilters.date;
        const matchesStatus = !appliedFilters.status || String(upload?.status || '').toLowerCase() === appliedFilters.status.toLowerCase();
        const matchesName =
          !appliedFilters.name ||
          matchesPreviewFilter(upload.previewRows, (row) => String(row?.Name || '').toLowerCase().includes(appliedFilters.name.toLowerCase()));
        const matchesDesignation =
          !appliedFilters.designation ||
          matchesPreviewFilter(upload.previewRows, (row) => String(row?.Designation || '').toLowerCase().includes(appliedFilters.designation.toLowerCase()));
        const matchesSector =
          !appliedFilters.sector ||
          matchesPreviewFilter(upload.previewRows, (row) => String(row?.Sector || '') === appliedFilters.sector);
        const matchesCountry =
          !appliedFilters.country ||
          matchesPreviewFilter(upload.previewRows, (row) => String(row?.Country || '') === appliedFilters.country);
        return matchesSearch && matchesDate && matchesStatus && matchesName && matchesDesignation && matchesSector && matchesCountry;
      }),
    [uploads, appliedFilters]
  );

  return (
    <AppLayout
      topbarProps={{
        title: 'Client Data',
        subtitle: 'Upload, manage, and review client files and records.',
        copyFooter: (
          <div className="client-data-section-switcher client-data-section-switcher-top" aria-label="Client data section controls">
            <button type="button" className="client-data-section-switcher-button active" onClick={() => router.push('/client-data/uploaded-files')}>
              Uploaded Files
            </button>
            <button type="button" className="client-data-section-switcher-button" onClick={() => router.push('/client-data/client-list')}>
              Client List
            </button>
            <UploadSheetWorkflow
              buttonClassName="client-data-section-switcher-button"
              onUploadSaved={() => setRefreshNonce((value) => value + 1)}
            />
          </div>
        )
      }}
    >
      <div className="client-data-page">
        <section className="ui-page-section">
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Uploaded Files</h2>
              <p className="ui-page-section-description">
                Daily upload history with valid, duplicate, and invalid client records.
              </p>
            </div>
          </div>

          <div className="client-data-filter-bar">
            <label className="client-data-filter-field">
              <span>Search File Name</span>
              <input className="input" type="text" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search file name" />
            </label>
            <label className="client-data-filter-field">
              <span>Date</span>
              <input className="input" type="date" value={filterDateDraft} onChange={(event) => setFilterDateDraft(event.target.value)} />
            </label>
            <label className="client-data-filter-field">
              <span>Status</span>
              <select className="input" value={filterStatusDraft} onChange={(event) => setFilterStatusDraft(event.target.value)}>
                <option value="">All</option>
                <option value="Valid">Valid</option>
                <option value="Duplicate">Duplicate</option>
                <option value="Invalid">Invalid</option>
              </select>
            </label>
            <label className="client-data-filter-field">
              <span>Name</span>
              <input className="input" type="text" value={filterNameDraft} onChange={(event) => setFilterNameDraft(event.target.value)} placeholder="Filter row name" />
            </label>
            <label className="client-data-filter-field">
              <span>Designation</span>
              <input className="input" type="text" value={filterDesignationDraft} onChange={(event) => setFilterDesignationDraft(event.target.value)} placeholder="Filter designation" />
            </label>
            <label className="client-data-filter-field">
              <span>Sector</span>
              <select className="input" value={filterSectorDraft} onChange={(event) => setFilterSectorDraft(event.target.value)}>
                <option value="">All sectors</option>
                {sectorOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="client-data-filter-field">
              <span>Country</span>
              <select className="input" value={filterCountryDraft} onChange={(event) => setFilterCountryDraft(event.target.value)}>
                <option value="">All countries</option>
                {countryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div className="client-data-filter-actions">
              <Button
                type="button"
                onClick={() =>
                  setAppliedFilters({
                    search: searchDraft,
                    date: filterDateDraft,
                    status: filterStatusDraft,
                    name: filterNameDraft,
                    designation: filterDesignationDraft,
                    sector: filterSectorDraft,
                    country: filterCountryDraft
                  })
                }
              >
                Apply Filter
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSearchDraft('');
                  setFilterDateDraft('');
                  setFilterStatusDraft('');
                  setFilterNameDraft('');
                  setFilterDesignationDraft('');
                  setFilterSectorDraft('');
                  setFilterCountryDraft('');
                  setAppliedFilters({
                    search: '',
                    date: '',
                    status: '',
                    name: '',
                    designation: '',
                    sector: '',
                    country: ''
                  });
                }}
              >
                Clear Filter
              </Button>
            </div>
          </div>

          <div className="client-data-upload-grid">
            {!loading && !error && !filteredUploads.length ? (
              <div className="client-data-upload-empty">
                <strong>No upload history found.</strong>
                <p>Upload a sheet to keep daily history here.</p>
              </div>
            ) : null}

            {!loading && !error
              ? filteredUploads.map((upload) => (
                  <article key={upload._id} className={`client-data-upload-card client-data-upload-card-status-${String(upload.status || '').toLowerCase()}`}>
                    <div className="client-data-upload-card-head">
                      <div className="client-data-upload-card-title">
                        <strong>{upload.fileName}</strong>
                        <span className={`client-data-upload-kind client-data-upload-kind-${String(upload.status || '').toLowerCase()}`}>{upload.status}</span>
                      </div>
                      <span>{upload.totalRecords} rows</span>
                    </div>
                    <p>Uploaded {formatUploadedAt(upload.uploadedDate)}</p>
                    <small>
                      Valid {upload.validRecords} | Duplicate {upload.duplicateRecords} | Invalid {upload.invalidRecords}
                    </small>
                    {(upload.duplicateRecords > 0 || upload.invalidRecords > 0) ? (
                      <small className="client-data-upload-warning">
                        Duplicate or invalid records are highlighted in red in the upload preview.
                      </small>
                    ) : null}
                  </article>
                ))
              : null}

            {loading ? <div className="client-data-upload-empty"><strong>Loading upload history...</strong></div> : null}
            {!loading && error ? <div className="client-data-upload-empty"><strong>{error}</strong></div> : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
