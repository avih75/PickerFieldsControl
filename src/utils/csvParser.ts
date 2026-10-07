import { FieldValues, FieldsValuesList } from "../types";

function cleanCell(cell: string): string {
  let clean = "";
  for (let i = 0; i < cell.length; i++) {
    if (cell.charCodeAt(i) !== 13) clean += cell[i];
  }
  return clean.trim();
}

/**
 * Parse CSV content into a FieldsValuesList with N levels (N = number of data columns).
 *
 * Expected CSV format:
 *   Row 0: header (ignored)
 *   Row 1+: [ignored_col], [level1_val], [level2_val], ..., [levelN_val]
 *
 * Works for any number of levels — no hardcoded limit.
 * Deduplicates entries: only adds a combination that hasn't been seen before.
 */
export function parseCsv(csvContent: string): { result: FieldsValuesList; duplicates: string[] } {
  const rows = csvContent.split("\n");
  const duplicates: string[] = [];

  // Determine level count from first non-header row
  let levelCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].split(",").map(cleanCell);
    if (cells[0] !== "") {
      levelCount = cells.length - 1; // column 0 is ignored; columns 1..N are levels
      break;
    }
  }

  if (levelCount === 0) {
    return { result: { FieldsLists: [] }, duplicates };
  }

  // One array per level
  const levelLists: Array<Array<FieldValues>> = Array.from({ length: levelCount }, () => []);

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].split(",").map(cleanCell);
    if (cells[0] === "") continue;

    const values = cells.slice(1, 1 + levelCount);

    // For each level L (0-indexed):
    //   Depend = concatenation of values[0..L-1]
    //   Value  = values[L]
    // Only add to level L if the (Depend, Value) pair doesn't already exist.
    // Once we find the first new level, add all subsequent levels unconditionally.
    let firstNewLevel = levelCount; // assume all already exist
    for (let L = 0; L < levelCount; L++) {
      const depend = values.slice(0, L).join("");
      const value = values[L];
      if (!value) break;
      const exists = levelLists[L].some(
        (e) => e.Depend === depend && e.Value === value
      );
      if (!exists) {
        firstNewLevel = L;
        break;
      }
    }

    if (firstNewLevel === levelCount) {
      // Entire combination is a duplicate
      duplicates.push(values.join(" "));
      continue;
    }

    // Add entries for levels firstNewLevel..levelCount-1
    for (let L = firstNewLevel; L < levelCount; L++) {
      const depend = values.slice(0, L).join("");
      const value = values[L];
      if (!value) break;
      levelLists[L].push({ Depend: depend, Value: value });
    }
  }

  return { result: { FieldsLists: levelLists }, duplicates };
}

/** Convert a FieldsValuesList back to CSV string (for export). */
export function toCsv(lists: FieldsValuesList, headers: string[]): string {
  const levelCount = lists.FieldsLists.length;
  const headerRow = ["", ...headers].join(",");

  // Reconstruct rows by walking level 0 entries and building full paths
  const rows: string[] = [headerRow];

  function buildRows(level: number, prefix: string[], dependKey: string): void {
    if (level >= levelCount) return;
    const entries = lists.FieldsLists[level].filter((e) => e.Depend === dependKey);
    for (const entry of entries) {
      const newPrefix = [...prefix, entry.Value];
      if (level === levelCount - 1) {
        rows.push(["x", ...newPrefix].join(","));
      } else {
        buildRows(level + 1, newPrefix, dependKey + entry.Value);
      }
    }
  }

  buildRows(0, [], "");
  return rows.join("\n");
}

/** Trigger a browser download of CSV content. */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
