import React, { useEffect, useState } from "react";
import { ControlsNames } from "../../types";
import { retrieveControlList, retrieveValueList, storeControlList, deleteValue, renameControl } from "../../services/StorageService";
import { toCsv, downloadCsv } from "../../utils/csvParser";

interface Props {
  onEdit: (controlName: string, headers: string[], csvContent: string) => void;
}

export const ControlList: React.FC<Props> = ({ onEdit }) => {
  const [controls, setControls] = useState<ControlsNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

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

  async function exportControl(ctrl: ControlsNames): Promise<boolean> {
    const data = await retrieveValueList(ctrl.controlName, ctrl.projectName);
    if (!data) return false;
    const headers = ctrl.headers?.length ? ctrl.headers : data.FieldsLists.map((_, index) => "Level " + (index + 1));
    downloadCsv(`${ctrl.controlName}.csv`, toCsv(data, headers));
    return true;
  }

  async function exportAll() {
    let count = 0;
    for (const ctrl of controls) {
      if (await exportControl(ctrl)) count++;
      // Browsers drop rapid back-to-back downloads
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    setMessage(`Exported ${count} of ${controls.length} configuration(s). Import them in another collection via the Upload CSV tab.`);
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
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h3 style={{ marginTop: 0, flex: 1 }}>Registered Controls</h3>
        {controls.length > 0 && (
          <button
            onClick={() => exportAll().catch(err => setMessage(String(err)))}
            style={{ padding: "4px 12px", background: "#fff", color: "#0078d4", border: "1px solid #0078d4", borderRadius: 2, cursor: "pointer", fontSize: 12 }}
          >
            Export All CSV
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: "#605e5c", marginTop: 0 }}>
        Configurations are stored at collection level and shared by all projects.
      </p>
      {message && (
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#dff6dd", border: "1px solid #107c10", borderRadius: 2, fontSize: 13 }}>
          {message}
        </div>
      )}
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
                onClick={() => exportControl(ctrl).then(ok => setMessage(ok ? `Exported "${ctrl.controlName}.csv".` : `No data found for "${ctrl.controlName}".`))}
                style={{ padding: "3px 10px", background: "#fff", color: "#0078d4", border: "1px solid #0078d4", borderRadius: 2, cursor: "pointer", fontSize: 12 }}
              >
                Export CSV
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
