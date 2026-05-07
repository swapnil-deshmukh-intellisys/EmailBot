import { useEffect, useRef } from 'react';

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const changeTimerRef = useRef(null);
  const selectionRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (changeTimerRef.current) {
        clearTimeout(changeTimerRef.current);
      }
    };
  }, []);

  const updateValue = (immediate = false) => {
    const next = editorRef.current?.innerHTML || '';
    if (immediate) {
      if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
      onChange(next);
      return;
    }
    if (changeTimerRef.current) clearTimeout(changeTimerRef.current);
    changeTimerRef.current = setTimeout(() => onChange(next), 220);
  };

  const saveSelection = () => {
    if (!editorRef.current || typeof window === 'undefined') return;
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!selectionRef.current || typeof window === 'undefined') return;
    const selection = window.getSelection?.();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  };

  const selectNodeContents = (node) => {
    if (!node || typeof window === 'undefined') return;
    const selection = window.getSelection?.();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
    selectionRef.current = range.cloneRange();
  };

  const applyInlineFormat = (command, val = null) => {
    restoreSelection();
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      document.execCommand(command, false, val);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    const wrapperMap = {
      bold: 'span',
      italic: 'span',
      underline: 'span',
      fontName: 'span',
      fontSize: 'span'
    };
    const wrapper = document.createElement(wrapperMap[command] || 'span');

    if (command === 'bold') {
      wrapper.style.fontWeight = '700';
    }
    if (command === 'italic') {
      wrapper.style.fontStyle = 'italic';
    }
    if (command === 'underline') {
      wrapper.style.textDecoration = 'underline';
    }
    if (command === 'fontName') {
      wrapper.style.fontFamily = val;
    }
    if (command === 'fontSize') {
      const sizeMap = {
        2: '13px',
        3: '15px',
        4: '17px',
        5: '20px',
        6: '24px'
      };
      wrapper.style.fontSize = sizeMap[val] || `${val}px`;
    }

    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    selectNodeContents(wrapper);
  };

  const runCommand = (command, val = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (['bold', 'italic', 'underline', 'fontName', 'fontSize'].includes(command)) {
      applyInlineFormat(command, val);
    } else {
      restoreSelection();
      document.execCommand(command, false, val);
    }
    saveSelection();
    updateValue(true);
  };

  const handleToolbarCommand = (event, command, val = null) => {
    event.preventDefault();
    runCommand(command, val);
  };

  const onPaste = (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      e.preventDefault();
      runCommand('insertHTML', html);
      return;
    }

    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      e.preventDefault();
      const normalized = String(text).replace(/\r\n/g, '\n');
      const escaped = normalized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const wrapped = `<div style="white-space:pre-wrap;font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">${escaped}</div>`;
      runCommand('insertHTML', wrapped);
    }
  };

  return (
    <div className="wysiwyg-wrap">
      <div className="wysiwyg-toolbar row">
        <select className="select wysiwyg-select" defaultValue="" onMouseDown={saveSelection} onChange={(e) => runCommand('fontName', e.target.value)}>
          <option value="" disabled>Font</option>
          <option value="Arial">Arial</option>
          <option value="'Times New Roman'">Times New Roman</option>
          <option value="Calibri">Calibri</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>
        <select className="select wysiwyg-select" defaultValue="" onMouseDown={saveSelection} onChange={(e) => runCommand('fontSize', e.target.value)}>
          <option value="" disabled>Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Medium</option>
          <option value="5">Large</option>
          <option value="6">XL</option>
        </select>
        <button type="button" className="button secondary" onMouseDown={(event) => handleToolbarCommand(event, 'bold')}>B</button>
        <button type="button" className="button secondary" onMouseDown={(event) => handleToolbarCommand(event, 'italic')}><i>I</i></button>
        <button type="button" className="button secondary" onMouseDown={(event) => handleToolbarCommand(event, 'underline')}><u>U</u></button>
        <button type="button" className="button secondary" onMouseDown={(event) => handleToolbarCommand(event, 'insertUnorderedList')}>List</button>
        <button type="button" className="button secondary" onMouseDown={(event) => handleToolbarCommand(event, 'justifyLeft')}>Left</button>
        <button type="button" className="button secondary" onMouseDown={(event) => handleToolbarCommand(event, 'justifyCenter')}>Center</button>
        <button type="button" className="button secondary" onMouseDown={(event) => handleToolbarCommand(event, 'justifyRight')}>Right</button>
        <button type="button" className="button secondary" onMouseDown={(event) => handleToolbarCommand(event, 'removeFormat')}>Clear Format</button>
      </div>
      <div
        ref={editorRef}
        className="wysiwyg-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || 'Compose your draft here...'}
        onInput={() => updateValue(false)}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={() => {
          saveSelection();
          updateValue(true);
        }}
        onPaste={onPaste}
      />
    </div>
  );
}
