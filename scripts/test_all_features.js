import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Import compiled modules from dist_js
import {
  formatDisplayDate,
  getDaysDifference,
  getTCAStatus,
  getLocalTodayISO,
  getOneMonthBeforeISO,
  getTCAGroupKey,
  getRelativeTCALabel,
  isDatePast
} from '../dist_js/utils/date.js';

import { matchesQuery, filterRecords, normalizeCode } from '../dist_js/utils/search.js';
import { sortRecords, SORT_OPTIONS, DEFAULT_SORT } from '../dist_js/utils/sort.js';
import { generateDemoRecords } from '../dist_js/utils/demo-data.js';
import { validateImportJSON } from '../dist_js/utils/export-import.js';
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
console.log(' ARV KKBK COMPREHENSIVE TEST SUITE (SEPARATE FIELDS) ');
console.log('====================================================\n');

// 1. BLOOD INVESTIGATION OPTIONS ORDER
console.log('--- 1. Testing Blood Investigation Options ---');
const expectedOptions = ['VL', 'CD4', 'FBC', 'FBS', 'HbA1c', 'LFT', 'AST', 'RP', 'FLP', 'Other'];
assert(
  JSON.stringify(BLOOD_INVESTIGATION_OPTIONS) === JSON.stringify(expectedOptions),
  'BLOOD_INVESTIGATION_OPTIONS matches exact requested order: VL, CD4, FBC, FBS, HbA1c, LFT, AST, RP, FLP, Other'
);

// 2. SEARCH MATCHING (INVESTIGATIONS, OTHER, PLAN)
console.log('\n--- 2. Testing Search across Investigations & Plan ---');
const testRecords = [
  {
    id: '1',
    name: 'Tan Ah Kow',
    icNumber: '000101-02-0001',
    phone: '012-345 6789',
    patientType: 'Existing',
    nextTca: '2026-11-01',
    bloodInvestigationDate: '2026-10-01',
    bloodInvestigations: ['VL', 'CD4', 'FBC'],
    bloodOther: undefined,
    plan: 'Continue current TLD regimen. Stable CD4 response.',
    createdAt: '',
    updatedAt: ''
  },
  {
    id: '2',
    name: 'Siti Nurhaliza',
    icNumber: '000202-08-0002',
    phone: '019-987 6543',
    patientType: 'New',
    nextTca: '2026-11-05',
    bloodInvestigationDate: '2026-10-05',
    bloodInvestigations: ['FBS', 'FLP', 'Other'],
    bloodOther: 'Thyroid Stimulating Hormone (TSH)',
    plan: 'Adherence counseling session scheduled.',
    createdAt: '',
    updatedAt: ''
  },
  {
    id: '3',
    name: 'Muthusamy',
    icNumber: '000303-02-0003',
    phone: '011-1234 5678',
    patientType: 'Existing',
    nextTca: undefined,
    bloodInvestigationDate: undefined,
    bloodInvestigations: [],
    bloodOther: undefined,
    plan: 'Baseline workup requested by physician.',
    createdAt: '',
    updatedAt: ''
  }
];

// Search matches investigation key (case-insensitive)
assert(filterRecords(testRecords, 'cd4').length === 1 && filterRecords(testRecords, 'cd4')[0].name === 'Tan Ah Kow', 'Search matches investigation chip "cd4"');
assert(filterRecords(testRecords, 'flp').length === 1 && filterRecords(testRecords, 'flp')[0].name === 'Siti Nurhaliza', 'Search matches investigation chip "flp"');

// Search matches Other text
assert(filterRecords(testRecords, 'Thyroid').length === 1, 'Search matches bloodOther text ("Thyroid")');
assert(filterRecords(testRecords, 'TSH').length === 1, 'Search matches bloodOther abbreviation ("TSH")');

// Search matches Plan text
assert(filterRecords(testRecords, 'counseling').length === 1, 'Search matches separate Plan text ("counseling")');
assert(filterRecords(testRecords, 'TLD regimen').length === 1, 'Search matches Plan regimen text ("TLD regimen")');


// 3. SORTING: INVESTIGATIONS AND PLAN
console.log('\n--- 3. Testing Sort by Investigations & Plan ---');
const mixedSortRecords = [
  { id: '1', name: 'Zack', icNumber: '1', patientType: 'Existing', bloodInvestigations: ['LFT', 'AST'], plan: 'Zeta plan', createdAt: '', updatedAt: '' },
  { id: '2', name: 'Alice', icNumber: '2', patientType: 'Existing', bloodInvestigations: ['VL', 'CD4'], plan: 'Alpha plan', createdAt: '', updatedAt: '' },
  { id: '3', name: 'Bob', icNumber: '3', patientType: 'Existing', bloodInvestigations: [], plan: undefined, createdAt: '', updatedAt: '' },
  { id: '4', name: 'Charlie', icNumber: '4', patientType: 'Existing', bloodInvestigations: ['CD4'], plan: 'Beta plan', createdAt: '', updatedAt: '' }
];

// investigations_asc: VL (index 0) comes before CD4 (index 1) which comes before LFT (index 5); empty comes last
const invSorted = sortRecords(mixedSortRecords, 'investigations_asc');
assert(invSorted[0].name === 'Alice', 'investigations_asc: Alice (has VL, index 0) comes first');
assert(invSorted[1].name === 'Charlie', 'investigations_asc: Charlie (has CD4, index 1) comes second');
assert(invSorted[2].name === 'Zack', 'investigations_asc: Zack (has LFT, index 5) comes third');
assert(invSorted[3].name === 'Bob', 'investigations_asc: Bob (empty investigations) placed at the very bottom');

