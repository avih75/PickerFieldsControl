import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import { parseCsv } from "../utils/csvParser";
import { storeValueList, retrieveControlList, storeControlList, getRepoInfo } from "../services/StorageService";
import "./Action.scss";

const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [textName, setTextName] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { try { SDK.notifyLoadSucceeded(); } catch (_) {} setReady(true); }, 3000);
    SDK.init({ loaded: false }).then(() => { clearTimeout(t); try { SDK.notifyLoadSucceeded(); } catch (_) {} setReady(true); }).catch(() => { clearTimeout(t); setReady(true); });
    return () => clearTimeout(t);
  }, []);

  async function save(controlName: string, csvContent: string) {
    const { result, duplicates } = parseCsv(csvContent);
    await storeValueList(controlName, result);
    const list = await retrieveControlList();
    if (!list.some((c) => c.controlName === controlName)) {
      const scope = controlName.includes("_") ? controlName.split("_")[0] : "Collection";
      list.push({ controlName, projectName: scope, fileName: `${controlName}.csv` });
      await storeControlList(list);
    }
    setMessage(`${controlName} updated. ${duplicates.length} duplicate(s) skipped.`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const controlName = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = (ev) => {
      save(controlName, ev.target?.result as string).catch((err) => setMessage(String(err)));
    };
    reader.readAsText(file);
  }

  async function handleTextUpload() {
    if (!textName.trim() || !textContent.trim()) { setMessage("Name and content are required."); return; }
    await save(textName.trim(), textContent).catch((err) => setMessage(String(err)));
  }

  if (!ready) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif", fontSize: 13 }}>
      <h3 style={{ marginTop: 0 }}>Upload Picker CSV</h3>
      <div style={{ marginBottom: 16 }}>
        <input type="file" accept=".csv,.xls,.xlsx" onChange={handleFileChange} />
      </div>
      <hr />
      <h4>Paste CSV Content</h4>
      <input value={textName} onChange={(e) => setTextName(e.target.value)} placeholder="Control name" style={{ display: "block", marginBottom: 8, padding: "4px 8px", width: 280, border: "1px solid #8a8886", borderRadius: 2 }} />
      <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={6} style={{ display: "block", width: "100%", maxWidth: 500, padding: "4px 8px", border: "1px solid #8a8886", fontFamily: "monospace", fontSize: 12 }} placeholder=",L1,L2&#10;x,A,B" />
      <button onClick={handleTextUpload} style={{ marginTop: 8, padding: "6px 14px", background: "#0078d4", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer" }}>Upload</button>
      {message && <div style={{ marginTop: 12, padding: "8px 12px", background: "#dff6dd", border: "1px solid #107c10", borderRadius: 2 }}>{message}</div>}
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
