import { BLOOD_INVESTIGATION_OPTIONS } from '../types';
import type { PatientRecord, PatientType, TCAAppointment, AppointmentStatus, ProgramId } from '../types';
import { encryptJSON } from './crypto';

export const CURRENT_SCHEMA_VERSION = 6;

export type ExportScope = 'all' | ProgramId;

export interface ExportDataPayload {
  app: 'ARV_KKBK';
  version: '6.0';
  schemaVersion: 6;
  exportedAt: string;
  scope: ExportScope;
  totalRecords: number;
  records: PatientRecord[];
}

/** Which records belong in an export of the given scope. Deleted records are never exported by scope. */
export function selectRecordsForScope(records: PatientRecord[], scope: ExportScope): PatientRecord[] {
  if (scope === 'all') return records;
  return records.filter(r => !r.deletedAt && (r.programs && r.programs.length ? r.programs : ['ARV']).includes(scope));
}

/**
 * A scoped export carries only that program's data. A person enrolled in both
 * programs appears in an ARV-only file without their MMT block, and vice versa.
 */
export function stripToScope(record: PatientRecord, scope: ExportScope): PatientRecord {
  if (scope === 'all') return record;
  const copy: PatientRecord = { ...record, programs: [scope] };
  if (scope === 'ARV') delete copy.mmt;
  if (scope === 'MMT') {
    delete copy.appointments;
    delete copy.bloodCollections;
    delete copy.nextTca;
    delete copy.bloodInvestigationDate;
    delete copy.currentBloodStatus;
    delete copy.plan;
    delete copy.bloodOther;
    copy.bloodInvestigations = [];
  }
  return copy;
}

