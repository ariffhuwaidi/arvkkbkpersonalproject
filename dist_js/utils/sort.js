import { BLOOD_INVESTIGATION_OPTIONS } from '../types.js';
export const SORT_STORAGE_KEY = 'arv_kkbk_sort_pref';
export const DEFAULT_SORT            = 'tca_asc';

export const SORT_OPTIONS                         = [
  { id: 'tca_asc', label: 'Next TCA (Earliest first)', shortLabel: 'TCA Earliest' },
  { id: 'tca_desc', label: 'Next TCA (Latest first)', shortLabel: 'TCA Latest' },
  { id: 'blood_asc', label: 'Blood date (Earliest first)', shortLabel: 'Blood Earliest' },
  { id: 'blood_desc', label: 'Blood date (Latest first)', shortLabel: 'Blood Latest' },
  { id: 'investigations_asc', label: 'Blood investigations', shortLabel: 'Investigations' },
  { id: 'plan_asc', label: 'Plan (A to Z)', shortLabel: 'Plan' },
  { id: 'name_asc', label: 'Name (A to Z)', shortLabel: 'Name A–Z' },
  { id: 'name_desc', label: 'Name (Z to A)', shortLabel: 'Name Z–A' },
  { id: 'ic_asc', label: 'IC Number', shortLabel: 'IC Number' },
  { id: 'phone_asc', label: 'Phone Number', shortLabel: 'Phone' },
];

const INV_ORDER_MAP = new Map                (
  BLOOD_INVESTIGATION_OPTIONS.map((opt, idx) => [opt, idx])
);

export function getSavedSort()            {
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY)             ;
    if (saved && SORT_OPTIONS.some(o => o.id === saved)) {
      return saved;
    }
  } catch {}
  return DEFAULT_SORT;
}

export function saveSortPreference(sort           )       {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, sort);
  } catch {}
}

function compareTieBreaker(a               , b               )         {
  const nameComp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  if (nameComp !== 0) return nameComp;
  return a.id.localeCompare(b.id);
}

function getLowestInvestigationIndex(investigations           )         {
  if (!investigations || investigations.length === 0) return 999;
  let min = 999;
  for (const inv of investigations) {
    const idx = INV_ORDER_MAP.get(inv);
    if (idx !== undefined && idx < min) {
      min = idx;
    }
  }
  return min;
}

export function sortRecords(records                 , sort           )                  {
  return [...records].sort((a, b) => {
    switch (sort) {
      case 'name_asc': {
        const valA = (a.name || '').trim();
        const valB = (b.name || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return comp !== 0 ? comp : a.id.localeCompare(b.id);
      }

      case 'name_desc': {
        const valA = (a.name || '').trim();
        const valB = (b.name || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valB.localeCompare(valA, undefined, { sensitivity: 'base' });
        return comp !== 0 ? comp : a.id.localeCompare(b.id);
      }

      case 'ic_asc': {
        const valA = (a.icNumber || '').trim();
        const valB = (b.icNumber || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
        return comp !== 0 ? comp : compareTieBreaker(a, b);
      }

      case 'phone_asc': {
        const valA = (a.phone || '').trim();
        const valB = (b.phone || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
        return comp !== 0 ? comp : compareTieBreaker(a, b);
      }

      case 'investigations_asc': {
        const emptyA = !a.bloodInvestigations || a.bloodInvestigations.length === 0;
        const emptyB = !b.bloodInvestigations || b.bloodInvestigations.length === 0;
        if (emptyA && emptyB) return compareTieBreaker(a, b);
        if (emptyA) return 1; // empty goes last
        if (emptyB) return -1;

        const minA = getLowestInvestigationIndex(a.bloodInvestigations);
        const minB = getLowestInvestigationIndex(b.bloodInvestigations);
        if (minA !== minB) return minA - minB;

        // Tied on first investigation: compare count
        const countDiff = a.bloodInvestigations.length - b.bloodInvestigations.length;
        return countDiff !== 0 ? countDiff : compareTieBreaker(a, b);
      }

      case 'plan_asc': {
        const valA = (a.plan || '').trim();
        const valB = (b.plan || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1; // empty goes last
        if (!valB) return -1;
        const comp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return comp !== 0 ? comp : compareTieBreaker(a, b);
      }

      case 'tca_asc': {
        const valA = (a.nextTca || '').trim();
        const valB = (b.nextTca || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valA.localeCompare(valB);
        return comp !== 0 ? comp : compareTieBreaker(a, b);
      }

      case 'tca_desc': {
        const valA = (a.nextTca || '').trim();
        const valB = (b.nextTca || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valB.localeCompare(valA);
        return comp !== 0 ? comp : compareTieBreaker(a, b);
      }

      case 'blood_asc': {
        const valA = (a.bloodInvestigationDate || '').trim();
        const valB = (b.bloodInvestigationDate || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valA.localeCompare(valB);
        return comp !== 0 ? comp : compareTieBreaker(a, b);
      }

      case 'blood_desc': {
        const valA = (a.bloodInvestigationDate || '').trim();
        const valB = (b.bloodInvestigationDate || '').trim();
        if (!valA && !valB) return compareTieBreaker(a, b);
        if (!valA) return 1;
        if (!valB) return -1;
        const comp = valB.localeCompare(valA);
        return comp !== 0 ? comp : compareTieBreaker(a, b);
      }

      default:
        return compareTieBreaker(a, b);
    }
  });
}
