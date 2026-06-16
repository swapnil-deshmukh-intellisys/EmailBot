'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const BLOCK_TYPES = [
  { label: 'Paragraph', value: 'P' },
  { label: 'Heading 1', value: 'H1' },
  { label: 'Heading 2', value: 'H2' },
  { label: 'Heading 3', value: 'H3' },
  { label: 'Blockquote', value: 'BLOCKQUOTE' }
];

const FONT_FAMILIES = [
  'Arial',
  'Inter',
  'Roboto',
  'Times New Roman',
  'Poppins',
  'Montserrat'
];

const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

function ToolbarButton({ children, title, onCommand, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      className={`imp-draft-editor-tool ${className}`.trim()}
      title={title}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
        if (!disabled) onCommand?.();
      }}
    >
      {children}
    </button>
  );
}

export default function DraftEditor({
  value = '',
  onChange,
  placeholder = 'Write your email draft...',
  className = ''
}) {
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const seededRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const emitChange = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML;
    setIsEmpty(!String(editor.textContent || '').trim());
    onChange?.(html);
  }, [onChange]);

  const saveSelection = useCallback(() => {
    if (typeof window === 'undefined') return;
    const editor = editorRef.current;
    const selection = window.getSelection?.();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection?.();
    if (!editor || !selection) return;

    editor.focus({ preventScroll: true });
    selection.removeAllRanges();

    if (savedRangeRef.current && editor.contains(savedRangeRef.current.commonAncestorContainer)) {
      selection.addRange(savedRangeRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
  }, []);

  const runCommand = useCallback((command, valueArg = null) => {
    restoreSelection();
    document.execCommand(command, false, valueArg);
    saveSelection();
    emitChange();
  }, [emitChange, restoreSelection, saveSelection]);

  const applyFontSize = useCallback((size) => {
    restoreSelection();
    document.execCommand('fontSize', false, '7');
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((node) => {
      node.removeAttribute('size');
      node.style.fontSize = size;
    });
    saveSelection();
    emitChange();
  }, [emitChange, restoreSelection, saveSelection]);

  const clearFormatting = useCallback(() => {
    restoreSelection();
    document.execCommand('removeFormat', false, null);
    document.execCommand('unlink', false, null);
    saveSelection();
    emitChange();
  }, [emitChange, restoreSelection, saveSelection]);

  const createLink = useCallback(() => {
    restoreSelection();
    const url = window.prompt('Enter link URL');
    if (!url) return;
    const safeUrl = /^(https?:|mailto:|tel:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    document.execCommand('createLink', false, safeUrl);
    saveSelection();
    emitChange();
  }, [emitChange, restoreSelection, saveSelection]);

  const handleKeyDown = useCallback((event) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (!modifier) return;

    const key = event.key.toLowerCase();
    if (key === 'b') {
      event.preventDefault();
      runCommand('bold');
    } else if (key === 'i') {
      event.preventDefault();
      runCommand('italic');
    } else if (key === 'u') {
      event.preventDefault();
      runCommand('underline');
    } else if (key === 'z' && event.shiftKey) {
      event.preventDefault();
      runCommand('redo');
    } else if (key === 'z') {
      event.preventDefault();
      runCommand('undo');
    } else if (key === 'y') {
      event.preventDefault();
      runCommand('redo');
    }
  }, [runCommand]);

  useEffect(() => {
    if (seededRef.current || !editorRef.current) return;
    editorRef.current.innerHTML = value || '';
    setIsEmpty(!String(editorRef.current.textContent || '').trim());
    seededRef.current = true;
  }, [value]);

  return (
    <div className={`imp-draft-editor ${className}`.trim()}>
      <style jsx>{`
        .imp-draft-editor {
          overflow: hidden;
          border: 1px solid #cbd5e1;
          border-radius: 14px;
          background: #ffffff;
          color: #0f172a;
          font-family: 'DM Sans', Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
        }

        .imp-draft-editor-toolbar {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex-wrap: wrap;
          padding: 10px;
          border-bottom: 0.5px solid #cbd5e1;
          background: linear-gradient(180deg, #f8fafc, #f1f5f9);
        }

        .imp-draft-editor-group {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          min-height: 38px;
          padding: 4px;
          border: 1px solid rgba(203, 213, 225, 0.78);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .imp-draft-editor-group.is-fluid {
          flex: 1 1 250px;
          min-width: 240px;
        }

        .imp-draft-editor-group-label {
          padding: 0 5px;
          color: #64748b;
          font: 700 9px/1 'DM Sans', Inter, system-ui, sans-serif;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .imp-draft-editor-select,
        .imp-draft-editor-color,
        .imp-draft-editor-tool {
          height: 30px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #ffffff;
          color: #0f172a;
          font: 500 12px 'DM Sans', Inter, system-ui, sans-serif;
          box-shadow: none;
        }

        .imp-draft-editor-select {
          min-width: 92px;
          padding: 0 24px 0 9px;
        }

        .imp-draft-editor-tool {
          min-width: 30px;
          padding: 0 9px;
          cursor: pointer;
        }

        .imp-draft-editor-tool:hover,
        .imp-draft-editor-select:hover,
        .imp-draft-editor-color:hover {
          border-color: #6366f1;
          background: #eef2ff;
        }

        .imp-draft-editor-tool:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .imp-draft-editor-color {
          width: 30px;
          min-width: 30px;
          padding: 5px;
          cursor: pointer;
        }

        .imp-draft-editor-tool.is-primary {
          min-width: 34px;
          color: #3730a3;
          background: #eef2ff;
          border-color: rgba(99, 102, 241, 0.28);
          font-weight: 800;
        }

        .imp-draft-editor-tool.is-danger-soft {
          color: #b45309;
          background: #fffbeb;
          border-color: #fde68a;
        }

        .imp-draft-editor-body-wrap {
          position: relative;
          background: #ffffff;
        }

        .imp-draft-editor-placeholder {
          position: absolute;
          top: 20px;
          left: 24px;
          color: #94a3b8;
          font-size: 14px;
          pointer-events: none;
        }

        .imp-draft-editor-body {
          min-height: 380px;
          padding: 20px 24px;
          outline: none;
          color: #0f172a;
          font: 400 14px/1.7 'DM Sans', Inter, system-ui, sans-serif;
          overflow-wrap: anywhere;
        }

        .imp-draft-editor-body :global(h1) {
          margin: 0 0 14px;
          font-size: 28px;
          line-height: 1.25;
        }

        .imp-draft-editor-body :global(h2) {
          margin: 0 0 12px;
          font-size: 22px;
          line-height: 1.3;
        }

        .imp-draft-editor-body :global(h3) {
          margin: 0 0 10px;
          font-size: 18px;
          line-height: 1.35;
        }

        .imp-draft-editor-body :global(blockquote) {
          margin: 10px 0;
          padding: 10px 14px;
          border-left: 3px solid #6366f1;
          background: #f8fafc;
          color: #334155;
        }
      `}</style>

      <div className="imp-draft-editor-toolbar" aria-label="Draft editor toolbar">
        <div className="imp-draft-editor-group is-fluid">
          <span className="imp-draft-editor-group-label">Format</span>
          <select
            className="imp-draft-editor-select"
            defaultValue="P"
            onMouseDown={saveSelection}
            onChange={(event) => runCommand('formatBlock', event.target.value)}
            aria-label="Block type"
          >
            {BLOCK_TYPES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>

          <select
            className="imp-draft-editor-select"
            defaultValue=""
            onMouseDown={saveSelection}
            onChange={(event) => event.target.value && runCommand('fontName', event.target.value)}
            aria-label="Font family"
          >
            <option value="">Font</option>
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>

          <select
            className="imp-draft-editor-select"
            defaultValue=""
            onMouseDown={saveSelection}
            onChange={(event) => event.target.value && applyFontSize(event.target.value)}
            aria-label="Font size"
          >
            <option value="">Size</option>
            {FONT_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div className="imp-draft-editor-group">
          <span className="imp-draft-editor-group-label">Style</span>
          <ToolbarButton title="Bold" onCommand={() => runCommand('bold')}>B</ToolbarButton>
          <ToolbarButton title="Italic" onCommand={() => runCommand('italic')}><i>I</i></ToolbarButton>
          <ToolbarButton title="Underline" onCommand={() => runCommand('underline')}><u>U</u></ToolbarButton>
          <ToolbarButton title="Strikethrough" onCommand={() => runCommand('strikeThrough')}><s>S</s></ToolbarButton>
        </div>

        <div className="imp-draft-editor-group">
          <span className="imp-draft-editor-group-label">Color</span>
          <input
            className="imp-draft-editor-color"
            type="color"
            defaultValue="#0f172a"
            title="Text color"
            onMouseDown={saveSelection}
            onInput={(event) => runCommand('foreColor', event.currentTarget.value)}
            aria-label="Text color"
          />
          <input
            className="imp-draft-editor-color"
            type="color"
            defaultValue="#fff3a3"
            title="Highlight color"
            onMouseDown={saveSelection}
            onInput={(event) => runCommand('hiliteColor', event.currentTarget.value)}
            aria-label="Highlight color"
          />
        </div>

        <div className="imp-draft-editor-group">
          <span className="imp-draft-editor-group-label">Layout</span>
          <ToolbarButton title="Align left" onCommand={() => runCommand('justifyLeft')}>L</ToolbarButton>
          <ToolbarButton title="Align center" onCommand={() => runCommand('justifyCenter')}>C</ToolbarButton>
          <ToolbarButton title="Align right" onCommand={() => runCommand('justifyRight')}>R</ToolbarButton>
          <ToolbarButton title="Bullet list" onCommand={() => runCommand('insertUnorderedList')}>UL</ToolbarButton>
          <ToolbarButton title="Numbered list" onCommand={() => runCommand('insertOrderedList')}>OL</ToolbarButton>
          <ToolbarButton title="Indent" onCommand={() => runCommand('indent')}>In</ToolbarButton>
          <ToolbarButton title="Outdent" onCommand={() => runCommand('outdent')}>Out</ToolbarButton>
          <ToolbarButton title="Insert link" onCommand={createLink}>Link</ToolbarButton>
        </div>

        <div className="imp-draft-editor-group">
          <span className="imp-draft-editor-group-label">Edit</span>
          <ToolbarButton title="Undo" onCommand={() => runCommand('undo')}>Undo</ToolbarButton>
          <ToolbarButton title="Redo" onCommand={() => runCommand('redo')}>Redo</ToolbarButton>
          <ToolbarButton title="Clear formatting" onCommand={clearFormatting} className="is-danger-soft">Clear</ToolbarButton>
        </div>
      </div>

      <div className="imp-draft-editor-body-wrap">
        {isEmpty ? <div className="imp-draft-editor-placeholder">{placeholder}</div> : null}
        <div
          ref={editorRef}
          className="imp-draft-editor-body"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          spellCheck="true"
          onInput={emitChange}
          onKeyDown={handleKeyDown}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onFocus={saveSelection}
          onBlur={saveSelection}
        />
      </div>
    </div>
  );
}
