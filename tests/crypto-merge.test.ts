import { describe, expect, it } from 'vitest';
import { encryptJSON, decryptJSON, isEncryptedEnvelope, WrongPassphraseError } from '../src/utils/crypto';
import { planMerge, isExpiredTombstone, unionPrograms, DELETE_RETENTION_DAYS } from '../src/utils/merge';
import { mmt, rec } from './helpers';

describe('backup encryption', () => {
  const payload = { records: [{ id: 'a', name: 'Demo é中', icNumber: '000101-00-0001' }], n: 5 };

  it('round-trips and hides names and IC numbers', async () => {
    const env = await encryptJSON(payload, 'correct horse battery');
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(JSON.stringify(env)).not.toContain('Demo');
    expect(await decryptJSON(env, 'correct horse battery')).toEqual(payload);
  });

  it('rejects a wrong passphrase, a tampered file and absurd settings', async () => {
    const env = await encryptJSON(payload, 'correct horse battery');
    await expect(decryptJSON(env, 'wrong passphrase')).rejects.toBeInstanceOf(WrongPassphraseError);
    const tampered = { ...env, data: env.data.slice(0, -4) + (env.data.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA') };
    await expect(decryptJSON(tampered, 'correct horse battery')).rejects.toBeInstanceOf(WrongPassphraseError);
    await expect(decryptJSON({ ...env, iterations: 1 }, 'x')).rejects.toThrow(/Unsupported/);
  });

  it('uses a fresh salt and IV every time', async () => {
    const a = await encryptJSON(payload, 'pw'); const b = await encryptJSON(payload, 'pw');
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
  });

  it('handles a large backup (~700 KB)', async () => {
    const big = { records: Array.from({ length: 3000 }, (_, i) => ({ id: 'r' + i, pad: 'x'.repeat(200) })) };
    expect(await decryptJSON(await encryptJSON(big, 'pw-pw-pw-pw'), 'pw-pw-pw-pw')).toEqual(big);
  });
});

describe('newest-wins merge', () => {
  it('adds new patients, takes newer edits, ignores older ones', () => {
    expect(planMerge([rec({ id: 'a' })], [rec({ id: 'b', icNumber: '800202-02-2222' })]).added).toBe(1);
    const newer = planMerge([rec({ id: 'a', name: 'Old', updatedAt: '2026-02-01T00:00:00.000Z' })], [rec({ id: 'a', name: 'Newer', updatedAt: '2026-03-01T00:00:00.000Z' })]);
    expect(newer.toPut[0].name).toBe('Newer');
    const older = planMerge([rec({ id: 'a', updatedAt: '2026-04-01T00:00:00.000Z' })], [rec({ id: 'a', name: 'Stale', updatedAt: '2026-03-01T00:00:00.000Z' })]);
    expect(older.toPut).toHaveLength(0);
  });

  it('matches the same person by IC number across devices, keeping the local id', () => {
    const p = planMerge([rec({ id: 'a' })], [rec({ id: 'zzz', icNumber: '900101011111', updatedAt: '2026-05-01T00:00:00.000Z' })]);
    expect(p.toPut.map(r => r.id)).toEqual(['a']);
    expect(p.added).toBe(0);
  });

  it('combines programs and picks the MMT block by its own timestamp', () => {
    const local = rec({ id: 'a', updatedAt: '2026-06-01T00:00:00.000Z' });
    const incoming = rec({ id: 'a', updatedAt: '2026-05-01T00:00:00.000Z', programs: ['MMT'], mmt: mmt({ updatedAt: '2026-05-01T00:00:00.000Z' }) });
    const p = planMerge([local], [incoming]);
    expect(p.toPut[0].programs).toEqual(['ARV', 'MMT']);
    expect(p.toPut[0].mmt).toBeTruthy();

    const l2 = rec({ id: 'a', updatedAt: '2026-07-01T00:00:00.000Z', programs: ['ARV', 'MMT'], mmt: mmt({ currentDoseMg: 60, updatedAt: '2026-07-01T00:00:00.000Z' }) });
    const i2 = rec({ id: 'a', updatedAt: '2026-08-01T00:00:00.000Z', programs: ['ARV', 'MMT'], mmt: mmt({ currentDoseMg: 40, updatedAt: '2026-06-01T00:00:00.000Z' }) });
    expect(planMerge([l2], [i2]).toPut[0].mmt!.currentDoseMg).toBe(60);
  });

  it('passes deletes along, but never brings back an expired one', () => {
    const now = Date.parse('2026-11-16T00:00:00Z');
    const del = (daysAgo: number) => rec({ id: 'd', deletedAt: new Date(now - daysAgo * 86400000).toISOString(), updatedAt: new Date(now - daysAgo * 86400000).toISOString() });
    expect(planMerge([rec({ id: 'd' })], [del(2)], now).toPut[0].deletedAt).toBeTruthy();
    const expired = planMerge([], [del(45)], now);
    expect(expired.skipped).toBe(1);
    expect(isExpiredTombstone(del(DELETE_RETENTION_DAYS - 1), now)).toBe(false);
    expect(isExpiredTombstone(del(DELETE_RETENTION_DAYS + 1), now)).toBe(true);
  });

  it('is stable: merging identical data changes nothing', () => {
    const r = rec({ id: 'a' });
    expect(planMerge([r], [r]).toPut).toHaveLength(0);
  });

  it('collapses duplicate people inside one backup', () => {
    const p = planMerge([], [rec({ id: 'a' }), rec({ id: 'b', icNumber: '900101011111', updatedAt: '2026-09-01T00:00:00.000Z' })]);
    expect(p.toPut).toHaveLength(1);
    expect(unionPrograms(undefined, ['MMT'])).toEqual(['ARV', 'MMT']);
  });
});
