import React from 'react';
import Button from '@/shared-components/ui-components/UiActionButton';
import { Card, CardContent } from '@/shared-components/ui-components/UiContentCard';

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
    <div className="ui-dropdown-group">
      <Button variant="secondary" onClick={() => setShowUploadedFilesDropdown((prev) => !prev)}>
        Uploaded Files
      </Button>
      {showUploadedFilesDropdown ? (
        <Card className="ui-dropdown-card">
          <CardContent className="ui-dropdown-card-content">
            {lists.length ? (
              lists.map((list) => (
                <label
                  key={list._id}
                  className={`ui-dropdown-option ${selectedListId === list._id ? 'is-selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedUploadedFileIds.includes(list._id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedUploadedFileIds((prev) => [...new Set([...prev, list._id])]);
                      } else {
                        setSelectedUploadedFileIds((prev) => prev.filter((id) => id !== list._id));
                      }
                    }}
                  />
                  <span onClick={() => setSelectedListId(list._id)} className="ui-dropdown-option-label">
                    {list.name}
                  </span>
                </label>
              ))
            ) : (
              <p className="ui-empty-note">No uploaded files</p>
            )}
          </CardContent>
        </Card>
      ) : null}
      {showUploadedFilesDropdown ? (
        <>
          <Button
            variant="danger"
            onClick={onDeleteSelected}
            disabled={!selectedListId && !selectedUploadedFileIds.length}
          >
            Delete Selected
          </Button>
          <Button variant="danger" onClick={onDeleteAll} disabled={!lists.length}>
            Delete All
          </Button>
        </>
      ) : null}
    </div>
  );
}

export default React.memo(LeadList);
