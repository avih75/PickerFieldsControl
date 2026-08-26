import React, { useCallback, useEffect, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
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
      const pathVal = selections.filter(Boolean).join("\\");
      fields[config.summarizeToPathRef] = pathVal;
    }
    setFieldValues(fields).catch(console.error);
  }, [selections, config]);

  const dropdownWidth = `${Math.floor(90 / viewOption)}%`;

  useEffect(() => {
    const resize = () => (SDK as any).resize?.();
    const frame = requestAnimationFrame(resize);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(resize);
    const root = document.getElementById("root");
    if (root && observer) observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [config, selections]);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8 }}>
      {config.fieldNames.map((name, i) => {
        if (config.fieldHides[i]) return null;
        const opts = optionsForLevel(data, i, selections);
        const isDisabled = i > 0 && selections[i - 1] === "";
        const isRequiredEmpty = config.fieldRequired[i] && selections[i] === "";

        return (
          <div key={i} style={{ width: dropdownWidth, display: "flex", flexDirection: "column" }}>
            <label style={{ fontSize: 12, fontFamily: "Segoe UI, sans-serif", marginBottom: 2 }}>
              {name}{config.fieldRequired[i] ? " *" : ""}
            </label>
            <select
              value={selections[i]}
              disabled={isDisabled}
              onChange={(e) => handleChange(i, e.target.value)}
              style={{
                fontFamily: "Segoe UI, sans-serif",
                fontSize: 13,
                padding: "4px 6px",
                border: isRequiredEmpty ? "2px solid #d13438" : "1px solid #8a8886",
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
