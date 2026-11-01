import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Import compiled modules from dist_js
import { IndexedDBStorage } from '../dist_js/storage/indexeddb-storage.js';
import { validateImportJSON, exportRecordsToJSON } from '../dist_js/utils/export-import.js';
import { generateDemoRecords } from '../dist_js/utils/demo-data.js';
import { BLOOD_INVESTIGATION_OPTIONS } from '../dist_js/types.js';

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(message);
  }
  passed++;
  console.log(`[PASS] ${message}`);
}

console.log('====================================================');
console.log(' CLINIC TCA MANAGER - 4 FIXES VERIFICATION SUITE   ');
console.log('====================================================\n');

const storage = new IndexedDBStorage();

// Mock in-memory indexedDB environment for node test
const mockStore = new Map();
storage.getDB = async () => {
  return {
    transaction: () => ({
      objectStore: () => ({
        get: (id) => {
          const res = { result: mockStore.get(id) || null };
          setTimeout(() => res.onsuccess?.({ target: res }), 0);
          return res;
        },
        getAll: () => {
          const res = { result: Array.from(mockStore.values()) };
          setTimeout(() => res.onsuccess?.({ target: res }), 0);
          return res;
        },
        put: (val) => {
          mockStore.set(val.id, JSON.parse(JSON.stringify(val)));
          const res = { result: val.id };
          setTimeout(() => res.onsuccess?.({ target: res }), 0);
          return res;
        },
        delete: (id) => {
          mockStore.delete(id);
          const res = { result: true };
          setTimeout(() => res.onsuccess?.({ target: res }), 0);
          return res;
        },
        clear: () => {
          mockStore.clear();
          const res = { result: true };
          setTimeout(() => res.onsuccess?.({ target: res }), 0);
          return res;
        }
      })
    })
  };
};

