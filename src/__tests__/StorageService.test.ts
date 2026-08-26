import * as StorageService from "../services/StorageService";
import SDK from "azure-devops-extension-sdk";

describe("StorageService", () => {
  const mockManager: any = {
    getValue: jest.fn(),
    setValue: jest.fn(),
  };
  const mockDataService = { getExtensionDataManager: jest.fn().mockResolvedValue(mockManager) };

  beforeEach(() => {
    mockManager.getValue.mockReset();
    mockManager.setValue.mockReset();
    (SDK.getService as jest.Mock).mockResolvedValue(mockDataService);
  });

  test("retrieveValueList returns project-scoped over collection-scoped", async () => {
    const collection = { FieldsLists: [[{ Depend: "", Value: "collection" }]] };
    const project = { FieldsLists: [[{ Depend: "", Value: "project" }]] };
    mockManager.getValue.mockImplementation((key: string) => {
      if (key === "MyProject_MyControl") return Promise.resolve(project);
      if (key === "MyControl") return Promise.resolve(collection);
      return Promise.resolve(undefined);
    });
    const result = await StorageService.retrieveValueList("MyControl", "MyProject");
    expect(result).toEqual(project);
  });

  test("retrieveValueList falls back to collection-scoped when project-scoped is undefined", async () => {
    const collection = { FieldsLists: [[{ Depend: "", Value: "collection" }]] };
    mockManager.getValue.mockImplementation((key: string) => {
      if (key === "MyControl") return Promise.resolve(collection);
      return Promise.resolve(undefined);
    });
    const result = await StorageService.retrieveValueList("MyControl", "MyProject");
    expect(result).toEqual(collection);
  });

  test("storeControlList calls setValue with pickerControl key", async () => {
    const list = [{ controlName: "test", projectName: "proj", fileName: "test.csv" }];
    await StorageService.storeControlList(list);
    expect(mockManager.setValue).toHaveBeenCalledWith("pickerControl", list);
  });

  test("retrieveControlList returns empty array when nothing stored", async () => {
    mockManager.getValue.mockResolvedValue(undefined);
    const result = await StorageService.retrieveControlList();
    expect(result).toEqual([]);
  });
});
