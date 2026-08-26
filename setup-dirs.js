'use strict';
const fs = require('fs');
const path = require('path');

const root = __dirname;

// Skip if already set up
if (fs.existsSync(path.join(root, 'src', 'types', 'index.ts'))) {
  console.log('[setup-dirs] Project already set up, skipping.');
  process.exit(0);
}

function ensureDir(d) {
  fs.mkdirSync(path.join(root, d), { recursive: true });
}

function write(relPath, content) {
  const full = path.join(root, relPath);
  if (fs.existsSync(full)) return;
  fs.writeFileSync(full, content, 'utf8');
  console.log('[setup-dirs] created:', relPath);
}

// ─── Create directories ───────────────────────────────────────────────────────
const dirs = [
  'src', 'src/types', 'src/services', 'src/utils',
  'src/Control', 'src/Hub', 'src/Action',
  'src/components', 'src/components/control', 'src/components/hub',
  'src/__mocks__', 'src/__tests__', 'static', 'img',
];
dirs.forEach(ensureDir);

// ─── src/types/index.ts ───────────────────────────────────────────────────────
write('src/types/index.ts', `export interface FieldValues {
  Depend: string;
  Value: string;
}

export interface FieldsValuesList {
  FieldsLists: Array<Array<FieldValues>>;
}

export interface ControlsNames {
  controlName: string;
  projectName: string;
  fileName: string;
}

export interface RepoInfo {
  repoProject: string;
  repoName: string;
}

/** Dynamic config — replaces the hardcoded field1/field2/field3/field4 variables */
export interface ControlConfig {
  controlName: string;
  fieldNames: string[];
  fieldRefs: string[];
  fieldHides: boolean[];
  summarizeToPathRef?: string;
  repo?: string;
  viewOption?: string;
  autoBehavior?: string;
}

/** One column definition for the CSV builder */
export interface CsvColumnDef {
  header: string;
}
`);

// ─── src/services/StorageService.ts ──────────────────────────────────────────
write('src/services/StorageService.ts', `import * as SDK from "azure-devops-extension-sdk";
import { FieldsValuesList, ControlsNames, RepoInfo } from "../types";

async function getDataService(): Promise<any> {
  return SDK.getService<any>("ms.vss-features.extension-data-service");
}

export async function getValue<T>(key: string): Promise<T | undefined> {
  const svc = await getDataService();
  return svc.getValue<T>(key);
}

export async function setValue<T>(key: string, value: T): Promise<void> {
  const svc = await getDataService();
  await svc.setValue(key, value);
}

export async function deleteValue(key: string): Promise<void> {
  const svc = await getDataService();
  await svc.setValue(key, undefined);
  try { await svc.deleteValue(key); } catch (_) {}
}

/** Load the FieldsValuesList for a control.
 *  Project-scoped key (projectName_controlName) takes precedence over collection-scoped (controlName). */
export async function retrieveValueList(
  controlName: string,
  projectName: string
): Promise<FieldsValuesList | undefined> {
  const svc = await getDataService();
  const collectionResult: FieldsValuesList = await svc.getValue(controlName);
  const projectResult: FieldsValuesList = await svc.getValue(\`\${projectName}_\${controlName}\`);
  return projectResult ?? collectionResult;
}

export async function storeValueList(
  controlName: string,
  value: FieldsValuesList
): Promise<void> {
  const svc = await getDataService();
  await svc.setValue(controlName, value);
}

export async function retrieveControlList(): Promise<ControlsNames[]> {
  const svc = await getDataService();
  let result: ControlsNames[] = [];
  try {
    result = await svc.getValue("pickerControl");
  } catch (_) {}
  return result ?? [];
}

export async function storeControlList(list: ControlsNames[]): Promise<void> {
  const svc = await getDataService();
  await svc.setValue("pickerControl", list);
}

export async function getRepoInfo(key = "RepoInfo"): Promise<RepoInfo | undefined> {
  const svc = await getDataService();
  return svc.getValue<RepoInfo>(key);
}

export async function setRepoInfo(info: RepoInfo, key = "RepoInfo"): Promise<void> {
  const svc = await getDataService();
  await svc.setValue(key, info);
}
`);

