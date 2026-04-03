'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardPlaceholderShell from '../components/DashboardPlaceholderShell';
import Button from '../components/ui/Button';

const STATUS_VARIANTS = {
  approved: 'success',
  archived: 'neutral',
  review: 'warning',
  'in review': 'warning',
  draft: 'info'
};

function formatRelativeDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) {
    const mins = Math.floor(diffMs / minute);
    return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (diffMs < 2 * day) return 'Yesterday';
  if (diffMs < 7 * day) {
    const days = Math.floor(diffMs / day);
    return `${days} days ago`;
  }

  return date.toLocaleDateString();
}

function getDraftStatus(draft) {
  const raw = String(draft?.status || draft?.approvalStatus || draft?.stage || '').trim();
  if (raw) return raw;
  return 'Approved';
}

function getDraftOwner(draft) {
  return (
    draft?.owner ||
    draft?.updatedBy ||
    draft?.createdBy ||
    draft?.userEmail ||
    'Team'
  );
}

function renderCell(cell, column) {
  const text = String(cell || '');
  if (column === 'Status') {
    const key = text.toLowerCase().trim();
    const badgeVariant = STATUS_VARIANTS[key] || 'info';
    return <span className={`workspace-status-badge workspace-status-${badgeVariant}`}>{text}</span>;
  }
  return <span>{text}</span>;
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let intervalId = null;

    const loadDrafts = async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }
        const response = await fetch('/api/drafts?scope=all', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch drafts');
        }

        if (active) {
          setError('');
          setDrafts(Array.isArray(data?.drafts) ? data.drafts : []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to fetch drafts');
          if (!silent) {
            setDrafts([]);
          }
        }
      } finally {
        if (active && !silent) {
          setLoading(false);
        }
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadDrafts({ silent: true });
      }
    };

    void loadDrafts();
    intervalId = window.setInterval(() => {
      void loadDrafts({ silent: true });
    }, 5000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const approvedCount = useMemo(
    () => drafts.filter((draft) => getDraftStatus(draft).toLowerCase() === 'approved').length,
    [drafts]
  );
  const reviewCount = useMemo(
    () =>
      drafts.filter((draft) => {
        const status = getDraftStatus(draft).toLowerCase();
        return status === 'review' || status === 'in review';
      }).length,
    [drafts]
  );
  const archivedCount = useMemo(
    () => drafts.filter((draft) => getDraftStatus(draft).toLowerCase() === 'archived').length,
    [drafts]
  );

  const rows = useMemo(
    () =>
      drafts.map((draft) => [
        draft?.title || 'Untitled Draft',
        draft?.subject || '-',
        getDraftStatus(draft),
        getDraftOwner(draft),
        formatRelativeDate(draft?.updatedAt || draft?.createdAt)
      ]),
    [drafts]
  );

  const recentItems = useMemo(
    () =>
      drafts.slice(0, 3).map((draft) => ({
        title: draft?.title || 'Draft updated',
        meta: `${getDraftStatus(draft)} | ${formatRelativeDate(draft?.updatedAt || draft?.createdAt)}`
      })),
    [drafts]
  );

  return (
    <DashboardPlaceholderShell>
      <section className="workspace-page" style={{ '--workspace-accent': '#f97316' }}>
        <div className="workspace-hero">
          <div>
            <span className="workspace-kicker">Drafts</span>
            <h1>Manage campaign messaging with a cleaner editorial workflow.</h1>
            <p>Keep approved copy, work-in-progress drafts, and archived variants visible to the whole team.</p>
          </div>
          <div className="workspace-hero-actions">
            <Button variant="secondary" className="workspace-secondary">Import Copy</Button>
            <Button className="workspace-primary">Create Draft</Button>
          </div>
        </div>

        <div className="workspace-stats">
          <article className="workspace-stat-card">
            <span>Saved Drafts</span>
            <strong>{loading ? '...' : drafts.length}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>Approved</span>
            <strong>{loading ? '...' : approvedCount}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>In Review</span>
            <strong>{loading ? '...' : reviewCount}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>Archived</span>
            <strong>{loading ? '...' : archivedCount}</strong>
          </article>
        </div>

        <div className="workspace-grid">
          <section className="workspace-panel workspace-panel-large">
            <div className="workspace-panel-head">
              <div>
                <h2>Draft Library</h2>
                <p>Saved drafts from your database, including subject, status, owner, and last update.</p>
              </div>
              <Button variant="ghost" size="sm">View All</Button>
            </div>

            <div className="workspace-table workspace-table-scroll">
              <div className="workspace-table-head" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                {['Draft', 'Subject', 'Status', 'Owner', 'Updated'].map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>

              {loading ? (
                <div className="workspace-table-row" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                  <span>Loading drafts...</span>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}

              {!loading && error ? (
                <div className="workspace-table-row" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                  <span>{error}</span>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}

              {!loading && !error && !rows.length ? (
                <div className="workspace-table-row" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                  <span>No drafts found in the database.</span>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : null}

              {!loading && !error
                ? rows.map((row, index) => (
                    <div key={index} className="workspace-table-row" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                      {row.map((cell, cellIndex) => (
                        <span key={cellIndex}>{renderCell(cell, ['Draft', 'Subject', 'Status', 'Owner', 'Updated'][cellIndex])}</span>
                      ))}
                    </div>
                  ))
                : null}
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>Editorial Status</h2>
                <p>Live counts pulled from your saved drafts.</p>
              </div>
            </div>
            <div className="workspace-list">
              <div>
                <strong>Ready to Send</strong>
                <span>{approvedCount} approved drafts are campaign-ready</span>
              </div>
              <div>
                <strong>Waiting for Review</strong>
                <span>{reviewCount} drafts need approval before launch</span>
              </div>
              <div>
                <strong>Archived</strong>
                <span>{archivedCount} drafts are stored as archived variants</span>
              </div>
            </div>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel-head">
              <div>
                <h2>Editor Activity</h2>
                <p>Recently updated drafts from the database.</p>
              </div>
            </div>
            <div className="workspace-activity">
              {recentItems.length ? recentItems.map((item) => (
                <article key={`${item.title}-${item.meta}`}>
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </article>
              )) : (
                <article>
                  <strong>No recent activity</strong>
                  <p>Saved draft updates will appear here once drafts are available.</p>
                </article>
              )}
            </div>
          </section>
        </div>
      </section>
    </DashboardPlaceholderShell>
  );
}
