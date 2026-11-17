import { describe, expect, it } from 'vitest';
import { BLOOD_INVESTIGATION_OPTIONS } from '../src/types';
import { filterRecords } from '../src/utils/search';
import { sortRecords } from '../src/utils/sort';
import { generateDemoRecords } from '../src/utils/demo-data';
import { validateImportJSON } from '../src/utils/export-import';
import { rec } from './helpers';

describe('blood investigation options', () => {
  it('keep the clinic order', () => {
    expect([...BLOOD_INVESTIGATION_OPTIONS]).toEqual(['VL', 'CD4', 'FBC', 'FBS', 'HbA1c', 'LFT', 'AST', 'RP', 'FLP', 'Other']);
  });
});

describe('search', () => {
  const records = [
    rec({ id: '1', name: 'Tan Ah Kow', icNumber: '000101-02-0001', bloodInvestigations: ['VL', 'CD4', 'FBC'], plan: 'Continue current TLD regimen.' }),
    rec({ id: '2', name: 'Siti', icNumber: '000202-08-0002', bloodInvestigations: ['FBS', 'FLP', 'Other'], bloodOther: 'Thyroid Stimulating Hormone (TSH)', plan: 'Adherence counseling session scheduled.' }),
    rec({ id: '3', name: 'Muthu', icNumber: '000303-02-0003', plan: 'Baseline workup.' })
  ];
  const names = (q: string) => filterRecords(records, q).map(r => r.name);

  it('matches investigation chips, case-insensitive', () => {
    expect(names('cd4')).toEqual(['Tan Ah Kow']);
    expect(names('flp')).toEqual(['Siti']);
  });
  it('matches the Other text', () => {
    expect(names('Thyroid')).toEqual(['Siti']);
    expect(names('TSH')).toEqual(['Siti']);
  });
  it('matches plan text', () => {
    expect(names('counseling')).toEqual(['Siti']);
    expect(names('TLD regimen')).toEqual(['Tan Ah Kow']);
  });
  it('matches IC numbers typed without dashes', () => {
    expect(names('000303020003')).toEqual(['Muthu']);
  });
});

describe('sorting', () => {
  const records = [
    rec({ id: '1', name: 'Zack', bloodInvestigations: ['LFT', 'AST'], plan: 'Zeta plan' }),
    rec({ id: '2', name: 'Alice', bloodInvestigations: ['VL', 'CD4'], plan: 'Alpha plan' }),
    rec({ id: '3', name: 'Bob', bloodInvestigations: [], plan: undefined }),
    rec({ id: '4', name: 'Charlie', bloodInvestigations: ['CD4'], plan: 'Beta plan' })
  ];
  it('by investigations follows the option order, empty last', () => {
    expect(sortRecords(records, 'investigations_asc').map(r => r.name)).toEqual(['Alice', 'Charlie', 'Zack', 'Bob']);
  });
  it('by plan is alphabetical, empty last', () => {
    expect(sortRecords(records, 'plan_asc').map(r => r.name)).toEqual(['Alice', 'Charlie', 'Zack', 'Bob']);
  });
});

describe('import of older backup files', () => {
  it('moves the old combined field into Plan without losing text (schema 2)', () => {
    const res = validateImportJSON(JSON.stringify({ schemaVersion: 2, records: [{ id: 'l1', name: 'Legacy', icNumber: '000101-00-5555', nextTca: '2026-11-20', bloodInvestigationsPlan: 'CD4: 500. Regimen review.' }] }));
    expect(res.valid).toBe(true);
    expect(res.records![0].plan).toBe('CD4: 500. Regimen review.');
    expect(res.records![0].bloodInvestigations).toEqual([]);
  });
  it('drops unknown investigation names but keeps the rest', () => {
    const res = validateImportJSON({ schemaVersion: 3, records: [{ id: 'd1', name: 'D', icNumber: '1', bloodInvestigations: ['CD4', 'UNKNOWN_TEST', 'FBC'] }] });
    expect(res.records![0].bloodInvestigations).toEqual(['CD4', 'FBC']);
  });
  it('turns a single Next TCA into an appointment (schema 3)', () => {
    const res = validateImportJSON({ schemaVersion: 3, records: [{ id: 'l2', name: 'L', icNumber: '700101-01-0001', nextTca: '2026-12-20', bloodInvestigations: ['VL', 'RP'] }] });
    expect(res.records![0].appointments).toHaveLength(1);
    expect(res.records![0].appointments![0].tcaDate).toBe('2026-12-20');
    expect(res.records![0].isActive).toBe(true);
  });
  it('rejects files without records', () => {
    expect(validateImportJSON('{"hello":1}').valid).toBe(false);
    expect(validateImportJSON('not json').valid).toBe(false);
    expect(validateImportJSON({ records: [{ name: '', icNumber: '1' }] }).valid).toBe(false);
  });
});

describe('demo data', () => {
  it('is varied enough to show every feature', () => {
    const demo = generateDemoRecords();
    expect(demo.length).toBeGreaterThanOrEqual(5);
    expect(demo.some(r => r.bloodInvestigations.length > 0)).toBe(true);
    expect(demo.some(r => r.bloodInvestigations.includes('Other') && !!r.bloodOther)).toBe(true);
    expect(demo.some(r => !!r.plan)).toBe(true);
  });
});
