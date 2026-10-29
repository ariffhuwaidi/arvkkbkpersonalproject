import type { TCAStatus, TCAGroupKey } from '../types';

/**
 * Converts ISO "YYYY-MM-DD" string to "DD/MM/YYYY".
 */
export function formatDisplayDate(isoDate?: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return '';
  }
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Returns today's date in local time as "YYYY-MM-DD".
 */
export function getLocalTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar days difference between today and the target date (target - today).
 * Normalizes both to local midnight to avoid timezone / daylight saving shifts.
 */
export function getDaysDifference(targetIsoDate: string): number {
  const [ty, tm, td] = targetIsoDate.split('-').map(Number);
  const targetMidnight = new Date(ty, tm - 1, td, 0, 0, 0, 0);

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / msPerDay);
}

/**
 * Calculates the date exactly 1 calendar month before the given ISO date,
 * clamping to the last valid day of that month (e.g. 31 Mar -> 28/29 Feb).
 */
export function getOneMonthBeforeISO(tcaIso: string): string {
  if (!tcaIso || !/^\d{4}-\d{2}-\d{2}$/.test(tcaIso)) {
    return '';
  }

  const [year, month, day] = tcaIso.split('-').map(Number);
  // Target month (0-indexed): (month - 1) - 1 = month - 2
  let targetYear = year;
  let targetMonth0 = month - 2;

  if (targetMonth0 < 0) {
    targetMonth0 = 11;
    targetYear -= 1;
  }

  // Find max days in target month
  const daysInTargetMonth = new Date(targetYear, targetMonth0 + 1, 0).getDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  const yStr = String(targetYear);
  const mStr = String(targetMonth0 + 1).padStart(2, '0');
  const dStr = String(clampedDay).padStart(2, '0');
  return `${yStr}-${mStr}-${dStr}`;
}

/**
 * Checks whether an ISO date is strictly before device's local today.
 */
export function isDatePast(isoDate?: string): boolean {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  return getDaysDifference(isoDate) < 0;
}

/**
 * Computes the relative friendly string for a TCA date.
 */
export function getRelativeTCALabel(isoDate: string): string {
  const daysDiff = getDaysDifference(isoDate);

  if (daysDiff < 0) {
    const abs = Math.abs(daysDiff);
    return abs === 1 ? 'Overdue (yesterday)' : `Overdue by ${abs} days`;
  }
  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Tomorrow';
  if (daysDiff <= 7) return `In ${daysDiff} days`;

  const weeks = Math.round(daysDiff / 7);
  if (weeks <= 4) return `In ${weeks} weeks`;
  return `In ${Math.round(daysDiff / 30)} months`;
}

/**
 * Computes the TCA status indicator based on calendar difference.
 */
export function getTCAStatus(isoDate?: string): TCAStatus {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { type: 'none', label: '' };
  }

  const daysDiff = getDaysDifference(isoDate);
  const formattedDate = formatDisplayDate(isoDate);

  if (daysDiff < 0) {
    const absDays = Math.abs(daysDiff);
    return {
      type: 'overdue',
      label: absDays === 1 ? 'Overdue (yesterday)' : `Overdue (${absDays}d)`,
      daysDiff,
      formattedDate
    };
  }

  if (daysDiff === 0) {
    return {
      type: 'upcoming',
      label: 'Today',
      daysDiff,
      formattedDate
    };
  }

  if (daysDiff === 1) {
    return {
      type: 'upcoming',
      label: 'Tomorrow',
      daysDiff,
      formattedDate
    };
  }

  if (daysDiff <= 7) {
    return {
      type: 'upcoming',
      label: `In ${daysDiff} days`,
      daysDiff,
      formattedDate
    };
  }

  const weeks = Math.round(daysDiff / 7);
  const label = weeks <= 4 ? `In ${weeks}w` : `In ${Math.round(daysDiff / 30)}mo`;

  return {
    type: 'later',
    label,
    daysDiff,
    formattedDate
  };
}

/**
 * Categorizes a record's TCA into one of the 5 chronological groups:
 * - 'overdue': TCA < today
 * - 'this_week': today <= TCA <= today + 7 days
 * - 'this_month': TCA > today + 7 days AND within current calendar month
 * - 'later': TCA > end of current calendar month
 * - 'no_tca': no TCA set
 */
export function getTCAGroupKey(tcaIso?: string): TCAGroupKey {
  if (!tcaIso || !/^\d{4}-\d{2}-\d{2}$/.test(tcaIso)) {
    return 'no_tca';
  }

  const daysDiff = getDaysDifference(tcaIso);
  if (daysDiff < 0) return 'overdue';
  if (daysDiff <= 7) return 'this_week';

  const [ty, tm] = tcaIso.split('-').map(Number);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (ty === currentYear && tm === currentMonth) {
    return 'this_month';
  }

  return 'later';
}
