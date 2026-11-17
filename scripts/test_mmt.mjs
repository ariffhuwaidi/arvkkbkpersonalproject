import assert from 'node:assert/strict';
const m = await import(new URL('../src/utils/mmt.ts', import.meta.url).href);
let n = 0; const ok = (name) => { n++; console.log('  pass', name); };
const prof = (over = {}) => m.newMMTProfile({ startDate: '2026-11-01', ...over }, '2026-11-01T00:00:00Z');
const rec = (mmt, extra = {}) => ({ id: 'a', name: 'A', icNumber: '1', programs: ['MMT'], mmt, isActive: true, ...extra });

// dates
assert.equal(m.addDays('2026-02-27', 3), '2026-03-02'); ok('addDays across month');
assert.equal(m.daysBetween('2026-11-01', '2026-11-10'), 9); ok('daysBetween');

// programs
assert.deepEqual(m.programsOf({ programs: undefined }), ['ARV']); ok('default program is ARV');
assert.ok(m.inProgram({ programs: ['ARV', 'MMT'] }, 'MMT')); ok('dual enrolment');

// dose status and missed days
let p = prof({ doseLog: [{ date: '2026-11-10', status: 'Dispensed' }] });
assert.equal(m.doseStatusOn(p, '2026-11-10'), 'Dispensed'); ok('logged dose');
assert.equal(m.doseStatusOn(p, '2026-11-11'), null); ok('nothing yet today');
assert.equal(m.missedDays(p, '2026-11-11'), 0); ok('today not counted as missed');
assert.equal(m.missedDays(p, '2026-11-12'), 1); ok('one missed day');
assert.equal(m.missedDays(p, '2026-11-14'), 3); ok('three missed days');

// take-home covers days and counts as covered
p = prof({ doseLog: [{ date: '2026-11-01', status: 'Dispensed' }], takeHomes: [{ id: 't', startDate: '2026-11-05', days: 3 }] });
assert.equal(m.doseStatusOn(p, '2026-11-06'), 'Take-home'); ok('take-home day');
assert.equal(m.lastCoveredDate(p), '2026-11-07'); ok('take-home extends coverage');
assert.equal(m.missedDays(p, '2026-11-09'), 1); ok('missed after supply ends');

// logged Missed overrides take-home
p = prof({ takeHomes: [{ id: 't', startDate: '2026-11-05', days: 3 }], doseLog: [{ date: '2026-11-06', status: 'Missed' }] });
assert.equal(m.doseStatusOn(p, '2026-11-06'), 'Missed'); ok('logged entry beats take-home');

// never dispensed: counts from start date
p = prof({ startDate: '2026-11-10' });
assert.equal(m.missedDays(p, '2026-11-14'), 4); ok('never dispensed counts from start');

// urine
p = prof({ urineTests: [{ id: 'u1', date: '2026-10-01', result: 'Negative' }, { id: 'u2', date: '2026-11-01', result: 'Positive' }] });
assert.equal(m.latestUrine(p).id, 'u2'); ok('latest urine');
assert.equal(m.urineDue(p, '2026-11-20'), false); ok('urine not due inside 30 days');
assert.equal(m.urineDue(p, '2026-12-05'), true); ok('urine due after 30 days');
assert.equal(m.urineDue(prof(), '2026-11-20'), true); ok('urine due when never tested');

// reviews and follow-up
p = prof({ doseLog: [{ date: '2026-11-14', status: 'Dispensed' }], reviews: [{ id: 'r1', date: '2026-11-20', status: 'Scheduled' }, { id: 'r0', date: '2026-10-01', status: 'Attended' }] });
assert.equal(m.nextReview(p).id, 'r1'); ok('next review ignores completed');
assert.deepEqual(m.followUpReasons(rec(p), '2026-11-15'), []); ok('no follow-up when fine');
assert.deepEqual(m.followUpReasons(rec(p), '2026-11-21'), ['missed', 'review_overdue']); ok('missed and overdue review');
assert.deepEqual(m.followUpReasons(rec(p, { isActive: false }), '2026-11-21'), []); ok('inactive patients are not chased');
assert.deepEqual(m.followUpReasons(rec(p, { programs: ['ARV'] }), '2026-11-21'), []); ok('ARV-only never in MMT follow-up');
assert.equal(m.reviewGroup(rec(p), '2026-11-15'), 'this_week'); ok('group this week');
assert.equal(m.reviewGroup(rec(prof({ doseLog: [{ date: '2026-11-14', status: 'Dispensed' }], reviews: [{ id: 'r', date: '2026-12-30', status: 'Scheduled' }] })), '2026-11-15'), 'later'); ok('group later');
assert.equal(m.reviewGroup(rec(prof({ doseLog: [{ date: '2026-11-14', status: 'Dispensed' }] })), '2026-11-15'), 'none'); ok('group none');

console.log(`${n} checks passed`);
