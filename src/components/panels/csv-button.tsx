"use client";

import { Download } from "lucide-react";
import { downloadCsv, type CsvColumn } from "@/lib/csv";
import { Button } from "../ui";

/** "Export CSV" button for a report table. Amounts in the file are rupees. */
export function CsvButton<T>({ filename, rows, columns, label = "CSV" }: { filename: string; rows: T[]; columns: CsvColumn<T>[]; label?: string }) {
  return (
    <Button size="sm" onClick={() => downloadCsv(filename, rows, columns)} disabled={rows.length === 0} aria-label={`Export ${filename} as CSV`}>
      <Download className="size-3.5" /> {label}
    </Button>
  );
}
