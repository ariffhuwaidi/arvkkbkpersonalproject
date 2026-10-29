import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Let's test full app bundle syntax and bracket balancing
const bundleCode = fs.readFileSync(path.join(rootDir, 'app.bundle.js'), 'utf-8');

console.log('--- Checking Syntax and Structure of app.bundle.js ---');
const ob = (bundleCode.match(/\{/g) || []).length;
const cb = (bundleCode.match(/\}/g) || []).length;
const op = (bundleCode.match(/\(/g) || []).length;
const cp = (bundleCode.match(/\)/g) || []).length;
const osq = (bundleCode.match(/\[/g) || []).length;
const csq = (bundleCode.match(/\]/g) || []).length;

if (ob !== cb) throw new Error(`Mismatched braces: ${ob} vs ${cb}`);
if (op !== cp) throw new Error(`Mismatched parens: ${op} vs ${cp}`);
if (osq !== csq) throw new Error(`Mismatched brackets: ${osq} vs ${csq}`);
console.log(`[PASS] Brackets & braces balanced: {} = ${ob}, () = ${op}, [] = ${osq}`);

// Verify all required features and conditions exist in bundle:
const checks = [
  { name: 'SortSheet reusable class', pattern: /class\s+SortSheet/ },
  { name: 'IndexedDBStorage class', pattern: /class\s+IndexedDBStorage/ },
  { name: 'ThemeManager class', pattern: /class\s+ThemeManager/ },
  { name: 'RecordModal class', pattern: /class\s+RecordModal/ },
  { name: 'DetailsModal class', pattern: /class\s+DetailsModal/ },
  { name: 'ConfirmSheet class', pattern: /class\s+ConfirmSheet/ },
  { name: 'DataModal class', pattern: /class\s+DataModal/ },
  { name: 'Demo Data generator', pattern: /function\s+generateDemoRecords/ },
  { name: 'Empty-last sorting logic', pattern: /if\s*\(!valA\)\s*return\s*1;\s*if\s*\(!valB\)\s*return\s*-1;/ },
  { name: 'Normalized IC / Phone search', pattern: /normalizeCode/ },
  { name: 'App bootstrap', pattern: /new\s+App\(\)/ }
];

for (const chk of checks) {
  if (!chk.pattern.test(bundleCode)) {
    throw new Error(`Missing required pattern in app.bundle.js: ${chk.name}`);
  }
  console.log(`[PASS] Verified: ${chk.name}`);
}

console.log('\n[PASS] All app bundle integrity checks verified successfully.');
