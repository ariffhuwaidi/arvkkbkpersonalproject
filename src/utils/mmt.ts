import type { AppointmentStatus, MMTDoseChange, MMTDoseLogEntry, MMTProfile, MMTDoseStatus, MMTReview, MMTTakeHome, MMTUrineTest, PatientRecord, ProgramId, UrineResult } from '../types';

/**
 * Pure MMT helpers. Dates are YYYY-MM-DD strings; "today" is always passed in
 * so the logic is easy to test.
 */

/** Days of fully missed doses before a patient is listed under "Needs follow-up". */
export const MISSED_DOSE_ALERT_DAYS = 3;
/** A urine test is considered due when the last one is older than this. */
export const URINE_INTERVAL_DAYS = 30;

export function programsOf(record: PatientRecord): ProgramId[] {
  return record.programs && record.programs.length ? record.programs : ['ARV'];
}

export function inProgram(record: PatientRecord, program: ProgramId): boolean {
  return programsOf(record).includes(program);
}

function toUTC(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const dt = new Date(toUTC(iso) + days * 86400000);
  return dt.toISOString().slice(0, 10);
}

/** b - a, in whole days. */
export function daysBetween(aIso: string, bIso: string): number {
  return Math.round((toUTC(bIso) - toUTC(aIso)) / 86400000);
}

export function newMMTProfile(init: Partial<MMTProfile> = {}, nowIso = new Date().toISOString()): MMTProfile {
  return {
    dispensing: 'Daily',
    doseHistory: [],
    doseLog: [],
    urineTests: [],
    takeHomes: [],
    reviews: [],
    ...init,
    updatedAt: nowIso
  };
}

/** Last day covered by a take-home supply that includes or follows `date`. */
function takeHomeCovering(mmt: MMTProfile, date: string) {
  return mmt.takeHomes.find(t => {
    const end = addDays(t.startDate, Math.max(1, t.days) - 1);
    return date >= t.startDate && date <= end;
  });
}

/** What happened on a given day: a logged entry wins, then a take-home supply, else nothing yet. */
export function doseStatusOn(mmt: MMTProfile, date: string): MMTDoseStatus | null {
  const logged = mmt.doseLog.find(e => e.date === date);
  if (logged) return logged.status;
  if (takeHomeCovering(mmt, date)) return 'Take-home';
  return null;
}

/** The latest date on which the patient is known to have had medication. */
export function lastCoveredDate(mmt: MMTProfile): string | null {
  let last: string | null = null;
  for (const e of mmt.doseLog) {
    if ((e.status === 'Dispensed' || e.status === 'Take-home') && (!last || e.date > last)) last = e.date;
  }
  for (const t of mmt.takeHomes) {
    const end = addDays(t.startDate, Math.max(1, t.days) - 1);
    if (!last || end > last) last = end;
  }
  return last;
}

/**
 * Whole days missed before today. Today is not counted because the dose may still be given.
 * Falls back to the start date when nothing has ever been logged.
 */
export function missedDays(mmt: MMTProfile, today: string): number {
  const base = lastCoveredDate(mmt) ?? (mmt.startDate ? addDays(mmt.startDate, -1) : null);
  if (!base) return 0;
  // days strictly between base and today
  return Math.max(0, daysBetween(base, today) - 1);
}

