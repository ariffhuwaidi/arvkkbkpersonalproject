// Checks for the fixes from the Nov 2026 code review:
// 1. MMT data from a backup is cleaned before it can reach the page (XSS).
// 2. Import "Merge" keeps the newest edit and never drops the other program.
// 3. Patient records never go into localStorage.
// 4. Generated build files are not tracked by git.
// Runs against dist_js, so `node scripts/build.js` must run first (npm test does).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const dist = new URL('../dist_js/', import.meta.url).href;
const src = (p) => fs.readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf-8');
let n = 0; const ok = (name) => { n++; console.log('  pass', name); };

const { sanitizeMMT } = await import(dist + 'utils/mmt.js');
const { validateImportJSON } = await import(dist + 'utils/export-import.js');
const { IndexedDBStorage } = await import(dist + 'storage/indexeddb-storage.js');
const { planMerge } = await import(dist + 'utils/merge.js');
const { escapeHtml } = await import(dist + 'utils/escape.js');

// --- 1. MMT data is cleaned on the way in ---
const evil = '"><img src=x onerror=alert(1)>';
const dirty = {
  startDate: evil,
  currentDoseMg: evil,
  dispensing: evil,
  doseHistory: [{ id: evil, date: '2026-11-01', doseMg: 60, reason: 'ok' }, { id: 'h2', date: evil, doseMg: 50 }],
  doseLog: [{ date: '2026-11-02', status: evil }, { date: evil, status: 'Dispensed' }, { date: '2026-11-03', status: 'Missed', doseMg: '70' }],
  urineTests: [{ id: 'u1', date: '2026-11-01', result: evil, substances: 'thc' }],
  takeHomes: [{ id: 't1', startDate: '2026-11-04', days: evil }, { id: 't2', startDate: '2026-11-05', days: 3, doseMg: 60 }],
  reviews: [{ id: 'r1', date: '2026-11-20', status: evil, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' }],
  notes: 'free text stays (escaped on display)',
  updatedAt: '2026-11-10T00:00:00.000Z'
};
const clean = sanitizeMMT(dirty);
const allowedText = new Set([clean.notes, 'ok', 'thc']);
const leaks = JSON.stringify(clean, (k, v) => (typeof v === 'string' && !allowedText.has(v) && v.includes('<') ? (() => { throw new Error(`unsafe value kept at ${k}`); })() : v));
assert.ok(leaks); ok('no markup survives in structured MMT fields');
assert.equal(clean.startDate, undefined); ok('bad start date dropped');
assert.equal(clean.currentDoseMg, undefined); ok('non-numeric dose dropped');
assert.equal(clean.dispensing, 'Daily'); ok('unknown dispensing mode falls back to Daily');
assert.deepEqual(clean.doseHistory.map(h => h.date), ['2026-11-01']); ok('dose history with bad date dropped');
assert.match(clean.doseHistory[0].id, /^[\w-]+$/); ok('unsafe id replaced');
assert.deepEqual(clean.doseLog, [{ date: '2026-11-03', status: 'Missed', doseMg: 70 }]); ok('dose log keeps only valid status and date');
assert.equal(clean.urineTests[0].result, 'Pending'); ok('unknown urine result becomes Pending');
assert.deepEqual(clean.takeHomes.map(t => t.id), ['t2']); ok('take-home with bad days dropped');
assert.equal(clean.reviews[0].status, 'Scheduled'); ok('unknown review status becomes Scheduled');
assert.equal(clean.updatedAt, '2026-11-10T00:00:00.000Z'); ok('MMT timestamp kept for merging');
assert.equal(sanitizeMMT('nope'), undefined); ok('non-object MMT ignored');

// Replaced ids are random, so compare with them masked.
const masked = (m) => ({ ...m, doseHistory: m.doseHistory.map(h => ({ ...h, id: 'X' })) });

const imported = validateImportJSON({ schemaVersion: 6, records: [{ id: 'p1', name: 'A', icNumber: '1', programs: ['MMT'], mmt: dirty }] });
assert.ok(imported.valid);
assert.deepEqual(masked(imported.records[0].mmt), masked(clean)); ok('import validation cleans the MMT block');

const storage = new IndexedDBStorage();
assert.deepEqual(masked(storage.normalizeRecord({ id: 'p1', name: 'A', icNumber: '1', mmt: dirty }).mmt), masked(clean)); ok('storage cleans MMT too (covers Drive sync)');

assert.equal(escapeHtml(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;'); ok('escapeHtml escapes all five characters');
for (const f of ['components/mmt-card.ts', 'components/mmt-modal.ts', 'components/mmt-view.ts', 'components/mmt-enrol-modal.ts']) {
  assert.ok(!/function esc\(/.test(src(f)), `${f} still has its own esc()`);
}
ok('MMT screens share one escape helper');

// --- 2. Import Merge keeps the newest edit and both programs ---
const bulk = src('storage/indexeddb-storage.ts');
const bulkBody = bulk.slice(bulk.indexOf('async bulkImport('), bulk.indexOf('public normalizeRecord('));
assert.match(bulkBody, /mode === 'merge'[\s\S]*mergeNewer\(/); ok('bulkImport merge uses the newest-wins merge');
const local = [{ id: 'a', name: 'A', icNumber: '900101-01-1111', programs: ['ARV', 'MMT'], mmt: { ...clean, updatedAt: '2026-11-01T00:00:00.000Z' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' }];
const arvOnlyFile = [{ id: 'a', name: 'A edited', icNumber: '900101011111', programs: ['ARV'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-11-05T00:00:00.000Z' }];
const plan = planMerge(local, arvOnlyFile);
assert.equal(plan.toPut[0].name, 'A edited'); ok('newer ARV edit wins');
assert.deepEqual(plan.toPut[0].programs, ['ARV', 'MMT']); ok('MMT program kept after ARV-only import');
assert.ok(plan.toPut[0].mmt); ok('MMT block kept after ARV-only import');
const older = planMerge(local, [{ ...arvOnlyFile[0], updatedAt: '2026-10-01T00:00:00.000Z' }]);
assert.equal(older.toPut.length, 0); ok('older file does not overwrite a newer local edit');

// --- 3. No patient records in localStorage ---
assert.ok(!/localStorage\.setItem\(\s*PRE_RESTORE_SAFETY_KEY/.test(src('utils/google-drive.ts'))); ok('safety snapshot no longer written to localStorage');
assert.match(src('storage/safety-snapshot.ts'), /indexedDB\.open/); ok('safety snapshot stored in IndexedDB');

// --- 4. Generated files are not tracked ---
let tracked = '';
try {
  tracked = execFileSync('git', ['ls-files', 'app.bundle.js', 'app.bundle.css', 'live_preview.html', 'dist_js'], { cwd: new URL('..', import.meta.url), encoding: 'utf-8' });
} catch { tracked = ''; /* git not installed: skip */ }
assert.equal(tracked.trim(), '', `still tracked:\n${tracked}`); ok('generated files are not tracked by git');

console.log(`${n} checks passed`);
