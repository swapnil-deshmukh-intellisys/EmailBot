export const EMAIL_RENDERER_ATTR = 'data-email-renderer="unified"';

export const EMAIL_TYPOGRAPHY_STYLE = [
  'font-family:Inter, Arial, Helvetica, sans-serif',
  'font-size:15px',
  'font-weight:400',
  'line-height:1.7',
  'color:#111827'
].join(';');

export function escapeEmailHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function plainTextToEmailHtml(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeEmailHtml(paragraph).replace(/\r?\n/g, '<br/>')}</p>`)
    .join('');
}

export function sanitizeEmailHtml(html = '') {
  return String(html || '')
    .replace(/<\s*(script|iframe|object|embed|meta|link|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|meta|link|style)\b[^>]*\/?\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, ' $1="#"');
}

export function htmlToPlainText(html = '') {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildEmailHtml(html = '') {
  const raw = String(html || '').trim();
  if (!raw) return '';
  const content = sanitizeEmailHtml(/<[a-z][\s\S]*>/i.test(raw) ? raw : plainTextToEmailHtml(raw)).trim();
  if (!content) return '';
  if (content.includes(EMAIL_RENDERER_ATTR)) return content;
  return `<div ${EMAIL_RENDERER_ATTR} style="${EMAIL_TYPOGRAPHY_STYLE}">${content}</div>`;
}

export function buildEmailParts({ html = '', text = '' } = {}) {
  const bodyHtml = buildEmailHtml(html);
  const bodyText = String(text || '').trim() || htmlToPlainText(bodyHtml);
  return { html: bodyHtml, bodyHtml, body: bodyHtml, text: bodyText, bodyText };
}
