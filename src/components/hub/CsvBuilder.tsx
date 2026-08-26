import React, { useEffect, useState } from "react";
import { FieldsValuesList, FieldValues } from "../../types";
import { storeValueList, retrieveControlList, storeControlList } from "../../services/StorageService";
import { toCsv } from "../../utils/csvParser";
import { LevelHeaderEditor } from "./LevelHeaderEditor";

interface GridRow {
  values: string[];
}

interface Props {
  initialControl?: { controlName: string; headers: string[]; csvContent: string };
}

function rowsFromCsv(csvContent: string): GridRow[] {
  return csvContent
    .split(/\r?\n/)
    .slice(1)
    .filter(line => line.trim())
    .map(line => ({ values: line.split(",").slice(1).map(value => value.trim()) }));
}

function buildFieldsValuesList(headers: string[], rows: GridRow[]): FieldsValuesList {
  const levelCount = headers.length;
  const levelLists: Array<Array<FieldValues>> = Array.from({ length: levelCount }, () => []);

  for (const row of rows) {
    for (let L = 0; L < levelCount; L++) {
      const depend = row.values.slice(0, L).join("");
      const value = (row.values[L] ?? "").trim();
      if (!value) continue;
      const exists = levelLists[L].some((e) => e.Depend === depend && e.Value === value);
      if (!exists) levelLists[L].push({ Depend: depend, Value: value });
    }
  }

  return { FieldsLists: levelLists };
}

export const CsvBuilder: React.FC<Props> = ({ initialControl }) => {
  const [controlName, setControlName] = useState("");
  const [headers, setHeaders] = useState<string[]>(["Level 1", "Level 2"]);
  const [rows, setRows] = useState<GridRow[]>([{ values: Array(2).fill("") }]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initialControl) return;
    const nextHeaders = initialControl.headers.length ? initialControl.headers : ["Level 1", "Level 2"];
    const nextRows = rowsFromCsv(initialControl.csvContent);
    setControlName(initialControl.controlName);
    setHeaders(nextHeaders);
    setRows(nextRows.length ? nextRows : [{ values: Array(nextHeaders.length).fill("") }]);
    setMessage("Editing uploaded CSV. Save changes when ready.");
  }, [initialControl]);

  const addRow = () => setRows((prev) => [...prev, { values: Array(headers.length).fill("") }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const updateCell = (rowIdx: number, colIdx: number, val: string) => {
    setRows((prev) => {
      const next = prev.map((r) => ({ values: [...r.values] }));
      next[rowIdx].values[colIdx] = val;
      return next;
    });
  };

  // Sync row cell count when level count changes
  const handleHeadersChange = (newHeaders: string[]) => {
    setHeaders(newHeaders);
    setRows((prev) =>
      prev.map((r) => {
        const vals = [...r.values];
        while (vals.length < newHeaders.length) vals.push("");
        return { values: vals.slice(0, newHeaders.length) };
      })
    );
  };

  async function handleSave() {
    if (!controlName.trim()) { setMessage("Please enter a control name."); return; }
    const data = buildFieldsValuesList(headers, rows);
    await storeValueList(controlName.trim(), data);
    const list = await retrieveControlList();
    if (!list.some((c) => c.controlName === controlName.trim())) {
      const scope = controlName.includes("_") ? controlName.split("_")[0] : "Collection";
      list.push({ controlName: controlName.trim(), projectName: scope, fileName: `${controlName.trim()}.csv`, headers });
      await storeControlList(list);
      setMessage(`"${controlName}" created successfully.`);
    } else {
      const index = list.findIndex((control) => control.controlName === controlName.trim());
      list[index] = { ...list[index], headers };
      await storeControlList(list);
      setMessage(`"${controlName}" updated successfully.`);
    }
  }

  function handleExport() {
    if (!controlName.trim()) { setMessage("Please enter a control name before exporting."); return; }
    const data = buildFieldsValuesList(headers, rows);
    const csv = toCsv(data, headers);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${controlName.trim()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif" }}>
      <h3 style={{ marginTop: 0 }}>Build CSV Interactively</h3>
      <p style={{ fontSize: 13, color: "#605e5c" }}>
        Define level headers and add rows directly — no CSV file needed.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, display: "block", marginBottom: 4, fontWeight: 600 }}>Control name</label>
        <input
          value={controlName}
          onChange={(e) => setControlName(e.target.value)}
          placeholder="e.g. MyControl"
          style={{ padding: "4px 8px", border: "1px solid #8a8886", borderRadius: 2, width: 300 }}
        />
      </div>

      <LevelHeaderEditor headers={headers} onChange={handleHeadersChange} />

      <div style={{ overflowX: "auto", marginBottom: 12 }}>
        <table style={{ borderCollapse: "collapse", minWidth: 400 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ border: "1px solid #edebe9", padding: "6px 10px", background: "#f3f2f1", fontSize: 12, textAlign: "left", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
              <th style={{ border: "1px solid #edebe9", padding: "6px 10px", background: "#f3f2f1", width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {headers.map((_, ci) => (
                  <td key={ci} style={{ border: "1px solid #edebe9", padding: 4 }}>
                    <input
                      value={row.values[ci] ?? ""}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      style={{ width: "100%", padding: "3px 6px", border: "1px solid #c8c6c4", borderRadius: 2, fontSize: 13, boxSizing: "border-box" }}
                    />
                  </td>
                ))}
                <td style={{ border: "1px solid #edebe9", padding: 4, textAlign: "center" }}>
                  <button
                    onClick={() => removeRow(ri)}
                    title="Remove row"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#a4262c", fontWeight: 700, fontSize: 14 }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} style={{ marginBottom: 16, padding: "4px 12px", cursor: "pointer", fontSize: 13 }}>
        + Add Row
      </button>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSave}
          style={{ padding: "6px 16px", background: "#0078d4", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 13 }}
        >
          Save to Extension Data
        </button>
        <button
          onClick={handleExport}
          style={{ padding: "6px 16px", background: "#fff", color: "#0078d4", border: "1px solid #0078d4", borderRadius: 2, cursor: "pointer", fontSize: 13 }}
        >
          Export CSV
        </button>
      </div>

      {message && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#dff6dd", border: "1px solid #107c10", borderRadius: 2, fontSize: 13 }}>
          {message}
        </div>
      )}
    </div>
  );
};
