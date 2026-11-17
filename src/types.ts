export type PatientType = 'New' | 'Existing';
export type PatientCategory = PatientType;

export type PatientTypeFilter = 'all' | 'New' | 'Existing';

export type ActiveTab = 'records' | 'tca' | 'more';

export type AppointmentStatus = 'Scheduled' | 'Attended' | 'DNA' | 'Rescheduled' | 'Cancelled';

export interface TCAAppointment {
  id: string; // Unique appointment ID (e.g. apt_...)
  patientId: string;
  tcaDate: string; // ISO format: YYYY-MM-DD
  status: AppointmentStatus;
  notes?: string;
  plan?: string;
  bloodInvestigationDate?: string;
  bloodInvestigations: string[];
  bloodOther?: string;
  rescheduledToAppointmentId?: string;
  rescheduledFromAppointmentId?: string;
  attendedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type BloodCollectionStatus = 'Scheduled' | 'Attended' | 'DNA' | 'Rescheduled' | 'Cancelled';

export interface BloodCollectionAppointment {
  id: string; // e.g. bld_...
  patientId: string;
  scheduledDate: string; // ISO format: YYYY-MM-DD
  scheduledTime?: string; // e.g. "Before 8.30 am" or "08:00 AM"
  status: BloodCollectionStatus;
  actualCollectionDate?: string; // Recorded separately from scheduled date
  actualCollectionTime?: string; // e.g. "08:15 AM"
  bloodInvestigations: string[]; // Fixed keys from BLOOD_INVESTIGATION_OPTIONS
  bloodOther?: string;
  notes?: string;
  rescheduledReason?: string;
  rescheduledToId?: string;
  rescheduledFromId?: string;
  createdAt: string;
  updatedAt: string;
}

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

export type ProgramId = 'ARV' | 'MMT';

// ---- MMT (Methadone Maintenance Therapy) -------------------------------------
export type MMTDispensing = 'Daily' | 'Take-home';
export type MMTDoseStatus = 'Dispensed' | 'Missed' | 'Take-home';
export type UrineResult = 'Negative' | 'Positive' | 'Pending';

export interface MMTDoseChange {
  id: string;
  date: string; // YYYY-MM-DD
  doseMg: number;
  reason?: string;
}

export interface MMTDoseLogEntry {
  date: string; // YYYY-MM-DD, one entry per day
  status: MMTDoseStatus;
  doseMg?: number;
}

export interface MMTUrineTest {
  id: string;
  date: string; // YYYY-MM-DD
  result: UrineResult;
  substances?: string; // free text, e.g. which substances were positive
  notes?: string;
}

export interface MMTTakeHome {
  id: string;
  startDate: string; // YYYY-MM-DD
  days: number; // length of supply
  doseMg?: number;
  notes?: string;
}

export interface MMTReview {
  id: string;
  date: string; // YYYY-MM-DD
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MMTProfile {
  startDate?: string;
  currentDoseMg?: number;
  dispensing: MMTDispensing;
  doseHistory: MMTDoseChange[];
  doseLog: MMTDoseLogEntry[];
  urineTests: MMTUrineTest[];
  takeHomes: MMTTakeHome[];
  reviews: MMTReview[];
  notes?: string;
  updatedAt: string; // used to merge this block independently of the ARV side
}

export interface PatientRecord {
  id: string; // Unique Patient ID
  name: string;
  icNumber: string;
  phone?: string;
  patientType: PatientType; // Patient Category: 'New' | 'Existing'
  isActive?: boolean; // Active or Deactivated/Inactive (defaults to true)
  appointments?: TCAAppointment[]; // Complete TCA appointment history
  bloodCollections?: BloodCollectionAppointment[]; // Complete blood collection history
  programs?: ProgramId[]; // Programs this person is enrolled in (defaults to ['ARV'])
  mmt?: MMTProfile; // MMT enrolment data, present when programs includes 'MMT'
  deletedAt?: string; // Set when moved to Recently Deleted (ISO timestamp)
  purged?: boolean; // Deleted forever: details erased, only a blank marker kept so other devices delete too

  // Denormalized/helper fields pointing to current/next active appointment for list/search
  nextTca?: string; // ISO format: YYYY-MM-DD
  bloodInvestigationDate?: string; // Next scheduled blood collection date (ISO format: YYYY-MM-DD)
  currentBloodStatus?: BloodCollectionStatus; // Current blood collection status
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
  bulkImport(records: PatientRecord[], mode: 'merge' | 'replace'): Promise<{ count: number }>;
  clear(): Promise<void>;
}

// Google Drive Integration Types
export type GoogleDriveBackupStatus =
  | 'Not Connected'
  | 'Connected'
  | 'Backing Up'
  | 'Backup Successful'
  | 'Backup Failed';

export interface GoogleDriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

export interface GoogleDriveConfig {
  folderId: string;
  folderUrl: string;
  clientId?: string;
}

// Message Generator Types
export type MessageTemplateType =
  | 'blood_collection'
  | 'tca_reschedule'
  | 'tca_reminder'
  | 'missed_appointment'
  | 'general_followup'
  | 'custom';

export type MessageTone = 'polite' | 'friendly' | 'formal';

export interface MessageGeneratorInputs {
  templateType: MessageTemplateType;
  tone: MessageTone;
  patientName?: string;
  phone?: string;
  scheduledDate?: string;
  oldDate?: string;
  newDate?: string;
  time?: string;
  reason?: string;
  subject?: string;
  instructions?: string;
  customContent?: string;
  signature?: string;
}
