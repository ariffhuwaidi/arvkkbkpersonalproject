import type { MMTProfile, PatientRecord } from '../src/types';

export const T0 = '2026-01-01T00:00:00.000Z';

/** A minimal valid record. All names and IC numbers here are fictional. */
export function rec(over: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 'x',
    name: 'Fictional Patient',
    icNumber: '900101-01-1111',
    patientType: 'Existing',
    programs: ['ARV'],
    bloodInvestigations: [],
    createdAt: T0,
    updatedAt: T0,
    ...over
  } as PatientRecord;
}

export function mmt(over: Partial<MMTProfile> = {}): MMTProfile {
  return {
    dispensing: 'Daily',
    doseHistory: [],
    doseLog: [],
    urineTests: [],
    takeHomes: [],
    reviews: [],
    updatedAt: T0,
    ...over
  };
}
