'use client';

import { DRAFT_CATEGORIES } from '../lib/draftCategories';

export default function SavedDraftsPanel({ drafts, activeId, onSelect, onEdit, onDelete }) {
  if (!drafts?.length) return null;

  const grouped = DRAFT_CATEGORIES.map((cat) => ({
    ...cat,
    items: drafts.filter((draft) => draft.category === cat.value)
  })).filter((cat) => cat.items.length);

  if (!grouped.length) return null;

  return (
    <section className='card' style={{ marginTop: 18 }}>
      <h4>Saved Draft Scripts</h4>
      <div
        className='grid'
        style={{
          gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
          gap: 14
        }}
      >
        {grouped.map((cat) => (
          <div key={cat.value} className='card' style={{ padding: 14, borderRadius: 10, background: '#f4f4f4' }}>
            <strong style={{ display: 'block', marginBottom: 10 }}>{cat.label}</strong>
            {cat.items.map((draft) => {
              const scriptId = draft._id || draft.id || draft.title;
              const isActive = scriptId && scriptId === activeId;
              const createdAt = draft.createdAt ? new Date(draft.createdAt).toLocaleString() : '';
              return (
                <div
                  key={scriptId}
                  className='card'
                  style={{
                    marginBottom: 10,
                    cursor: 'pointer',
                    padding: 10,
                    border: isActive ? '2px solid #0ea5e9' : '1px solid #e5e7eb',
                    background: isActive ? '#e0f2fe' : '#fff',
                    minHeight: 110
                  }}
                  onClick={() => onSelect(draft)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600 }}>{draft.title}</p>
                      <small style={{ color: 'var(--muted)' }}>{draft.subject}</small>
                      {createdAt ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{createdAt}</div> : null}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button
                        className='button secondary'
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(draft);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className='button danger'
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        type='button'
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(draft);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
