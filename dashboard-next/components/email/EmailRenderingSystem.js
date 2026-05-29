export const EMAIL_RENDERER_ATTR = 'data-email-renderer="unified"';

export const EMAIL_TYPOGRAPHY_STYLE = [
  'font-family:Inter, Arial, Helvetica, sans-serif',
  'font-size:15px',
  'font-weight:400',
  'line-height:1.7',
  'color:#111827'
].join(';');

export function buildEmailHtml(html = '') {
  const content = String(html || '').trim();
  if (!content) return '';
  if (content.includes(EMAIL_RENDERER_ATTR)) return content;
  return `<div ${EMAIL_RENDERER_ATTR} style="${EMAIL_TYPOGRAPHY_STYLE}">${content}</div>`;
}
