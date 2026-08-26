export interface FieldValues {
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
  headers?: string[];
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
  fieldRequired: boolean[];
  summarizeToPathRef?: string;
  repo?: string;
  viewOption?: string;
  autoBehavior?: string;
}

/** One column definition for the CSV builder */
export interface CsvColumnDef {
  header: string;
}
