import React, { useState } from 'react';

const TABS = ['Dashboard', 'Client Data', 'Drafts', 'Campaigns'];

const selectStyle = {
  padding: '6px 28px 6px 12px',
  border: '1px solid var(--border,#e8ecf1)',
  borderRadius: 'var(--radius-md,10px)',
  fontSize: 13,
  color: 'var(--text-2,#4a5568)',
  background:
    'var(--surface,#fff) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239aa5b4\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E") no-repeat right 10px center',
  appearance: 'none',
  outline: 'none',
  cursor: 'pointer'
};

export default function TopBar({ activeTab: controlledTab, onTabChange }) {
  const [internalTab, setInternalTab] = useState('Dashboard');
  const activeTab = controlledTab ?? internalTab;
  const handleTab = (tab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  return (
    <header style={styles.topbar}>
      <div style={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTab(tab)}
            style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : {}) }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={styles.actions}>
        <select style={selectStyle} defaultValue="Select Date">
          <option>Select Date</option>
        </select>
        <select style={selectStyle} defaultValue="Select Project">
          <option>Select Project</option>
        </select>
        <select style={selectStyle} defaultValue="Select Sender">
          <option>Select Sender</option>
        </select>
      </div>
    </header>
  );
}

const styles = {
  topbar: {
    height: 'var(--header-h,56px)',
    background: 'var(--surface,#fff)',
    borderBottom: '1px solid var(--border,#e8ecf1)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 24px',
    gap: 8,
    position: 'sticky',
    top: 0,
    zIndex: 50
  },
  tabs: { display: 'flex', alignItems: 'center', gap: 2, flex: 1 },
  tab: {
    padding: '5px 14px',
    borderRadius: 'var(--radius-md,10px)',
    fontSize: 13.5,
    color: 'var(--text-2,#4a5568)',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent'
  },
  tabActive: {
    background: 'var(--accent-light,#eef0fd)',
    color: 'var(--accent,#4f5bd5)',
    fontWeight: 500
  },
  actions: { display: 'flex', alignItems: 'center', gap: 8 }
};
