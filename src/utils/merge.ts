import type { PatientRecord, ProgramId } from '../types';

/** Deleted records stay recoverable for this many days. */
export const DELETE_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeIC(ic: string | undefined): string {
  return (ic || '').replace(/[\s-]/g, '').toLowerCase();
}

export function unionPrograms(a?: ProgramId[], b?: ProgramId[]): ProgramId[] {
  const set = new Set<ProgramId>([...(a && a.length ? a : ['ARV' as ProgramId]), ...(b && b.length ? b : ['ARV' as ProgramId])]);
  return (['ARV', 'MMT'] as ProgramId[]).filter(p => set.has(p));
}

export function isExpiredTombstone(record: PatientRecord, now: number = Date.now()): boolean {
  if (!record.deletedAt) return false;
  const deletedMs = Date.parse(record.deletedAt);
  if (Number.isNaN(deletedMs)) return false;
  return now - deletedMs > DELETE_RETENTION_DAYS * DAY_MS;
}

export interface MergePlan {
  /** Records to write to the local database. */
  toPut: PatientRecord[];
  added: number;
  updated: number;
  unchanged: number;
  /** Expired deleted records that were not brought back. */
  skipped: number;
}

function mmtStamp(record: PatientRecord): string {
  return record.mmt?.updatedAt || '';
}

/**
 * Newest-wins merge of incoming records (from a backup) into the local list.
 *
 * - Patients match by id first, then by IC number, so the same person created on
 *   two devices becomes one record.
 * - The whole record from the newer side wins, judged by `updatedAt`.
 * - The MMT block is chosen on its own timestamp, so MMT data is never lost
 *   because the ARV side of a record happened to be edited later.
 * - Programs are combined, never dropped.
 * - Deleted records travel as records with `deletedAt`, so a delete on one
 *   device reaches the other. Deleted records older than the retention period
 *   are not brought back.
 */
export function planMerge(local: PatientRecord[], incoming: PatientRecord[], now: number = Date.now()): MergePlan {
  const byId = new Map<string, PatientRecord>();
  const byIC = new Map<string, PatientRecord>();
  for (const rec of local) {
    byId.set(rec.id, rec);
    const ic = normalizeIC(rec.icNumber);
    if (ic) byIC.set(ic, rec);
  }

  const plan: MergePlan = { toPut: [], added: 0, updated: 0, unchanged: 0, skipped: 0 };
  // Several incoming rows can point at the same local patient; fold them in order.
  const pending = new Map<string, PatientRecord>();

  for (const inc of incoming) {
    const ic = normalizeIC(inc.icNumber);
    const match = pending.get(inc.id) ?? byId.get(inc.id) ?? (ic ? byIC.get(ic) : undefined);

    if (!match) {
      if (isExpiredTombstone(inc, now)) {
        plan.skipped++;
        continue;
      }
      pending.set(inc.id, inc);
      byId.set(inc.id, inc);
      if (ic) byIC.set(ic, inc);
      plan.added++;
      continue;
    }

    const incomingNewer = (inc.updatedAt || '') > (match.updatedAt || '');
    const base = incomingNewer ? inc : match;

    const merged: PatientRecord = {
      ...base,
      id: match.id,
      createdAt: (match.createdAt || '') <= (inc.createdAt || '') ? match.createdAt : inc.createdAt,
      programs: unionPrograms(match.programs, inc.programs)
    };

    const mmt = mmtStamp(inc) > mmtStamp(match) ? inc.mmt : match.mmt;
    if (mmt) merged.mmt = mmt;
    else delete merged.mmt;

    const changed = JSON.stringify(merged) !== JSON.stringify(match);
    if (!changed) {
      plan.unchanged++;
      continue;
    }

    if (pending.has(match.id)) {
      // already counted as added in this run
    } else {
      plan.updated++;
    }
    pending.set(match.id, merged);
    byId.set(match.id, merged);
    const mic = normalizeIC(merged.icNumber);
    if (mic) byIC.set(mic, merged);
  }

  plan.toPut = Array.from(pending.values());
  return plan;
}