// ─── src/services/WorkItemService.ts ─────────────────────────────────────────
write('src/services/WorkItemService.ts', `import * as SDK from "azure-devops-extension-sdk";
import { IWorkItemFormService } from "azure-devops-extension-api/WorkItemTracking";

const WIT_FORM_SERVICE = "ms.vss-work-web.work-item-form";

export async function getWorkItemService(): Promise<IWorkItemFormService> {
  return SDK.getService<IWorkItemFormService>(WIT_FORM_SERVICE);
}

export async function getFieldValues(fieldRefs: string[]): Promise<Record<string, string>> {
  const svc = await getWorkItemService();
  const values = await svc.getFieldValues(fieldRefs);
  const result: Record<string, string> = {};
  for (const ref of fieldRefs) {
    result[ref] = values[ref] != null ? String(values[ref]) : "";
  }
  return result;
}

export async function setFieldValue(fieldRef: string, value: string): Promise<void> {
  if (!fieldRef) return;
  const svc = await getWorkItemService();
  await svc.setFieldValue(fieldRef, value);
}

export async function setFieldValues(fields: Record<string, string>): Promise<void> {
  const svc = await getWorkItemService();
  await Promise.all(
    Object.entries(fields)
      .filter(([ref]) => !!ref)
      .map(([ref, val]) => svc.setFieldValue(ref, val))
  );
}
`);

// ─── src/utils/csvParser.ts ───────────────────────────────────────────────────
write('src/utils/csvParser.ts', `import { FieldValues, FieldsValuesList } from "../types";

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
  const rows = csvContent.split("\\n");
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
  return rows.join("\\n");
}
`);

// ─── src/utils/gitHelper.ts ───────────────────────────────────────────────────
write('src/utils/gitHelper.ts', `import { RepoInfo } from "../types";

/** Push CSV content to a Git repository via Azure DevOps REST API.
 *  Uses the native fetch API available in modern browsers. */
export async function pushToGit(
  csvContent: string,
  controlName: string,
  info: RepoInfo,
  baseUrl: string,
  token: string
): Promise<void> {
  const { repoProject, repoName } = info;
  const base = \`\${baseUrl}/\${encodeURIComponent(repoProject)}/_apis/git/repositories/\${encodeURIComponent(repoName)}\`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${token}\`,
  };
  const filePath = \`/\${controlName}.csv\`;

  // Get repo refs to find master/main
  const refsRes = await fetch(\`\${base}/refs?filter=heads&api-version=6.0\`, { headers });
  const refsData = await refsRes.json();
  const ref: { name: string; objectId: string } | undefined = refsData.value?.find(
    (r: any) => r.name === "refs/heads/master" || r.name === "refs/heads/main"
  );
  if (!ref) return;

  // Check if file exists
  let changeType = 1; // add
  try {
    const itemRes = await fetch(
      \`\${base}/items?path=\${encodeURIComponent(filePath)}&api-version=6.0\`,
      { headers }
    );
    if (itemRes.ok) changeType = 2; // edit
  } catch (_) {}

  const body = JSON.stringify({
    refUpdates: [{ name: ref.name, oldObjectId: ref.objectId }],
    commits: [
      {
        comment: changeType === 1 ? "Upload New File" : "Upload Edited File",
        changes: [
          {
            changeType,
            item: { path: filePath },
            newContent: { content: csvContent, contentType: 0 },
          },
        ],
      },
    ],
  });

  await fetch(\`\${base}/pushes?api-version=6.0\`, {
    method: "POST",
    headers,
    body,
  });
}
`);

// ─── src/components/control/ErrorDisplay.tsx ─────────────────────────────────
write('src/components/control/ErrorDisplay.tsx', `import React from "react";

interface Props {
  message: string;
}

export const ErrorDisplay: React.FC<Props> = ({ message }) => (
  <div style={{
    padding: "12px 16px",
    background: "#fde8e8",
    color: "#a80000",
    border: "1px solid #a80000",
    borderRadius: 4,
    fontFamily: "Segoe UI, sans-serif",
    fontSize: 13,
  }}>
    <strong>Error:</strong> {message}
  </div>
);
`);

