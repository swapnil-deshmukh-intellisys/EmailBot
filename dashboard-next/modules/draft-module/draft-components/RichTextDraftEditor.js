'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Selection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import { FontSize } from '@tiptap/extension-text-style/font-size';
import { BackgroundColor } from '@tiptap/extension-text-style/background-color';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Placeholder from '@tiptap/extension-placeholder';

const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Inter', value: 'Inter, Arial, sans-serif' },
  { label: 'Roboto', value: 'Roboto, Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Poppins', value: 'Poppins, Arial, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, Arial, sans-serif' }
];

const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];
const COLOR_SWATCHES = ['#111827', '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#f97316'];
const HIGHLIGHT_SWATCHES = ['transparent', '#fef3c7', '#dcfce7', '#dbeafe', '#fae8ff', '#fee2e2'];

const sanitizeEditorHtml = (html = '') => {
  if (typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove());
  return doc.body.innerHTML;
};

function ToolbarButton({ active = false, disabled = false, children, title, onClick, onSaveSelection }) {
  return (
    <button
      type="button"
      className={`button secondary wysiwyg-tool${active ? ' is-active' : ''}`}
      title={title}
      aria-pressed={active ? 'true' : 'false'}
      disabled={disabled}
      onMouseDown={(event) => {
        event.preventDefault();
        onSaveSelection?.();
      }}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 8px',
        minWidth: '30px',
        height: '30px',
        borderRadius: '6px',
        transition: 'all 0.15s ease'
      }}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, normalizeDefaultWeight = false }) {
  const lastEmittedValueRef = useRef('');
  const selectionJsonRef = useRef(null);
  const editorIdRef = useRef(`editor-${Math.random().toString(36).slice(2)}`);
  const [, setToolbarVersion] = useState(0);

  // Track initial content to support reverting changes
  const initialContentRef = useRef('');
  useEffect(() => {
    if (value && !initialContentRef.current) {
      initialContentRef.current = value;
    }
  }, [value]);

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: false
    }),
    TextStyle,
    Color,
    BackgroundColor,
    FontFamily,
    FontSize,
    Underline,
    Superscript,
    Subscript,
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }
    }),
    Image.configure({ inline: false, allowBase64: true }),
    TextAlign.configure({ types: ['heading', 'paragraph', 'listItem', 'taskItem'] }),
    Highlight.configure({ multicolor: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: placeholder || 'Compose your draft here...' })
  ], [placeholder]);

  const editor = useEditor({
    extensions,
    content: value || '',
    editorProps: {
      attributes: {
        class: 'wysiwyg-prosemirror',
        id: editorIdRef.current,
        spellcheck: 'true'
      },
      transformPastedHTML: (html) => sanitizeEditorHtml(html)
    },
    immediatelyRender: false,
    onUpdate: ({ editor: activeEditor }) => {
      const next = sanitizeEditorHtml(activeEditor.getHTML());
      lastEmittedValueRef.current = next;
      onChange(next);
    }
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming !== lastEmittedValueRef.current && incoming !== editor.getHTML()) {
      editor.commands.setContent(incoming, false);
    }
  }, [editor, normalizeDefaultWeight, value]);

  useEffect(() => {
    if (!editor) return undefined;
    const refreshToolbar = () => setToolbarVersion((version) => version + 1);
    editor.on('selectionUpdate', refreshToolbar);
    editor.on('transaction', refreshToolbar);
    editor.on('focus', refreshToolbar);
    editor.on('blur', refreshToolbar);
    return () => {
      editor.off('selectionUpdate', refreshToolbar);
      editor.off('transaction', refreshToolbar);
      editor.off('focus', refreshToolbar);
      editor.off('blur', refreshToolbar);
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className="wysiwyg-wrap">
        <div className="wysiwyg-editor is-loading">Loading editor...</div>
      </div>
    );
  }

  const saveSelection = () => {
    selectionJsonRef.current = editor.state.selection.toJSON();
  };

  const restoreSelection = () => {
    if (!selectionJsonRef.current) return;
    try {
      const selection = Selection.fromJSON(editor.state.doc, selectionJsonRef.current);
      editor.view.dispatch(editor.state.tr.setSelection(selection));
    } catch (error) {
      selectionJsonRef.current = null;
    }
  };

  const runCommand = (callback) => {
    restoreSelection();
    const result = callback(editor.chain().focus());
    setToolbarVersion((version) => version + 1);
    return result;
  };

  const setLink = () => {
    restoreSelection();
    const previousUrl = editor.getAttributes('link').href || '';
    const rawUrl = window.prompt('Enter link URL', previousUrl);
    if (rawUrl === null) return;
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      runCommand((chain) => chain.extendMarkRange('link').unsetLink().run());
      return;
    }
    const url = /^(https?:|mailto:|tel:)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      new URL(url);
    } catch (error) {
      window.alert('Please enter a valid URL.');
      return;
    }
    runCommand((chain) => chain.extendMarkRange('link').setLink({ href: url }).run());
  };

  const addImage = () => {
    restoreSelection();
    const rawUrl = window.prompt('Enter image URL');
    if (!rawUrl?.trim()) return;
    try {
      new URL(rawUrl.trim());
    } catch (error) {
      window.alert('Please enter a valid image URL.');
      return;
    }
    runCommand((chain) => chain.setImage({ src: rawUrl.trim(), alt: 'Draft image' }).run());
  };

  const handleRevertChanges = () => {
    if (window.confirm('Are you sure you want to revert all changes back to the original template?')) {
      editor.commands.setContent(initialContentRef.current || '');
      showToastNotification?.('Content reverted to original draft.');
    }
  };

  const textStyle = editor.getAttributes('textStyle') || {};
  const selectedHeading = [1, 2, 3].find((level) => editor.isActive('heading', { level }));
  const currentBlock = selectedHeading ? `h${selectedHeading}` : 'paragraph';

  // Inline SVG Helper components to keep things clean and high-fidelity
  const Icons = {
    Undo: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>,
    Redo: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>,
    Bold: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>,
    Italic: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>,
    Underline: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 12 0V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>,
    Strike: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6A5 5 0 0 0 8 9v1.5M16 13.5v1.5a5 5 0 0 1-8 4"/></svg>,
    Superscript: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5M4 12h8M12 19V5M16 6a1.5 1.5 0 0 1 3 0c0 .7-.8 1.4-1.5 2H19"/></svg>,
    Subscript: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5M4 12h8M12 19V5M16 14a1.5 1.5 0 0 1 3 0c0 .7-.8 1.4-1.5 2H19"/></svg>,
    Left: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>,
    Center: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>,
    Right: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>,
    Justify: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>,
    List: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    NumList: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4M4 10h2M4 14h2.5c.7 0 1.2.6 1.2 1.2 0 .5-.3.8-.7.9l-1 .3 1 .3c.4.1.7.4.7.9 0 .7-.5 1.2-1.2 1.2H4"/></svg>,
    Check: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><path d="m9 12 2 2 4-4"/></svg>,
    Link: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    Image: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15 16 10 5 21"/></svg>,
    Table: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>,
    Line: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>,
    Clear: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l4.3 4.3c1 1 1 2.5 0 3.4L10.8 21z"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>,
    Revert: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
  };

  const getSwatchStyle = (color, isActive, isTransparent) => {
    const base = {
      width: '24px',
      height: '24px',
      minWidth: '24px',
      border: isActive ? '2px solid #2563eb' : '1px solid rgba(15, 23, 42, 0.14)',
      borderRadius: isTransparent ? '7px' : '999px',
      cursor: 'pointer',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      transition: 'transform 0.15s ease, border-color 0.15s ease'
    };
    if (isTransparent) {
      base.background = '#ffffff';
    } else {
      base.background = color;
    }
    return base;
  };

  return (
    <div className="wysiwyg-wrap tiptap-editor-wrap">
      <div className="wysiwyg-toolbar row tiptap-toolbar">
        
        {/* Paragraph & Headings Select dropdown */}
        <select
          className="select wysiwyg-select"
          value={currentBlock}
          onMouseDown={saveSelection}
          onChange={(event) => {
            const next = event.target.value;
            if (next === 'paragraph') runCommand((chain) => chain.setParagraph().run());
            if (next === 'h1') runCommand((chain) => chain.setHeading({ level: 1 }).run());
            if (next === 'h2') runCommand((chain) => chain.setHeading({ level: 2 }).run());
            if (next === 'h3') runCommand((chain) => chain.setHeading({ level: 3 }).run());
          }}
        >
          <option value="paragraph">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        {/* Headings Buttons */}
        <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 1 }).run())}>
          <span style={{ fontWeight: 'bold', fontSize: '12px' }}>H₁</span>
        </ToolbarButton>
        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 2 }).run())}>
          <span style={{ fontWeight: 'bold', fontSize: '12px' }}>H₂</span>
        </ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 3 }).run())}>
          <span style={{ fontWeight: 'bold', fontSize: '12px' }}>H₃</span>
        </ToolbarButton>

        {/* Font Select */}
        <select
          className="select wysiwyg-select"
          value={textStyle.fontFamily || ''}
          onMouseDown={saveSelection}
          onChange={(event) => runCommand((chain) => event.target.value ? chain.setFontFamily(event.target.value).run() : chain.unsetFontFamily().run())}
        >
          <option value="">Font</option>
          {FONT_FAMILIES.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
        </select>

        {/* Font Size Select */}
        <select
          className="select wysiwyg-select compact"
          value={textStyle.fontSize || ''}
          onMouseDown={saveSelection}
          onChange={(event) => runCommand((chain) => event.target.value ? chain.setFontSize(event.target.value).run() : chain.unsetFontSize().run())}
        >
          <option value="">Size</option>
          {FONT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>

        {/* Undo/Redo */}
        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.undo().run())}>
          <Icons.Undo />
        </ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.redo().run())}>
          <Icons.Redo />
        </ToolbarButton>

        {/* Formatting Actions */}
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleBold().run())}>
          <Icons.Bold />
        </ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleItalic().run())}>
          <Icons.Italic />
        </ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive('underline')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleUnderline().run())}>
          <Icons.Underline />
        </ToolbarButton>
        <ToolbarButton title="Strike" active={editor.isActive('strike')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleStrike().run())}>
          <Icons.Strike />
        </ToolbarButton>
        <ToolbarButton title="Superscript" active={editor.isActive('superscript')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.unsetSubscript().toggleSuperscript().run())}>
          <Icons.Superscript />
        </ToolbarButton>
        <ToolbarButton title="Subscript" active={editor.isActive('subscript')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.unsetSuperscript().toggleSubscript().run())}>
          <Icons.Subscript />
        </ToolbarButton>

        {/* Alignment */}
        <ToolbarButton title="Left" active={editor.isActive({ textAlign: 'left' })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setTextAlign('left').run())}>
          <Icons.Left />
        </ToolbarButton>
        <ToolbarButton title="Center" active={editor.isActive({ textAlign: 'center' })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setTextAlign('center').run())}>
          <Icons.Center />
        </ToolbarButton>
        <ToolbarButton title="Right" active={editor.isActive({ textAlign: 'right' })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setTextAlign('right').run())}>
          <Icons.Right />
        </ToolbarButton>
        <ToolbarButton title="Justify" active={editor.isActive({ textAlign: 'justify' })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setTextAlign('justify').run())}>
          <Icons.Justify />
        </ToolbarButton>

        {/* Lists */}
        <ToolbarButton title="Bullet List" active={editor.isActive('bulletList')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleBulletList().run())}>
          <Icons.List />
        </ToolbarButton>
        <ToolbarButton title="Number List" active={editor.isActive('orderedList')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleOrderedList().run())}>
          <Icons.NumList />
        </ToolbarButton>
        <ToolbarButton title="Checklist" active={editor.isActive('taskList')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleTaskList().run())}>
          <Icons.Check />
        </ToolbarButton>

        {/* Media & Objects */}
        <ToolbarButton title="Link" active={editor.isActive('link')} onSaveSelection={saveSelection} onClick={setLink}>
          <Icons.Link />
        </ToolbarButton>
        <ToolbarButton title="Image" onSaveSelection={saveSelection} onClick={addImage}>
          <Icons.Image />
        </ToolbarButton>
        <ToolbarButton title="Table" onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>
          <Icons.Table />
        </ToolbarButton>
        <ToolbarButton title="Horizontal line" onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setHorizontalRule().run())}>
          <Icons.Line />
        </ToolbarButton>

        {/* Dynamic Color A Button with Underline */}
        <label className="wysiwyg-color-control" title="Text color" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', height: '30px', padding: '4px 8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>A</span>
            <div style={{ width: '13px', height: '3px', background: textStyle.color || '#111827', marginTop: '1px', borderRadius: '1px' }} />
          </div>
          <input type="color" value={textStyle.color || '#111827'} onMouseDown={saveSelection} onChange={(event) => runCommand((chain) => chain.setColor(event.target.value).run())} style={{ width: 0, height: 0, opacity: 0, padding: 0, border: 0 }} />
        </label>

        {/* Dynamic Color HL Button with Highlighter and Underline */}
        <label className="wysiwyg-color-control" title="Highlight color" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', height: '30px', padding: '4px 8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '-0.5px' }}>HL</span>
            <div style={{ width: '13px', height: '3px', background: textStyle.backgroundColor || '#fef3c7', marginTop: '1px', borderRadius: '1px' }} />
          </div>
          <input type="color" value={textStyle.backgroundColor || '#fef3c7'} onMouseDown={saveSelection} onChange={(event) => runCommand((chain) => chain.setBackgroundColor(event.target.value).run())} style={{ width: 0, height: 0, opacity: 0, padding: 0, border: 0 }} />
        </label>

        {/* Color swatches with active checkmarks */}
        {COLOR_SWATCHES.map((color) => {
          const isActive = textStyle.color === color;
          return (
            <button
              key={color}
              type="button"
              className={`wysiwyg-swatch${isActive ? ' is-active' : ''}`}
              style={getSwatchStyle(color, isActive, false)}
              title={`Text ${color}`}
              onMouseDown={(event) => { event.preventDefault(); saveSelection(); }}
              onClick={() => runCommand((chain) => chain.setColor(color).run())}
            >
              {isActive && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}

        {/* Highlight swatches with active checkmarks and checkerboard/slash transparent option */}
        {HIGHLIGHT_SWATCHES.map((color) => {
          const isTransparent = color === 'transparent';
          const isActive = isTransparent ? !textStyle.backgroundColor : textStyle.backgroundColor === color;
          return (
            <button
              key={color}
              type="button"
              className={`wysiwyg-swatch highlight${isActive ? ' is-active' : ''}${isTransparent ? ' is-transparent' : ''}`}
              style={getSwatchStyle(color, isActive, isTransparent)}
              title={isTransparent ? 'No Highlight' : `Highlight ${color}`}
              onMouseDown={(event) => { event.preventDefault(); saveSelection(); }}
              onClick={() => runCommand((chain) => isTransparent ? chain.unsetBackgroundColor().run() : chain.setBackgroundColor(color).run())}
            >
              {isTransparent && (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                  <line x1="22" y1="2" x2="2" y2="22" />
                </svg>
              )}
              {isActive && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isTransparent || color === '#fef3c7' ? '#111827' : 'white'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          );
        })}

        {/* Clear Formatting button */}
        <ToolbarButton title="Clear formatting" onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.unsetAllMarks().clearNodes().setParagraph().run())}>
          <Icons.Clear />
        </ToolbarButton>

        {/* Revert Changes button */}
        <ToolbarButton title="Revert to original draft" onSaveSelection={saveSelection} onClick={handleRevertChanges}>
          <Icons.Revert />
        </ToolbarButton>

      </div>

      <EditorContent editor={editor} className="wysiwyg-editor tiptap-editor" />
    </div>
  );
}
