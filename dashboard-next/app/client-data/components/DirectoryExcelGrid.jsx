'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Campaign badge tone colors
const MAIL_STATUS_BADGE = {
  Sent: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  Pending: { bg: '#fef9c3', color: '#854d0e', border: '#fef08a' },
  Failed: { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
  Bounced: { bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' },
  Spam: { bg: '#fae8ff', color: '#86198f', border: '#f5d0fe' },
  'Missing Email': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  Verified: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
};

export default function DirectoryExcelGrid({
  rows = [],
  columns = [],
  rowEdits = {},
  setRowEdits,
  selectedClientIds = [],
  setSelectedClientIds,
  rowEmailIssues = {},
  duplicateEmailRowIds = new Set(),
  showToast
}) {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);

  // Grid dimensions & Virtualization
  const rowHeight = 34; // compact Excel row height
  const gridHeight = 500; // viewport height
  const headerHeight = 36;
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Column width state (default width: 120px, names & emails wider)
  const [columnWidths, setColumnWidths] = useState(() => {
    const widths = {};
    columns.forEach((col) => {
      if (['name', 'surname'].includes(col.field)) {
        widths[col.field] = 130;
      } else if (col.field === 'email') {
        widths[col.field] = 200;
      } else if (col.field === 'designation') {
        widths[col.field] = 160;
      } else if (col.field === 'cmpName') {
        widths[col.field] = 160;
      } else if (['campaignName', 'mailStatus'].includes(col.field)) {
        widths[col.field] = 140;
      } else {
        widths[col.field] = 110;
      }
    });
    return widths;
  });

  const [resizingCol, setResizingCol] = useState(null);

  // Cell Selection State
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 }); // { row, col } indices
  const [selectedCells, setSelectedCells] = useState(new Set()); // Set of "row-col" strings
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);

  // Drag Fill Handle States
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const [dragFillStart, setDragFillStart] = useState(null);
  const [dragFillEnd, setDragFillEnd] = useState(null);

  // Inline editor state
  const [editingCell, setEditingCell] = useState(null); // { row, col }
  const [editValue, setEditValue] = useState('');

  // Undo / Redo History Stack (for rowEdits)
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null); // { x, y, row, col }
  const contextMenuRef = useRef(null);

  // Record history state for Undo
  const recordHistory = (prevEdits = rowEdits) => {
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(prevEdits))]);
    setRedoStack([]); // Clear Redo
  };

  const handleUndo = () => {
    if (!undoStack.length) {
      showToast?.('info', 'Nothing to undo.');
      return;
    }
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(rowEdits))]);
    setRowEdits(previous);
    showToast?.('success', 'Undo successful.');
  };

  const handleRedo = () => {
    if (!redoStack.length) {
      showToast?.('info', 'Nothing to redo.');
      return;
    }
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, JSON.parse(JSON.stringify(rowEdits))]);
    setRowEdits(next);
    showToast?.('success', 'Redo successful.');
  };

  // Keyboard navigation movement helper
  const moveActiveCell = (rowOffset, colOffset, expandSelection = false) => {
    if (!rows.length) return;
    setActiveCell((curr) => {
      const nextRow = Math.max(0, Math.min(rows.length - 1, curr.row + rowOffset));
      const nextCol = Math.max(0, Math.min(columns.length - 1, curr.col + colOffset));

      if (expandSelection) {
        selectCellRange(curr.row, curr.col, nextRow, nextCol);
      } else {
        setSelectedCells(new Set([`${nextRow}-${nextCol}`]));
      }

      // Scroll active cell into view if needed
      const cellTop = nextRow * rowHeight + headerHeight;
      const cellBottom = cellTop + rowHeight;
      const viewTop = scrollTop;
      const viewBottom = scrollTop + gridHeight;

      if (cellTop < viewTop + headerHeight) {
        scrollRef.current.scrollTop = cellTop - headerHeight;
      } else if (cellBottom > viewBottom) {
        scrollRef.current.scrollTop = cellBottom - gridHeight;
      }

      return { row: nextRow, col: nextCol };
    });
  };

  // Cell selection range helper
  const selectCellRange = (startR, startC, endR, endC) => {
    const minR = Math.min(startR, endR);
    const maxR = Math.max(startR, endR);
    const minC = Math.min(startC, endC);
    const maxC = Math.max(startC, endC);
    const range = new Set();
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        range.add(`${r}-${c}`);
      }
    }
    setSelectedCells(range);
  };

  // Click outside to dismiss menu and active filters
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Window mouseup listener for cell dragging
  const handleMouseUpGlobal = () => {
    setIsDraggingSelection(false);
    if (isDraggingFill && dragFillStart && dragFillEnd) {
      handleCompleteDragFill();
    }
    setIsDraggingFill(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, [isDraggingSelection, isDraggingFill, dragFillStart, dragFillEnd, activeCell, rowEdits]);

  // Virtualization indices
  const totalRowsCount = rows.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
  const endIndex = Math.min(totalRowsCount - 1, Math.ceil((scrollTop + gridHeight) / rowHeight) + 5);

  const visibleRows = useMemo(() => {
    return rows.slice(startIndex, endIndex + 1);
  }, [rows, startIndex, endIndex]);

  // Column headers group widths
  const gridWidth = useMemo(() => {
    return columns.reduce((sum, col) => sum + (columnWidths[col.field] || 110), 0) + 90; // +90 for Row Number & Checkbox sticky cols
  }, [columns, columnWidths]);

  // Check if a cell is read-only
  const isReadOnly = (colIndex) => {
    const col = columns[colIndex];
    if (!col) return true;
    return ['campaignName', 'mailStatus', 'mailSentDate', 'mailSentTime'].includes(col.field);
  };

  // Handle cell edit save
  const saveCellEdit = (r, c, val) => {
    const row = rows[r];
    const col = columns[c];
    if (!row || !col || isReadOnly(c)) return;

    recordHistory();
    setRowEdits((prev) => {
      const next = { ...prev };
      const rowId = row.id;
      const rowPatch = { ...(next[rowId] || {}) };
      rowPatch[col.field] = val;
      next[rowId] = rowPatch;
      return next;
    });
  };

  // Mouse handlers for cell range drag selection
  const handleCellMouseDown = (e, r, c) => {
    if (e.button === 2) return; // ignore right click
    setEditingCell(null);
    setContextMenu(null);
    setIsDraggingFill(false);

    if (e.shiftKey && activeCell) {
      selectCellRange(activeCell.row, activeCell.col, r, c);
    } else {
      setActiveCell({ row: r, col: c });
      setSelectedCells(new Set([`${r}-${c}`]));
      setIsDraggingSelection(true);
    }
  };

  const handleCellMouseEnter = (r, c) => {
    if (isDraggingSelection && activeCell) {
      selectCellRange(activeCell.row, activeCell.col, r, c);
    } else if (isDraggingFill && activeCell) {
      setDragFillEnd({ row: r, col: c });
    }
  };

  // Drag Autofill operation
  const handleCompleteDragFill = () => {
    if (!dragFillStart || !dragFillEnd || !activeCell) return;
    const startRow = Math.min(dragFillStart.row, dragFillEnd.row);
    const endRow = Math.max(dragFillStart.row, dragFillEnd.row);
    const colIdx = activeCell.col;
    if (isReadOnly(colIdx)) return;

    const col = columns[colIdx];
    const baseVal = rows[activeCell.row]?.[col.field] ?? '';

    recordHistory();
    setRowEdits((prev) => {
      const next = { ...prev };
      for (let r = startRow; r <= endRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const rowPatch = { ...(next[row.id] || {}) };
        rowPatch[col.field] = baseVal;
        next[row.id] = rowPatch;
      }
      return next;
    });
    showToast?.('success', `Autofilled ${endRow - startRow + 1} cells.`);
  };

  // Column Resizing logic
  const handleColResizeStart = (e, colField) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol({
      field: colField,
      startX: e.clientX,
      startWidth: columnWidths[colField] || 110
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingCol) return;
      const diff = e.clientX - resizingCol.startX;
      setColumnWidths((prev) => ({
        ...prev,
        [resizingCol.field]: Math.max(50, resizingCol.startWidth + diff)
      }));
    };
    const handleMouseUp = () => {
      setResizingCol(null);
    };

    if (resizingCol) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

  // Auto-fit Column width by content length
  const autoFitColumn = (colField, colIdx) => {
    // Measure maximum characters in the column
    let maxLen = columns[colIdx].label.length;
    rows.forEach((row) => {
      const val = String(row[colField] ?? '').trim();
      if (val.length > maxLen) maxLen = val.length;
    });
    const computedWidth = Math.min(400, Math.max(80, maxLen * 8.5 + 24));
    setColumnWidths((prev) => ({
      ...prev,
      [colField]: computedWidth
    }));
    showToast?.('info', `Auto-fit column "${columns[colIdx].label}"`);
  };

  // Keyboard navigation & Shortcuts handler
  const handleGridKeyDown = (e) => {
    if (editingCell) return; // let input handle its own keys
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      // Select all cells
      const allCells = new Set();
      for (let r = 0; r < rows.length; r++) {
        for (let c = 0; c < columns.length; c++) {
          allCells.add(`${r}-${c}`);
        }
      }
      setSelectedCells(allCells);
      showToast?.('info', 'All cells selected.');
      return;
    }

    // Undo / Redo
    if (isCtrl && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      handleUndo();
      return;
    }
    if (isCtrl && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Cut / Copy / Paste
    if (isCtrl && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      handleCopy();
      return;
    }
    if (isCtrl && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      handleCut();
      return;
    }
    if (isCtrl && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      handlePaste();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActiveCell(-1, 0, e.shiftKey);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActiveCell(1, 0, e.shiftKey);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveActiveCell(0, -1, e.shiftKey);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveActiveCell(0, 1, e.shiftKey);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      moveActiveCell(0, e.shiftKey ? -1 : 1, false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isReadOnly(activeCell.col)) {
        startEditing(activeCell.row, activeCell.col);
      } else {
        moveActiveCell(e.shiftKey ? -1 : 1, 0, false);
      }
      return;
    }
    if (e.key === 'F2') {
      e.preventDefault();
      if (!isReadOnly(activeCell.col)) {
        startEditing(activeCell.row, activeCell.col);
      }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearSelectedCells();
      return;
    }

    // Quick text input edit initiation
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!isReadOnly(activeCell.col)) {
        startEditing(activeCell.row, activeCell.col, e.key);
      }
    }
  };

  const startEditing = (r, c, initChar = '') => {
    setEditingCell({ row: r, col: c });
    const col = columns[c];
    const initialVal = rows[r]?.[col.field] ?? '';
    setEditValue(initChar || initialVal);
  };

  const handleEditingKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveCellEdit(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
      moveActiveCell(1, 0, false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      saveCellEdit(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
      moveActiveCell(0, e.shiftKey ? -1 : 1, false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    }
  };

  // Clipboard copy helper
  const handleCopy = async () => {
    const text = getTSVFromSelection();
    try {
      await navigator.clipboard.writeText(text);
      showToast?.('success', 'Selected cells copied to clipboard.');
    } catch {
      showToast?.('error', 'Clipboard copy failed.');
    }
  };

  const handleCut = async () => {
    await handleCopy();
    clearSelectedCells();
  };

  const getTSVFromSelection = () => {
    if (!selectedCells.size) {
      const col = columns[activeCell.col];
      return rows[activeCell.row]?.[col.field] ?? '';
    }

    // Find selection bounding box
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    selectedCells.forEach((key) => {
      const [r, c] = key.split('-').map(Number);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    });

    const lines = [];
    for (let r = minR; r <= maxR; r++) {
      const lineVals = [];
      for (let c = minC; c <= maxC; c++) {
        if (selectedCells.has(`${r}-${c}`)) {
          const col = columns[c];
          lineVals.push(rows[r]?.[col.field] ?? '');
        } else {
          lineVals.push('');
        }
      }
      lines.push(lineVals.join('\t'));
    }
    return lines.join('\n');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      pasteTSVData(text, activeCell.row, activeCell.col);
    } catch {
      showToast?.('error', 'Clipboard paste permission required.');
    }
  };

  const pasteTSVData = (text, startRow, startCol) => {
    if (!text) return;
    const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
    recordHistory();
    setRowEdits((prev) => {
      const next = { ...prev };
      lines.forEach((line, rOffset) => {
        const targetR = startRow + rOffset;
        const row = rows[targetR];
        if (!row) return;

        const cells = line.split('\t');
        const rowPatch = { ...(next[row.id] || {}) };
        cells.forEach((val, cOffset) => {
          const targetC = startCol + cOffset;
          if (isReadOnly(targetC)) return;
          const col = columns[targetC];
          if (col) {
            rowPatch[col.field] = val;
          }
        });
        next[row.id] = rowPatch;
      });
      return next;
    });
    showToast?.('success', `Pasted values starting at Row ${startRow + 1}.`);
  };

  const clearSelectedCells = () => {
    recordHistory();
    setRowEdits((prev) => {
      const next = { ...prev };
      selectedCells.forEach((key) => {
        const [r, c] = key.split('-').map(Number);
        if (isReadOnly(c)) return;
        const row = rows[r];
        const col = columns[c];
        if (row && col) {
          const rowPatch = { ...(next[row.id] || {}) };
          rowPatch[col.field] = '';
          next[row.id] = rowPatch;
        }
      });
      return next;
    });
    showToast?.('success', 'Cleared cell contents.');
  };

  // Right click custom context menu
  const handleCellContextMenu = (e, r, c) => {
    e.preventDefault();
    setEditingCell(null);
    setActiveCell({ row: r, col: c });
    setSelectedCells(new Set([`${r}-${c}`]));

    const rect = scrollRef.current.getBoundingClientRect();
    setContextMenu({
      x: e.clientX - rect.left + scrollRef.current.scrollLeft,
      y: e.clientY - rect.top + scrollRef.current.scrollTop,
      row: r,
      col: c
    });
  };

  // Checkbox row toggling
  const toggleRowSelect = (r) => {
    const rowId = rows[r]?.id;
    if (!rowId) return;

    setSelectedClientIds((current) => {
      if (current.includes(rowId)) {
        return current.filter((id) => id !== rowId);
      }
      return [...current, rowId];
    });
  };

  const handleSelectAllChecked = () => {
    const visibleIds = rows.map((r) => r.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedClientIds.includes(id));
    if (allSelected) {
      // Unselect all visible rows
      setSelectedClientIds((curr) => curr.filter((id) => !visibleIds.includes(id)));
    } else {
      // Select all visible rows
      setSelectedClientIds((curr) => Array.from(new Set([...curr, ...visibleIds])));
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="excel-grid-container directory-excel-grid"
      onKeyDown={handleGridKeyDown}
      onClick={() => containerRef.current?.focus()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-soft, #e2e8f0)',
        borderRadius: '8px',
        background: '#ffffff',
        overflow: 'hidden',
        position: 'relative',
        outline: 'none',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}
    >
      {/* Scrollable Spreadsheet Viewport */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          setScrollTop(e.target.scrollTop);
          setScrollLeft(e.target.scrollLeft);
        }}
        style={{
          height: `${gridHeight}px`,
          overflow: 'auto',
          position: 'relative',
          background: '#f8fafc'
        }}
      >
        {/* Full scroll canvas size */}
        <div style={{ height: `${totalRowsCount * rowHeight + headerHeight}px`, width: `${gridWidth}px`, position: 'relative' }}>
          
          {/* Header Row */}
          <div
            className="excel-grid-head"
            style={{
              display: 'flex',
              height: `${headerHeight}px`,
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: '#f1f5f9',
              borderBottom: '2px solid #cbd5e1',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
            }}
          >
            {/* Sticky headers for No. and Select */}
            <span style={{
              width: '45px',
              minWidth: '45px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '11px',
              borderRight: '1px solid #cbd5e1',
              color: '#475569',
              position: 'sticky',
              left: 0,
              background: '#f1f5f9',
              zIndex: 20
            }}>No.</span>
            
            <span style={{
              width: '45px',
              minWidth: '45px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '1px solid #cbd5e1',
              position: 'sticky',
              left: '45px',
              background: '#f1f5f9',
              zIndex: 20
            }}>
              <input
                type="checkbox"
                checked={rows.length > 0 && rows.every((row) => selectedClientIds.includes(row.id))}
                onChange={handleSelectAllChecked}
                style={{ cursor: 'pointer' }}
              />
            </span>

            {/* Other columns */}
            {columns.map((column, colIdx) => {
              const width = columnWidths[column.field] || 110;
              const isCampaignHeader = ['campaignName', 'mailStatus', 'mailSentDate', 'mailSentTime'].includes(column.field);
              return (
                <div
                  key={column.field}
                  className={`excel-header-cell ${isCampaignHeader ? 'campaign-col-header' : ''}`}
                  style={{
                    width: `${width}px`,
                    minWidth: `${width}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 8px',
                    fontWeight: 700,
                    fontSize: '12px',
                    borderRight: '1px solid #cbd5e1',
                    color: '#1e293b',
                    position: 'relative',
                    userSelect: 'none',
                    textAlign: 'center',
                    background: isCampaignHeader ? '#e0f2fe' : '#f1f5f9'
                  }}
                  onDoubleClick={() => autoFitColumn(column.field, colIdx)}
                  title="Double click edge to auto-fit content"
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {column.label}
                  </span>

                  {/* Resizer Handle */}
                  <div
                    onMouseDown={(e) => handleColResizeStart(e, column.field)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '5px',
                      cursor: 'col-resize',
                      zIndex: 5,
                      background: resizingCol?.field === column.field ? '#2563eb' : 'transparent'
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Virtualized grid items */}
          <div style={{ position: 'absolute', top: `${startIndex * rowHeight + headerHeight}px`, left: 0, right: 0 }}>
            {visibleRows.map((row, vIdx) => {
              const rowIndex = startIndex + vIdx;
              const isRowChecked = selectedClientIds.includes(row.id);
              const isRowIndexDuplicate = duplicateEmailRowIds.has(row.id);

              return (
                <div
                  key={row.id || rowIndex}
                  className="excel-grid-row"
                  style={{
                    display: 'flex',
                    height: `${rowHeight}px`,
                    background: isRowChecked 
                      ? 'rgba(37, 99, 235, 0.08)' 
                      : isRowIndexDuplicate 
                        ? 'rgba(239, 68, 68, 0.05)' 
                        : rowIndex % 2 === 0 
                          ? '#ffffff' 
                          : '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    alignItems: 'center'
                  }}
                >
                  {/* Sticky Row indices */}
                  <span
                    onClick={() => toggleRowSelect(rowIndex)}
                    style={{
                      width: '45px',
                      minWidth: '45px',
                      height: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRight: '1px solid #cbd5e1',
                      fontWeight: 600,
                      fontSize: '11px',
                      color: '#64748b',
                      background: '#f1f5f9',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'sticky',
                      left: 0,
                      zIndex: 5
                    }}
                  >
                    {rowIndex + 1}
                  </span>

                  {/* Sticky checkbox column */}
                  <span style={{
                    width: '45px',
                    minWidth: '45px',
                    height: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRight: '1px solid #cbd5e1',
                    position: 'sticky',
                    left: '45px',
                    background: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                    zIndex: 5
                  }}>
                    <input
                      type="checkbox"
                      checked={isRowChecked}
                      onChange={() => toggleRowSelect(rowIndex)}
                      style={{ cursor: 'pointer' }}
                    />
                  </span>

                  {/* Table Cell elements */}
                  {columns.map((column, colIdx) => {
                    const width = columnWidths[column.field] || 110;
                    const val = row[column.field] ?? '';
                    const cellKey = `${rowIndex}-${colIdx}`;
                    const isCellSelected = selectedCells.has(cellKey);
                    const isActive = activeCell.row === rowIndex && activeCell.col === colIdx;
                    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIdx;
                    const hasEmailError = column.field === 'email' && Boolean(rowEmailIssues[row.id]);
                    const readOnlyCol = isReadOnly(colIdx);

                    return (
                      <div
                        key={`${rowIndex}-${column.field}`}
                        onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIdx)}
                        onMouseEnter={() => handleCellMouseEnter(rowIndex, colIdx)}
                        onDoubleClick={() => {
                          if (!readOnlyCol) startEditing(rowIndex, colIdx);
                        }}
                        onContextMenu={(e) => handleCellContextMenu(e, rowIndex, colIdx)}
                        style={{
                          width: `${width}px`,
                          minWidth: `${width}px`,
                          height: '100%',
                          padding: '0 8px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRight: '1px solid #e2e8f0',
                          background: isEditing
                            ? '#ffffff'
                            : isCellSelected
                              ? 'rgba(37, 99, 235, 0.12)'
                              : isActive
                                ? 'rgba(37, 99, 235, 0.05)'
                                : 'transparent',
                          color: hasEmailError
                            ? 'var(--danger, #ef4444)'
                            : isRowIndexDuplicate && column.field === 'email'
                              ? 'var(--warning, #f59e0b)'
                              : '#1e293b',
                          outline: isActive && !isEditing ? '2px solid #2563eb' : 'none',
                          outlineOffset: '-2px',
                          zIndex: isActive ? 2 : 1,
                          fontSize: '13px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                        title={val}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleEditingKeyDown}
                            onBlur={() => {
                              saveCellEdit(rowIndex, colIdx, editValue);
                              setEditingCell(null);
                            }}
                            autoFocus
                            style={{
                              width: '100%',
                              height: '100%',
                              border: 'none',
                              padding: 0,
                              background: 'transparent',
                              outline: 'none',
                              color: '#1e293b',
                              fontSize: '13px'
                            }}
                          />
                        ) : column.field === 'mailStatus' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: (MAIL_STATUS_BADGE[val] || MAIL_STATUS_BADGE.Pending).bg,
                              color: (MAIL_STATUS_BADGE[val] || MAIL_STATUS_BADGE.Pending).color,
                              border: `1px solid ${(MAIL_STATUS_BADGE[val] || MAIL_STATUS_BADGE.Pending).border}`
                            }}
                          >
                            {val}
                          </span>
                        ) : (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                            {val === '-' ? '' : val}
                          </span>
                        )}

                        {/* Excel Drag Fill Handle Corner Handle */}
                        {isActive && !isEditing && !readOnlyCol && (
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingFill(true);
                              setDragFillStart({ row: rowIndex, col: colIdx });
                              setDragFillEnd({ row: rowIndex, col: colIdx });
                            }}
                            style={{
                              position: 'absolute',
                              right: '-2px',
                              bottom: '-2px',
                              width: '6px',
                              height: '6px',
                              background: '#2563eb',
                              border: '1px solid #ffffff',
                              cursor: 'crosshair',
                              zIndex: 10
                            }}
                          />
                        )}

                        {/* Autofill Drag indicator dashed outline */}
                        {isDraggingFill && dragFillStart && dragFillEnd && rowIndex >= Math.min(dragFillStart.row, dragFillEnd.row) && rowIndex <= Math.max(dragFillStart.row, dragFillEnd.row) && colIdx === activeCell.col && (
                          <div style={{ position: 'absolute', inset: 0, border: '2px dashed #2563eb', background: 'rgba(37, 99, 235, 0.05)', pointerEvents: 'none' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Click custom context menu */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            style={{
              position: 'absolute',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              zIndex: 100,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '4px 0',
              minWidth: '160px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            }}
          >
            {!isReadOnly(contextMenu.col) && (
              <button
                onClick={() => {
                  setContextMenu(null);
                  startEditing(contextMenu.row, contextMenu.col);
                }}
                style={{ display: 'block', width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', fontSize: '13px' }}
              >
                📝 Edit Cell
              </button>
            )}
            <button
              onClick={() => {
                setContextMenu(null);
                handleCopy();
              }}
              style={{ display: 'block', width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', fontSize: '13px' }}
            >
              📋 Copy Cell (Ctrl+C)
            </button>
            {!isReadOnly(contextMenu.col) && (
              <>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    handleCut();
                  }}
                  style={{ display: 'block', width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', fontSize: '13px' }}
                >
                  ✂️ Cut Cell (Ctrl+X)
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    handlePaste();
                  }}
                  style={{ display: 'block', width: '100%', padding: '6px 12px', textAlign: 'left', background: 'none', border: 'none', color: '#1e293b', cursor: 'pointer', fontSize: '13px' }}
                >
                  📥 Paste Cell (Ctrl+V)
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    clearSelectedCells();
                  }}
                  style={{ display: 'block', width: '100%', padding: '6px 12px', textAlign: 'left', borderTop: '1px solid #f1f5f9', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}
                >
                  🧹 Clear Value
                </button>
              </>
            )}
          </div>
        )}

      </div>

      {/* Spreadsheet grid status bar summary info */}
      <div
        className="excel-grid-status-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          background: '#f1f5f9',
          borderTop: '1px solid #cbd5e1',
          fontSize: '12px',
          color: '#475569',
          fontWeight: 600
        }}
      >
        <div style={{ display: 'flex', gap: '14px' }}>
          <span>Total Records: <strong>{totalRowsCount}</strong></span>
          <span>Selected Rows: <strong>{selectedClientIds.length}</strong></span>
          <span>Selected Cells: <strong>{selectedCells.size}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '14px' }}>
          <span style={{ color: '#ef4444' }}>
            Validation Errors: <strong>{Object.keys(rowEmailIssues).length}</strong>
          </span>
          <span style={{ color: '#f59e0b' }}>
            Duplicates: <strong>{duplicateEmailRowIds.size}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