// ─── src/components/control/CascadeDropdowns.tsx ─────────────────────────────
write('src/components/control/CascadeDropdowns.tsx', `import React, { useCallback, useEffect, useState } from "react";
import { ControlConfig, FieldsValuesList } from "../../types";
import { setFieldValues } from "../../services/WorkItemService";

interface Props {
  config: ControlConfig;
  data: FieldsValuesList;
  initialValues: string[];
}

/** Compute the dependency key for level L: concatenation of values[0..L-1] */
function dependKey(values: string[], level: number): string {
  return values.slice(0, level).join("");
}

/** Filter options for a given level based on current selections */
function optionsForLevel(data: FieldsValuesList, level: number, selections: string[]): string[] {
  if (level >= data.FieldsLists.length) return [];
  const dep = dependKey(selections, level);
  const opts = data.FieldsLists[level]
    .filter((e) => e.Depend === dep)
    .map((e) => e.Value);
  opts.sort();
  return opts;
}

export const CascadeDropdowns: React.FC<Props> = ({ config, data, initialValues }) => {
  const count = config.fieldNames.length;
  const viewOption = parseInt(config.viewOption ?? "1", 10) || 1;
  const [selections, setSelections] = useState<string[]>(() => {
    const vals = Array<string>(count).fill("");
    for (let i = 0; i < Math.min(initialValues.length, count); i++) {
      vals[i] = initialValues[i] ?? "";
    }
    return vals;
  });

  const handleChange = useCallback(
    (level: number, value: string) => {
      setSelections((prev) => {
        const next = [...prev];
        next[level] = value;
        // Reset all subsequent levels
        for (let i = level + 1; i < count; i++) next[i] = "";
        return next;
      });
    },
    [count]
  );

  // Auto-select when only one option and autoBehavior == "Auto"
  useEffect(() => {
    if (config.autoBehavior !== "Auto") return;
    setSelections((prev) => {
      const next = [...prev];
      let changed = false;
      for (let i = 0; i < count; i++) {
        if (next[i] === "") {
          const opts = optionsForLevel(data, i, next);
          if (opts.length === 1) {
            next[i] = opts[0];
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [config.autoBehavior, data, count]);

  // Sync field values to work item whenever selections change
  useEffect(() => {
    const fields: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
      if (config.fieldRefs[i]) fields[config.fieldRefs[i]] = selections[i] ?? "";
    }
    if (config.summarizeToPathRef) {
      const pathVal = selections.filter(Boolean).join("\\\\");
      fields[config.summarizeToPathRef] = pathVal;
    }
    setFieldValues(fields).catch(console.error);
  }, [selections, config]);

  const dropdownWidth = \`\${Math.floor(90 / viewOption)}%\`;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8 }}>
      {config.fieldNames.map((name, i) => {
        if (config.fieldHides[i]) return null;
        const opts = optionsForLevel(data, i, selections);
        const isDisabled = i > 0 && selections[i - 1] === "";

        return (
          <div key={i} style={{ width: dropdownWidth, display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 12, fontFamily: "Segoe UI, sans-serif", marginBottom: 2 }}>
              {name}
            </label>
            <select
              value={selections[i]}
              disabled={isDisabled}
              onChange={(e) => handleChange(i, e.target.value)}
              style={{
                fontFamily: "Segoe UI, sans-serif",
                fontSize: 13,
                padding: "4px 6px",
                border: "1px solid #8a8886",
                borderRadius: 2,
                background: isDisabled ? "#f3f2f1" : "#fff",
              }}
            >
              <option value="" />
              {opts.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
};
`);

