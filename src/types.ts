export type PatientType = 'New' | 'Existing';

export type PatientTypeFilter = 'all' | 'New' | 'Existing';

export type ActiveTab = 'records' | 'tca';

export const BLOOD_INVESTIGATION_OPTIONS = [
  'VL',
  'CD4',
  'FBC',
  'FBS',
  'HbA1c',
  'LFT',
  'AST',
  'RP',
  'FLP',
  'Other'
] as const;

export type BloodInvestigationOption = typeof BLOOD_INVESTIGATION_OPTIONS[number];

export interface PatientRecord {
  id: string;
  name: string;
  icNumber: string;
  phone?: string;
  patientType: PatientType;
  nextTca?: string; // ISO format: YYYY-MM-DD
  bloodInvestigationDate?: string; // ISO format: YYYY-MM-DD
  bloodInvestigations: string[]; // Fixed keys from BLOOD_INVESTIGATION_OPTIONS
  bloodOther?: string; // Specified text if 'Other' is ticked
  plan?: string; // Optional multi-line free text
  createdAt: string;
  updatedAt: string;
}

export type SortField =
  | 'tca_asc'
  | 'tca_desc'
  | 'blood_asc'
  | 'blood_desc'
  | 'investigations_asc'
  | 'plan_asc'
  | 'name_asc'
  | 'name_desc'
  | 'ic_asc'
  | 'phone_asc';

export interface SortOptionDefinition {
  id: SortField;
  label: string;
  shortLabel: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type TCAStatusType = 'overdue' | 'upcoming' | 'later' | 'none';

export interface TCAStatus {
  type: TCAStatusType;
  label: string;
  daysDiff?: number;
  formattedDate?: string; // DD/MM/YYYY
}

export type TCAGroupKey = 'overdue' | 'this_week' | 'this_month' | 'later' | 'no_tca';

export interface TCAGroupDefinition {
  key: TCAGroupKey;
  title: string;
  records: PatientRecord[];
}

export interface IRecordStorage {
  list(): Promise<PatientRecord[]>;
  get(id: string): Promise<PatientRecord | null>;
  save(record: Omit<PatientRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }): Promise<PatientRecord>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
  bulkImport(records: PatientRecord[], mode: 'merge' | 'replace'): Promise<{ count: number }>;
}

export {};
