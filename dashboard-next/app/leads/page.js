'use client';

import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/app/components/layout/AppLayout';
import Button from '@/app/components/ui/Button';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

export default function LeadsPage() {
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadPipeline = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/leads/pipeline', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || data?.ok === false) throw new Error(data?.error || 'Failed to load leads');
        if (!active) return;
        setPipeline(Array.isArray(data.stages) ? data.stages : []);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load leads');
        setPipeline([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadPipeline();
    return () => {
      active = false;
    };
  }, []);

  const totalResponses = useMemo(
    () => pipeline.reduce((sum, stage) => sum + Number(stage.count || 0), 0),
    [pipeline]
  );

  const interestedCount = useMemo(
    () => pipeline.find((stage) => stage.stage === 'Interested')?.count || 0,
    [pipeline]
  );

  return (
    <AppLayout>
      <section className="user-dashboard-page lead-pipeline-page">
        <div className="user-dashboard-hero">
          <div>
            <span className="user-dashboard-kicker">Leads</span>
            <h1>Customer response pipeline</h1>
            <p>Track received replies, next follow-ups, and sales stages in a CRM-style board.</p>
          </div>
          <div className="user-dashboard-actions">
            <Button variant="secondary" onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </div>

        <div className="report-count-grid">
          <article className="report-count-card"><span>Total responses</span><strong>{loading ? '...' : totalResponses}</strong><small>Received reply clients</small></article>
          <article className="report-count-card"><span>Interested</span><strong>{loading ? '...' : interestedCount}</strong><small>Positive pipeline</small></article>
          <article className="report-count-card"><span>Pipeline stages</span><strong>{pipeline.length || 8}</strong><small>CRM board</small></article>
        </div>

        {error ? <div className="dashboard-error-state">{error}</div> : null}

        <div className="lead-kanban">
          {loading ? Array.from({ length: 4 }).map((_, index) => (
            <section key={index} className="lead-kanban-column skeleton-card"><strong>Loading...</strong></section>
          )) : pipeline.map((stage) => (
            <section key={stage.stage} className="lead-kanban-column">
              <div className="lead-kanban-head">
                <strong>{stage.stage}</strong>
                <span>{stage.count}</span>
              </div>
              <div className="lead-kanban-cards">
                {stage.cards.length ? stage.cards.map((card) => (
                  <article key={card.id} className="lead-card">
                    <div className="lead-card-head">
                      <strong>{card.clientName}</strong>
                      <span>{card.responseStatus}</span>
                    </div>
                    <p>{card.company}</p>
                    <small>{card.email}</small>
                    <div className="lead-card-meta">
                      <span>Last reply: {formatDate(card.lastReplyDate)}</span>
                      <span>Owner: {card.assignedUser}</span>
                      <span>Next follow-up: {formatDate(card.nextFollowUpDate)}</span>
                    </div>
                    {card.preview ? <p className="lead-card-preview">{card.preview}</p> : null}
                    <div className="lead-card-actions">
                      <button type="button">Add Note</button>
                      <button type="button">Schedule Follow-up</button>
                      <button type="button">Move Stage</button>
                      <button type="button">Open Client Profile</button>
                    </div>
                  </article>
                )) : (
                  <div className="lead-empty-card">
                    <strong>No clients</strong>
                    <p>Responses moved here will appear in this stage.</p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