// ─── src/Control/Control.tsx ─────────────────────────────────────────────────
write('src/Control/Control.tsx', `import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import { ControlConfig, FieldsValuesList } from "../types";
import { retrieveValueList } from "../services/StorageService";
import { getFieldValues } from "../services/WorkItemService";
import { CascadeDropdowns } from "../components/control/CascadeDropdowns";
import { ErrorDisplay } from "../components/control/ErrorDisplay";
import "./Control.scss";

const MAX_FIELDS = 8;

function getContribInputs(): Record<string, string> {
  try {
    const config = SDK.getConfiguration?.() ?? (window as any).__witInputs ?? {};
    return config.witInputs ?? config ?? {};
  } catch {
    return {};
  }
}

const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ControlConfig | null>(null);
  const [data, setData] = useState<FieldsValuesList | null>(null);
  const [initialValues, setInitialValues] = useState<string[]>([]);

  useEffect(() => {
    let done = false;
    const finish = (err?: string) => { if (!done) { done = true; setReady(true); if (err) setError(err); } };
    const timeout = setTimeout(() => { try { SDK.notifyLoadSucceeded(); } catch (_) {} finish("SDK init timed out"); }, 3000);

    SDK.init({ loaded: false, applyTheme: true })
      .then(async () => {
        clearTimeout(timeout);
        try { SDK.notifyLoadSucceeded(); } catch (_) {}

        const inputs = getContribInputs();
        const controlName: string = inputs["ControlName"] ?? "";

        // Collect field definitions dynamically (up to MAX_FIELDS)
        const fieldNames: string[] = [];
        const fieldRefs: string[] = [];
        const fieldHides: boolean[] = [];

        for (let n = 1; n <= MAX_FIELDS; n++) {
          const name = inputs[\`FieldName\${n}\`];
          const ref = inputs[\`Field\${n}\`];
          if (!name && !ref) break; // Stop at first missing pair
          if (name) fieldNames.push(name);
          if (ref) fieldRefs.push(ref);
          fieldHides.push(inputs[\`Field\${n}Hide\`] === "true");
        }

        const cfg: ControlConfig = {
          controlName,
          fieldNames,
          fieldRefs,
          fieldHides,
          summarizeToPathRef: inputs["SummarizeToPath"],
          repo: inputs["Reposetory"],
          viewOption: inputs["ViewOption"] ?? "1",
          autoBehavior: inputs["PrivateBehaviure"],
        };
        setConfig(cfg);

        // Load current field values and data
        const projectName = (SDK.getWebContext?.() as any)?.project?.name ?? "";
        const allRefs = [...fieldRefs];
        if (cfg.summarizeToPathRef) allRefs.push(cfg.summarizeToPathRef);

        const [fieldVals, storedData] = await Promise.all([
          getFieldValues(allRefs).catch(() => ({} as Record<string, string>)),
          retrieveValueList(controlName, projectName),
        ]);

        setInitialValues(fieldRefs.map((r) => fieldVals[r] ?? ""));
        setData(storedData ?? { FieldsLists: [] });
        finish();
      })
      .catch((err) => {
        clearTimeout(timeout);
        try { SDK.notifyLoadSucceeded(); } catch (_) {}
        finish(String(err));
      });

    return () => clearTimeout(timeout);
  }, []);

  if (!ready) return <div style={{ padding: 8, fontFamily: "Segoe UI, sans-serif", fontSize: 13 }}>Loading\u2026</div>;
  if (error) return <ErrorDisplay message={error} />;
  if (!config || !data) return <ErrorDisplay message="Could not load configuration." />;
  if (data.FieldsLists.length === 0) return <ErrorDisplay message={\`No data found for control "\${config.controlName}". Upload a CSV in the admin hub.\`} />;

  return <CascadeDropdowns config={config} data={data} initialValues={initialValues} />;
};

ReactDOM.render(<App />, document.getElementById("root"));
`);

// ─── src/Control/Control.html ────────────────────────────────────────────────
write('src/Control/Control.html', `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Picker Fields Control</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`);

// ─── src/Control/Control.scss ────────────────────────────────────────────────
write('src/Control/Control.scss', `body {
  margin: 0;
  padding: 0;
  font-family: "Segoe UI", sans-serif;
  font-size: 13px;
}

select:focus {
  outline: 2px solid #0078d4;
  outline-offset: 1px;
}
`);

// ─── src/components/hub/LevelHeaderEditor.tsx ────────────────────────────────
write('src/components/hub/LevelHeaderEditor.tsx', `import React from "react";

interface Props {
  headers: string[];
  onChange: (headers: string[]) => void;
  minLevels?: number;
}

export const LevelHeaderEditor: React.FC<Props> = ({ headers, onChange, minLevels = 2 }) => {
  const addLevel = () => onChange([...headers, \`Level \${headers.length + 1}\`]);
  const removeLevel = (i: number) => {
    if (headers.length <= minLevels) return;
    onChange(headers.filter((_, idx) => idx !== i));
  };
  const updateHeader = (i: number, val: string) => {
    const next = [...headers];
    next[i] = val;
    onChange(next);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Level Headers</div>
      {headers.map((h, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ width: 70, fontSize: 12, color: "#605e5c" }}>Level {i + 1}</span>
          <input
            value={h}
            onChange={(e) => updateHeader(i, e.target.value)}
            style={{ flex: 1, padding: "4px 8px", border: "1px solid #8a8886", borderRadius: 2, fontSize: 13 }}
          />
          <button
            onClick={() => removeLevel(i)}
            disabled={headers.length <= minLevels}
            style={{ padding: "2px 8px", cursor: headers.length <= minLevels ? "not-allowed" : "pointer" }}
            title="Remove level"
          >
            \u2212
          </button>
        </div>
      ))}
      <button
        onClick={addLevel}
        style={{ marginTop: 4, padding: "4px 12px", cursor: "pointer", fontSize: 13 }}
      >
        + Add Level
      </button>
    </div>
  );
};
`);

