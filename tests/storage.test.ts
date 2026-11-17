// Runs the real storage code against an in-memory IndexedDB (see setup.ts).
import { describe, expect, it } from 'vitest';
import { IndexedDBStorage } from '../src/storage/indexeddb-storage';
import { mmt, rec } from './helpers';

const newPatient = (storage: IndexedDBStorage, over: Record<string, unknown> = {}) => storage.save({
  id: 'pat-001',
  name: 'Fictional Patient Alpha',
  icNumber: '900101-01-0001',
  patientType: 'New',
  nextTca: '2026-11-15',
  bloodInvestigationDate: '2026-10-15',
  bloodInvestigations: ['VL', 'CD4'],
  plan: 'Start first-line ART',
  ...over
} as any);

describe('TCA appointments', () => {
  it('a new patient gets their first TCA as an appointment', async () => {
    const s = new IndexedDBStorage();
    const p = await newPatient(s);
    expect(p.appointments).toHaveLength(1);
    expect(p.appointments![0]).toMatchObject({ status: 'Scheduled', tcaDate: '2026-11-15' });
    expect(p.nextTca).toBe('2026-11-15');
  });

  it('keeps full history through attend, DNA and reschedule', async () => {
    const s = new IndexedDBStorage();
    const p = await newPatient(s);
    const first = p.appointments![0].id;

    await s.updateAppointment(p.id, first, { status: 'Attended', notes: 'Tolerating meds well' });
    expect((await s.get(p.id))!.nextTca).toBeUndefined();

    const second = await s.addAppointment(p.id, { tcaDate: '2027-02-15', status: 'Scheduled', bloodInvestigationDate: '2027-01-15', bloodInvestigations: ['VL', 'CD4', 'FBC'] });
    await s.updateAppointment(p.id, second.id, { status: 'DNA', notes: 'Traced by phone' });
    const third = await s.addAppointment(p.id, { tcaDate: '2027-02-25', status: 'Scheduled' });
    const { newApt } = await s.rescheduleAppointment(p.id, third.id, { tcaDate: '2027-03-05', notes: 'Travelling' });

    const after = (await s.get(p.id))!;
    const byId = (id: string) => after.appointments!.find(a => a.id === id)!;
    expect(after.appointments).toHaveLength(4);
    expect(byId(first).status).toBe('Attended');
    expect(byId(first).notes).toContain('Tolerating');
    expect(byId(first).bloodInvestigations).toEqual(['VL', 'CD4']);
    expect(byId(second.id).status).toBe('DNA');
    expect(byId(second.id).bloodInvestigations).toEqual(['VL', 'CD4', 'FBC']);
    expect(byId(third.id)).toMatchObject({ status: 'Rescheduled', rescheduledToAppointmentId: newApt.id });
    expect(newApt).toMatchObject({ status: 'Scheduled', tcaDate: '2027-03-05', rescheduledFromAppointmentId: third.id });
    expect(after.nextTca).toBe('2027-03-05');
  });

  it('deactivating and changing category keep id and history', async () => {
    const s = new IndexedDBStorage();
    const p = await newPatient(s);
    await s.setPatientActiveStatus(p.id, false);
    expect((await s.get(p.id))!.isActive).toBe(false);
    await s.setPatientActiveStatus(p.id, true);
    await s.setPatientCategory(p.id, 'Existing');
    const after = (await s.get(p.id))!;
    expect(after).toMatchObject({ id: 'pat-001', isActive: true, patientType: 'Existing' });
    expect(after.appointments).toHaveLength(1);
  });
});

