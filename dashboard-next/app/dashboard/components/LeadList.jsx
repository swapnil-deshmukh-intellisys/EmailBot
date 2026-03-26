import React from 'react';

function LeadList({
  lists,
  selectedListId,
  selectedUploadedFileIds,
  showUploadedFilesDropdown,
  setShowUploadedFilesDropdown,
  setSelectedUploadedFileIds,
  setSelectedListId,
  onDeleteSelected,
  onDeleteAll
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'nowrap'
      }}
    >
      <button
        className="button secondary"
        type="button"
        onClick={() => setShowUploadedFilesDropdown((prev) => !prev)}
        style={{ minWidth: 140, flexShrink: 0 }}
      >
        Uploaded Files
      </button>
      {showUploadedFilesDropdown ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 20,
            minWidth: 320,
            maxHeight: 200,
            overflowY: 'auto',
            margin: 0,
            border: '1px solid #cbd5e1',
            borderRadius: 10,
            background: '#fff',
            padding: 8,
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)'
          }}
        >
          {lists.length ? (
            lists.map((list) => (
              <label
                key={list._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 4px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  background: selectedListId === list._id ? '#eff6ff' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedUploadedFileIds.includes(list._id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUploadedFileIds((prev) => [...new Set([...prev, list._id])]);
                    } else {
                      setSelectedUploadedFileIds((prev) => prev.filter((id) => id !== list._id));
                    }
                  }}
                />
                <span onClick={() => setSelectedListId(list._id)} style={{ flex: 1 }}>
                  {list.name}
                </span>
              </label>
            ))
          ) : (
            <p>No uploaded files</p>
          )}
        </div>
      ) : null}
      {showUploadedFilesDropdown ? (
        <>
          <button
            className="button danger"
            type="button"
            onClick={onDeleteSelected}
            disabled={!selectedListId && !selectedUploadedFileIds.length}
          >
            Delete Selected
          </button>
          <button className="button danger" type="button" onClick={onDeleteAll} disabled={!lists.length}>
            Delete All
          </button>
        </>
      ) : null}
    </div>
  );
}

export default React.memo(LeadList);