// ─── src/components/hub/CsvUpload.tsx ────────────────────────────────────────
write('src/components/hub/CsvUpload.tsx', `import React, { useState } from "react";
import { parseCsv } from "../../utils/csvParser";
import { storeValueList, retrieveControlList, storeControlList } from "../../services/StorageService";
import { LevelHeaderEditor } from "./LevelHeaderEditor";

export const CsvUpload: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [textName, setTextName] = useState("");
  const [headers, setHeaders] = useState<string[]>(["Level 1", "Level 2"]);

  async function save(controlName: string, csvContent: string) {
    const { result, duplicates } = parseCsv(csvContent);
    await storeValueList(controlName, result);

    const list = await retrieveControlList();
    if (!list.some((c) => c.controlName === controlName)) {
      const scope = controlName.includes("_") ? controlName.split("_")[0] : "Collection";
      list.push({ controlName, projectName: scope, fileName: \`\${controlName}.csv\` });
      await storeControlList(list);
      setMessage(\`"\${controlName}" created. \${duplicates.length} duplicate(s) skipped.\`);
    } else {
      setMessage(\`"\${controlName}" updated. \${duplicates.length} duplicate(s) skipped.\`);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const controlName = file.name.replace(/\\.[^/.]+$/, "");
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
`);

// ─── src/components/hub/CsvBuilder.tsx ───────────────────────────────────────
write('src/components/hub/CsvBuilder.tsx', `import React, { useState } from "react";
import { FieldsValuesList, FieldValues } from "../../types";
import { storeValueList, retrieveControlList, storeControlList } from "../../services/StorageService";
import { toCsv } from "../../utils/csvParser";
import { LevelHeaderEditor } from "./LevelHeaderEditor";

interface GridRow {
  values: string[];
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

export const CsvBuilder: React.FC = () => {
  const [controlName, setControlName] = useState("");
  const [headers, setHeaders] = useState<string[]>(["Level 1", "Level 2"]);
  const [rows, setRows] = useState<GridRow[]>([{ values: Array(2).fill("") }]);
  const [message, setMessage] = useState<string | null>(null);

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
      list.push({ controlName: controlName.trim(), projectName: scope, fileName: \`\${controlName.trim()}.csv\` });
      await storeControlList(list);
      setMessage(\`"\${controlName}" created successfully.\`);
    } else {
      setMessage(\`"\${controlName}" updated successfully.\`);
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
    a.download = \`\${controlName.trim()}.csv\`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif" }}>
      <h3 style={{ marginTop: 0 }}>Build CSV Interactively</h3>
      <p style={{ fontSize: 13, color: "#605e5c" }}>
        Define level headers and add rows directly \u2014 no CSV file needed.
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
                    \u00d7
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
`);

// ─── src/components/hub/ControlList.tsx ──────────────────────────────────────
write('src/components/hub/ControlList.tsx', `import React, { useEffect, useState } from "react";
import { ControlsNames } from "../../types";
import { retrieveControlList, storeControlList, deleteValue } from "../../services/StorageService";

export const ControlList: React.FC = () => {
  const [controls, setControls] = useState<ControlsNames[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    retrieveControlList()
      .then(setControls)
      .finally(() => setLoading(false));
  }, []);

  async function deleteControl(ctrl: ControlsNames) {
    const updated = controls.filter((c) => c.controlName !== ctrl.controlName);
    await storeControlList(updated);
    await deleteValue(ctrl.controlName);
    setControls(updated);
  }

  if (loading) return <div style={{ padding: 16 }}>Loading\u2026</div>;

  return (
    <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif" }}>
      <h3 style={{ marginTop: 0 }}>Registered Controls</h3>
      {controls.length === 0 ? (
        <p style={{ fontSize: 13, color: "#605e5c" }}>No controls registered yet. Upload a CSV to create one.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {controls.map((ctrl) => (
            <li key={ctrl.controlName} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "8px 12px", borderBottom: "1px solid #edebe9", fontSize: 13,
            }}>
              <div style={{ flex: 1 }}>
                <strong>{ctrl.controlName}</strong>
                <span style={{ color: "#605e5c", marginLeft: 12 }}>scope: {ctrl.projectName}</span>
                <span style={{ color: "#605e5c", marginLeft: 12 }}>file: {ctrl.fileName}</span>
              </div>
              <button
                onClick={() => deleteControl(ctrl)}
                style={{ padding: "3px 10px", background: "#a4262c", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 12 }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
`);