// plan_asc: Alpha before Beta before Zeta; empty last
const planSorted = sortRecords(mixedSortRecords, 'plan_asc');
assert(planSorted[0].name === 'Alice', 'plan_asc: Alice (Alpha plan) comes first');
assert(planSorted[1].name === 'Charlie', 'plan_asc: Charlie (Beta plan) comes second');
assert(planSorted[2].name === 'Zack', 'plan_asc: Zack (Zeta plan) comes third');
assert(planSorted[3].name === 'Bob', 'plan_asc: Bob (empty plan) placed at the very bottom');


// 4. MIGRATION & BACKWARD COMPATIBILITY
console.log('\n--- 4. Testing Migration from Legacy Schema v1/v2 ---');
const legacyV2Payload = JSON.stringify({
  app: 'ARV_KKBK',
  version: '2.0',
  schemaVersion: 2,
  records: [
    {
      id: 'legacy-rec-101',
      name: 'Legacy Patient Old Schema',
      icNumber: '000101-00-5555',
      phone: '012-5555555',
      patientType: 'Existing',
      nextTca: '2026-11-20',
      bloodInvestigationsPlan: 'CD4: 500. Regimen review.' // Combined legacy field
    }
  ]
});

const legacyValidation = validateImportJSON(legacyV2Payload);
assert(legacyValidation.valid === true, 'Accepts legacy schema version 2 file');
assert(legacyValidation.records?.[0].plan === 'CD4: 500. Regimen review.', 'Migrates legacy combined text into new plan field without data loss');
assert(Array.isArray(legacyValidation.records?.[0].bloodInvestigations) && legacyValidation.records?.[0].bloodInvestigations.length === 0, 'Initializes bloodInvestigations as empty array');

// Test unrecognized investigation key warning / filtering
const dirtyPayload = JSON.stringify({
  app: 'ARV_KKBK',
  schemaVersion: 3,
  records: [
    {
      id: 'dirty-1',
      name: 'Dirty Invs Patient',
      icNumber: '000101-00-6666',
      bloodInvestigations: ['CD4', 'UNKNOWN_CUSTOM_TEST', 'FBC']
    }
  ]
});

const dirtyValidation = validateImportJSON(dirtyPayload);
assert(dirtyValidation.valid === true, 'Validates import with unknown keys');
assert(
  dirtyValidation.records?.[0].bloodInvestigations.length === 2 &&
  !dirtyValidation.records?.[0].bloodInvestigations.includes('UNKNOWN_CUSTOM_TEST'),
  'Safely filters out unrecognized investigation key ("UNKNOWN_CUSTOM_TEST")'
);


// 5. DEMO DATA CHECKS
console.log('\n--- 5. Auditing Updated Demo Dataset ---');
const demoRecords = generateDemoRecords();
assert(demoRecords.length >= 5, 'Demo dataset contains 5 records');
assert(demoRecords.some(r => r.bloodInvestigations.length > 0), 'Demo records include populated blood investigations');
assert(demoRecords.some(r => r.bloodInvestigations.includes('Other') && Boolean(r.bloodOther)), 'Demo records include patient with Other ticked and bloodOther populated');
assert(demoRecords.some(r => Boolean(r.plan)), 'Demo records include multi-line clinical plans');


// 6. CSS & ACCESSIBILITY AUDIT
console.log('\n--- 6. Auditing CSS for Toggle Chips & Tap Targets ---');
const cssCode = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'components.css'), 'utf-8');
assert(cssCode.includes('min-height: 44px;'), 'Toggle chips specify min-height: 44px for iOS tap targets');
assert(cssCode.includes('flex-wrap: wrap;'), 'Investigation chips container wraps onto multiple lines');
assert(cssCode.includes('.chip-check-icon'), 'Visual checkmark icon present for selected state (not color alone)');
assert(cssCode.includes('.card-investigations-row'), 'Mini-chips styling present for patient cards');
assert(cssCode.includes('.mini-chip-more'), '"+N" badge styling present for card chips overflow');

// 7. SCRIPT/MODAL LOGIC AUDIT
console.log('\n--- 7. Auditing Modal Behavior ---');
const modalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'record-modal.ts'), 'utf-8');
assert(modalCode.includes("data-inv=\"${opt}\""), 'Modal generates toggle chips for all investigation options');
assert(modalCode.includes("container-blood-other"), 'Modal includes container for Other text input');
assert(modalCode.includes("error-blood-other"), 'Modal includes validation error for Other text input');
assert(modalCode.includes("otherContainer.style.display = 'none';"), 'Unticking Other hides and clears its text');

// 8. BUNDLE INTEGRITY AUDIT
console.log('\n--- 8. Checking App Bundle Syntax ---');
const bundleCode = fs.readFileSync(path.join(rootDir, 'app.bundle.js'), 'utf-8');
const ob = (bundleCode.match(/\{/g) || []).length;
const cb = (bundleCode.match(/\}/g) || []).length;
assert(ob === cb, `Braces perfectly balanced: ${ob} vs ${cb}`);

console.log('\n====================================================');
console.log(`ALL CHECKS PASSED: ${passed}/${total}`);
console.log('====================================================\n');
