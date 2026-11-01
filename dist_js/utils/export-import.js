import { BLOOD_INVESTIGATION_OPTIONS } from '../types.js';
/**
 * Creates a downloadable JSON file of current records with appointment history.
 */
export function exportRecordsToJSON(records                 )       {
  const payload                    = {
    app: 'ARV_KKBK',
    version: '4.0',
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    totalRecords: records.length,
    records
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateTag = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `arv_kkbk_backup_${dateTag}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

                                   
                 
                 
                            
                         
 

const ALLOWED_SET = new Set        (BLOOD_INVESTIGATION_OPTIONS);
const ALLOWED_STATUSES = new Set                   (['Scheduled', 'Attended', 'DNA', 'Rescheduled', 'Cancelled']);

/**
 * Validates an imported JSON string or parsed object against ARV KKBK schema.
 * Safely migrates schema version 1, 2, and 3 records to schema 4.
 */
export function validateImportJSON(rawText        )                   {
  let parsed         ;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { valid: false, error: 'The selected file is not a valid JSON document.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid JSON root structure.' };
  }

  let recordList           ;
  let schemaVer = 1;

  if (Array.isArray(parsed)) {
    recordList = parsed;
  } else if ('records' in parsed && Array.isArray((parsed                          ).records)) {
    recordList = (parsed                          ).records;
    if ('schemaVersion' in parsed && typeof (parsed                              ).schemaVersion === 'number') {
      schemaVer = (parsed                             ).schemaVersion;
    }
  } else {
    return { valid: false, error: 'File missing "records" array. Please use an export generated from ARV KKBK.' };
  }

  const validRecords                  = [];
  for (let i = 0; i < recordList.length; i++) {
    const item = recordList[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Record at index ${i + 1} is invalid.` };
    }
    const r = item                           ;

    // Name and IC are strictly required
    if (typeof r.name !== 'string' || !r.name.trim()) {
      return { valid: false, error: `Record ${i + 1} is missing a required Name.` };
    }
    if (typeof r.icNumber !== 'string' || !r.icNumber.trim()) {
      return { valid: false, error: `Record "${r.name}" is missing a required IC number.` };
    }

    // Patient type / category: 'New' or 'Existing', defaults to 'Existing'
    let patientType              = 'Existing';
    if (r.patientType === 'New' || r.patientType === 'Existing') {
      patientType = r.patientType;
    }

    const isActive = r.isActive !== undefined ? Boolean(r.isActive) : true;
    const recordId = typeof r.id === 'string' && r.id ? r.id : `imp_${Date.now()}_${i}`;

    // Migration for Plan: if legacy bloodInvestigationsPlan is present and plan is missing, migrate text
    let plan                     = undefined;
    if (typeof r.plan === 'string' && r.plan.trim()) {
      plan = r.plan.trim();
    } else if (typeof r.bloodInvestigationsPlan === 'string' && r.bloodInvestigationsPlan.trim()) {
      plan = r.bloodInvestigationsPlan.trim();
    }

    // Blood investigations validation
    const investigations           = [];
    if (Array.isArray(r.bloodInvestigations)) {
      for (const inv of r.bloodInvestigations) {
        if (typeof inv === 'string' && ALLOWED_SET.has(inv)) {
          investigations.push(inv);
        } else {
          console.warn(`Ignoring unrecognized blood investigation option: "${inv}"`);
        }
      }
    }

    let bloodOther                     = undefined;
    if (investigations.includes('Other') && typeof r.bloodOther === 'string' && r.bloodOther.trim()) {
      bloodOther = r.bloodOther.trim();
    }

    const now = new Date().toISOString();
    const createdAt = typeof r.createdAt === 'string' ? r.createdAt : now;
    const updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : now;

    // Validate or synthesize appointments array
    let appointments                   = [];
    if (Array.isArray(r.appointments) && r.appointments.length > 0) {
      for (let aIdx = 0; aIdx < r.appointments.length; aIdx++) {
        const aptRaw = r.appointments[aIdx]                           ;
        if (!aptRaw || typeof aptRaw !== 'object') continue;

        const aptInvs           = [];
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

        let status                    = 'Scheduled';
        if (typeof aptRaw.status === 'string' && ALLOWED_STATUSES.has(aptRaw.status                     )) {
          status = aptRaw.status                     ;
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
      updatedAt
    });
  }

  return {
    valid: true,
    records: validRecords,
    schemaVersion: schemaVer
  };
}