// ─── src/Hub/Hub.tsx ──────────────────────────────────────────────────────────
write('src/Hub/Hub.tsx', `import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import { ControlList } from "../components/hub/ControlList";
import { CsvUpload } from "../components/hub/CsvUpload";
import { CsvBuilder } from "../components/hub/CsvBuilder";
import "./Hub.scss";

type Tab = "configurations" | "upload" | "builder" | "instructions";

function detectDarkTheme(): boolean {
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return true;
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--palette-neutral-0").trim();
  const match = bg.match(/\\d+/g);
  if (!match) return false;
  const [r, g, b] = match.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.4;
}

const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("configurations");

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

  if (!ready) return <div style={{ padding: 24, fontFamily: "Segoe UI, sans-serif" }}>Loading\u2026</div>;

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
            className={\`hub-tab\${tab === t.id ? " hub-tab--active" : ""}\`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="hub-content">
        {tab === "configurations" && <ControlList />}
        {tab === "upload" && <CsvUpload />}
        {tab === "builder" && <CsvBuilder />}
        {tab === "instructions" && <Instructions />}
      </div>
    </div>
  );
};

const Instructions: React.FC = () => (
  <div style={{ padding: 16, fontFamily: "Segoe UI, sans-serif", maxWidth: 700, fontSize: 13, lineHeight: 1.6 }}>
    <h3 style={{ marginTop: 0 }}>How to use Multi Pickers Fields Control</h3>
    <h4>1. Add data</h4>
    <p>Go to the <strong>Upload CSV</strong> tab to upload a CSV file, or the <strong>Build CSV</strong> tab to enter values interactively.</p>
    <p>CSV format: first column is ignored, then one column per cascading level.</p>
    <pre style={{ background: "#f3f2f1", padding: 10, borderRadius: 4, fontSize: 12 }}>
{\`,Country,State,City
x,USA,California,San Francisco
x,USA,California,Los Angeles
x,USA,New York,New York City
x,Israel,Center,Tel Aviv\`}
    </pre>
    <h4>2. Add the control to a work item type</h4>
    <p>In the process customization, add the <strong>Multi Pickers Fields with dependencies</strong> control to a work item form.</p>
    <p>Set the <strong>Control Name</strong> input to the same name you used when uploading data.</p>
    <h4>3. Configure fields</h4>
    <p>Set <strong>Field Name 1/2/3\u2026</strong> (the label) and <strong>Field 1/2/3\u2026</strong> (the work item field reference) for each level.</p>
    <p>Optionally set <strong>Summarize to Path field</strong> to write a backslash-separated path into another field.</p>
    <h4>4. Optional settings</h4>
    <ul>
      <li><strong>View Option</strong>: number of dropdowns per row (1\u20134)</li>
      <li><strong>Private Behaviour</strong>: set to <code>Auto</code> to auto-select when only one option exists</li>
      <li><strong>Backup Repository</strong>: <code>ProjectName\\RepoName</code> to push CSV backups to Git</li>
    </ul>
  </div>
);

ReactDOM.render(<App />, document.getElementById("root"));
`);

// ─── src/Hub/Hub.html ─────────────────────────────────────────────────────────
write('src/Hub/Hub.html', `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi Picker Configuration</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`);

// ─── src/Hub/Hub.scss ─────────────────────────────────────────────────────────
write('src/Hub/Hub.scss', `body {
  margin: 0;
  padding: 0;
  font-family: "Segoe UI", sans-serif;
  font-size: 13px;
  background: var(--palette-neutral-0, #fff);
  color: var(--palette-neutral-100, #323130);
}

.hub-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.hub-tabs {
  display: flex;
  border-bottom: 1px solid #edebe9;
  background: var(--palette-neutral-4, #f3f2f1);
  flex-shrink: 0;
}

.hub-tab {
  padding: 10px 20px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  color: var(--palette-neutral-80, #605e5c);

  &:hover {
    background: var(--palette-neutral-8, #edebe9);
  }

  &--active {
    border-bottom-color: #0078d4;
    color: #0078d4;
    font-weight: 600;
  }
}

.hub-content {
  flex: 1;
  overflow: auto;
}
`);

