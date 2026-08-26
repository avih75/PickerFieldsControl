import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import * as SDK from "azure-devops-extension-sdk";
import { ControlConfig, FieldsValuesList } from "../types";
import { retrieveValueList } from "../services/StorageService";
import { getFieldValues } from "../services/WorkItemService";
import { CascadeDropdowns } from "../components/control/CascadeDropdowns";
import { ErrorDisplay } from "../components/control/ErrorDisplay";
import "./Control.scss";

const MAX_FIELDS = 8;

function getContribInputs(): Record<string, unknown> {
  try {
    const config = SDK.getConfiguration?.() ?? (window as any).__witInputs ?? {};
    return config.witInputs ?? config ?? {};
  } catch {
    return {};
  }
}

function isChecked(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === "true";
}

function getInputString(inputs: Record<string, unknown>, key: string): string {
  const value = inputs[key];
  return value == null ? "" : String(value);
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
        const controlName = getInputString(inputs, "ControlName");

        // Collect field definitions dynamically (up to MAX_FIELDS)
        const fieldNames: string[] = [];
        const fieldRefs: string[] = [];
        const fieldHides: boolean[] = [];
        const fieldRequired: boolean[] = [];

        for (let n = 1; n <= MAX_FIELDS; n++) {
          const name = String(inputs[`FieldName${n}`] ?? "");
          const ref = String(inputs[`Field${n}`] ?? "");
          if (!name && !ref) break; // Stop at first missing pair
          fieldNames.push(name);
          fieldRefs.push(ref);
          fieldHides.push(isChecked(inputs[`Field${n}Hide`]));
          fieldRequired.push(isChecked(inputs[`Field${n}Required`]));
        }

        const cfg: ControlConfig = {
          controlName,
          fieldNames,
          fieldRefs,
          fieldHides,
          fieldRequired,
          summarizeToPathRef: getInputString(inputs, "SummarizeToPath") || undefined,
          repo: getInputString(inputs, "Reposetory") || undefined,
          viewOption: getInputString(inputs, "ViewOption") || "1",
          autoBehavior: getInputString(inputs, "PrivateBehaviure") || undefined,
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

  if (!ready) return <div style={{ padding: 8, fontFamily: "Segoe UI, sans-serif", fontSize: 13 }}>Loading…</div>;
  if (error) return <ErrorDisplay message={error} />;
  if (!config || !data) return <ErrorDisplay message="Could not load configuration." />;
  if (data.FieldsLists.length === 0) return <ErrorDisplay message={`No data found for control "${config.controlName}". Upload a CSV in the admin hub.`} />;

  return <CascadeDropdowns config={config} data={data} initialValues={initialValues} />;
};

ReactDOM.render(<App />, document.getElementById("root"));
