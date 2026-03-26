const escapeHtml = (value = '') =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export function buildWordPadTableHtml(columns = [], rows = []) {
  if (!columns.length) {
    return '<div style="font-family:Segoe UI, Arial, sans-serif;font-size:14px;line-height:1.6;">No data available.</div>';
  }

  const headerHtml = columns
    .map(
      (column) =>
        `<th style="border:1px solid #d7e0ea;padding:8px 10px;background:#f8fafc;text-align:left;">${escapeHtml(column)}</th>`
    )
    .join('');

  const rowsHtml = (rows || [])
    .map((row) => {
      const cells = columns
        .map(
          (column) =>
            `<td style="border:1px solid #d7e0ea;padding:8px 10px;vertical-align:top;">${escapeHtml(row?.[column] ?? '')}</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <div style="font-family:Segoe UI, Arial, sans-serif;font-size:14px;line-height:1.6;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