// ─── src/Action/Action.tsx ────────────────────────────────────────────────────
write('src/Action/Action.tsx', `import React, { useEffect, useState } from "react";
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
      list.push({ controlName, projectName: scope, fileName: \`\${controlName}.csv\` });
      await storeControlList(list);
    }
    setMessage(\`\${controlName} updated. \${duplicates.length} duplicate(s) skipped.\`);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const controlName = file.name.replace(/\\.[^/.]+$/, "");
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

  if (!ready) return <div style={{ padding: 16 }}>Loading\u2026</div>;

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
`);

// ─── src/Action/Action.html ───────────────────────────────────────────────────
write('src/Action/Action.html', `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Upload Picker CSV</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`);

// ─── src/Action/Action.scss ───────────────────────────────────────────────────
write('src/Action/Action.scss', `body { margin: 0; padding: 0; font-family: "Segoe UI", sans-serif; }
`);

// ─── src/__mocks__/azure-devops-extension-sdk.ts ─────────────────────────────
write('src/__mocks__/azure-devops-extension-sdk.ts', `const SDK = {
  init: jest.fn().mockResolvedValue(undefined),
  notifyLoadSucceeded: jest.fn(),
  getService: jest.fn().mockResolvedValue({
    getValue: jest.fn().mockResolvedValue(undefined),
    setValue: jest.fn().mockResolvedValue(undefined),
    deleteValue: jest.fn().mockResolvedValue(undefined),
  }),
  getConfiguration: jest.fn().mockReturnValue({ witInputs: {} }),
  getWebContext: jest.fn().mockReturnValue({ project: { name: "TestProject" } }),
};
export default SDK;
export const { init, notifyLoadSucceeded, getService, getConfiguration, getWebContext } = SDK;
`);

// ─── src/__mocks__/azure-devops-extension-api.ts ─────────────────────────────
write('src/__mocks__/azure-devops-extension-api.ts', `export const getClient = jest.fn().mockReturnValue({});
`);

// ─── src/__mocks__/styleMock.ts ───────────────────────────────────────────────
write('src/__mocks__/styleMock.ts', `export default {};
`);

// ─── src/__tests__/csvParser.test.ts ─────────────────────────────────────────
write('src/__tests__/csvParser.test.ts', `import { parseCsv, toCsv } from "../utils/csvParser";

describe("parseCsv", () => {
  test("parses a 2-level CSV correctly", () => {
    const csv = ",L1,L2\\nx,A,X\\nx,A,Y\\nx,B,Z";
    const { result, duplicates } = parseCsv(csv);
    expect(duplicates).toHaveLength(0);
    expect(result.FieldsLists).toHaveLength(2);
    expect(result.FieldsLists[0]).toEqual([
      { Depend: "", Value: "A" },
      { Depend: "", Value: "B" },
    ]);
    expect(result.FieldsLists[1]).toEqual([
      { Depend: "A", Value: "X" },
      { Depend: "A", Value: "Y" },
      { Depend: "B", Value: "Z" },
    ]);
  });

  test("parses a 4-level CSV correctly", () => {
    const csv = ",L1,L2,L3,L4\\nx,A,B,C,D\\nx,A,B,C,E\\nx,A,B,F,G";
    const { result, duplicates } = parseCsv(csv);
    expect(duplicates).toHaveLength(0);
    expect(result.FieldsLists).toHaveLength(4);
    expect(result.FieldsLists[3]).toContainEqual({ Depend: "ABC", Value: "D" });
    expect(result.FieldsLists[3]).toContainEqual({ Depend: "ABC", Value: "E" });
  });

  test("parses a 6-level CSV correctly", () => {
    const csv = ",L1,L2,L3,L4,L5,L6\\nx,A,B,C,D,E,F";
    const { result } = parseCsv(csv);
    expect(result.FieldsLists).toHaveLength(6);
    expect(result.FieldsLists[5]).toContainEqual({ Depend: "ABCDE", Value: "F" });
  });

  test("deduplicates identical rows", () => {
    const csv = ",L1,L2\\nx,A,B\\nx,A,B\\nx,A,B";
    const { result, duplicates } = parseCsv(csv);
    expect(duplicates).toHaveLength(2);
    expect(result.FieldsLists[0]).toHaveLength(1);
    expect(result.FieldsLists[1]).toHaveLength(1);
  });

  test("handles empty rows gracefully", () => {
    const csv = ",L1,L2\\nx,A,B\\n\\nx,C,D\\n";
    const { result } = parseCsv(csv);
    expect(result.FieldsLists[0]).toHaveLength(2);
  });

  test("returns empty FieldsLists for empty content", () => {
    const { result } = parseCsv(",L1,L2\\n");
    expect(result.FieldsLists).toHaveLength(0);
  });
});

describe("toCsv", () => {
  test("round-trips a 2-level structure", () => {
    const csv = ",L1,L2\\nx,A,X\\nx,A,Y\\nx,B,Z";
    const { result } = parseCsv(csv);
    const out = toCsv(result, ["L1", "L2"]);
    const lines = out.split("\\n").slice(1).sort();
    expect(lines).toEqual(["x,A,X", "x,A,Y", "x,B,Z"].sort());
  });
});
`);