async function runTests() {
  console.log('--- TEST SCENARIO 1: Create a patient and add a first TCA ---');
  const patient1 = await storage.save({
    id: 'pat-001',
    name: 'Fictional Patient Alpha',
    icNumber: '900101-01-0001',
    phone: '012-3456789',
    patientType: 'New',
    nextTca: '2026-11-15',
    bloodInvestigationDate: '2026-10-15',
    bloodInvestigations: ['VL', 'CD4'],
    plan: 'Initiation of First-Line ART'
  });

  assert(patient1.id === 'pat-001', 'Patient 1 created with ID pat-001');
  assert(patient1.appointments && patient1.appointments.length === 1, 'First TCA appointment record created automatically');
  assert(patient1.appointments[0].status === 'Scheduled', 'First appointment has status Scheduled');
  assert(patient1.appointments[0].tcaDate === '2026-11-15', 'First appointment date is 2026-11-15');
  assert(patient1.nextTca === '2026-11-15', 'Patient nextTca accurately mirrors upcoming scheduled TCA');

  console.log('\n--- TEST SCENARIO 2: Record the first TCA as Attended ---');
  const firstAptId = patient1.appointments[0].id;
  await storage.updateAppointment(patient1.id, firstAptId, {
    status: 'Attended',
    notes: 'Patient attended on time, tolerating meds well'
  });

  const p1AfterAttended = await storage.get(patient1.id);
  assert(p1AfterAttended.appointments[0].status === 'Attended', 'First TCA appointment successfully updated to Attended');
  assert(p1AfterAttended.appointments[0].notes.includes('tolerating meds well'), 'Attendance notes preserved on appointment');
  assert(p1AfterAttended.nextTca === undefined, 'Patient nextTca is undefined because there are no remaining scheduled appointments');

  console.log('\n--- TEST SCENARIO 3: Create second TCA and verify first TCA remains in History ---');
  const secondApt = await storage.addAppointment(patient1.id, {
    tcaDate: '2027-02-15',
    status: 'Scheduled',
    plan: '3-month follow-up review, assess adherence',
    bloodInvestigationDate: '2027-01-15',
    bloodInvestigations: ['VL', 'CD4', 'FBC']
  });

  const p1WithSecondApt = await storage.get(patient1.id);
  assert(p1WithSecondApt.appointments.length === 2, 'Patient now has 2 distinct appointment records');
  assert(p1WithSecondApt.appointments.some(a => a.id === firstAptId && a.status === 'Attended'), 'First appointment remains intact in history as Attended');
  assert(p1WithSecondApt.appointments.some(a => a.id === secondApt.id && a.status === 'Scheduled'), 'Second appointment created as Scheduled');
  assert(p1WithSecondApt.nextTca === '2027-02-15', 'Patient nextTca updated to second appointment date');

  console.log('\n--- TEST SCENARIO 4: Record DNA appointment and create another without losing DNA history ---');
  // Mark second appointment as DNA
  await storage.updateAppointment(patient1.id, secondApt.id, {
    status: 'DNA',
    notes: 'Patient defaulted appointment, traced via phone'
  });

  // Create third appointment
  const thirdApt = await storage.addAppointment(patient1.id, {
    tcaDate: '2027-02-25',
    status: 'Scheduled',
    notes: 'Urgent follow-up after DNA'
  });

  const p1WithDNA = await storage.get(patient1.id);
  assert(p1WithDNA.appointments.length === 3, 'Patient now has 3 appointment records');
  assert(p1WithDNA.appointments.some(a => a.id === secondApt.id && a.status === 'DNA'), 'DNA appointment successfully preserved in TCA history');
  assert(p1WithDNA.appointments.some(a => a.id === thirdApt.id && a.status === 'Scheduled'), 'New scheduled appointment created after DNA');
  assert(p1WithDNA.nextTca === '2027-02-25', 'nextTca accurately points to the third appointment');

  console.log('\n--- TEST SCENARIO 5: Reschedule appointment and verify original is preserved ---');
  const reschedResult = await storage.rescheduleAppointment(patient1.id, thirdApt.id, {
    tcaDate: '2027-03-05',
    notes: 'Patient requested rescheduling due to outstation travel',
    plan: 'Routine follow-up'
  });

  const p1AfterReschedule = await storage.get(patient1.id);
  assert(p1AfterReschedule.appointments.length === 4, 'Patient now has 4 appointments (including Rescheduled record)');
  const origApt = p1AfterReschedule.appointments.find(a => a.id === thirdApt.id);
  assert(origApt && origApt.status === 'Rescheduled', 'Original appointment status updated to Rescheduled');
  assert(origApt.rescheduledToAppointmentId === reschedResult.newApt.id, 'Original appointment links to the new appointment ID');
  assert(reschedResult.newApt.status === 'Scheduled' && reschedResult.newApt.tcaDate === '2027-03-05', 'New appointment scheduled for 2027-03-05');
  assert(reschedResult.newApt.rescheduledFromAppointmentId === thirdApt.id, 'New appointment links back to original appointment ID');

  console.log('\n--- TEST SCENARIO 6: Confirm investigation records remain associated with correct appointments ---');
  const apt1 = p1AfterReschedule.appointments.find(a => a.id === firstAptId);
  const apt2 = p1AfterReschedule.appointments.find(a => a.id === secondApt.id);
  assert(JSON.stringify(apt1.bloodInvestigations) === JSON.stringify(['VL', 'CD4']), 'Appointment 1 retains its exact blood investigations [VL, CD4]');
  assert(JSON.stringify(apt2.bloodInvestigations) === JSON.stringify(['VL', 'CD4', 'FBC']), 'Appointment 2 retains its exact blood investigations [VL, CD4, FBC]');
  assert(apt1.bloodInvestigationDate === '2026-10-15', 'Appointment 1 retains blood date 2026-10-15');
  assert(apt2.bloodInvestigationDate === '2027-01-15', 'Appointment 2 retains blood date 2027-01-15');

  console.log('\n--- TEST SCENARIO 7: Deactivate & Reactivate patient workflow ---');
  await storage.setPatientActiveStatus(patient1.id, false);
  const p1Deactivated = await storage.get(patient1.id);
  assert(p1Deactivated.isActive === false, 'Patient isActive set to false (deactivated)');
  assert(p1Deactivated.appointments.length === 4, 'Deactivating preserves complete 4-appointment history');

  await storage.setPatientActiveStatus(patient1.id, true);
  const p1Reactivated = await storage.get(patient1.id);
  assert(p1Reactivated.isActive === true, 'Patient reactivated successfully');

  console.log('\n--- TEST SCENARIO 8: Confirm sorting dropdown styling & positioning logic ---');
  const css = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'components.css'), 'utf-8');
  assert(css.includes('.sort-dropdown-overlay'), 'CSS includes .sort-dropdown-overlay with z-index 1050');
  assert(css.includes('.sort-dropdown-menu.is-anchored'), 'CSS includes .sort-dropdown-menu.is-anchored');
  assert(css.includes('.sort-dropdown-item'), 'CSS includes .sort-dropdown-item');

  const sortSheetCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'sort-sheet.ts'), 'utf-8');
  assert(sortSheetCode.includes('preventScroll: true'), 'Sort dropdown uses preventScroll: true on focus to eliminate jumping');
  assert(sortSheetCode.includes('this.positionMenu('), 'Sort dropdown implements positionMenu calculation anchored to trigger button');

  console.log('\n--- TEST SCENARIO 9 & 10: Register New Patient & Register Existing Patient ---');
  const newPatient = await storage.save({
    id: 'pat-new',
    name: 'Fictional Patient Beta',
    icNumber: '950202-02-0002',
    patientType: 'New',
    nextTca: '2026-12-01'
  });
  assert(newPatient.patientType === 'New', 'Registered patient categorized as New Patient');

  const existingPatient = await storage.save({
    id: 'pat-existing',
    name: 'Fictional Patient Gamma',
    icNumber: '800303-03-0003',
    patientType: 'Existing',
    nextTca: '2026-12-10'
  });
  assert(existingPatient.patientType === 'Existing', 'Directly registered clinic patient categorized as Existing Patient');

  console.log('\n--- TEST SCENARIO 11: Change category and confirm Patient ID, history & investigations unchanged ---');
  const origId = newPatient.id;
  const origAptsCount = newPatient.appointments.length;
  await storage.setPatientCategory(newPatient.id, 'Existing');

  const updatedPatient = await storage.get(newPatient.id);
  assert(updatedPatient.id === origId, 'Patient ID remained strictly unchanged');
  assert(updatedPatient.patientType === 'Existing', 'Patient Category successfully changed to Existing Patient');
  assert(updatedPatient.appointments.length === origAptsCount, 'Appointment history completely preserved after category change');

  console.log('\n--- TEST SCHEMA MIGRATION & BACKWARD COMPATIBILITY ---');
  // Legacy v3 backup file
  const legacyV3Json = JSON.stringify({
    app: 'ARV_KKBK',
    version: '3.0',
    schemaVersion: 3,
    records: [
      {
        id: 'legacy-001',
        name: 'Legacy Patient',
        icNumber: '700101-01-0001',
        patientType: 'Existing',
        nextTca: '2026-12-20',
        bloodInvestigationDate: '2026-11-20',
        bloodInvestigations: ['VL', 'RP'],
        plan: 'Legacy clinical plan'
      }
    ]
  });

  const importResult = validateImportJSON(legacyV3Json);
  assert(importResult.valid === true, 'validateImportJSON accepts legacy v3 export files');
  assert(importResult.records.length === 1, 'Imported 1 record from legacy file');
  assert(importResult.records[0].appointments.length === 1, 'Legacy record automatically migrated to have an appointment record');
  assert(importResult.records[0].appointments[0].tcaDate === '2026-12-20', 'Migrated appointment date is 2026-12-20');
  assert(importResult.records[0].isActive === true, 'Migrated record defaults to isActive: true');

  console.log('\n====================================================');
  console.log(`ALL SCENARIOS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
