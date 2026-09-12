function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exporte des lignes en CSV (compatible Excel, y compris les accents grâce au
 * BOM UTF-8) et déclenche le téléchargement dans le navigateur.
 */
export function exportToCsv(filename: string, columns: string[], rows: unknown[][]) {
  const lines = [columns, ...rows].map((row) => row.map(escapeCsvValue).join(";"));
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
