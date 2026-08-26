import * as SDK from "azure-devops-extension-sdk";
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
