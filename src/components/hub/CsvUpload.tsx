import React, { useState } from "react";
import { parseCsv } from "../../utils/csvParser";
import { storeValueList, retrieveControlList, storeControlList } from "../../services/StorageService";
import { LevelHeaderEditor } from "./LevelHeaderEditor";

interface Props {
  onEdit: (controlName: string, headers: string[], csvContent: string) => void;
}

function getHeaders(csvContent: string): string[] {
  const header = csvContent.split(/\r?\n/, 1)[0] ?? "";
  return header.split(",").slice(1).map(value => value.trim()).filter(Boolean);
}

export const CsvUpload: React.FC<Props> = ({ onEdit }) => {
  const [message, setMessage] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [textName, setTextName] = useState("");
  const [headers, setHeaders] = useState<string[]>(["Level 1", "Level 2"]);

  async function save(controlName: string, csvContent: string) {
    const { result, duplicates } = parseCsv(csvContent);
    const parsedHeaders = getHeaders(csvContent);
    await storeValueList(controlName, result);

    const list = await retrieveControlList();
    if (!list.some((c) => c.controlName === controlName)) {
      const scope = controlName.includes("_") ? controlName.split("_")[0] : "Collection";
      list.push({ controlName, projectName: scope, fileName: `${controlName}.csv`, headers: parsedHeaders });
      await storeControlList(list);
      setMessage(`"${controlName}" created. ${duplicates.length} duplicate(s) skipped.`);
    } else {
      const index = list.findIndex((control) => control.controlName === controlName);
      list[index] = { ...list[index], headers: parsedHeaders };
      await storeControlList(list);
      setMessage(`"${controlName}" updated. ${duplicates.length} duplicate(s) skipped.`);
    }
    onEdit(controlName, parsedHeaders, csvContent);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const controlName = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      save(controlName, content).catch((err) => setMessage(String(err)));
    };
    reader.readAsText(file);
  }

  async function handleTextUpload() {
    if (!textName.trim()) { setMessage("Please enter a control name."); return; }
    if (!textContent.trim()) { setMessage("Please paste CSV content."); return; }
    await save(textName.trim(), textContent).catch((err) => setMessage(String(err)));
  }

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif" }}>
      <h3 style={{ marginTop: 0 }}>Upload CSV File</h3>
      <p style={{ fontSize: 13, color: "#605e5c" }}>
        CSV format: first column ignored, then one column per level.
      </p>

      <LevelHeaderEditor headers={headers} onChange={setHeaders} />

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: "block", marginBottom: 6 }}>Select file</label>
        <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileChange} />
      </div>

      <hr />
      <h3>Paste CSV Content</h3>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>Control name</label>
        <input
          value={textName}
          onChange={(e) => setTextName(e.target.value)}
          placeholder="e.g. MyControl"
          style={{ padding: "4px 8px", border: "1px solid #8a8886", borderRadius: 2, width: 300 }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, display: "block", marginBottom: 4 }}>CSV content</label>
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          rows={8}
          style={{ width: "100%", maxWidth: 600, padding: "4px 8px", border: "1px solid #8a8886", borderRadius: 2, fontFamily: "monospace", fontSize: 12 }}
          placeholder=",Level1,Level2,Level3&#10;x,A,B,C"
        />
      </div>
      <button
        onClick={handleTextUpload}
        style={{ padding: "6px 16px", background: "#0078d4", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 13 }}
      >
        Upload
      </button>

      {message && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#dff6dd", border: "1px solid #107c10", borderRadius: 2, fontSize: 13 }}>
          {message}
        </div>
      )}
    </div>
  );
};
