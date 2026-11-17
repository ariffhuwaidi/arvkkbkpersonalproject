import type { PatientRecord } from '../types';

/**
 * Safety copies of all records, taken just before a Replace import or a Drive
 * restore erases the database. They live in their own IndexedDB database so
 * patient data never goes into localStorage (see README). Copies older than
 * SAFETY_SNAPSHOT_KEEP_DAYS are removed whenever a new one is saved.
 */

/** How long a safety copy is kept. */
export const SAFETY_SNAPSHOT_KEEP_DAYS = 7;

const SAFETY_DB_NAME = 'arv_kkbk_safety';
const SAFETY_DB_VERSION = 1;
const SAFETY_STORE = 'snapshots';
/** Where older versions of the app wrote the safety copy. Moved on startup. */
const LEGACY_SAFETY_LS_KEY = 'arv_kkbk_pre_restore_safety_backup';

export interface SafetySnapshot {
  snapshotTime: string;
  recordsCount: number;
  records: PatientRecord[];
}

function openSafetyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SAFETY_DB_NAME, SAFETY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAFETY_STORE)) {
        db.createObjectStore(SAFETY_STORE, { keyPath: 'snapshotTime' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeSnapshot(snapshot: SafetySnapshot): Promise<void> {
  const db = await openSafetyDB();
  const cutoff = new Date(Date.now() - SAFETY_SNAPSHOT_KEEP_DAYS * 86400000).toISOString();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SAFETY_STORE, 'readwrite');
    const store = tx.objectStore(SAFETY_STORE);
    store.put(snapshot);
    store.delete(IDBKeyRange.upperBound(cutoff, true));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Saves a safety copy of the given records. Never throws; a failure is logged. */
export async function saveSafetySnapshot(records: PatientRecord[]): Promise<void> {
  try {
    await writeSnapshot({ snapshotTime: new Date().toISOString(), recordsCount: records.length, records });
  } catch (err) {
    console.warn('Could not save safety copy:', err);
  }
}

/** Moves a safety copy left in localStorage by older versions into IndexedDB, then deletes it. */
export async function migrateLegacySafetySnapshot(): Promise<void> {
  let raw: string | null = null;
  try { raw = localStorage.getItem(LEGACY_SAFETY_LS_KEY); } catch { return; }
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Partial<SafetySnapshot>;
    if (Array.isArray(parsed.records) && typeof parsed.snapshotTime === 'string') {
      await writeSnapshot({ snapshotTime: parsed.snapshotTime, recordsCount: parsed.records.length, records: parsed.records });
    }
  } catch (err) {
    // Keep the old copy where it is and try again next start.
    console.warn('Could not move old safety copy:', err);
    return;
  }
  try { localStorage.removeItem(LEGACY_SAFETY_LS_KEY); } catch { /* ignore */ }
}
