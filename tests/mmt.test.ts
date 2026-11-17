import { describe, expect, it } from 'vitest';
import * as m from '../src/utils/mmt';
import { IndexedDBStorage } from '../src/storage/indexeddb-storage';
import { validateImportJSON } from '../src/utils/export-import';
import { rec } from './helpers';

const prof = (over = {}) => m.newMMTProfile({ startDate: '2026-11-01', ...over }, '2026-11-01T00:00:00Z');
const mmtRec = (mmt: any, extra = {}) => rec({ id: 'a', programs: ['MMT'], mmt, isActive: true, ...extra });

describe('MMT dates and programs', () => {
  it('date helpers', () => {
    expect(m.addDays('2026-02-27', 3)).toBe('2026-03-02');
    expect(m.daysBetween('2026-11-01', '2026-11-10')).toBe(9);
  });
  it('programs default to ARV and allow both', () => {
    expect(m.programsOf(rec({ programs: undefined }))).toEqual(['ARV']);
    expect(m.inProgram(rec({ programs: ['ARV', 'MMT'] }), 'MMT')).toBe(true);
  });
});

describe('doses and missed days', () => {
  it('counts missed days, not counting today', () => {
    const p = prof({ doseLog: [{ date: '2026-11-10', status: 'Dispensed' }] });
    expect(m.doseStatusOn(p, '2026-11-10')).toBe('Dispensed');
    expect(m.doseStatusOn(p, '2026-11-11')).toBeNull();
    expect(m.missedDays(p, '2026-11-11')).toBe(0);
    expect(m.missedDays(p, '2026-11-12')).toBe(1);
    expect(m.missedDays(p, '2026-11-14')).toBe(3);
  });
  it('take-home supply covers its days', () => {
    const p = prof({ doseLog: [{ date: '2026-11-01', status: 'Dispensed' }], takeHomes: [{ id: 't', startDate: '2026-11-05', days: 3 }] });
    expect(m.doseStatusOn(p, '2026-11-06')).toBe('Take-home');
    expect(m.lastCoveredDate(p)).toBe('2026-11-07');
    expect(m.missedDays(p, '2026-11-09')).toBe(1);
  });
  it('a logged Missed beats a take-home', () => {
    const p = prof({ takeHomes: [{ id: 't', startDate: '2026-11-05', days: 3 }], doseLog: [{ date: '2026-11-06', status: 'Missed' }] });
    expect(m.doseStatusOn(p, '2026-11-06')).toBe('Missed');
  });
  it('never dispensed counts from the start date', () => {
    expect(m.missedDays(prof({ startDate: '2026-11-10' }), '2026-11-14')).toBe(4);
  });
});

describe('urine tests, reviews and follow-up', () => {
  it('urine is due after the interval or when never tested', () => {
    const p = prof({ urineTests: [{ id: 'u1', date: '2026-10-01', result: 'Negative' }, { id: 'u2', date: '2026-11-01', result: 'Positive' }] });
    expect(m.latestUrine(p)!.id).toBe('u2');
    expect(m.urineDue(p, '2026-11-20')).toBe(false);
    expect(m.urineDue(p, '2026-12-05')).toBe(true);
    expect(m.urineDue(prof(), '2026-11-20')).toBe(true);
  });
  it('lists patients who need follow-up', () => {
    const p = prof({ doseLog: [{ date: '2026-11-14', status: 'Dispensed' }], reviews: [{ id: 'r1', date: '2026-11-20', status: 'Scheduled' }, { id: 'r0', date: '2026-10-01', status: 'Attended' }] });
    expect(m.nextReview(p)!.id).toBe('r1');
    expect(m.followUpReasons(mmtRec(p), '2026-11-15')).toEqual([]);
    expect(m.followUpReasons(mmtRec(p), '2026-11-21')).toEqual(['missed', 'review_overdue']);
    expect(m.followUpReasons(mmtRec(p, { isActive: false }), '2026-11-21')).toEqual([]);
    expect(m.followUpReasons(mmtRec(p, { programs: ['ARV'] }), '2026-11-21')).toEqual([]);
    expect(m.reviewGroup(mmtRec(p), '2026-11-15')).toBe('this_week');
  });
});

describe('cleaning MMT data from outside (imports, Drive, sync)', () => {
  const evil = '"><img src=x onerror=alert(1)>';
  const dirty = {
    startDate: evil, currentDoseMg: evil, dispensing: evil,
    doseHistory: [{ id: evil, date: '2026-11-01', doseMg: 60, reason: 'ok' }, { id: 'h2', date: evil, doseMg: 50 }],
    doseLog: [{ date: '2026-11-02', status: evil }, { date: evil, status: 'Dispensed' }, { date: '2026-11-03', status: 'Missed', doseMg: '70' }],
    urineTests: [{ id: 'u1', date: '2026-11-01', result: evil, substances: 'thc' }],
    takeHomes: [{ id: 't1', startDate: '2026-11-04', days: evil }, { id: 't2', startDate: '2026-11-05', days: 3, doseMg: 60 }],
    reviews: [{ id: 'r1', date: '2026-11-20', status: evil, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' }],
    notes: 'free text stays (escaped on display)',
    updatedAt: '2026-11-10T00:00:00.000Z'
  };
  const masked = (x: any) => ({ ...x, doseHistory: x.doseHistory.map((h: any) => ({ ...h, id: 'X' })) });

  it('keeps only valid values', () => {
    const c = m.sanitizeMMT(dirty)!;
    expect(c.startDate).toBeUndefined();
    expect(c.currentDoseMg).toBeUndefined();
    expect(c.dispensing).toBe('Daily');
    expect(c.doseHistory.map(h => h.date)).toEqual(['2026-11-01']);
    expect(c.doseHistory[0].id).toMatch(/^[\w-]+$/);
    expect(c.doseLog).toEqual([{ date: '2026-11-03', status: 'Missed', doseMg: 70 }]);
    expect(c.urineTests[0].result).toBe('Pending');
    expect(c.takeHomes.map(t => t.id)).toEqual(['t2']);
    expect(c.reviews[0].status).toBe('Scheduled');
    expect(c.updatedAt).toBe('2026-11-10T00:00:00.000Z');
    expect(m.sanitizeMMT('nope')).toBeUndefined();
  });

  it('runs on import and in storage', () => {
    const clean = masked(m.sanitizeMMT(dirty));
    const imported = validateImportJSON({ schemaVersion: 6, records: [{ id: 'p1', name: 'A', icNumber: '1', programs: ['MMT'], mmt: dirty }] });
    expect(masked(imported.records![0].mmt)).toEqual(clean);
    expect(masked(new IndexedDBStorage().normalizeRecord({ id: 'p1', name: 'A', icNumber: '1', mmt: dirty }).mmt)).toEqual(clean);
  });
});
