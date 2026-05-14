'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';
import ClientDataSectionNav from '@/app/client-data/components/ClientDataSectionNav';
import { UNIFIED_NAVBAR_TOPBAR_PROPS } from '@/shared-components/layout-components/UnifiedNavbarConfig';

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

const EMPTY_UPLOAD_FILTERS = {
  search: '',
  date: '',
  status: '',
  name: '',
  designation: '',
  sector: '',
  country: ''
};

const UploadedFilesFilters = memo(function UploadedFilesFilters({
  initialFilters,
  sectorOptions,
  countryOptions,
  hasAppliedFilters,
  isApplyingFilters,
  onApply,
  onReset
}) {
  const [localFilters, setLocalFilters] = useState(initialFilters);
  const [searchInput, setSearchInput] = useState(initialFilters.search || '');

  useEffect(() => {
    setLocalFilters(initialFilters);
    setSearchInput(initialFilters.search || '');
  }, [initialFilters]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setLocalFilters((current) => (current.search === searchInput ? current : { ...current, search: searchInput }));
    }, 350);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  const setField = useCallback((field, value) => {
    setLocalFilters((current) => ({ ...current, [field]: value }));
  }, []);

  const hasLocalChanges = useMemo(
    () =>
      searchInput !== initialFilters.search ||
      localFilters.date !== initialFilters.date ||
      localFilters.status !== initialFilters.status ||
      localFilters.name !== initialFilters.name ||
      localFilters.designation !== initialFilters.designation ||
      localFilters.sector !== initialFilters.sector ||
      localFilters.country !== initialFilters.country,
    [initialFilters, localFilters, searchInput]
  );

  const applyNow = useCallback(() => {
    onApply({ ...localFilters, search: searchInput });
  }, [localFilters, onApply, searchInput]);

  return (
    <div className="client-data-filter-bar">
      <label className="client-data-filter-field">
        <span>Search File Name</span>
        <input className="input" type="text" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search file name" />
      </label>
      <label className="client-data-filter-field">
        <span>Date</span>
        <input className="input" type="date" value={localFilters.date} onChange={(event) => setField('date', event.target.value)} />
      </label>
      <label className="client-data-filter-field">
        <span>Status</span>
        <select className="input" value={localFilters.status} onChange={(event) => setField('status', event.target.value)}>
          <option value="">All</option>
          <option value="Valid">Valid</option>
          <option value="Duplicate">Duplicate</option>
          <option value="Invalid">Invalid</option>
        </select>
      </label>
      <label className="client-data-filter-field">
        <span>Name</span>
        <input className="input" type="text" value={localFilters.name} onChange={(event) => setField('name', event.target.value)} placeholder="Filter row name" />
      </label>
      <label className="client-data-filter-field">
        <span>Designation</span>
        <input className="input" type="text" value={localFilters.designation} onChange={(event) => setField('designation', event.target.value)} placeholder="Filter designation" />
      </label>
      <label className="client-data-filter-field">
        <span>Sector</span>
        <select className="input" value={localFilters.sector} onChange={(event) => setField('sector', event.target.value)}>
          <option value="">All sectors</option>
          {sectorOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="client-data-filter-field">
        <span>Country</span>
        <select className="input" value={localFilters.country} onChange={(event) => setField('country', event.target.value)}>
          <option value="">All countries</option>
          {countryOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <div className="client-data-filter-actions">
        <Button type="button" disabled={!hasLocalChanges || isApplyingFilters} onClick={applyNow}>
          {isApplyingFilters ? 'Applying...' : 'Apply Filters'}
        </Button>
        <Button type="button" variant="secondary" disabled={(!hasAppliedFilters && !hasLocalChanges) || isApplyingFilters} onClick={onReset}>
          Reset Filters
        </Button>
      </div>
    </div>
  );
});

export default function UploadedFilesPage() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [filters, setFilters] = useState(EMPTY_UPLOAD_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_UPLOAD_FILTERS);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

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

  const hasAppliedFilters = useMemo(
    () => Object.values(appliedFilters).some(Boolean),
    [appliedFilters]
  );

  const handleApplyFilters = useCallback((nextFilters) => {
    const normalized = {
      search: String(nextFilters.search || '').trim(),
      date: String(nextFilters.date || '').trim(),
      status: String(nextFilters.status || '').trim(),
      name: String(nextFilters.name || '').trim(),
      designation: String(nextFilters.designation || '').trim(),
      sector: String(nextFilters.sector || '').trim(),
      country: String(nextFilters.country || '').trim()
    };
    setFilters(normalized);
    setIsApplyingFilters(true);
    requestAnimationFrame(() => {
      setAppliedFilters(normalized);
      setIsApplyingFilters(false);
    });
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(EMPTY_UPLOAD_FILTERS);
    setAppliedFilters(EMPTY_UPLOAD_FILTERS);
  }, []);

  return (
    <AppLayout topbarProps={UNIFIED_NAVBAR_TOPBAR_PROPS}>
      <div className="client-data-page">
        <ClientDataSectionNav />
        <section className="ui-page-section">
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Uploaded Files</h2>
              <p className="ui-page-section-description">
                Daily upload history with valid, duplicate, and invalid client records.
              </p>
            </div>
          </div>

          <UploadedFilesFilters
            initialFilters={filters}
            sectorOptions={sectorOptions}
            countryOptions={countryOptions}
            hasAppliedFilters={hasAppliedFilters}
            isApplyingFilters={isApplyingFilters}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
          />
          <p className="ui-card-description" style={{ marginBottom: 12 }}>
            Showing {filteredUploads.length} of {uploads.length} uploaded files.
          </p>

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
