import { BLOOD_INVESTIGATION_OPTIONS } from '../types.js';
/**
 * Creates a downloadable JSON file of current records.
 */
export function exportRecordsToJSON(records                 )       {
  const payload                    = {
    app: 'ARV_KKBK',
    version: '3.0',
    schemaVersion: 3,
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

/**
 * Validates an imported JSON string or parsed object against ARV KKBK schema.
 * Safely migrates schema version 1 and 2 records.
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

    // Patient type: 'New' or 'Existing', defaults to 'Existing' for older files
    let patientType              = 'Existing';
    if (r.patientType === 'New' || r.patientType === 'Existing') {
      patientType = r.patientType;
    }

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
    validRecords.push({
      id: typeof r.id === 'string' && r.id ? r.id : `imp_${Date.now()}_${i}`,
      name: r.name.trim(),
      icNumber: r.icNumber.trim(),
      phone: typeof r.phone === 'string' && r.phone.trim() ? r.phone.trim() : undefined,
      patientType,
      nextTca: typeof r.nextTca === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.nextTca.trim()) ? r.nextTca.trim() : undefined,
      bloodInvestigationDate: typeof r.bloodInvestigationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.bloodInvestigationDate.trim()) ? r.bloodInvestigationDate.trim() : undefined,
      bloodInvestigations: investigations,
      bloodOther,
      plan,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now
    });
  }

  return {
    valid: true,
    records: validRecords,
    schemaVersion: schemaVer
  };
}