export function buildExportPayload(records: PatientRecord[], scope: ExportScope = 'all'): ExportDataPayload {
  const chosen = selectRecordsForScope(records, scope).map(r => stripToScope(r, scope));
  return {
    app: 'ARV_KKBK',
    version: '6.0',
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
    scope,
    totalRecords: chosen.length,
    records: chosen
  };
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Downloads records as JSON. With a passphrase the file is encrypted (.arvenc.json);
 * without one it is readable plain JSON, so callers should warn first.
 */
export async function exportRecordsToJSON(
  records: PatientRecord[],
  options: { scope?: ExportScope; passphrase?: string } = {}
): Promise<number> {
  const scope = options.scope ?? 'all';
  const payload = buildExportPayload(records, scope);
  const dateTag = new Date().toISOString().slice(0, 10);
  const scopeTag = scope === 'all' ? '' : `_${scope.toLowerCase()}`;

  if (options.passphrase) {
    const envelope = await encryptJSON(payload, options.passphrase);
    downloadText(`arv_kkbk${scopeTag}_backup_${dateTag}.arvenc.json`, JSON.stringify(envelope));
  } else {
    downloadText(`arv_kkbk${scopeTag}_backup_${dateTag}.json`, JSON.stringify(payload, null, 2));
  }
  return payload.totalRecords;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  records?: PatientRecord[];
  schemaVersion?: number;
}

const ALLOWED_SET = new Set<string>(BLOOD_INVESTIGATION_OPTIONS);
const ALLOWED_STATUSES = new Set<AppointmentStatus>(['Scheduled', 'Attended', 'DNA', 'Rescheduled', 'Cancelled']);

/**
 * Validates an imported JSON string or parsed object against ARV KKBK schema.
 * Safely migrates schema version 1, 2, and 3 records to schema 4.
 */
export function validateImportJSON(raw: unknown): ValidationResult {
  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { valid: false, error: 'The selected file is not a valid JSON document.' };
    }
  } else {
    parsed = raw;
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid JSON root structure.' };
  }

  let recordList: unknown[];
  let schemaVer = 1;

  if (Array.isArray(parsed)) {
    recordList = parsed;
  } else if ('records' in parsed && Array.isArray((parsed as { records: unknown[] }).records)) {
    recordList = (parsed as { records: unknown[] }).records;
    if ('schemaVersion' in parsed && typeof (parsed as { schemaVersion: unknown }).schemaVersion === 'number') {
      schemaVer = (parsed as { schemaVersion: number }).schemaVersion;
    }
  } else {
    return { valid: false, error: 'File missing "records" array. Please use an export generated from ARV KKBK.' };
  }

  const validRecords: PatientRecord[] = [];
  for (let i = 0; i < recordList.length; i++) {
    const item = recordList[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Record at index ${i + 1} is invalid.` };
    }
    const r = item as Record<string, unknown>;

    // Name and IC are strictly required
    if (typeof r.name !== 'string' || !r.name.trim()) {
      return { valid: false, error: `Record ${i + 1} is missing a required Name.` };
    }
    if (typeof r.icNumber !== 'string' || !r.icNumber.trim()) {
      return { valid: false, error: `Record "${r.name}" is missing a required IC number.` };
    }

    // Patient type / category: 'New' or 'Existing', defaults to 'Existing'
    let patientType: PatientType = 'Existing';
    if (r.patientType === 'New' || r.patientType === 'Existing') {
      patientType = r.patientType;
    }

    const isActive = r.isActive !== undefined ? Boolean(r.isActive) : true;
    const recordId = typeof r.id === 'string' && r.id ? r.id : `imp_${Date.now()}_${i}`;

    // Migration for Plan: if legacy bloodInvestigationsPlan is present and plan is missing, migrate text
    let plan: string | undefined = undefined;
    if (typeof r.plan === 'string' && r.plan.trim()) {
      plan = r.plan.trim();
    } else if (typeof r.bloodInvestigationsPlan === 'string' && r.bloodInvestigationsPlan.trim()) {
      plan = r.bloodInvestigationsPlan.trim();
    }

    // Blood investigations validation
    const investigations: string[] = [];
    if (Array.isArray(r.bloodInvestigations)) {
      for (const inv of r.bloodInvestigations) {
        if (typeof inv === 'string' && ALLOWED_SET.has(inv)) {
          investigations.push(inv);
        } else {
          console.warn(`Ignoring unrecognized blood investigation option: "${inv}"`);
        }
      }
    }

    let bloodOther: string | undefined = undefined;
    if (investigations.includes('Other') && typeof r.bloodOther === 'string' && r.bloodOther.trim()) {
      bloodOther = r.bloodOther.trim();
    }

    const now = new Date().toISOString();
    const createdAt = typeof r.createdAt === 'string' ? r.createdAt : now;
    const updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : now;

    // Validate or synthesize appointments array
    let appointments: TCAAppointment[] = [];
    if (Array.isArray(r.appointments) && r.appointments.length > 0) {
      for (let aIdx = 0; aIdx < r.appointments.length; aIdx++) {
        const aptRaw = r.appointments[aIdx] as Record<string, unknown>;
        if (!aptRaw || typeof aptRaw !== 'object') continue;

        const aptInvs: string[] = [];
        if (Array.isArray(aptRaw.bloodInvestigations)) {
          for (const inv of aptRaw.bloodInvestigations) {
            if (typeof inv === 'string' && ALLOWED_SET.has(inv)) {
              aptInvs.push(inv);
            }
          }
        }

        const aptOther = aptInvs.includes('Other') && typeof aptRaw.bloodOther === 'string' && aptRaw.bloodOther.trim()
          ? aptRaw.bloodOther.trim()
          : undefined;

        let status: AppointmentStatus = 'Scheduled';
        if (typeof aptRaw.status === 'string' && ALLOWED_STATUSES.has(aptRaw.status as AppointmentStatus)) {
          status = aptRaw.status as AppointmentStatus;
        }

        appointments.push({
          id: typeof aptRaw.id === 'string' && aptRaw.id ? aptRaw.id : `apt_imp_${Date.now()}_${aIdx}`,
          patientId: recordId,
          tcaDate: typeof aptRaw.tcaDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(aptRaw.tcaDate.trim()) ? aptRaw.tcaDate.trim() : (typeof r.nextTca === 'string' ? r.nextTca : now.slice(0, 10)),
          status,
          notes: typeof aptRaw.notes === 'string' && aptRaw.notes.trim() ? aptRaw.notes.trim() : undefined,
          plan: typeof aptRaw.plan === 'string' && aptRaw.plan.trim() ? aptRaw.plan.trim() : undefined,
          bloodInvestigationDate: typeof aptRaw.bloodInvestigationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(aptRaw.bloodInvestigationDate.trim()) ? aptRaw.bloodInvestigationDate.trim() : undefined,
          bloodInvestigations: aptInvs,
          bloodOther: aptOther,
          rescheduledToAppointmentId: typeof aptRaw.rescheduledToAppointmentId === 'string' ? aptRaw.rescheduledToAppointmentId : undefined,
          rescheduledFromAppointmentId: typeof aptRaw.rescheduledFromAppointmentId === 'string' ? aptRaw.rescheduledFromAppointmentId : undefined,
          attendedAt: typeof aptRaw.attendedAt === 'string' ? aptRaw.attendedAt : undefined,
          createdAt: typeof aptRaw.createdAt === 'string' ? aptRaw.createdAt : createdAt,
          updatedAt: typeof aptRaw.updatedAt === 'string' ? aptRaw.updatedAt : updatedAt
        });
      }
    } else if (typeof r.nextTca === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.nextTca.trim())) {
      // Migrating from older backup files with single nextTca
      appointments.push({
        id: `apt_migrated_${recordId}`,
        patientId: recordId,
        tcaDate: r.nextTca.trim(),
        status: 'Scheduled',
        notes: 'Migrated from backup record',
        plan,
        bloodInvestigationDate: typeof r.bloodInvestigationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.bloodInvestigationDate.trim()) ? r.bloodInvestigationDate.trim() : undefined,
        bloodInvestigations: investigations,
        bloodOther,
        createdAt,
        updatedAt
      });
    }

    validRecords.push({
      id: recordId,
      name: r.name.trim(),
      icNumber: r.icNumber.trim(),
      phone: typeof r.phone === 'string' && r.phone.trim() ? r.phone.trim() : undefined,
      patientType,
      isActive,
      appointments,
      nextTca: typeof r.nextTca === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.nextTca.trim()) ? r.nextTca.trim() : undefined,
      bloodInvestigationDate: typeof r.bloodInvestigationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.bloodInvestigationDate.trim()) ? r.bloodInvestigationDate.trim() : undefined,
      bloodInvestigations: investigations,
      bloodOther,
      plan,
      createdAt,
      updatedAt,
      ...extraFields(r)
    });
  }

  return {
    valid: true,
    records: validRecords,
    schemaVersion: schemaVer
  };
}

/**
 * Fields the validator does not rebuild itself but that must survive an import:
 * blood collection history, programs, the MMT block and deleted markers.
 * Storage normalises them again when saving.
 */
function extraFields(r: Record<string, unknown>): Partial<PatientRecord> {
  const extra: Partial<PatientRecord> = {};
  if (Array.isArray(r.bloodCollections)) {
    extra.bloodCollections = r.bloodCollections as PatientRecord['bloodCollections'];
  }
  if (typeof r.currentBloodStatus === 'string') {
    extra.currentBloodStatus = r.currentBloodStatus as PatientRecord['currentBloodStatus'];
  }
  const programs = Array.isArray(r.programs)
    ? (r.programs.filter(p => p === 'ARV' || p === 'MMT') as ProgramId[])
    : [];
  extra.programs = programs.length ? Array.from(new Set(programs)) : ['ARV'];
  if (r.mmt && typeof r.mmt === 'object') {
    extra.mmt = r.mmt as PatientRecord['mmt'];
  }
  if (typeof r.deletedAt === 'string' && r.deletedAt) {
    extra.deletedAt = r.deletedAt;
  }
  return extra;
}
