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

const plainTextToHtml = (text = '') => String(text || '')
  .replace(/\r\n/g, '\n')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .split(/\n{2,}/)
  .map((block) => `<p>${block.replace(/\n/g, '<br>') || '<br>'}</p>`)
  .join('');

const sanitizeEditorHtml = (html = '') => {
  if (typeof window === 'undefined') return html;
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script, iframe, object, embed').forEach((node) => node.remove());
  // Preserve all inline styles and TipTap classes.
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

  const textStyle = editor.getAttributes('textStyle');
  const selectedHeading = [1, 2, 3].find((level) => editor.isActive('heading', { level }));
  const currentBlock = selectedHeading ? `h${selectedHeading}` : 'paragraph';

  return (
    <div className="wysiwyg-wrap tiptap-editor-wrap">
      <div className="wysiwyg-toolbar row tiptap-toolbar">
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
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
        </select>

        <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 1 }).run())}>H1</ToolbarButton>
        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 2 }).run())}>H2</ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleHeading({ level: 3 }).run())}>H3</ToolbarButton>

        <select
          className="select wysiwyg-select"
          value={textStyle.fontFamily || ''}
          onMouseDown={saveSelection}
          onChange={(event) => runCommand((chain) => event.target.value ? chain.setFontFamily(event.target.value).run() : chain.unsetFontFamily().run())}
        >
          <option value="">Font</option>
          {FONT_FAMILIES.map((font) => <option key={font.label} value={font.value}>{font.label}</option>)}
        </select>

        <select
          className="select wysiwyg-select compact"
          value={textStyle.fontSize || ''}
          onMouseDown={saveSelection}
          onChange={(event) => runCommand((chain) => event.target.value ? chain.setFontSize(event.target.value).run() : chain.unsetFontSize().run())}
        >
          <option value="">Size</option>
          {FONT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>

        <ToolbarButton title="Undo" disabled={!editor.can().undo()} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.undo().run())}>Undo</ToolbarButton>
        <ToolbarButton title="Redo" disabled={!editor.can().redo()} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.redo().run())}>Redo</ToolbarButton>
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleBold().run())}>B</ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleItalic().run())}><i>I</i></ToolbarButton>
        <ToolbarButton title="Underline" active={editor.isActive('underline')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleUnderline().run())}><u>U</u></ToolbarButton>
        <ToolbarButton title="Strike" active={editor.isActive('strike')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleStrike().run())}>S</ToolbarButton>
        <ToolbarButton title="Superscript" active={editor.isActive('superscript')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.unsetSubscript().toggleSuperscript().run())}>x^2</ToolbarButton>
        <ToolbarButton title="Subscript" active={editor.isActive('subscript')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.unsetSuperscript().toggleSubscript().run())}>x_2</ToolbarButton>

        <ToolbarButton title="Left" active={editor.isActive({ textAlign: 'left' })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setTextAlign('left').run())}>Left</ToolbarButton>
        <ToolbarButton title="Center" active={editor.isActive({ textAlign: 'center' })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setTextAlign('center').run())}>Center</ToolbarButton>
        <ToolbarButton title="Right" active={editor.isActive({ textAlign: 'right' })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setTextAlign('right').run())}>Right</ToolbarButton>
        <ToolbarButton title="Justify" active={editor.isActive({ textAlign: 'justify' })} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setTextAlign('justify').run())}>Justify</ToolbarButton>

        <ToolbarButton title="Bullet List" active={editor.isActive('bulletList')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleBulletList().run())}>List</ToolbarButton>
        <ToolbarButton title="Number List" active={editor.isActive('orderedList')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleOrderedList().run())}>1. List</ToolbarButton>
        <ToolbarButton title="Checklist" active={editor.isActive('taskList')} onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.toggleTaskList().run())}>Check</ToolbarButton>

        <ToolbarButton title="Link" active={editor.isActive('link')} onSaveSelection={saveSelection} onClick={setLink}>Link</ToolbarButton>
        <ToolbarButton title="Image" onSaveSelection={saveSelection} onClick={addImage}>Image</ToolbarButton>
        <ToolbarButton title="Table" onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}>Table</ToolbarButton>
        <ToolbarButton title="Horizontal line" onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.setHorizontalRule().run())}>Line</ToolbarButton>

        <label className="wysiwyg-color-control" title="Text color">
          <span>A</span>
          <input type="color" value={textStyle.color || '#111827'} onMouseDown={saveSelection} onChange={(event) => runCommand((chain) => chain.setColor(event.target.value).run())} />
        </label>
        <label className="wysiwyg-color-control" title="Highlight color">
          <span>HL</span>
          <input type="color" value={textStyle.backgroundColor || '#fef3c7'} onMouseDown={saveSelection} onChange={(event) => runCommand((chain) => chain.setBackgroundColor(event.target.value).run())} />
        </label>
        {COLOR_SWATCHES.map((color) => (
          <button key={color} type="button" className="wysiwyg-swatch" style={{ background: color }} title={`Text ${color}`} onMouseDown={(event) => { event.preventDefault(); saveSelection(); }} onClick={() => runCommand((chain) => chain.setColor(color).run())} />
        ))}
        {HIGHLIGHT_SWATCHES.map((color) => (
          <button key={color} type="button" className="wysiwyg-swatch highlight" style={{ background: color }} title={`Highlight ${color}`} onMouseDown={(event) => { event.preventDefault(); saveSelection(); }} onClick={() => runCommand((chain) => color === 'transparent' ? chain.unsetBackgroundColor().run() : chain.setBackgroundColor(color).run())} />
        ))}

        <ToolbarButton title="Clear formatting" onSaveSelection={saveSelection} onClick={() => runCommand((chain) => chain.unsetAllMarks().clearNodes().setParagraph().run())}>Clear</ToolbarButton>
      </div>

      <EditorContent editor={editor} className="wysiwyg-editor tiptap-editor" />
    </div>
  );
}
