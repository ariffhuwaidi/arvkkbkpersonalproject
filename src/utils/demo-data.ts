import type { PatientRecord } from '../types';
import { getOneMonthBeforeISO } from './date';

function getOffsetDateISO(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates an explicitly fictional demo dataset.
 * - Realistic mix of New and Existing patients.
 * - Varied blood investigation chip selections (including 'Other').
 * - Separate multi-line clinical plans.
 */
export function generateDemoRecords(): PatientRecord[] {
  const now = new Date().toISOString();

  const overdueTca = getOffsetDateISO(-3); // Overdue by 3 days
  const todayTca = getOffsetDateISO(0);    // Today
  const soonTca = getOffsetDateISO(4);     // In 4 days (This week)
  const laterTca = getOffsetDateISO(35);   // Later next month

  return [
    {
      id: 'demo-rec-001',
      name: 'Demo Patient 01 (Ah Kow)',
      icNumber: '000101-00-0001',
      phone: '012-0000001',
      patientType: 'Existing',
      nextTca: overdueTca,
      bloodInvestigationDate: getOneMonthBeforeISO(overdueTca), // Past blood date
      bloodInvestigations: ['VL', 'CD4', 'FBC', 'RP'],
      bloodOther: undefined,
      plan: 'Stable on TLD regimen. Repeat FBC, Renal Profile, and LFT in 6 months.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-002',
      name: 'Demo Patient 02 (Siti)',
      icNumber: '000202-00-0002',
      phone: '019-0000002',
      patientType: 'New',
      nextTca: todayTca,
      bloodInvestigationDate: getOneMonthBeforeISO(todayTca),
      bloodInvestigations: ['VL', 'FBS', 'FLP'],
      bloodOther: undefined,
      plan: 'Adherence counseling session scheduled. Fasting lipid profile (FLP) & FBS review.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-003',
      name: 'Demo Patient 03 (Muthu)',
      icNumber: '000303-00-0003',
      phone: '013-0000003',
      patientType: 'Existing',
      nextTca: soonTca,
      bloodInvestigationDate: getOneMonthBeforeISO(soonTca),
      bloodInvestigations: ['VL', 'CD4', 'Other'],
      bloodOther: 'TFT & urine protein',
      plan: 'CD4 count 650 cells/uL, Viral Load undetectable. Dispense 3-month antiretroviral supply.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-004',
      name: 'Demo Patient 04 (Tan)',
      icNumber: '000404-00-0004',
      phone: '011-0000004',
      patientType: 'Existing',
      nextTca: laterTca,
      bloodInvestigationDate: getOneMonthBeforeISO(laterTca),
      bloodInvestigations: ['LFT', 'AST', 'RP'],
      bloodOther: undefined,
      plan: 'Annual biochemical surveillance. Hep B sAg non-reactive, anti-HCV negative.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-005',
      name: 'Demo Patient 05 (Fatimah)',
      icNumber: '000505-00-0005',
      phone: '017-0000005',
      patientType: 'New',
      nextTca: undefined, // No TCA scheduled
      bloodInvestigationDate: undefined,
      bloodInvestigations: [],
      bloodOther: undefined,
      plan: 'Newly transferred from private GP clinic. Awaiting baseline workup.',
      createdAt: now,
      updatedAt: now
    }
  ];
}
