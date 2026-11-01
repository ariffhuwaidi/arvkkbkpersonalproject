import type { PatientRecord, TCAAppointment } from '../types';
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
 * Generates an explicitly fictional demo dataset showcasing:
 * - Patient Category: New Patient & Existing Patient.
 * - Active & Deactivated records.
 * - Multiple TCA appointments per patient (Upcoming Scheduled + TCA History: Attended, DNA, Rescheduled).
 * - Preserved blood investigations and follow-up plans.
 */
export function generateDemoRecords(): PatientRecord[] {
  const now = new Date().toISOString();

  const pastApt1 = getOffsetDateISO(-90); // 3 months ago (Attended)
  const pastApt2 = getOffsetDateISO(-30); // 1 month ago (Attended)
  const pastAptDna = getOffsetDateISO(-14); // 2 weeks ago (DNA)
  const overdueTca = getOffsetDateISO(-3); // Overdue by 3 days
  const todayTca = getOffsetDateISO(0);    // Today
  const soonTca = getOffsetDateISO(4);     // In 4 days (This week)
  const laterTca = getOffsetDateISO(35);   // Later next month

  // Patient 1: Overdue scheduled TCA + 1 Attended historical TCA
  const p1Apts: TCAAppointment[] = [
    {
      id: 'apt-001-hist1',
      patientId: 'demo-rec-001',
      tcaDate: pastApt1,
      status: 'Attended',
      attendedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      notes: 'Attended on time. Dispensed 2-month TLD supply.',
      plan: 'Stable on TLD regimen. Repeat FBC, Renal Profile, and LFT next visit.',
      bloodInvestigationDate: getOneMonthBeforeISO(pastApt1),
      bloodInvestigations: ['VL', 'CD4', 'FBC', 'RP'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'apt-001-curr',
      patientId: 'demo-rec-001',
      tcaDate: overdueTca,
      status: 'Scheduled',
      notes: 'Patient overdue for follow-up review',
      plan: 'Repeat viral load check and renal profile. Assess adherence.',
      bloodInvestigationDate: getOneMonthBeforeISO(overdueTca),
      bloodInvestigations: ['VL', 'CD4', 'FBC', 'RP'],
      createdAt: now,
      updatedAt: now
    }
  ];

  // Patient 2: New Patient, Scheduled TCA for today + 1 DNA visit
  const p2Apts: TCAAppointment[] = [
    {
      id: 'apt-002-dna',
      patientId: 'demo-rec-002',
      tcaDate: pastAptDna,
      status: 'DNA',
      notes: 'Patient did not attend appointment. Traced via phone.',
      plan: 'Reschedule urgently for adherence counseling session.',
      bloodInvestigationDate: getOneMonthBeforeISO(pastAptDna),
      bloodInvestigations: ['VL', 'FBS'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'apt-002-today',
      patientId: 'demo-rec-002',
      tcaDate: todayTca,
      status: 'Scheduled',
      notes: 'Follow-up after DNA. Fasting for FBS & FLP.',
      plan: 'Adherence counseling session scheduled. Fasting lipid profile (FLP) & FBS review.',
      bloodInvestigationDate: getOneMonthBeforeISO(todayTca),
      bloodInvestigations: ['VL', 'FBS', 'FLP'],
      createdAt: now,
      updatedAt: now
    }
  ];

  // Patient 3: Existing Patient with Rescheduled appointment history
  const p3Apts: TCAAppointment[] = [
    {
      id: 'apt-003-old',
      patientId: 'demo-rec-003',
      tcaDate: getOffsetDateISO(-5),
      status: 'Rescheduled',
      rescheduledToAppointmentId: 'apt-003-new',
      notes: 'Patient called to request postponement due to work outstation.',
      plan: 'CD4 count 650 cells/uL, Viral Load undetectable. Dispense 3-month antiretroviral supply.',
      bloodInvestigationDate: getOneMonthBeforeISO(getOffsetDateISO(-5)),
      bloodInvestigations: ['VL', 'CD4', 'Other'],
      bloodOther: 'TFT & urine protein',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'apt-003-new',
      patientId: 'demo-rec-003',
      tcaDate: soonTca,
      status: 'Scheduled',
      rescheduledFromAppointmentId: 'apt-003-old',
      notes: 'Rescheduled from last week.',
      plan: 'CD4 count 650 cells/uL, Viral Load undetectable. Dispense 3-month antiretroviral supply.',
      bloodInvestigationDate: getOneMonthBeforeISO(soonTca),
      bloodInvestigations: ['VL', 'CD4', 'Other'],
      bloodOther: 'TFT & urine protein',
      createdAt: now,
      updatedAt: now
    }
  ];

  // Patient 4: Existing Patient with 1 upcoming TCA + 1 Attended
  const p4Apts: TCAAppointment[] = [
    {
      id: 'apt-004-att',
      patientId: 'demo-rec-004',
      tcaDate: pastApt2,
      status: 'Attended',
      attendedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      notes: 'Routine visit completed.',
      plan: 'Annual biochemical surveillance. Hep B sAg non-reactive, anti-HCV negative.',
      bloodInvestigationDate: getOneMonthBeforeISO(pastApt2),
      bloodInvestigations: ['LFT', 'AST', 'RP'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'apt-004-later',
      patientId: 'demo-rec-004',
      tcaDate: laterTca,
      status: 'Scheduled',
      notes: 'Routine 6-month check.',
      plan: 'Annual biochemical surveillance. Hep B sAg non-reactive, anti-HCV negative.',
      bloodInvestigationDate: getOneMonthBeforeISO(laterTca),
      bloodInvestigations: ['LFT', 'AST', 'RP'],
      createdAt: now,
      updatedAt: now
    }
  ];

  return [
    {
      id: 'demo-rec-001',
      name: 'Demo Patient 01 (Ah Kow)',
      icNumber: '000101-00-0001',
      phone: '012-0000001',
      patientType: 'Existing',
      isActive: true,
      appointments: p1Apts,
      nextTca: overdueTca,
      bloodInvestigationDate: getOneMonthBeforeISO(overdueTca),
      bloodInvestigations: ['VL', 'CD4', 'FBC', 'RP'],
      bloodOther: undefined,
      plan: 'Repeat viral load check and renal profile. Assess adherence.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-002',
      name: 'Demo Patient 02 (Siti)',
      icNumber: '000202-00-0002',
      phone: '019-0000002',
      patientType: 'New',
      isActive: true,
      appointments: p2Apts,
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
      isActive: true,
      appointments: p3Apts,
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
      isActive: false, // Showcasing Deactivated / Inactive patient
      appointments: p4Apts,
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
      isActive: true,
      appointments: [],
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
