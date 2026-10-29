import type { PatientRecord, IRecordStorage, PatientType } from '../types';

const DB_NAME = 'arv_kkbk_db';
const DB_VERSION = 3;
const STORE_NAME = 'records';

export class IndexedDBStorage implements IRecordStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const oldVersion = event.oldVersion;

          let store: IDBObjectStore;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('icNumber', 'icNumber', { unique: false });
            store.createIndex('name', 'name', { unique: false });
            store.createIndex('nextTca', 'nextTca', { unique: false });
          } else {
            store = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
          }

          if (!store.indexNames.contains('patientType')) {
            store.createIndex('patientType', 'patientType', { unique: false });
          }
          if (!store.indexNames.contains('bloodInvestigationDate')) {
            store.createIndex('bloodInvestigationDate', 'bloodInvestigationDate', { unique: false });
          }

          // Safe migration across legacy versions
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor) {
              const val = cursor.value;
              let modified = false;

              // Migration for version < 2: patientType
              if (oldVersion < 2 && !val.patientType) {
                val.patientType = 'Existing';
                modified = true;
              }

              // Migration for version < 3: separate blood investigations and plan
              if (oldVersion < 3) {
                if (val.bloodInvestigationsPlan !== undefined && val.plan === undefined) {
                  val.plan = val.bloodInvestigationsPlan;
                  delete val.bloodInvestigationsPlan;
                  modified = true;
                }
                if (!Array.isArray(val.bloodInvestigations)) {
                  val.bloodInvestigations = [];
                  modified = true;
                }
              }

              if (modified) {
                cursor.update(val);
              }
              cursor.continue();
            }
          };
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    }
    return this.dbPromise;
  }

  async list(): Promise<PatientRecord[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result as any[]).map(r => this.normalizeRecord(r));
        resolve(list);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async get(id: string): Promise<PatientRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        if (!request.result) {
          resolve(null);
          return;
        }
        resolve(this.normalizeRecord(request.result));
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async save(record: Omit<PatientRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }): Promise<PatientRecord> {
    const db = await this.getDB();
    const now = new Date().toISOString();

    const existing = record.id ? await this.get(record.id) : null;
    const investigations = Array.isArray(record.bloodInvestigations) ? record.bloodInvestigations : [];
    const isOtherTicked = investigations.includes('Other');

    const finalRecord: PatientRecord = {
      id: record.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      name: record.name.trim(),
      icNumber: record.icNumber.trim(),
      phone: record.phone ? record.phone.trim() : undefined,
      patientType: record.patientType || existing?.patientType || 'Existing',
      nextTca: record.nextTca ? record.nextTca.trim() : undefined,
      bloodInvestigationDate: record.bloodInvestigationDate ? record.bloodInvestigationDate.trim() : undefined,
      bloodInvestigations: investigations,
      bloodOther: isOtherTicked && record.bloodOther ? record.bloodOther.trim() : undefined,
      plan: record.plan ? record.plan.trim() : undefined,
      createdAt: existing?.createdAt || record.createdAt || now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(finalRecord);

      request.onsuccess = () => {
        resolve(finalRecord);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async delete(id: string): Promise<boolean> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve(true);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async bulkImport(records: PatientRecord[], mode: 'merge' | 'replace'): Promise<{ count: number }> {
    const db = await this.getDB();
    const existingList = mode === 'merge' ? await this.list() : [];
    const existingByIC = new Map<string, PatientRecord>();
    const existingById = new Map<string, PatientRecord>();

    if (mode === 'merge') {
      for (const rec of existingList) {
        existingById.set(rec.id, rec);
        const normIC = rec.icNumber.replace(/[\s-]/g, '').toLowerCase();
        if (normIC) {
          existingByIC.set(normIC, rec);
        }
      }
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      if (mode === 'replace') {
        store.clear();
      }

      let count = 0;
      for (const raw of records) {
        const r = this.normalizeRecord(raw);
        const normIC = (r.icNumber || '').replace(/[\s-]/g, '').toLowerCase();
        let targetId = r.id;
        let originalCreatedAt = r.createdAt;

        if (mode === 'merge') {
          const match = existingById.get(r.id) || (normIC ? existingByIC.get(normIC) : undefined);
          if (match) {
            targetId = match.id;
            originalCreatedAt = match.createdAt;
          }
        }

        const now = new Date().toISOString();
        const recordToSave: PatientRecord = {
          ...r,
          id: targetId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
          createdAt: originalCreatedAt || r.createdAt || now,
          updatedAt: now
        };

        store.put(recordToSave);
        count++;
      }

      tx.oncomplete = () => {
        resolve({ count });
      };
      tx.onerror = () => {
        reject(tx.error);
      };
    });
  }

  private normalizeRecord(raw: any): PatientRecord {
    // If legacy bloodInvestigationsPlan is present and plan is absent, migrate it
    const plan = raw.plan !== undefined ? raw.plan : (raw.bloodInvestigationsPlan || undefined);
    const investigations = Array.isArray(raw.bloodInvestigations) ? raw.bloodInvestigations : [];
    const isOther = investigations.includes('Other');

    return {
      id: raw.id,
      name: (raw.name || '').trim(),
      icNumber: (raw.icNumber || '').trim(),
      phone: raw.phone ? raw.phone.trim() : undefined,
      patientType: (raw.patientType as PatientType) || 'Existing',
      nextTca: raw.nextTca ? raw.nextTca.trim() : undefined,
      bloodInvestigationDate: raw.bloodInvestigationDate ? raw.bloodInvestigationDate.trim() : undefined,
      bloodInvestigations: investigations,
      bloodOther: isOther && raw.bloodOther ? raw.bloodOther.trim() : undefined,
      plan: plan ? plan.trim() : undefined,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }
}

export const recordStorage = new IndexedDBStorage();
