import React, { useEffect, useState } from "react";
import { ControlsNames } from "../../types";
import { retrieveControlList, retrieveValueList, storeControlList, deleteValue, renameControl } from "../../services/StorageService";
import { toCsv } from "../../utils/csvParser";

interface Props {
  onEdit: (controlName: string, headers: string[], csvContent: string) => void;
}

export const ControlList: React.FC<Props> = ({ onEdit }) => {
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

  async function editControl(ctrl: ControlsNames) {
    const data = await retrieveValueList(ctrl.controlName, ctrl.projectName);
    if (!data) return;
    const headers = ctrl.headers?.length ? ctrl.headers : data.FieldsLists.map((_, index) => "Level " + (index + 1));
    onEdit(ctrl.controlName, headers, toCsv(data, headers));
  }

  async function renameSavedControl(ctrl: ControlsNames) {
    const newName = window.prompt("New control name", ctrl.controlName)?.trim();
    if (!newName || newName === ctrl.controlName || controls.some(control => control.controlName === newName)) return;
    const renamed = await renameControl(ctrl, newName);
    const updated = controls.map(control => control.controlName === ctrl.controlName ? renamed : control);
    await storeControlList(updated);
    setControls(updated);
  }

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

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
                onClick={() => editControl(ctrl)}
                style={{ padding: "3px 10px", background: "#0078d4", color: "#fff", border: "none", borderRadius: 2, cursor: "pointer", fontSize: 12 }}
              >
                Edit
              </button>
              <button
                onClick={() => renameSavedControl(ctrl)}
                style={{ padding: "3px 10px", background: "#fff", color: "#0078d4", border: "1px solid #0078d4", borderRadius: 2, cursor: "pointer", fontSize: 12 }}
              >
                Rename
              </button>
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
