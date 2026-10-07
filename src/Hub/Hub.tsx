import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import { ControlList } from "../components/hub/ControlList";
import { CsvUpload } from "../components/hub/CsvUpload";
import { CsvBuilder } from "../components/hub/CsvBuilder";
import { Watermark } from "../components/Watermark";
import "./Hub.scss";

type Tab = "configurations" | "upload" | "builder" | "instructions";

function detectDarkTheme(): boolean {
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return true;
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--palette-neutral-0").trim();
  const match = bg.match(/\d+/g);
  if (!match) return false;
  const [r, g, b] = match.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.4;
}

const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("configurations");
  const [editingControl, setEditingControl] = useState<{ controlName: string; headers: string[]; csvContent: string } | undefined>();

  const openBuilder = (controlName: string, headers: string[], csvContent: string) => {
    setEditingControl({ controlName, headers, csvContent });
    setTab("builder");
  };

  useEffect(() => {
    const timeout = setTimeout(() => { try { SDK.notifyLoadSucceeded(); } catch (_) {} setReady(true); }, 3000);
    SDK.init({ loaded: false, applyTheme: true })
      .then(() => {
        clearTimeout(timeout);
        if (detectDarkTheme()) document.documentElement.setAttribute("data-theme", "dark");
        try { SDK.notifyLoadSucceeded(); } catch (_) {}
        setReady(true);
      })
      .catch(() => { clearTimeout(timeout); try { SDK.notifyLoadSucceeded(); } catch (_) {} setReady(true); });
    return () => clearTimeout(timeout);
  }, []);

  if (!ready) return <div style={{ padding: 24, fontFamily: "Segoe UI, sans-serif" }}>Loading…</div>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "configurations", label: "Configurations" },
    { id: "upload", label: "Upload CSV" },
    { id: "builder", label: "Build CSV" },
    { id: "instructions", label: "Instructions" },
  ];

  return (
    <div className="hub-container">
      <nav className="hub-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`hub-tab${tab === t.id ? " hub-tab--active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="hub-content">
        {tab === "configurations" && <ControlList onEdit={openBuilder} />}
        {tab === "upload" && <CsvUpload onEdit={openBuilder} />}
        {tab === "builder" && <CsvBuilder initialControl={editingControl} />}
        {tab === "instructions" && <Instructions />}
      </div>
      <Watermark />
    </div>
  );
};

const Instructions: React.FC = () => (
  <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif", maxWidth: 700, fontSize: 13, lineHeight: 1.6 }}>
    <h3 style={{ marginTop: 0 }}>How to use Multi Pickers Fields Control</h3>
    <p>This page lives in <strong>Project Settings</strong>, but configurations are stored at <strong>collection level</strong>: every project sees and can use every configuration.</p>
    <h4>1. Add data</h4>
    <p>Go to the <strong>Upload CSV</strong> tab to upload one or more CSV files (the file name becomes the control name) or paste CSV text, or use the <strong>Build CSV</strong> tab to enter values in a grid.</p>
    <p>CSV format: the first row is the header. In every data row the first column must be <strong>non-empty</strong> (e.g. <code>x</code>) and is otherwise ignored; then one column per cascading level. Values must not contain commas, and trailing spaces count as part of the value.</p>
    <pre style={{ background: "#f3f2f1", padding: 10, borderRadius: 4, fontSize: 12 }}>
{`,Country,State,City
x,USA,California,San Francisco
x,USA,California,Los Angeles
x,USA,New York,New York City
x,Israel,Center,Tel Aviv`}
    </pre>
    <p>To make a list specific to one project, name the control <code>ProjectName_ControlName</code>; the form control uses it in that project instead of the shared <code>ControlName</code> list.</p>
    <h4>2. Add the control to a work item type</h4>
    <p>In the process customization, add the <strong>Multi Pickers Fields with dependencies</strong> control to a work item form.</p>
    <p>Set the <strong>Control Name</strong> input to the same name you used when uploading data.</p>
    <h4>3. Configure fields</h4>
    <p>For each level set <strong>Field Name N</strong> (the label) and <strong>Field N</strong> (the work item field that stores the value). Levels are read in order from 1 and stop at the first level with both left empty, up to 8 levels. The number of levels should match the number of CSV columns.</p>
    <p><strong>Hide Field N</strong> hides that level on the form. <strong>Field N Required</strong> marks it with <code>*</code> and a red border while empty. It does not block saving, so make the field required in the process for that.</p>
    <p>Optionally set <strong>Summarize to Path field</strong> to write a backslash-separated path (<code>A\B\C</code>) into another field.</p>
    <h4>4. Optional settings</h4>
    <ul>
      <li><strong>View Option</strong>: number of dropdowns per row (1–4)</li>
      <li><strong>Private Behaviour</strong>: set to <code>Auto</code> to auto-select when only one option exists</li>
    </ul>
    <h4>5. Export / import between collections</h4>
    <p>In <strong>Configurations</strong>, click <strong>Export CSV</strong> on a control (or <strong>Export All CSV</strong>). Each file is named <code>ControlName.csv</code>.</p>
    <p>In the target collection, open <strong>Upload CSV</strong> and select one or more exported files. The file name becomes the control name.</p>
  </div>
);

ReactDOM.render(<App />, document.getElementById("root"));
