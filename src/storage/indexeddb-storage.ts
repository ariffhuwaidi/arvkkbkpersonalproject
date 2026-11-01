import type { PatientRecord, IRecordStorage, PatientType, TCAAppointment } from '../types';

const DB_NAME = 'arv_kkbk_db';
const DB_VERSION = 4;
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

              // Migration for version < 4: separate appointment history and isActive status
              if (oldVersion < 4) {
                if (val.isActive === undefined) {
                  val.isActive = true;
                  modified = true;
                }
                if (!Array.isArray(val.appointments) || val.appointments.length === 0) {
                  val.appointments = [];
                  if (val.nextTca) {
                    val.appointments.push({
                      id: `apt_migrated_${val.id}`,
                      patientId: val.id,
                      tcaDate: val.nextTca,
                      status: 'Scheduled',
                      notes: 'Initial recorded appointment',
                      plan: val.plan,
                      bloodInvestigationDate: val.bloodInvestigationDate,
                      bloodInvestigations: val.bloodInvestigations || [],
                      bloodOther: val.bloodOther,
                      createdAt: val.createdAt || new Date().toISOString(),
                      updatedAt: val.updatedAt || new Date().toISOString()
                    });
                  }
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
    const patientId = record.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    // Manage appointments
    let appointments: TCAAppointment[] = [];
    if (Array.isArray(record.appointments) && record.appointments.length > 0) {
      appointments = record.appointments;
    } else if (existing && Array.isArray(existing.appointments) && existing.appointments.length > 0) {
      appointments = [...existing.appointments];
      // If user provided or changed nextTca in form, check if we need to update/create scheduled appointment
      if (record.nextTca && record.nextTca.trim()) {
        const scheduledIndex = appointments.findIndex(a => a.status === 'Scheduled');
        if (scheduledIndex >= 0) {
          appointments[scheduledIndex] = {
            ...appointments[scheduledIndex],
            tcaDate: record.nextTca.trim(),
            bloodInvestigationDate: record.bloodInvestigationDate ? record.bloodInvestigationDate.trim() : undefined,
            bloodInvestigations: investigations,
            bloodOther: isOtherTicked && record.bloodOther ? record.bloodOther.trim() : undefined,
            plan: record.plan ? record.plan.trim() : undefined,
            updatedAt: now
          };
        } else {
          // Add new scheduled appointment
          appointments.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            patientId,
            tcaDate: record.nextTca.trim(),
            status: 'Scheduled',
            bloodInvestigationDate: record.bloodInvestigationDate ? record.bloodInvestigationDate.trim() : undefined,
            bloodInvestigations: investigations,
            bloodOther: isOtherTicked && record.bloodOther ? record.bloodOther.trim() : undefined,
            plan: record.plan ? record.plan.trim() : undefined,
            createdAt: now,
            updatedAt: now
          });
        }
      }
    } else if (record.nextTca && record.nextTca.trim()) {
      appointments = [{
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        patientId,
        tcaDate: record.nextTca.trim(),
        status: 'Scheduled',
        notes: 'Initial appointment',
        bloodInvestigationDate: record.bloodInvestigationDate ? record.bloodInvestigationDate.trim() : undefined,
        bloodInvestigations: investigations,
        bloodOther: isOtherTicked && record.bloodOther ? record.bloodOther.trim() : undefined,
        plan: record.plan ? record.plan.trim() : undefined,
        createdAt: now,
        updatedAt: now
      }];
    }

    const preRecord: any = {
      id: patientId,
      name: record.name.trim(),
      icNumber: record.icNumber.trim(),
      phone: record.phone ? record.phone.trim() : undefined,
      patientType: record.patientType || existing?.patientType || 'Existing',
      isActive: record.isActive !== undefined ? Boolean(record.isActive) : (existing?.isActive !== undefined ? existing.isActive : true),
      appointments,
      nextTca: record.nextTca ? record.nextTca.trim() : undefined,
      bloodInvestigationDate: record.bloodInvestigationDate ? record.bloodInvestigationDate.trim() : undefined,
      bloodInvestigations: investigations,
      bloodOther: isOtherTicked && record.bloodOther ? record.bloodOther.trim() : undefined,
      plan: record.plan ? record.plan.trim() : undefined,
      createdAt: existing?.createdAt || record.createdAt || now,
      updatedAt: now
    };

    const finalRecord = this.normalizeRecord(preRecord);

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

  public normalizeRecord(raw: any): PatientRecord {
    // If legacy bloodInvestigationsPlan is present and plan is absent, migrate it
    const plan = raw.plan !== undefined ? raw.plan : (raw.bloodInvestigationsPlan || undefined);
    const investigations = Array.isArray(raw.bloodInvestigations) ? raw.bloodInvestigations : [];
    const isOther = investigations.includes('Other');
    const isActive = raw.isActive !== undefined ? Boolean(raw.isActive) : true;
    const patientId = raw.id;

    // Normalize appointments array
    let appointments: TCAAppointment[] = [];
    if (Array.isArray(raw.appointments) && raw.appointments.length > 0) {
      appointments = raw.appointments.map((apt: any) => {
        const aptInvs = Array.isArray(apt.bloodInvestigations) ? apt.bloodInvestigations : [];
        const isAptOther = aptInvs.includes('Other');
        return {
          id: apt.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
          patientId: apt.patientId || patientId,
          tcaDate: (apt.tcaDate || '').trim(),
          status: apt.status || 'Scheduled',
          notes: apt.notes ? apt.notes.trim() : undefined,
          plan: apt.plan ? apt.plan.trim() : undefined,
          bloodInvestigationDate: apt.bloodInvestigationDate ? apt.bloodInvestigationDate.trim() : undefined,
          bloodInvestigations: aptInvs,
          bloodOther: isAptOther && apt.bloodOther ? apt.bloodOther.trim() : undefined,
          rescheduledToAppointmentId: apt.rescheduledToAppointmentId,
          rescheduledFromAppointmentId: apt.rescheduledFromAppointmentId,
          attendedAt: apt.attendedAt,
          createdAt: apt.createdAt || raw.createdAt || new Date().toISOString(),
          updatedAt: apt.updatedAt || raw.updatedAt || new Date().toISOString()
        };
      });
    } else if (raw.nextTca && typeof raw.nextTca === 'string' && raw.nextTca.trim()) {
      appointments = [{
        id: `apt_migrated_${patientId}`,
        patientId,
        tcaDate: raw.nextTca.trim(),
        status: 'Scheduled',
        notes: 'Initial recorded appointment',
        plan: plan ? plan.trim() : undefined,
        bloodInvestigationDate: raw.bloodInvestigationDate ? raw.bloodInvestigationDate.trim() : undefined,
        bloodInvestigations: investigations,
        bloodOther: isOther && raw.bloodOther ? raw.bloodOther.trim() : undefined,
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || new Date().toISOString()
      }];
    }

    // Determine latest upcoming scheduled appointment for fast top-level access
    const scheduledApts = appointments.filter(a => a.status === 'Scheduled');
    let activeApt: TCAAppointment | undefined;

    if (scheduledApts.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = scheduledApts.filter(a => a.tcaDate >= today).sort((a, b) => a.tcaDate.localeCompare(b.tcaDate));
      if (upcoming.length > 0) {
        activeApt = upcoming[0];
      } else {
        const overdue = [...scheduledApts].sort((a, b) => a.tcaDate.localeCompare(b.tcaDate));
        activeApt = overdue[0];
      }
    }

    const nextTca = activeApt ? activeApt.tcaDate : undefined;
    const bloodDate = activeApt ? activeApt.bloodInvestigationDate : (raw.bloodInvestigationDate ? raw.bloodInvestigationDate.trim() : undefined);
    const activeInvs = activeApt ? activeApt.bloodInvestigations : investigations;
    const activeOther = activeApt ? activeApt.bloodOther : (isOther && raw.bloodOther ? raw.bloodOther.trim() : undefined);
    const activePlan = activeApt && activeApt.plan ? activeApt.plan : (plan ? plan.trim() : undefined);

    return {
      id: raw.id,
      name: (raw.name || '').trim(),
      icNumber: (raw.icNumber || '').trim(),
      phone: raw.phone ? raw.phone.trim() : undefined,
      patientType: (raw.patientType as PatientType) || 'Existing',
      isActive,
      appointments,
      nextTca,
      bloodInvestigationDate: bloodDate,
      bloodInvestigations: activeInvs,
      bloodOther: activeOther,
      plan: activePlan,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  async addAppointment(
    patientId: string,
    aptData: Omit<TCAAppointment, 'id' | 'patientId' | 'createdAt' | 'updatedAt'>
  ): Promise<TCAAppointment> {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const now = new Date().toISOString();
    const aptId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newApt: TCAAppointment = {
      ...aptData,
      id: aptId,
      patientId,
      status: aptData.status || 'Scheduled',
      bloodInvestigations: Array.isArray(aptData.bloodInvestigations) ? aptData.bloodInvestigations : [],
      createdAt: now,
      updatedAt: now
    };

    const appointments = [...(patient.appointments || []), newApt];
    await this.save({
      ...patient,
      appointments
    });

    return newApt;
  }

  async updateAppointment(
    patientId: string,
    aptId: string,
    updates: Partial<TCAAppointment>
  ): Promise<TCAAppointment> {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const appointments = [...(patient.appointments || [])];
    const index = appointments.findIndex(a => a.id === aptId);
    if (index === -1) throw new Error(`Appointment ${aptId} not found`);

    const now = new Date().toISOString();
    const updatedApt: TCAAppointment = {
      ...appointments[index],
      ...updates,
      updatedAt: now
    };

    if (updates.status === 'Attended' && !updatedApt.attendedAt) {
      updatedApt.attendedAt = now;
    }

    appointments[index] = updatedApt;

    await this.save({
      ...patient,
      appointments
    });

    return updatedApt;
  }

  async rescheduleAppointment(
    patientId: string,
    oldAptId: string,
    newAptData: {
      tcaDate: string;
      notes?: string;
      plan?: string;
      bloodInvestigationDate?: string;
      bloodInvestigations?: string[];
      bloodOther?: string;
    }
  ): Promise<{ oldApt: TCAAppointment; newApt: TCAAppointment }> {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const appointments = [...(patient.appointments || [])];
    const oldIndex = appointments.findIndex(a => a.id === oldAptId);
    if (oldIndex === -1) throw new Error(`Appointment ${oldAptId} not found`);

    const now = new Date().toISOString();
    const newAptId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Mark old appointment as Rescheduled, referencing new appointment
    const oldApt: TCAAppointment = {
      ...appointments[oldIndex],
      status: 'Rescheduled',
      rescheduledToAppointmentId: newAptId,
      updatedAt: now
    };
    appointments[oldIndex] = oldApt;

    // Create new appointment
    const newApt: TCAAppointment = {
      id: newAptId,
      patientId,
      tcaDate: newAptData.tcaDate.trim(),
      status: 'Scheduled',
      notes: newAptData.notes ? newAptData.notes.trim() : `Rescheduled from ${oldApt.tcaDate}`,
      plan: newAptData.plan ? newAptData.plan.trim() : oldApt.plan,
      bloodInvestigationDate: newAptData.bloodInvestigationDate ? newAptData.bloodInvestigationDate.trim() : undefined,
      bloodInvestigations: Array.isArray(newAptData.bloodInvestigations) ? newAptData.bloodInvestigations : (oldApt.bloodInvestigations || []),
      bloodOther: newAptData.bloodOther ? newAptData.bloodOther.trim() : oldApt.bloodOther,
      rescheduledFromAppointmentId: oldAptId,
      createdAt: now,
      updatedAt: now
    };
    appointments.push(newApt);

    await this.save({
      ...patient,
      appointments
    });

    return { oldApt, newApt };
  }

  async setPatientActiveStatus(patientId: string, isActive: boolean): Promise<PatientRecord> {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    return this.save({
      ...patient,
      isActive
    });
  }

  async setPatientCategory(patientId: string, category: PatientType): Promise<PatientRecord> {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    return this.save({
      ...patient,
      patientType: category
    });
  }
}

export const recordStorage = new IndexedDBStorage();