// ─── src/__tests__/StorageService.test.ts ────────────────────────────────────
write('src/__tests__/StorageService.test.ts', `import * as StorageService from "../services/StorageService";
import SDK from "azure-devops-extension-sdk";

describe("StorageService", () => {
  let mockSvc: any;

  beforeEach(() => {
    mockSvc = {
      getValue: jest.fn(),
      setValue: jest.fn(),
      deleteValue: jest.fn(),
    };
    (SDK.getService as jest.Mock).mockResolvedValue(mockSvc);
  });

  test("retrieveValueList returns project-scoped over collection-scoped", async () => {
    const collection = { FieldsLists: [[{ Depend: "", Value: "collection" }]] };
    const project = { FieldsLists: [[{ Depend: "", Value: "project" }]] };
    mockSvc.getValue.mockImplementation((key: string) => {
      if (key === "MyProject_MyControl") return Promise.resolve(project);
      if (key === "MyControl") return Promise.resolve(collection);
      return Promise.resolve(undefined);
    });
    const result = await StorageService.retrieveValueList("MyControl", "MyProject");
    expect(result).toEqual(project);
  });

  test("retrieveValueList falls back to collection-scoped when project-scoped is undefined", async () => {
    const collection = { FieldsLists: [[{ Depend: "", Value: "collection" }]] };
    mockSvc.getValue.mockImplementation((key: string) => {
      if (key === "MyControl") return Promise.resolve(collection);
      return Promise.resolve(undefined);
    });
    const result = await StorageService.retrieveValueList("MyControl", "MyProject");
    expect(result).toEqual(collection);
  });

  test("storeControlList calls setValue with pickerControl key", async () => {
    const list = [{ controlName: "test", projectName: "proj", fileName: "test.csv" }];
    await StorageService.storeControlList(list);
    expect(mockSvc.setValue).toHaveBeenCalledWith("pickerControl", list);
  });

  test("retrieveControlList returns empty array when nothing stored", async () => {
    mockSvc.getValue.mockResolvedValue(undefined);
    const result = await StorageService.retrieveControlList();
    expect(result).toEqual([]);
  });
});
`);

// ─── static/.gitkeep ─────────────────────────────────────────────────────────
write('static/.gitkeep', '');

// ─── Copy img and docs from PickerFieldsControl-master ───────────────────────
const sourceBase = path.join(root, '..', 'PickerFieldsControl-master');
const sourceImg = path.join(sourceBase, 'img');
const destImg = path.join(root, 'img');

if (fs.existsSync(sourceImg)) {
  fs.readdirSync(sourceImg).forEach(f => {
    const src = path.join(sourceImg, f);
    const dst = path.join(destImg, f);
    if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst);
      console.log('[setup-dirs] copied img:', f);
    }
  });
}

['LICENSE.md', 'PRIVACY.md', 'details.md'].forEach(f => {
  const src = path.join(sourceBase, f);
  const dst = path.join(root, f);
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    fs.copyFileSync(src, dst);
    console.log('[setup-dirs] copied doc:', f);
  }
});

console.log('[setup-dirs] Done! All source files created.');

