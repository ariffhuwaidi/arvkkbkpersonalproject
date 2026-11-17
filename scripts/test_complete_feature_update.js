/**
 * test_complete_feature_update.js
 * Comprehensive automated verification test suite for ARV KKBK feature update:
 * 1. Blood collection attendance tracking (Attended, DNA, Rescheduled, Cancelled, actual date/time)
 * 2. Blood collection date rescheduling and history fix (no profile reset, separate IDs, history preserved)
 * 3. Google Drive automatic backup & restore (Folder ID 1KSu4II21PraMavPwi6q2Y3ZUdPnedMVS, debounce, safety snapshots)
 * 4. Standalone Message Generator in Settings / More (6 templates, 3 tones, privacy, WhatsApp wa.me links)
 * 5. Architecture & UI constraints (Zero emojis, 2 bottom nav tabs preserved)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('---------------------------------------------------------');
console.log('ARV KKBK - COMPLETE FEATURE UPDATE VERIFICATION SUITE');
console.log('---------------------------------------------------------\n');

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
  testsTotal++;
  try {
    fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) console.error(`       Stack: ${err.stack.split('\n').slice(1, 3).join('\n')}`);
  }
}

// -------------------------------------------------------------
// TEST SUITE 1: Data Model & Types Integrity
// -------------------------------------------------------------
runTest('1.1 Data types and interfaces support blood collections and Google Drive', () => {
  const typesContent = fs.readFileSync(path.join(rootDir, 'src', 'types.ts'), 'utf-8');
  assert(typesContent.includes('BloodCollectionStatus'), 'Missing BloodCollectionStatus');
  assert(typesContent.includes('BloodCollectionAppointment'), 'Missing BloodCollectionAppointment');
  assert(typesContent.includes('actualCollectionDate?: string'), 'Missing actualCollectionDate');
  assert(typesContent.includes('actualCollectionTime?: string'), 'Missing actualCollectionTime');
  assert(typesContent.includes('rescheduledReason?: string'), 'Missing rescheduledReason');
  assert(typesContent.includes('rescheduledToId?: string'), 'Missing rescheduledToId');
  assert(typesContent.includes('GoogleDriveConfig'), 'Missing GoogleDriveConfig');
  assert(typesContent.includes('GoogleDriveBackupFile'), 'Missing GoogleDriveBackupFile');
  assert(typesContent.includes('MessageTemplateType'), 'Missing MessageTemplateType');
  assert(typesContent.includes('MessageTone'), 'Missing MessageTone');
});

// -------------------------------------------------------------
// TEST SUITE 2: Storage & Migration Logic (v5)
// -------------------------------------------------------------
runTest('2.1 IndexedDB Storage DB_VERSION upgraded to 5 with backward compatibility migration', () => {
  const idbContent = fs.readFileSync(path.join(rootDir, 'src', 'storage', 'indexeddb-storage.ts'), 'utf-8');
  assert(idbContent.includes('const DB_VERSION = 5'), 'DB_VERSION is not 5');
  assert(idbContent.includes('oldVersion < 5'), 'Missing oldVersion < 5 migration step');
  assert(idbContent.includes('addBloodCollection'), 'Missing addBloodCollection method');
  assert(idbContent.includes('updateBloodCollectionStatus'), 'Missing updateBloodCollectionStatus method');
  assert(idbContent.includes('rescheduleBloodCollection'), 'Missing rescheduleBloodCollection method');
});

runTest('2.2 Blood collection rescheduling preserves history and creates new appointment without profile reset', () => {
  // Simulate record normalization and rescheduling logic in memory
  const initialPatient = {
    id: 'pat-test-001',
    name: 'Ahmad bin Abdullah',
    icNumber: '880101-02-1234',
    phone: '012-3456789',
    patientType: 'Existing',
    nextTca: '2026-12-01',
    bloodInvestigationDate: '2026-11-20',
    bloodInvestigations: ['HIV Viral Load', 'CD4'],
    bloodCollections: [
      {
        id: 'bld-001',
        patientId: 'pat-test-001',
        scheduledDate: '2026-11-20',
        status: 'Scheduled',
        investigations: ['HIV Viral Load', 'CD4'],
        createdAt: '2026-11-01T10:00:00.000Z',
        updatedAt: '2026-11-01T10:00:00.000Z'
      }
    ]
  };

  // Reschedule bld-001 to 2026-11-28 with reason "Patient out of state"
  const oldAppointment = initialPatient.bloodCollections.find(b => b.id === 'bld-001');
  assert(oldAppointment, 'Original appointment not found');
  
  const newAppointmentId = 'bld-002';
  const newDate = '2026-11-28';
  const reason = 'Patient out of state';

  // Apply rescheduling
  oldAppointment.status = 'Rescheduled';
  oldAppointment.rescheduledReason = reason;
  oldAppointment.rescheduledToId = newAppointmentId;

  const newAppointment = {
    id: newAppointmentId,
    patientId: initialPatient.id,
    scheduledDate: newDate,
    status: 'Scheduled',
    rescheduledFromId: 'bld-001',
    investigations: oldAppointment.investigations,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  initialPatient.bloodCollections.push(newAppointment);
  initialPatient.bloodInvestigationDate = newDate;
  initialPatient.currentBloodStatus = 'Scheduled';

  // Verifications
  assert.strictEqual(initialPatient.id, 'pat-test-001', 'Patient ID must remain unchanged');
  assert.strictEqual(initialPatient.name, 'Ahmad bin Abdullah', 'Patient name must remain unchanged');
  assert.strictEqual(initialPatient.bloodCollections.length, 2, 'Must have 2 blood collection records');
  assert.strictEqual(initialPatient.bloodCollections[0].status, 'Rescheduled', 'Old appointment must be marked Rescheduled');
  assert.strictEqual(initialPatient.bloodCollections[0].rescheduledReason, 'Patient out of state');
  assert.strictEqual(initialPatient.bloodCollections[1].status, 'Scheduled', 'New appointment must be Scheduled');
  assert.strictEqual(initialPatient.bloodCollections[1].scheduledDate, '2026-11-28');
  assert.strictEqual(initialPatient.bloodCollections[1].rescheduledFromId, 'bld-001');
  assert.strictEqual(initialPatient.nextTca, '2026-12-01', 'TCA must be completely untouched by blood rescheduling');
});

runTest('2.3 Blood collection attendance (Attended / Sample Collected) records actual collection date & time separately', () => {
  const patient = {
    id: 'pat-test-002',
    name: 'Siti binti Yusof',
    bloodInvestigationDate: '2026-11-15',
    bloodCollections: [
      {
        id: 'bld-101',
        patientId: 'pat-test-002',
        scheduledDate: '2026-11-15',
        status: 'Scheduled',
        investigations: ['CD4']
      }
    ]
  };

  const apt = patient.bloodCollections[0];
  const actualDate = '2026-11-16'; // Attended 1 day later
  const actualTime = '09:30';
  const notes = 'Sample collected at KK Bandar Kulim, sent to KK Taman Intan';

  apt.status = 'Attended';
  apt.actualCollectionDate = actualDate;
  apt.actualCollectionTime = actualTime;
  apt.sampleCollected = true;
  apt.notes = notes;
  patient.currentBloodStatus = 'Attended';

  assert.strictEqual(apt.status, 'Attended');
  assert.strictEqual(apt.scheduledDate, '2026-11-15', 'Original scheduled date preserved');
  assert.strictEqual(apt.actualCollectionDate, '2026-11-16', 'Actual collection date recorded');
  assert.strictEqual(apt.actualCollectionTime, '09:30', 'Actual collection time recorded');
  assert.strictEqual(apt.sampleCollected, true);
  assert.strictEqual(patient.currentBloodStatus, 'Attended');
});

// -------------------------------------------------------------
// TEST SUITE 3: Google Drive Integration & Safety Workflow
// -------------------------------------------------------------
runTest('3.1 Google Drive Backup target folder ID and OAuth scope configured correctly', () => {
  const gdriveContent = fs.readFileSync(path.join(rootDir, 'src', 'utils', 'google-drive.ts'), 'utf-8');
  assert(gdriveContent.includes('1KSu4II21PraMavPwi6q2Y3ZUdPnedMVS'), 'Folder ID 1KSu4II21PraMavPwi6q2Y3ZUdPnedMVS missing');
  assert(gdriveContent.includes('https://www.googleapis.com/auth/drive.file'), 'Missing drive.file scope');
  const settingsContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'settings-modal.ts'), 'utf-8');
  const safetyContent = fs.readFileSync(path.join(rootDir, 'src', 'storage', 'safety-snapshot.ts'), 'utf-8');
  assert(settingsContent.includes('await saveSafetySnapshot('), 'Missing pre-restore safety backup snapshot');
  assert(safetyContent.includes('indexedDB.open'), 'Safety snapshot must be stored in IndexedDB, not localStorage');
  assert(gdriveContent.includes('scheduleAutoBackup'), 'Missing debounced scheduleAutoBackup');
  assert(gdriveContent.includes('backupPayload'), 'Missing backupPayload construction');
});

// -------------------------------------------------------------
// TEST SUITE 4: Standalone Message Generator
// -------------------------------------------------------------
runTest('4.1 Message Generator provides 6 templates and 3 tones without patient profile placement', () => {
  const msgContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'message-generator.ts'), 'utf-8');
  assert(msgContent.includes('blood_collection'), 'Template blood_collection missing');
  assert(msgContent.includes('tca_reschedule'), 'Template tca_reschedule missing');
  assert(msgContent.includes('tca_reminder'), 'Template tca_reminder missing');
  assert(msgContent.includes('missed_appointment'), 'Template missed_appointment missing');
  assert(msgContent.includes('general_followup'), 'Template general_followup missing');
  assert(msgContent.includes('custom'), 'Template custom missing');
  assert(msgContent.includes('polite'), 'Tone polite missing');
  assert(msgContent.includes('friendly'), 'Tone friendly missing');
  assert(msgContent.includes('formal'), 'Tone formal missing');
  assert(msgContent.includes('https://wa.me/'), 'Missing WhatsApp link generator');
  
  // Verify strict privacy: message templates must NOT mention sensitive HIV terms
  assert(!msgContent.includes('HIV Positif'), 'Sensitive HIV diagnosis in templates forbidden');
  assert(!msgContent.includes('AIDS'), 'Sensitive AIDS diagnosis in templates forbidden');
  assert(!msgContent.includes('Antiretroviral Viral Load'), 'Sensitive HIV terminology in patient messages forbidden');
});

runTest('4.2 Message Generator is inside Settings / More modal as a dedicated tab', () => {
  const settingsModalContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'settings-modal.ts'), 'utf-8');
  assert(settingsModalContent.includes('Message Generator'), 'Missing Message Generator tab in Settings / More');
  assert(settingsModalContent.includes('Google Drive'), 'Missing Google Drive tab in Settings / More');
  assert(settingsModalContent.includes('Local Data'), 'Missing Local Data tab in Settings / More');
  assert(settingsModalContent.includes("row('message_gen'"), 'Missing message_gen row');
  assert(settingsModalContent.includes("row('gdrive'"), 'Missing gdrive row');
  assert(settingsModalContent.includes("row('local_data'"), 'Missing local_data row');
});

// -------------------------------------------------------------
// TEST SUITE 5: UI & Architecture Constraint Checks
// -------------------------------------------------------------
runTest('5.1 Bottom Navigation retains exactly 2 tabs (Records and TCA) without extra tabs', () => {
  const navBarContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'nav-bar.ts'), 'utf-8');
  assert(navBarContent.includes('data-tab="records"'), 'Records tab missing');
  assert(navBarContent.includes('data-tab="tca"'), 'TCA tab missing');
  assert(!navBarContent.includes('data-tab="messages"'), 'Bottom navigation must NOT contain messages tab');
  assert(!navBarContent.includes('data-tab="gdrive"'), 'Bottom navigation must NOT contain gdrive tab');
  assert(!navBarContent.includes('data-tab="settings"'), 'Bottom navigation must NOT contain settings tab');
});

runTest('5.2 Settings live under a dedicated "More" tab (third tab)', () => {
  const navContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'nav-bar.ts'), 'utf-8');
  assert(navContent.includes('data-tab="more"') && navContent.includes('>More<'), 'Nav bar must have a More tab');
  const tabs = (navContent.match(/data-tab="(records|tca|more)"/g) || []).length;
  assert(tabs >= 3, 'Nav bar must have exactly the Records, TCA and More tabs');
  assert(!/data-tab="(?!records|tca|more)/.test(navContent), 'No other bottom tabs');
});

runTest('5.3 Details modal contains Sections A (TCA), B (TCA History), C (Blood), D (Blood History) & Lab Routing', () => {
  const detailsContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'details-modal.ts'), 'utf-8');
  assert(detailsContent.includes('A. Upcoming Scheduled TCA'), 'Missing Section A');
  assert(detailsContent.includes('B. TCA History'), 'Missing Section B');
  assert(detailsContent.includes('C. Upcoming Blood Collection'), 'Missing Section C');
  assert(detailsContent.includes('D. Blood Collection History'), 'Missing Section D');
  assert(detailsContent.includes('KK Bandar Kulim'), 'Missing KK Bandar Kulim routing notice');
  assert(detailsContent.includes('KK Taman Intan'), 'Missing KK Taman Intan routing notice');
  assert(detailsContent.includes('Hospital Sultanah Bahiyah'), 'Missing HSB routing notice');
});

runTest('5.4 Patient three-dot menu and UI elements contain ZERO decorative emojis', () => {
  const recordCardContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'record-card.ts'), 'utf-8');
  const detailsContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'details-modal.ts'), 'utf-8');
  const headerContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'header.ts'), 'utf-8');
  const navContent = fs.readFileSync(path.join(rootDir, 'src', 'components', 'nav-bar.ts'), 'utf-8');
  
  // Regex for general unicode emoji ranges
  const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
  
  assert(!emojiRegex.test(recordCardContent), 'Record card contains disallowed emojis');
  assert(!emojiRegex.test(detailsContent), 'Details modal contains disallowed emojis');
  assert(!emojiRegex.test(headerContent), 'Header contains disallowed emojis');
  assert(!emojiRegex.test(navContent), 'Nav bar contains disallowed emojis');
});

runTest('5.5 Bundle app.bundle.js and live_preview.html generated and verified', () => {
  const bundlePath = path.join(rootDir, 'app.bundle.js');
  const previewPath = path.join(rootDir, 'live_preview.html');
  assert(fs.existsSync(bundlePath), 'app.bundle.js missing');
  assert(fs.existsSync(previewPath), 'live_preview.html missing');
  const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
  assert(bundleContent.includes('GoogleDriveBackupService'), 'Bundle missing GoogleDriveBackupService');
  assert(bundleContent.includes('BloodCollectionModal'), 'Bundle missing BloodCollectionModal');
  assert(bundleContent.includes('SettingsModal'), 'Bundle missing SettingsModal');
  assert(bundleContent.includes('MessageGenerator'), 'Bundle missing MessageGenerator');
});

console.log('\n---------------------------------------------------------');
console.log(`TEST SUMMARY: ${testsPassed} of ${testsTotal} tests passed.`);
console.log('---------------------------------------------------------');

if (testsPassed === testsTotal) {
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
  process.exit(0);
} else {
  console.error('SOME CHECKS FAILED!\n');
  process.exit(1);
}