export function latestUrine(mmt: MMTProfile): MMTUrineTest | null {
  if (mmt.urineTests.length === 0) return null;
  return [...mmt.urineTests].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function urineDue(mmt: MMTProfile, today: string): boolean {
  const last = latestUrine(mmt);
  if (!last) return true;
  return daysBetween(last.date, today) > URINE_INTERVAL_DAYS;
}

/** Earliest review that is still scheduled. */
export function nextReview(mmt: MMTProfile): MMTReview | null {
  const open = mmt.reviews.filter(r => r.status === 'Scheduled');
  if (open.length === 0) return null;
  return [...open].sort((a, b) => a.date.localeCompare(b.date))[0];
}

export type MMTFollowUpReason = 'missed' | 'review_overdue';

/** Why a patient needs follow-up, if at all. Inactive patients never do. */
export function followUpReasons(record: PatientRecord, today: string): MMTFollowUpReason[] {
  const mmt = record.mmt;
  if (!mmt || record.isActive === false || !inProgram(record, 'MMT')) return [];
  const reasons: MMTFollowUpReason[] = [];
  if (missedDays(mmt, today) >= MISSED_DOSE_ALERT_DAYS) reasons.push('missed');
  const review = nextReview(mmt);
  if (review && review.date < today) reasons.push('review_overdue');
  return reasons;
}

export type MMTReviewGroup = 'follow_up' | 'this_week' | 'later' | 'none';

export function reviewGroup(record: PatientRecord, today: string): MMTReviewGroup {
  if (followUpReasons(record, today).length > 0) return 'follow_up';
  const review = record.mmt ? nextReview(record.mmt) : null;
  if (!review) return 'none';
  return daysBetween(today, review.date) <= 7 ? 'this_week' : 'later';
}

// ---- Cleaning MMT data that comes from outside (imports, Drive, sync) --------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID = /^[\w-]{1,80}$/;
const DOSE_STATUSES: MMTDoseStatus[] = ['Dispensed', 'Missed', 'Take-home'];
const URINE_RESULTS: UrineResult[] = ['Negative', 'Positive', 'Pending'];
const REVIEW_STATUSES: AppointmentStatus[] = ['Scheduled', 'Attended', 'DNA', 'Rescheduled', 'Cancelled'];

function mmtCleanDate(v: unknown): string | undefined {
  return typeof v === 'string' && ISO_DATE.test(v.trim()) ? v.trim() : undefined;
}

function mmtCleanNum(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function mmtCleanText(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function mmtCleanId(v: unknown, prefix: string, i: number): string {
  return typeof v === 'string' && SAFE_ID.test(v) ? v : `${prefix}_${i}_${Math.random().toString(36).slice(2, 8)}`;
}

function mmtCleanList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
}

/**
 * Rebuilds an MMT block from untrusted data, keeping only known values.
 * Dates must be YYYY-MM-DD, statuses must be known, ids must be plain. Free
 * text (notes, reasons, substances) is kept and escaped wherever it is shown.
 * Returns undefined when the input is not an object.
 */
export function sanitizeMMT(raw: unknown): MMTProfile | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const m = raw as Record<string, unknown>;
  const now = new Date().toISOString();

  const doseHistory: MMTDoseChange[] = [];
  mmtCleanList(m.doseHistory).forEach((h, i) => {
    const date = mmtCleanDate(h.date); const doseMg = mmtCleanNum(h.doseMg);
    if (date && doseMg !== undefined) doseHistory.push({ id: mmtCleanId(h.id, 'dh', i), date, doseMg, ...(mmtCleanText(h.reason) ? { reason: mmtCleanText(h.reason) } : {}) });
  });

  const doseLog: MMTDoseLogEntry[] = [];
  mmtCleanList(m.doseLog).forEach(e => {
    const date = mmtCleanDate(e.date);
    if (!date || !DOSE_STATUSES.includes(e.status as MMTDoseStatus)) return;
    const doseMg = mmtCleanNum(e.doseMg);
    doseLog.push({ date, status: e.status as MMTDoseStatus, ...(doseMg !== undefined ? { doseMg } : {}) });
  });

  const urineTests: MMTUrineTest[] = [];
  mmtCleanList(m.urineTests).forEach((u, i) => {
    const date = mmtCleanDate(u.date);
    if (!date) return;
    const result = URINE_RESULTS.includes(u.result as UrineResult) ? (u.result as UrineResult) : 'Pending';
    urineTests.push({ id: mmtCleanId(u.id, 'ut', i), date, result, ...(mmtCleanText(u.substances) ? { substances: mmtCleanText(u.substances) } : {}), ...(mmtCleanText(u.notes) ? { notes: mmtCleanText(u.notes) } : {}) });
  });

  const takeHomes: MMTTakeHome[] = [];
  mmtCleanList(m.takeHomes).forEach((t, i) => {
    const startDate = mmtCleanDate(t.startDate); const days = mmtCleanNum(t.days);
    if (!startDate || days === undefined || days < 1 || !Number.isInteger(days)) return;
    const doseMg = mmtCleanNum(t.doseMg);
    takeHomes.push({ id: mmtCleanId(t.id, 'th', i), startDate, days, ...(doseMg !== undefined ? { doseMg } : {}), ...(mmtCleanText(t.notes) ? { notes: mmtCleanText(t.notes) } : {}) });
  });

  const reviews: MMTReview[] = [];
  mmtCleanList(m.reviews).forEach((r, i) => {
    const date = mmtCleanDate(r.date);
    if (!date) return;
    const status = REVIEW_STATUSES.includes(r.status as AppointmentStatus) ? (r.status as AppointmentStatus) : 'Scheduled';
    reviews.push({
      id: mmtCleanId(r.id, 'rv', i), date, status,
      ...(mmtCleanText(r.notes) ? { notes: mmtCleanText(r.notes) } : {}),
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now
    });
  });

  const startDate = mmtCleanDate(m.startDate);
  const currentDoseMg = mmtCleanNum(m.currentDoseMg);
  const notes = mmtCleanText(m.notes);
  return {
    ...(startDate ? { startDate } : {}),
    ...(currentDoseMg !== undefined ? { currentDoseMg } : {}),
    dispensing: m.dispensing === 'Take-home' ? 'Take-home' : 'Daily',
    doseHistory, doseLog, urineTests, takeHomes, reviews,
    ...(notes ? { notes } : {}),
    updatedAt: typeof m.updatedAt === 'string' ? m.updatedAt : now
  };
}
