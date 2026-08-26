import * as SDK from "azure-devops-extension-sdk";
import { CommonServiceIds, IExtensionDataManager, IExtensionDataService } from "azure-devops-extension-api/Common/CommonServices";
import { FieldsValuesList, ControlsNames, RepoInfo } from "../types";

let dataManager: IExtensionDataManager | null = null;

async function getDataManager(): Promise<IExtensionDataManager> {
  if (dataManager) return dataManager;
  const dataService = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
  const extension = SDK.getExtensionContext();
  const token = await SDK.getAccessToken();
  dataManager = await dataService.getExtensionDataManager(extension.id, token);
  return dataManager;
}

export async function getValue<T>(key: string): Promise<T | undefined> {
  const manager = await getDataManager();
  return manager.getValue<T | undefined>(key);
}

export async function setValue<T>(key: string, value: T): Promise<void> {
  const manager = await getDataManager();
  await manager.setValue(key, value);
}

export async function deleteValue(key: string): Promise<void> {
  const manager = await getDataManager();
  await manager.setValue(key, undefined as unknown);
}

/** Load the FieldsValuesList for a control.
 *  Project-scoped key (projectName_controlName) takes precedence over collection-scoped (controlName). */
export async function retrieveValueList(
  controlName: string,
  projectName: string
): Promise<FieldsValuesList | undefined> {
  const manager = await getDataManager();
  const collectionResult = await manager.getValue<FieldsValuesList | undefined>(controlName);
  const projectResult = await manager.getValue<FieldsValuesList | undefined>(`${projectName}_${controlName}`);
  return projectResult ?? collectionResult;
}

export async function storeValueList(
  controlName: string,
  value: FieldsValuesList
): Promise<void> {
  const manager = await getDataManager();
  await manager.setValue(controlName, value);
}

export async function retrieveControlList(): Promise<ControlsNames[]> {
  const manager = await getDataManager();
  let result: ControlsNames[] = [];
  try {
    result = await manager.getValue<ControlsNames[] | undefined>("pickerControl") ?? [];
  } catch (_) {}
  return result ?? [];
}

export async function storeControlList(list: ControlsNames[]): Promise<void> {
  const manager = await getDataManager();
  await manager.setValue("pickerControl", list);
}

export async function renameControl(control: ControlsNames, newName: string): Promise<ControlsNames> {
  const valueList = await retrieveValueList(control.controlName, control.projectName);
  if (!valueList) throw new Error("CSV data for '" + control.controlName + "' was not found.");
  await storeValueList(newName, valueList);
  await deleteValue(control.controlName);
  return { ...control, controlName: newName, fileName: newName + ".csv" };
}

export async function getRepoInfo(key = "RepoInfo"): Promise<RepoInfo | undefined> {
  const manager = await getDataManager();
  return manager.getValue<RepoInfo | undefined>(key);
}

export async function setRepoInfo(info: RepoInfo, key = "RepoInfo"): Promise<void> {
  const manager = await getDataManager();
  await manager.setValue(key, info);
}
