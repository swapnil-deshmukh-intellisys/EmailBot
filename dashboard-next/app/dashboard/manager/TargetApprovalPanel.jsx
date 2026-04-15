'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui';

export default function TargetApprovalPanel() {
  const [targetEmail, setTargetEmail] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [rejectTargetEmail, setRejectTargetEmail] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const canSubmit = useMemo(() => Boolean(targetEmail.trim()), [targetEmail]);
  const pendingRequests = useMemo(
    () => requests.filter((request) => String(request.status || '').toLowerCase() !== 'approved'),
    [requests]
  );
  const approvedRequests = useMemo(
    () => requests.filter((request) => String(request.status || '').toLowerCase() === 'approved'),
    [requests]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/target-approval?scope=manager', { cache: 'no-store' });
        const data = await response.json().catch(() => null);
        if (!active) return;
        setRequests(Array.isArray(data?.approvals) ? data.approvals : []);
      } catch (error) {
        if (active) setRequests([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const updateStatus = async (email, status) => {
    setRequests((current) =>
      current.map((request) => (
        request.email === email
          ? {
              ...request,
              status: status === 'pending' ? 'Pending' : status === 'rejected' ? 'Rejected' : 'Approved'
            }
          : request
      ))
    );
    await fetch('/api/target-approval', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: email,
        status,
        reviewer: 'Team Lead',
        reviewNote: status === 'rejected' ? reviewNote.trim() || 'Rejected from manager dashboard.' : 'Approved from manager dashboard.'
      })
    }).catch(() => {});
    if (status === 'rejected') {
      setReviewNote('');
      setRejectTargetEmail('');
      setShowRejectModal(false);
    }
  };

  const addRequest = async () => {
    if (!canSubmit) return;
    const email = targetEmail.trim().toLowerCase();
    setRequests((current) => [
      { id: `req-${Date.now()}`, employee: email.split('@')[0], email, target: 'Daily 300 mails', period: 'Daily', status: 'Pending', requestedAt: 'Just now' },
      ...current.filter((request) => request.email !== email)
    ]);
    await fetch('/api/target-approval', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, status: 'pending', note: 'Manager target request created.', period: 'daily', dailyTarget: 300 })
    }).catch(() => {});
    setTargetEmail('');
    setShowAddModal(false);
  };

  return (
    <Card id="target-approvals" className="dashboard-panel">
      <CardHeader>
        <CardTitle>Target Approvals</CardTitle>
        <CardDescription>Approve employee daily targets before they go live.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="admin-form-grid" style={{ marginBottom: 14 }}>
          <input
            className="input"
            value={targetEmail}
            onChange={(event) => setTargetEmail(event.target.value)}
            placeholder="employee@company.com"
          />
          <Button onClick={() => setShowAddModal(true)} disabled={!canSubmit}>Add Request</Button>
        </div>

        <div className="admin-list" style={{ marginBottom: 16 }}>
          <div className="admin-list-item">
            <strong>Pending Requests</strong>
            <p>{pendingRequests.length} target approvals waiting for review.</p>
          </div>
          <div className="admin-list-item">
            <strong>Approved Requests</strong>
            <p>{approvedRequests.length} target approvals already accepted.</p>
          </div>
        </div>

        <div className="admin-list">
          {loading ? (
            <div className="admin-list-item">
              <strong>Loading approval history...</strong>
              <p>Please wait while we load the latest target requests.</p>
            </div>
          ) : null}
          {requests.map((request) => (
            <div key={request.id} className="admin-list-item admin-target-request">
              <div>
                <strong>{request.employee}</strong>
                <p>{request.target} · {request.period}</p>
                <small style={{ display: 'block', marginTop: 4 }}>
                  Requested: {request.requestedAt || 'Today'}
                </small>
                <small style={{ display: 'block', marginTop: 2 }}>
                  {request.reviewedAt ? `Reviewed: ${request.reviewedAt}` : 'Reviewed: Pending'}
                  {request.reviewer ? ` · By ${request.reviewer}` : ''}
                </small>
              </div>
              <div className="admin-target-request-actions">
                <span className={`admin-target-request-status ${String(request.status || '').toLowerCase()}`}>
                  {request.status}
                </span>
                <Button variant="secondary" size="sm" onClick={() => updateStatus(request.email, 'approved')}>
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRejectTargetEmail(request.email);
                    setReviewNote('');
                    setShowRejectModal(true);
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {showRejectModal && typeof window !== 'undefined'
        ? createPortal(
            <div className="dashboard-popup-backdrop" onClick={() => setShowRejectModal(false)}>
              <div className="dashboard-popup-card" onClick={(event) => event.stopPropagation()}>
                <div className="dashboard-popup-head">
                  <div>
                    <strong>Reject target approval</strong>
                    <p>{rejectTargetEmail || 'Selected employee'}</p>
                  </div>
                  <button type="button" className="dashboard-popup-close" onClick={() => setShowRejectModal(false)}>
                    × Close
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                  <input
                    className="input"
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Rejection reason (optional)"
                  />
                  <div className="admin-target-request-actions">
                    <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>
                      Cancel
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => updateStatus(rejectTargetEmail, 'rejected')}>
                      Confirm Reject
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {showAddModal && typeof window !== 'undefined'
        ? createPortal(
            <div className="dashboard-popup-backdrop" onClick={() => setShowAddModal(false)}>
              <div className="dashboard-popup-card" onClick={(event) => event.stopPropagation()}>
                <div className="dashboard-popup-head">
                  <div>
                    <strong>Add target request</strong>
                    <p>{targetEmail || 'employee@company.com'}</p>
                  </div>
                  <button type="button" className="dashboard-popup-close" onClick={() => setShowAddModal(false)}>
                    × Close
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
                  <div className="admin-list-item">
                    <strong>Daily default target</strong>
                    <p>300 mails per day</p>
                  </div>
                  <div className="admin-target-request-actions">
                    <Button variant="secondary" size="sm" onClick={() => setShowAddModal(false)}>
                      Cancel
                    </Button>
                    <Button variant="secondary" size="sm" onClick={addRequest} disabled={!canSubmit}>
                      Confirm Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </Card>
  );
}
