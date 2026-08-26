import React from "react";

interface Props {
  headers: string[];
  onChange: (headers: string[]) => void;
  minLevels?: number;
}

export const LevelHeaderEditor: React.FC<Props> = ({ headers, onChange, minLevels = 2 }) => {
  const addLevel = () => onChange([...headers, `Level ${headers.length + 1}`]);
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
            −
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
