'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function ExcelGrid({
  pasteRows = [],
  setPasteRows,
  activeCell = { row: 0, col: 0 },
  setActiveCell,
  selectedRows,
  setSelectedRows,
  selectedCells,
  setSelectedCells,
  clipboardData,
  setClipboardData,
  pasteInvalidRowIndexes = new Set(),
  pasteDuplicateRowIndexes = new Set(),
  columns = [],
  hasVisibleClientData,
  showToast
}) {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);

  // Layout & Scrolling state
  const rowHeight = 36; // px
  const gridHeight = 460; // px
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Column properties state
  const [columnWidths, setColumnWidths] = useState(() =>
    Object.fromEntries(columns.map((col) => [col.key, 125]))
  );
  const [resizingCol, setResizingCol] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [columnFilters, setColumnFilters] = useState({});
  const [activeFilterPopup, setActiveFilterPopup] = useState(null);
  const filterPopupRef = useRef(null);

  // Editing & Dragging states
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { row, col }

  // Drag Fill Handle States
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const [dragFillStart, setDragFillStart] = useState(null); // { row, col }
  const [dragFillEnd, setDragFillEnd] = useState(null); // { row, col }

  // Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Right-Click Context Menu State
  const [contextMenu, setContextMenu] = useState(null); // { x, y, row, col }
  const contextMenuRef = useRef(null);

  // Click Outside hooks
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
      if (filterPopupRef.current && !filterPopupRef.current.contains(e.target)) {
        setActiveFilterPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save current grid state to Undo History before modification
  const recordHistory = (rowsToRecord = pasteRows) => {
    setHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(rowsToRecord))]);
    setRedoStack([]); // Clear Redo
  };

  const handleUndo = () => {
    if (!historyStack.length) {
      showToast?.('info', 'Nothing to undo.');
      return;
    }
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(pasteRows))]);
    setPasteRows(previous);
    showToast?.('success', 'Undo successful.');
  };

  const handleRedo = () => {
    if (!redoStack.length) {
      showToast?.('info', 'Nothing to redo.');
      return;
    }
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setHistoryStack((prev) => [...prev, JSON.parse(JSON.stringify(pasteRows))]);
    setPasteRows(next);
    showToast?.('success', 'Redo successful.');
  };

  // Virtualization calculations
  const totalRowsCount = pasteRows.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 5);
  const endIndex = Math.min(totalRowsCount - 1, Math.ceil((scrollTop + gridHeight) / rowHeight) + 5);

  // Filter and Sort pasteRows data
  const filteredSortedRows = useMemo(() => {
    let result = [...pasteRows];

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, filterText]) => {
      if (!filterText) return;
      const lowerFilter = filterText.toLowerCase().trim();
      result = result.filter((row) =>
        String(row[key] || '').toLowerCase().includes(lowerFilter)
      );
    });

    // Apply sorting
    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        const valA = String(a[key] || '').toLowerCase();
        const valB = String(b[key] || '').toLowerCase();
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [pasteRows, columnFilters, sortConfig]);

  const visibleRows = useMemo(() => {
    return filteredSortedRows.slice(startIndex, endIndex + 1);
  }, [filteredSortedRows, startIndex, endIndex]);

  // Selection utilities
  const selectCellRange = (startR, startC, endR, endC) => {
    const minR = Math.min(startR, endR);
    const maxR = Math.max(startR, endR);
    const minC = Math.min(startC, endC);
    const maxC = Math.max(startC, endC);
    const nextCells = new Set();
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        nextCells.add(`${r}-${c}`);
      }
    }
    setSelectedCells(nextCells);
  };

  const selectRowRange = (startR, endR) => {
    const minR = Math.min(startR, endR);
    const maxR = Math.max(startR, endR);
    const nextRows = new Set(selectedRows);
    const nextCells = new Set(selectedCells);
    for (let r = minR; r <= maxR; r++) {
      const rowId = pasteRows[r]?._rowId;
      if (rowId) nextRows.add(rowId);
      for (let c = 0; c < columns.length; c++) {
        nextCells.add(`${r}-${c}`);
      }
    }
    setSelectedRows(nextRows);
    setSelectedCells(nextCells);
  };

  const selectAllRows = () => {
    const allIds = filteredSortedRows.filter(hasVisibleClientData).map((r) => r._rowId).filter(Boolean);
    setSelectedRows(new Set(allIds));
    const allCells = new Set();
    for (let r = 0; r < filteredSortedRows.length; r++) {
      for (let c = 0; c < columns.length; c++) {
        allCells.add(`${r}-${c}`);
      }
    }
    setSelectedCells(allCells);
    showToast?.('info', 'All rows and cells selected.');
  };

  // Keyboard navigation & move cell helper
  const moveActiveCell = (rowOffset, colOffset, expandSelection) => {
    setActiveCell((current) => {
      const nextRow = Math.max(0, Math.min(pasteRows.length - 1, (current?.row ?? 0) + rowOffset));
      const nextCol = Math.max(0, Math.min(columns.length - 1, (current?.col ?? 0) + colOffset));

      if (expandSelection) {
        selectCellRange(current?.row ?? 0, current?.col ?? 0, nextRow, nextCol);
      } else {
        setSelectedCells(new Set([`${nextRow}-${nextCol}`]));
        setSelectedRows(new Set());
      }

      // Scroll into view if needed
      const targetScrollTop = nextRow * rowHeight;
      const viewBottom = scrollTop + gridHeight - 40;
      if (targetScrollTop < scrollTop) {
        scrollRef.current.scrollTop = targetScrollTop;
      } else if (targetScrollTop > viewBottom) {
        scrollRef.current.scrollTop = targetScrollTop - gridHeight + 80;
      }

      return { row: nextRow, col: nextCol };
    });
  };

  // Clipboard operations using Browser Clipboard APIs
  const buildTSVFromSelection = () => {
    if (selectedRows.size > 0) {
      const lines = [];
      pasteRows.forEach((row) => {
        if (selectedRows.has(row._rowId)) {
          const rowVals = columns.map((col) => row[col.key] || '');
          lines.push(rowVals.join('\t'));
        }
      });
      return lines.join('\n');
    }

    if (selectedCells.size === 0) {
      const activeVal = pasteRows[activeCell.row]?.[columns[activeCell.col]?.key] || '';
      return activeVal;
    }

    // Find bounding box of selectedCells
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    selectedCells.forEach((key) => {
      const [r, c] = key.split('-').map(Number);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    });

    const lines = [];
    for (let r = minR; r <= maxR; r++) {
      const rowVals = [];
      for (let c = minC; c <= maxC; c++) {
        if (selectedCells.has(`${r}-${c}`)) {
          rowVals.push(pasteRows[r]?.[columns[c]?.key] || '');
        } else {
          rowVals.push('');
        }
      }
      lines.push(rowVals.join('\t'));
    }
    return lines.join('\n');
  };

  const copySelectedRowsOrCells = async () => {
    const text = buildTSVFromSelection();
    try {
      await navigator.clipboard.writeText(text);
      setClipboardData(text);
      showToast?.('success', 'Selected cells copied to clipboard.');
    } catch (err) {
      showToast?.('error', 'Failed to copy to clipboard.');
    }
  };

  const cutSelectedRowsOrCells = async () => {
    await copySelectedRowsOrCells();
    clearSelectedCellsOrRows();
  };

  const pasteTSVIntoGrid = (text, startRow, startCol) => {
    if (!text) return;
    recordHistory();
    const lines = text.split(/\r?\n/);
    setPasteRows((current) => {
      const next = [...current];
      lines.forEach((line, rowOffset) => {
        const targetR = startRow + rowOffset;
        if (targetR >= next.length) {
          next.push({
            _rowId: `paste-extra-${Date.now()}-${next.length}`,
            ...Object.fromEntries(columns.map((column) => [column.key, '']))
          });
        }
        const rowVals = line.split('\t');
        const updated = { ...next[targetR] };
        rowVals.forEach((val, colOffset) => {
          const targetC = startCol + colOffset;
          const col = columns[targetC];
          if (col) {
            updated[col.key] = val;
          }
        });
        next[targetR] = updated;
      });
      return next;
    });
    showToast?.('success', 'Pasted clipboard data successfully.');
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      pasteTSVIntoGrid(text, activeCell.row, activeCell.col);
    } catch (err) {
      // Fallback to state if permission is denied
      if (clipboardData) {
        pasteTSVIntoGrid(clipboardData, activeCell.row, activeCell.col);
      } else {
        showToast?.('error', 'Clipboard read permission required.');
      }
    }
  };

  const clearSelectedCellsOrRows = () => {
    if (selectedRows.size > 0) {
      recordHistory();
      setPasteRows((current) => {
        const remaining = current.filter((row) => !selectedRows.has(row._rowId));
        return remaining.length ? remaining : createEmptyPasteRows(6);
      });
      setSelectedRows(new Set());
      setSelectedCells(new Set());
      showToast?.('success', 'Deleted selected rows.');
    } else {
      recordHistory();
      setPasteRows((current) =>
        current.map((row, rIdx) => {
          let updated = { ...row };
          let modified = false;
          columns.forEach((col, cIdx) => {
            if (selectedCells.has(`${rIdx}-${cIdx}`)) {
              updated[col.key] = '';
              modified = true;
            }
          });
          return modified ? updated : row;
        })
      );
      showToast?.('success', 'Cleared cell selection values.');
    }
  };

  const createEmptyPasteRows = (count = 6) => {
    return Array.from({ length: count }).map((_, i) => ({
      _rowId: `paste-inserted-${Date.now()}-${i}`,
      ...Object.fromEntries(columns.map((col) => [col.key, '']))
    }));
  };

  // Mouse handlers for cell selection and drag
  const handleCellMouseDown = (e, r, c) => {
    if (e.button === 2) return; // Right Click context
    setEditingCell(null);
    setContextMenu(null);
    setIsDraggingFill(false);

    if (e.shiftKey && activeCell) {
      selectCellRange(activeCell.row, activeCell.col, r, c);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedCells((current) => {
        const next = new Set(current);
        const key = `${r}-${c}`;
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
      const rowId = pasteRows[r]?._rowId;
      if (rowId) {
        setSelectedRows((current) => {
          const next = new Set(current);
          if (next.has(rowId)) {
            next.delete(rowId);
          } else {
            next.add(rowId);
          }
          return next;
        });
      }
    } else {
      setActiveCell({ row: r, col: c });
      setSelectedCells(new Set([`${r}-${c}`]));
      setSelectedRows(new Set());
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

  const handleMouseUpGlobal = () => {
    setIsDraggingSelection(false);
    if (isDraggingFill && dragFillStart && dragFillEnd && activeCell) {
      handleCompleteDragFill();
    }
    setIsDraggingFill(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUpGlobal);
    return () => window.removeEventListener('mouseup', handleMouseUpGlobal);
  }, [isDraggingSelection, isDraggingFill, dragFillStart, dragFillEnd, activeCell]);

  const handleCompleteDragFill = () => {
    const targetVal = pasteRows[activeCell.row]?.[columns[activeCell.col]?.key] || '';
    const startRow = Math.min(dragFillStart.row, dragFillEnd.row);
    const endRow = Math.max(dragFillStart.row, dragFillEnd.row);
    const colKey = columns[activeCell.col]?.key;

    recordHistory();
    setPasteRows((current) =>
      current.map((row, idx) => {
        if (idx >= startRow && idx <= endRow) {
          return { ...row, [colKey]: targetVal };
        }
        return row;
      })
    );
    showToast?.('success', `Autofilled cells into range.`);
  };

  // Focusable main grid keydown shortcut handler
  const handleGridKeyDown = (e) => {
    if (editingCell) return; // Allow inline input cells to write
    const isCtrl = e.ctrlKey || e.metaKey;

    if (isCtrl && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAllRows();
      return;
    }

    if (isCtrl && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      copySelectedRowsOrCells();
      return;
    }

    if (isCtrl && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      pasteFromClipboard();
      return;
    }

    if (isCtrl && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      cutSelectedRowsOrCells();
      return;
    }

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

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      clearSelectedCellsOrRows();
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

    if (e.key === 'Enter') {
      e.preventDefault();
      moveActiveCell(e.shiftKey ? -1 : 1, 0, false);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      moveActiveCell(0, e.shiftKey ? -1 : 1, false);
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      setEditingCell({ row: activeCell.row, col: activeCell.col });
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedCells(new Set());
      setSelectedRows(new Set());
      return;
    }

    if (/^[a-zA-Z0-9\s]$/.test(e.key) && !e.altKey && !e.metaKey) {
      setEditingCell({ row: activeCell.row, col: activeCell.col });
    }
  };

  const handleEditingCellKeyDown = (e, r, c) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
      moveActiveCell(1, 0, false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
      moveActiveCell(0, 1, false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    }
  };

  // Row header click selections
  const handleRowNumberClick = (e, r) => {
    setEditingCell(null);
    const rowId = pasteRows[r]?._rowId;
    if (!rowId) return;

    if (e.shiftKey && activeCell) {
      setSelectedRows(new Set());
      setSelectedCells(new Set());
      selectRowRange(activeCell.row, r);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedRows((current) => {
        const next = new Set(current);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
      setSelectedCells((current) => {
        const next = new Set(current);
        for (let c = 0; c < columns.length; c++) {
          next.add(`${r}-${c}`);
        }
        return next;
      });
    } else {
      setActiveCell({ row: r, col: 0 });
      setSelectedRows(new Set([rowId]));
      const nextCells = new Set();
      for (let c = 0; c < columns.length; c++) {
        nextCells.add(`${r}-${c}`);
      }
      setSelectedCells(nextCells);
    }
  };

  // Context menus and Column divider resizing
  const handleColResizeStart = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol({
      key: colKey,
      startX: e.clientX,
      startWidth: columnWidths[colKey] || 120
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingCol) return;
      const diff = e.clientX - resizingCol.startX;
      setColumnWidths((prev) => ({
        ...prev,
        [resizingCol.key]: Math.max(70, resizingCol.startWidth + diff)
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

  const handleContextMenu = (e, r, c) => {
    e.preventDefault();
    setEditingCell(null);
    setActiveCell({ row: r, col: c });
    setSelectedCells(new Set([`${r}-${c}`]));

    const parentGrid = scrollRef.current.getBoundingClientRect();
    setContextMenu({
      x: e.clientX - parentGrid.left + scrollRef.current.scrollLeft,
      y: e.clientY - parentGrid.top + scrollRef.current.scrollTop,
      row: r,
      col: c
    });
  };

  const handleInsertRow = (idx) => {
    recordHistory();
    setPasteRows((current) => {
      const next = [...current];
      const emptyRow = {
        _rowId: `paste-insert-${Date.now()}-${next.length}`,
        ...Object.fromEntries(columns.map((col) => [col.key, '']))
      };
      next.splice(idx, 0, emptyRow);
      return next;
    });
    showToast?.('success', `Inserted new row.`);
  };

  const handleDeleteRow = (idx) => {
    if (pasteRows.length <= 1) return;
    recordHistory();
    setPasteRows((current) => current.filter((_, rIdx) => rIdx !== idx));
    showToast?.('success', `Deleted row.`);
  };

  const handleDuplicateRow = (idx) => {
    recordHistory();
    setPasteRows((current) => {
      const next = [...current];
      const copy = {
        ...JSON.parse(JSON.stringify(next[idx])),
        _rowId: `paste-dup-${Date.now()}-${next.length}`
      };
      next.splice(idx + 1, 0, copy);
      return next;
    });
    showToast?.('success', `Duplicated row.`);
  };

  // Dimensions
  const gridWidth = useMemo(() => {
    return columns.reduce((acc, col) => acc + (columnWidths[col.key] || 120), 0) + 90;
  }, [columns, columnWidths]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="excel-grid-container client-excel-grid"
      onKeyDown={handleGridKeyDown}
      onClick={() => containerRef.current?.focus()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-soft)',
        borderRadius: '12px',
        background: 'var(--panel)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        position: 'relative',
        outline: 'none'
      }}
    >
      {/* Scrollable sheet viewport */}
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
          background: 'var(--bg-main)'
        }}
      >
        <div style={{ height: `${totalRowsCount * rowHeight + 38}px`, width: `${gridWidth}px`, position: 'relative' }}>
          
          {/* Header Row */}
          <div
            className="excel-grid-head"
            style={{
              display: 'flex',
              height: '38px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--table-head-bg)',
              borderBottom: '2px solid var(--border-soft)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
            }}
          >
            <span style={{ width: '45px', minWidth: '45px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px', borderRight: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}>No.</span>
            
            <span style={{ width: '45px', minWidth: '45px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-soft)' }}>
              <input
                type="checkbox"
                checked={filteredSortedRows.length > 0 && filteredSortedRows.filter(hasVisibleClientData).every((row) => selectedRows.has(row._rowId))}
                onChange={() => {
                  const visible = filteredSortedRows.filter(hasVisibleClientData);
                  const allSelected = visible.length > 0 && visible.every((row) => selectedRows.has(row._rowId));
                  setSelectedRows(allSelected ? new Set() : new Set(visible.map((row) => row._rowId)));
                }}
              />
            </span>

            {columns.map((column) => {
              const width = columnWidths[column.key] || 120;
              const isFiltered = Boolean(columnFilters[column.key]);
              return (
                <div
                  key={column.key}
                  className="excel-header-cell"
                  style={{
                    width: `${width}px`,
                    minWidth: `${width}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 8px',
                    fontWeight: 700,
                    fontSize: '12px',
                    borderRight: '1px solid var(--border-soft)',
                    color: 'var(--text-primary)',
                    position: 'relative',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <span
                    onClick={() => {
                      const nextDir = sortConfig.key === column.key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
                      setSortConfig({ key: column.key, direction: nextDir });
                    }}
                    style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {column.label}
                    {sortConfig.key === column.key && (
                      <span style={{ marginLeft: '4px', fontSize: '10px' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </span>

                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFilterPopup(activeFilterPopup === column.key ? null : column.key);
                    }}
                    style={{ cursor: 'pointer', opacity: isFiltered ? 1 : 0.45, fontSize: '11px', color: isFiltered ? 'var(--accent)' : 'inherit', marginLeft: '4px' }}
                  >
                    🔍
                  </span>

                  <div
                    onMouseDown={(e) => handleColResizeStart(e, column.key)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '4px',
                      cursor: 'col-resize',
                      zIndex: 5,
                      background: resizingCol?.key === column.key ? 'var(--accent)' : 'transparent'
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Virtualized Rows */}
          <div style={{ position: 'absolute', top: `${startIndex * rowHeight + 38}px`, left: 0, right: 0 }}>
            {visibleRows.map((row, vIndex) => {
              const rowIndex = startIndex + vIndex;
              const isRowSelected = selectedRows.has(row._rowId);
              const isInvalid = pasteInvalidRowIndexes.has(rowIndex);
              const isDuplicate = pasteDuplicateRowIndexes.has(rowIndex);

              return (
                <div
                  key={row._rowId || rowIndex}
                  className="excel-grid-row"
                  style={{
                    display: 'flex',
                    height: `${rowHeight}px`,
                    background: isRowSelected ? 'rgba(37, 99, 235, 0.05)' : isInvalid ? 'rgba(239, 68, 68, 0.05)' : isDuplicate ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-table)',
                    borderBottom: '1px solid var(--border-soft)',
                    alignItems: 'center'
                  }}
                >
                  <span
                    onClick={(e) => handleRowNumberClick(e, rowIndex)}
                    style={{
                      width: '45px',
                      minWidth: '45px',
                      height: '100%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRight: '1px solid var(--border-soft)',
                      fontWeight: 650,
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      background: 'var(--table-head-bg)',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    {rowIndex + 1}
                  </span>

                  <span style={{ width: '45px', minWidth: '45px', height: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-soft)' }}>
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => {
                        setSelectedRows((current) => {
                          const next = new Set(current);
                          if (next.has(row._rowId)) {
                            next.delete(row._rowId);
                          } else {
                            next.add(row._rowId);
                          }
                          return next;
                        });
                      }}
                    />
                  </span>

                  {columns.map((column, colIndex) => {
                    const width = columnWidths[column.key] || 120;
                    const val = row[column.key] || '';
                    const isCellSelectedFlag = selectedCells.has(`${rowIndex}-${colIndex}`) || isRowSelected;
                    const isActive = activeCell?.row === rowIndex && activeCell?.col === colIndex;
                    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;

                    return (
                      <div
                        key={`${rowIndex}-${column.key}`}
                        onMouseDown={(e) => handleCellMouseDown(e, rowIndex, colIndex)}
                        onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                        onDoubleClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
                        onContextMenu={(e) => handleContextMenu(e, rowIndex, colIndex)}
                        style={{
                          width: `${width}px`,
                          minWidth: `${width}px`,
                          height: '100%',
                          padding: '0 8px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRight: '1px solid var(--border-soft)',
                          background: isEditing ? '#ffffff' : isCellSelectedFlag ? 'rgba(37, 99, 235, 0.08)' : isActive ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                          color: isInvalid && column.key === 'email' ? 'var(--danger)' : isDuplicate && column.key === 'email' ? 'var(--warning)' : 'var(--text-primary)',
                          outline: isActive && !isEditing ? '2px solid #2563eb' : 'none',
                          outlineOffset: '-2px',
                          zIndex: isActive ? 2 : 1,
                          fontSize: '13.5px',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => {
                              setPasteRows((current) =>
                                current.map((item, rIdx) =>
                                  rIdx === rowIndex ? { ...item, [column.key]: e.target.value } : item
                                )
                              );
                            }}
                            onKeyDown={(e) => handleEditingCellKeyDown(e, rowIndex, colIndex)}
                            onBlur={() => setEditingCell(null)}
                            autoFocus
                            style={{
                              width: '100%',
                              height: '100%',
                              border: 'none',
                              padding: 0,
                              background: 'transparent',
                              outline: 'none',
                              color: 'var(--text-main)',
                              fontSize: '13.5px'
                            }}
                          />
                        ) : (
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {val}
                          </span>
                        )}

                        {/* Excel Drag Fill Handle Corner Square */}
                        {isActive && !isEditing && (
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingFill(true);
                              setDragFillStart({ row: rowIndex, col: colIndex });
                              setDragFillEnd({ row: rowIndex, col: colIndex });
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

                        {/* Fill Range Indicator Highlight */}
                        {isDraggingFill && dragFillStart && dragFillEnd && rowIndex >= Math.min(dragFillStart.row, dragFillEnd.row) && rowIndex <= Math.max(dragFillStart.row, dragFillEnd.row) && colIndex === activeCell.col && (
                          <div style={{ position: 'absolute', inset: 0, border: '1px dashed #2563eb', background: 'rgba(37, 99, 235, 0.05)', pointerEvents: 'none' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right-Click custom Context Menu */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            style={{
              position: 'absolute',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              zIndex: 100,
              background: 'var(--modal-bg)',
              border: '1px solid var(--border-soft)',
              borderRadius: '8px',
              padding: '6px 0',
              minWidth: '150px',
              boxShadow: 'var(--shadow-floating)'
            }}
          >
            <button
              onClick={() => {
                setContextMenu(null);
                setEditingCell({ row: contextMenu.row, col: contextMenu.col });
              }}
              style={{ display: 'block', width: '100%', padding: '6px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}
            >
              📝 Edit Cell
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                handleInsertRow(contextMenu.row);
              }}
              style={{ display: 'block', width: '100%', padding: '6px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}
            >
              ➕ Insert Row Above
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                handleInsertRow(contextMenu.row + 1);
              }}
              style={{ display: 'block', width: '100%', padding: '6px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}
            >
              ➕ Insert Row Below
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                handleDuplicateRow(contextMenu.row);
              }}
              style={{ display: 'block', width: '100%', padding: '6px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}
            >
              📋 Duplicate Row
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                handleDeleteRow(contextMenu.row);
              }}
              style={{ display: 'block', width: '100%', padding: '6px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '13px' }}
            >
              ❌ Delete Row
            </button>
            <button
              onClick={() => {
                setContextMenu(null);
                clearSelectedCellsOrRows();
              }}
              style={{ display: 'block', width: '100%', padding: '6px 14px', textAlign: 'left', borderTop: '1px solid var(--border-soft)', background: 'none', borderBottom: 'none', borderLeft: 'none', borderRight: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
            >
              🧼 Clear Contents
            </button>
          </div>
        )}

        {/* Dynamic Column Filter Popups */}
        {activeFilterPopup && (
          <div
            ref={filterPopupRef}
            style={{
              position: 'absolute',
              top: '40px',
              left: `${scrollLeft + 80}px`,
              zIndex: 90,
              background: 'var(--modal-bg)',
              border: '1px solid var(--border-soft)',
              borderRadius: '8px',
              padding: '10px',
              minWidth: '200px',
              boxShadow: 'var(--shadow-floating)'
            }}
          >
            <strong style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-primary)' }}>Filter Column</strong>
            <input
              type="text"
              placeholder="Search..."
              value={columnFilters[activeFilterPopup] || ''}
              onChange={(e) => {
                setColumnFilters((prev) => ({ ...prev, [activeFilterPopup]: e.target.value }));
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid var(--border-soft)',
                borderRadius: '4px',
                background: 'var(--input-bg)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
              <button
                onClick={() => {
                  setColumnFilters((prev) => ({ ...prev, [activeFilterPopup]: '' }));
                  setActiveFilterPopup(null);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}
              >
                Clear
              </button>
              <button
                onClick={() => setActiveFilterPopup(null)}
                style={{ background: 'var(--accent)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Spreadsheet Status Bar Summary */}
      <div
        className="excel-grid-status-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          background: 'var(--table-head-bg)',
          borderTop: '1px solid var(--border-soft)',
          fontSize: '12.5px',
          color: 'var(--text-secondary)',
          fontWeight: 650
        }}
      >
        <div style={{ display: 'flex', gap: '14px' }}>
          <span>Total Rows: <strong>{totalRowsCount}</strong></span>
          <span>Selected Rows: <strong>{selectedRows.size}</strong></span>
          <span>Selected Cells: <strong>{selectedCells.size}</strong></span>
        </div>
        <div style={{ display: 'flex', gap: '14px' }}>
          <span style={{ color: pasteInvalidRowIndexes.size ? 'var(--danger)' : 'inherit' }}>
            Invalid: <strong>{pasteInvalidRowIndexes.size}</strong>
          </span>
          <span style={{ color: pasteDuplicateRowIndexes.size ? 'var(--warning)' : 'inherit' }}>
            Duplicates: <strong>{pasteDuplicateRowIndexes.size}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
