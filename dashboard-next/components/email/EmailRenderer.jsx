'use client';

import { EMAIL_TYPOGRAPHY_STYLE } from './EmailRenderingSystem';

const styleFromString = (style = '') => Object.fromEntries(
  style.split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [property, ...valueParts] = part.split(':');
      const camelProperty = property.trim().replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return [camelProperty, valueParts.join(':').trim()];
    })
);

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEmailHtml(value = '') {
  const content = String(value || '').trim();
  if (!content) return '';
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  if (looksLikeHtml) return content;
  return escapeHtml(content)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export default function EmailRenderer({ html = '', className = '', empty = null }) {
  const content = normalizeEmailHtml(html);

  if (!content) {
    return empty;
  }

  return (
    <div
      className={`email-renderer${className ? ` ${className}` : ''}`}
      style={styleFromString(EMAIL_TYPOGRAPHY_STYLE)}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