describe('blood collections', () => {
  it('keeps the chosen tests when a collection is scheduled', async () => {
    const s = new IndexedDBStorage();
    const p = await newPatient(s, { bloodInvestigationDate: undefined, bloodInvestigations: [] });
    await s.addBloodCollection(p.id, { scheduledDate: '2026-12-01', bloodInvestigations: ['VL', 'Other'], bloodOther: 'TSH' });
    const bld = (await s.get(p.id))!.bloodCollections!.find(b => b.scheduledDate === '2026-12-01')!;
    expect(bld.bloodInvestigations).toEqual(['VL', 'Other']);
    expect(bld.bloodOther).toBe('TSH');
  });

  it('attending records the real collection date and time separately', async () => {
    const s = new IndexedDBStorage();
    const p = await newPatient(s);
    const bld = p.bloodCollections![0];
    await s.updateBloodCollectionStatus(p.id, bld.id, 'Attended', '2026-10-16', '09:30');
    const after = (await s.get(p.id))!.bloodCollections![0];
    expect(after).toMatchObject({ status: 'Attended', scheduledDate: '2026-10-15', actualCollectionDate: '2026-10-16', actualCollectionTime: '09:30' });
  });

  it('rescheduling keeps the old one in history and leaves the TCA alone', async () => {
    const s = new IndexedDBStorage();
    const p = await newPatient(s);
    const old = p.bloodCollections![0];
    const { nextCollection } = await s.rescheduleBloodCollection(p.id, old.id, '2026-10-28', 'Out of state');
    const after = (await s.get(p.id))!;
    expect(after.bloodCollections).toHaveLength(2);
    expect(after.bloodCollections!.find(b => b.id === old.id)).toMatchObject({ status: 'Rescheduled', rescheduledReason: 'Out of state', rescheduledToId: nextCollection.id });
    expect(nextCollection).toMatchObject({ status: 'Scheduled', scheduledDate: '2026-10-28', rescheduledFromId: old.id, bloodInvestigations: ['VL', 'CD4'] });
    expect(after.nextTca).toBe('2026-11-15');
    expect(after.bloodInvestigationDate).toBe('2026-10-28');
  });
});

describe('import', () => {
  it('Merge keeps a newer local edit and the other program', async () => {
    const s = new IndexedDBStorage();
    await s.put(rec({ id: 'a', name: 'Local', programs: ['ARV', 'MMT'], mmt: mmt({ currentDoseMg: 60 }), updatedAt: '2026-11-10T00:00:00.000Z' }));
    await s.bulkImport([rec({ id: 'a', name: 'Older file', programs: ['ARV'], updatedAt: '2026-11-01T00:00:00.000Z' })], 'merge');
    const a = (await s.get('a'))!;
    expect(a.name).toBe('Local');
    expect(a.programs).toEqual(['ARV', 'MMT']);
    expect(a.mmt?.currentDoseMg).toBe(60);
  });

  it('Merge takes a newer edit from the file but never drops MMT', async () => {
    const s = new IndexedDBStorage();
    await s.put(rec({ id: 'a', name: 'Local', programs: ['ARV', 'MMT'], mmt: mmt({ currentDoseMg: 60 }), updatedAt: '2026-11-01T00:00:00.000Z' }));
    await s.bulkImport([rec({ id: 'a', icNumber: '900101011111', name: 'From file', programs: ['ARV'], updatedAt: '2026-11-10T00:00:00.000Z' })], 'merge');
    const all = await s.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: 'From file', programs: ['ARV', 'MMT'] });
    expect(all[0].mmt?.currentDoseMg).toBe(60);
  });

  it('Replace erases what was there', async () => {
    const s = new IndexedDBStorage();
    await s.put(rec({ id: 'a' }));
    await s.bulkImport([rec({ id: 'b', icNumber: '800202-02-2222' })], 'replace');
    expect((await s.listAll()).map(r => r.id)).toEqual(['b']);
  });
});

describe('Recently Deleted', () => {
  it('soft delete hides a patient and restore brings them back', async () => {
    const s = new IndexedDBStorage();
    await s.put(rec({ id: 'a' }));
    await s.softDelete('a');
    expect(await s.list()).toHaveLength(0);
    expect(await s.listDeleted()).toHaveLength(1);
    await s.restore('a');
    expect(await s.list()).toHaveLength(1);
  });

  it('purges deletes older than 30 days only', async () => {
    const s = new IndexedDBStorage();
    const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
    await s.put(rec({ id: 'old', deletedAt: daysAgo(31) }));
    await s.put(rec({ id: 'recent', icNumber: '2', deletedAt: daysAgo(5) }));
    expect(await s.purgeExpiredDeleted()).toBe(1);
    expect((await s.listAll()).map(r => r.id)).toEqual(['recent']);
  });
});
