/*
 * Client-side CSV export. Every report table offers one; amounts go out in rupees
 * (not paise) so the file opens cleanly in a spreadsheet.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | undefined | null;
}

function escape(cell: string | number | undefined | null) {
  const s = cell == null ? "" : String(cell);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const lines = [columns.map((c) => escape(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escape(c.value(row))).join(","));
  return lines.join("\r\n");
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  // BOM so Excel reads the file as UTF-8 (customer names, the ₹-free memo text).
  const blob = new Blob(["﻿" + toCsv(rows, columns)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Paise -> rupees with two decimals, for CSV cells. */
export function rupees(paise: number | undefined | null) {
  return paise == null ? "" : (paise / 100).toFixed(2);
}

/** YYYY-MM-DD in IST, for CSV date cells (sorts correctly in spreadsheets). */
export function csvDate(iso: string | undefined) {
  return iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";
}
