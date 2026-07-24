const fs = require('fs');
const path = require('path');
const XLSX = require('../dashboard-next/node_modules/xlsx');

const projectRoot = path.resolve(__dirname, '..');
const inputDir = path.join(__dirname, 'google-sheets');
const outputPath = path.join(projectRoot, 'GOOGLE_SHEETS_PROJECT_TRACKER.xlsx');

const sheetOrder = [
  'Projects_Master',
  'Daily_Updates',
  'Daily_Task_Planner',
  'Weekly_Roadmap',
  'Sprint_Tracker',
  'Feature_Tracker',
  'Frontend_Tracker',
  'Backend_Tracker',
  'Database_Tracker',
  'API_Tracker',
  'Bug_Tracker',
  'Testing_Tracker',
  'Deployment_Tracker',
  'Risks_And_Blockers',
  'Team_Productivity'
];

function estimateColumnWidth(rows, key) {
  const longest = rows.reduce(
    (max, row) => Math.max(max, String(row[key] ?? '').length),
    key.length
  );
  return Math.min(45, Math.max(12, longest + 2));
}

function isDateColumn(key) {
  return key === 'Date' || key.endsWith(' Date') || key === 'Target Date';
}

function normalizeCellValue(key, value) {
  if (value === '') return '';
  if (key.includes('%') || key.includes('Hours') || ['Completed', 'Pending', 'Bugs'].includes(key)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

const workbook = XLSX.utils.book_new();
workbook.Props = {
  Title: 'IntelliMailPilot Project Management Tracker',
  Subject: 'Roadmap, sprint, feature, engineering, QA, deployment, and risk tracking',
  Author: 'IntelliMailPilot Project Team',
  CreatedDate: new Date('2026-06-23T00:00:00+05:30')
};

for (const sheetName of sheetOrder) {
  const csvPath = path.join(inputDir, `${sheetName}.csv`);
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Missing source CSV: ${csvPath}`);
  }

  const csv = fs.readFileSync(csvPath, 'utf8');
  const sourceWorkbook = XLSX.read(csv, { type: 'string', raw: true });
  const sourceSheet = sourceWorkbook.Sheets[sourceWorkbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sourceSheet, { defval: '', raw: true });
  const headers = rows.length
    ? Object.keys(rows[0])
    : XLSX.utils.sheet_to_json(sourceSheet, { header: 1, defval: '', raw: true })[0] || [];

  const normalizedRows = rows.map((row) =>
    Object.fromEntries(headers.map((header) => [header, normalizeCellValue(header, row[header])]))
  );

  const worksheet = XLSX.utils.json_to_sheet(normalizedRows, {
    header: headers,
    skipHeader: false
  });


  for (let colIndex = 0; colIndex < headers.length; colIndex += 1) {
    const header = headers[colIndex];
    if (!isDateColumn(header)) continue;
    for (let rowIndex = 1; rowIndex <= normalizedRows.length; rowIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = worksheet[address];
      if (cell && cell.v instanceof Date) {
        cell.t = 'd';
        cell.z = 'yyyy-mm-dd';
        cell.w = cell.v.toISOString().slice(0, 10);
      }
    }
  }
  worksheet['!cols'] = headers.map((header) => ({
    wch: estimateColumnWidth(normalizedRows, header)
  }));

  if (worksheet['!ref']) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    worksheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: range.e.r, c: range.e.c }
      })
    };
  }

  worksheet['!rows'] = [{ hpt: 24 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

XLSX.writeFile(workbook, outputPath, {
  bookType: 'xlsx',
  compression: true
});

console.log(outputPath);



