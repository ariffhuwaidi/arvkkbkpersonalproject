// Delete-forever, exports of deleted patients, and one record per person.
import { describe, expect, it } from 'vitest';
import { IndexedDBStorage } from '../src/storage/indexeddb-storage';
import { planMerge, findByIC, toTombstone } from '../src/utils/merge';
import { buildExportPayload, validateImportJSON } from '../src/utils/export-import';
import { mmt, rec } from './helpers';

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

describe('delete forever', () => {
  it('erases details at once but keeps a blank marker so other devices delete too', async () => {
    const s = new IndexedDBStorage();
    await s.put(rec({ id: 'a', name: 'Secret Name', plan: 'secret plan', programs: ['ARV', 'MMT'], mmt: mmt({ currentDoseMg: 60 }) }));
    await s.softDelete('a');
    await s.purge('a');

    expect(await s.listDeleted()).toEqual([]); // gone from Recently Deleted
    expect(await s.list()).toEqual([]);
    const [marker] = await s.listAll();
    expect(marker).toMatchObject({ id: 'a', purged: true });
    expect(marker.deletedAt).toBeTruthy();
    const text = JSON.stringify(marker);
    expect(text).not.toContain('Secret Name');
    expect(text).not.toContain('secret plan');
    expect(marker.mmt).toBeUndefined();
  });

  it('an older copy from another device does not bring the patient back', async () => {
    const s = new IndexedDBStorage();
    const live = rec({ id: 'a', name: 'Secret Name', updatedAt: daysAgo(3) });
    await s.put(live);
    await s.softDelete('a');
    await s.purge('a');
    await s.mergeNewer([live]);
    expect(await s.list()).toEqual([]);
    expect(JSON.stringify(await s.listAll())).not.toContain('Secret Name');
  });

  it('the marker reaches the other device and erases the patient there', () => {
    const other = rec({ id: 'a', name: 'Secret Name', updatedAt: daysAgo(3) });
    const marker = toTombstone({ ...other, deletedAt: daysAgo(1) }, new Date().toISOString());
    const plan = planMerge([other], [marker]);
    expect(plan.toPut[0]).toMatchObject({ purged: true });
    expect(JSON.stringify(plan.toPut[0])).not.toContain('Secret Name');
  });

  it('markers are removed for good after 30 days', async () => {
    const s = new IndexedDBStorage();
    await s.put(toTombstone(rec({ id: 'old', deletedAt: daysAgo(31) }), daysAgo(31)));
    await s.put(toTombstone(rec({ id: 'new', icNumber: '2', deletedAt: daysAgo(2) }), daysAgo(2)));
    expect(await s.purgeExpiredDeleted()).toBe(1);
    expect((await s.listAll()).map(r => r.id)).toEqual(['new']);
  });
});

describe('exports', () => {
  const records = [
    rec({ id: 'live', name: 'Live Patient' }),
    rec({ id: 'gone', icNumber: '2', name: 'Deleted Patient', plan: 'private', deletedAt: daysAgo(1), updatedAt: daysAgo(1) })
  ];

  it('"Everything" carries deleted patients only as blank markers', () => {
    const payload = buildExportPayload(records, 'all');
    expect(payload.totalRecords).toBe(1); // count shows live patients
    const gone = payload.records.find(r => r.id === 'gone')!;
    expect(gone).toMatchObject({ purged: true, deletedAt: records[1].deletedAt });
    expect(JSON.stringify(payload)).not.toContain('Deleted Patient');
    expect(JSON.stringify(payload)).not.toContain('private');
  });

  it('a program export leaves deleted patients out', () => {
    expect(buildExportPayload(records, 'ARV').records.map(r => r.id)).toEqual(['live']);
  });

  it('files with markers import cleanly', () => {
    const res = validateImportJSON(buildExportPayload(records, 'all'));
    expect(res.valid).toBe(true);
    expect(res.records!.find(r => r.id === 'gone')).toMatchObject({ purged: true });
  });
});

describe('one record per person', () => {
  const people = [
    rec({ id: 'a', icNumber: '900101-01-1111', programs: ['MMT'] }),
    rec({ id: 'b', icNumber: '800202-02-2222', deletedAt: daysAgo(2) }),
    toTombstone(rec({ id: 'c', icNumber: '700303-03-3333', deletedAt: daysAgo(2) }), daysAgo(1))
  ];

  it('finds a person by IC however it is typed, ignoring erased markers', () => {
    expect(findByIC(people, '900101 01 1111')?.id).toBe('a');
    expect(findByIC(people, '800202022222')?.id).toBe('b');
    expect(findByIC(people, '700303-03-3333')).toBeUndefined();
    expect(findByIC(people, '')).toBeUndefined();
  });

  it('adding an MMT-only person to ARV keeps one record and their MMT data', async () => {
    const s = new IndexedDBStorage();
    await s.put(rec({ id: 'a', name: 'Same Person', programs: ['MMT'], mmt: mmt({ currentDoseMg: 60 }) }));
    await s.save({ id: 'a', name: 'Same Person', icNumber: '900101-01-1111', patientType: 'Existing', bloodInvestigations: ['VL'], nextTca: '2026-12-01', programs: ['ARV', 'MMT'] } as any);
    const all = await s.listAll();
    expect(all).toHaveLength(1);
    expect(all[0].programs).toEqual(['ARV', 'MMT']);
    expect(all[0].mmt?.currentDoseMg).toBe(60);
    expect(all[0].nextTca).toBe('2026-12-01');
  });
});
