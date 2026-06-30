import * as XLSX from 'xlsx';

/** A single exportable record: ordered column header -> cell value. */
export type ExportRow = Record<string, string | number | null | undefined>;

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export rows to an .xlsx file. `headers` fixes the column order; when omitted,
 * the keys of the first row are used.
 */
export function exportToExcel(rows: ExportRow[], filename: string, headers?: string[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows, headers ? { header: headers } : undefined);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  // bookType 'xlsx' produces an array buffer we wrap in a Blob for download.
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Escape a single CSV field per RFC 4180 (quote when it contains , " or newline). */
function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Export rows to a .csv file. `headers` fixes the column order; when omitted,
 * the keys of the first row are used. A UTF-8 BOM is prepended so Excel opens
 * non-ASCII (e.g. Chinese) text with the correct encoding.
 */
export function exportToCsv(rows: ExportRow[], filename: string, headers?: string[]) {
  const cols = headers ?? (rows.length ? Object.keys(rows[0]) : []);
  const lines = [
    cols.map(csvEscape).join(','),
    ...rows.map((row) => cols.map((col) => csvEscape(row[col])).join(',')),
  ];
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}
