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

export default function EmailRenderer({ html = '', className = '', empty = null }) {
  const content = String(html || '').trim();

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
