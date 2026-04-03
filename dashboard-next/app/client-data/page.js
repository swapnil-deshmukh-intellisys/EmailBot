'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Badge from '@/app/components/ui/Badge';
import Button from '@/app/components/ui/Button';

const TABLE_COLUMNS = ['Name', 'Email', 'Company', 'City', 'Status', 'Source'];

const badgeToneMap = {
  Verified: 'success',
  'Needs Review': 'warning',
  'Missing Email': 'danger'
};

function getLeadStatus(lead) {
  const email = String(lead?.Email || lead?.data?.Email || lead?.data?.email || '').trim();
  if (!email) return 'Missing Email';
  return 'Verified';
}

function getLeadCity(lead) {
  return (
    lead?.data?.City ||
    lead?.data?.city ||
    lead?.data?.Location ||
    lead?.data?.location ||
    '-'
  );
}

function getLeadSource(list) {
  const source = String(list?.sourceFile || list?.name || '').trim();
  return source || 'Uploaded List';
}

function formatUploadedAt(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export default function ClientDataPage() {
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadLists = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const response = await fetch('/api/stats', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch client data');
        }

        if (!active) return;

        const nextLists = Array.isArray(data?.lists) ? data.lists : [];
        setError('');
        setLists(nextLists);

        const nextSelectedId =
          nextLists.some((item) => item._id === selectedListId)
            ? selectedListId
            : nextLists[0]?._id || '';

        setSelectedListId(nextSelectedId);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to fetch client data');
        if (!silent) {
          setLists([]);
          setSelectedListId('');
          setSelectedList(null);
        }
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadLists({ silent: true });
      }
    };

    void loadLists();
    intervalId = window.setInterval(() => {
      void loadLists({ silent: true });
    }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [selectedListId]);

  useEffect(() => {
    let active = true;
    if (!selectedListId) {
      setSelectedList(null);
      return () => {
        active = false;
      };
    }

    const loadSelectedList = async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoadingList(true);
        const response = await fetch(`/api/lists/${selectedListId}`, { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch list data');
        }

        if (active) {
          setSelectedList(data);
          setError('');
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to fetch list data');
          if (!silent) {
            setSelectedList(null);
          }
        }
      } finally {
        if (active && !silent) setLoadingList(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadSelectedList({ silent: true });
      }
    };

    void loadSelectedList();
    const intervalId = window.setInterval(() => {
      void loadSelectedList({ silent: true });
    }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [selectedListId]);

  const clientRows = useMemo(() => {
    if (!selectedList?.leads?.length) return [];
    return selectedList.leads.map((lead, index) => ({
      id: `${selectedList._id || 'list'}-${index}`,
      name: lead?.Name || lead?.data?.Name || lead?.data?.name || '-',
      email: lead?.Email || lead?.data?.Email || lead?.data?.email || '-',
      company: lead?.Company || lead?.data?.Company || lead?.data?.company || '-',
      city: getLeadCity(lead),
      status: getLeadStatus(lead),
      source: getLeadSource(selectedList)
    }));
  }, [selectedList]);

  const totalClients = useMemo(
    () => lists.reduce((sum, list) => sum + Number(list?.leadCount || 0), 0),
    [lists]
  );

  const verifiedCount = useMemo(
    () => clientRows.filter((row) => row.status === 'Verified').length,
    [clientRows]
  );

  const missingEmailCount = useMemo(
    () => clientRows.filter((row) => row.status === 'Missing Email').length,
    [clientRows]
  );

  const sourceCards = useMemo(
    () => [
      { label: 'Total Clients', value: loading ? '...' : String(totalClients) },
      { label: 'Active Lists', value: loading ? '...' : String(lists.length) },
      { label: 'Verified Contacts', value: loadingList ? '...' : String(verifiedCount) },
      { label: 'Pending Review', value: loadingList ? '...' : String(missingEmailCount) }
    ],
    [loading, totalClients, lists.length, loadingList, verifiedCount, missingEmailCount]
  );

  const sourceHealthItems = useMemo(
    () =>
      lists.slice(0, 6).map((list) => ({
        title: list.name,
        meta: `${list.leadCount || 0} contacts • uploaded ${formatUploadedAt(list.uploadedAt)}`
      })),
    [lists]
  );

  const recentActivityItems = useMemo(
    () =>
      lists.slice(0, 3).map((list) => ({
        title: list.sourceFile || list.name || 'Uploaded list',
        meta: `${list.leadCount || 0} contacts • ${formatUploadedAt(list.uploadedAt)}`
      })),
    [lists]
  );

  return (
    <AppLayout
      topbarProps={{
        title: 'Client Data',
        subtitle: 'Upload, manage, and review client files and records.',
        actions: (
          <>
            <Button variant="secondary">Create Sheet</Button>
            <Button>Upload File</Button>
          </>
        )
      }}
    >
      <div className="client-data-page">
        <section className="ui-page-section">
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Overview</h2>
              <p className="ui-page-section-description">
                Track uploaded files, source health, and current client records.
              </p>
            </div>
          </div>

          <div className="client-data-stats">
            {sourceCards.map((card) => (
              <article key={card.label} className="client-data-stat-card">
                <div className="ui-card-content">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ui-page-section">
          <div className="ui-page-section-header">
            <div className="ui-page-section-copy">
              <h2 className="ui-page-section-title">Client Workspace</h2>
              <p className="ui-page-section-description">
                Keep imported lists, client records, and validation status in one place before campaigns go live.
              </p>
            </div>
            <div className="ui-page-section-actions">
              <select
                className="input"
                value={selectedListId}
                onChange={(event) => setSelectedListId(event.target.value)}
                style={{ minWidth: 240 }}
              >
                {lists.length ? lists.map((list) => (
                  <option key={list._id} value={list._id}>
                    {list.name} ({list.leadCount || 0})
                  </option>
                )) : <option value="">No uploaded lists</option>}
              </select>
              <Button variant="secondary">Import List</Button>
            </div>
          </div>

          <div className="client-data-grid">
            <section className="client-data-panel client-data-panel-large">
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Client Directory</h2>
                  <p className="ui-card-description">
                    Live client rows from your selected uploaded list.
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  {selectedList ? `${clientRows.length} rows` : 'View All'}
                </Button>
              </div>

              <div className="ui-card-content">
                <div className="client-data-table client-data-table-scroll">
                  <div className="client-data-table-head">
                    {TABLE_COLUMNS.map((column) => (
                      <span key={column}>{column}</span>
                    ))}
                  </div>

                  {loading || loadingList ? (
                    <div className="client-data-table-row">
                      <span>Loading client data...</span>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !loadingList && error ? (
                    <div className="client-data-table-row">
                      <span>{error}</span>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !loadingList && !error && !clientRows.length ? (
                    <div className="client-data-table-row">
                      <span>No client data found.</span>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {!loading && !loadingList && !error ? clientRows.map((row) => (
                    <div key={row.id} className="client-data-table-row">
                      <span>{row.name}</span>
                      <span>{row.email}</span>
                      <span>{row.company}</span>
                      <span>{row.city}</span>
                      <span>
                        <Badge variant={badgeToneMap[row.status] || 'default'}>
                          {row.status}
                        </Badge>
                      </span>
                      <span>{row.source}</span>
                    </div>
                  )) : null}
                </div>
              </div>
            </section>

            <section className="client-data-panel">
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Source Health</h2>
                  <p className="ui-card-description">Live overview of uploaded client lists.</p>
                </div>
              </div>
              <div className="ui-card-content">
                <div className="client-data-health-list">
                  {sourceHealthItems.length ? sourceHealthItems.map((item) => (
                    <div key={item.title}>
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </div>
                  )) : (
                    <div>
                      <strong>No uploaded lists</strong>
                      <span>Upload a list and it will appear here automatically.</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="client-data-panel">
              <div className="client-data-panel-head">
                <div>
                  <h2 className="ui-card-title">Recent Activity</h2>
                  <p className="ui-card-description">Latest uploaded lists and changes from the database.</p>
                </div>
              </div>
              <div className="ui-card-content">
                <div className="client-data-activity-list">
                  {recentActivityItems.length ? recentActivityItems.map((item) => (
                    <article key={`${item.title}-${item.meta}`}>
                      <strong>{item.title}</strong>
                      <p>{item.meta}</p>
                    </article>
                  )) : (
                    <article>
                      <strong>No recent activity</strong>
                      <p>When you upload client data, it will show here automatically.</p>
                    </article>
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
