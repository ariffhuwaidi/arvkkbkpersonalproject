                                                                 
import { formatDisplayDate } from './date.js';

/**
 * Strips whitespace, hyphens, and slashes from a string for numeric/code matching.
 */
export function normalizeCode(val         )         {
  if (!val) return '';
  return val.replace(/[\s\-_/]/g, '').toLowerCase();
}

/**
 * Checks if a record matches a query string.
 * Criteria:
 * - Case-insensitive match across name, IC, phone, patient type, blood date,
 *   blood investigations (chips), bloodOther, and plan text.
 * - Ignore spaces and hyphens when matching IC and phone numbers.
 */
export function matchesQuery(record               , rawQuery        )          {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const normalizedQuery = normalizeCode(query);

  // 1. Name match
  if (record.name && record.name.toLowerCase().includes(query)) {
    return true;
  }

  // 2. Patient type match ("new" or "existing")
  if (record.patientType && record.patientType.toLowerCase().includes(query)) {
    return true;
  }

  // 3. IC number match (normalized comparison and standard substring)
  if (record.icNumber) {
    const rawIc = record.icNumber.toLowerCase();
    if (rawIc.includes(query)) return true;
    if (normalizedQuery && normalizeCode(record.icNumber).includes(normalizedQuery)) return true;
  }

  // 4. Phone number match (normalized and substring)
  if (record.phone) {
    const rawPhone = record.phone.toLowerCase();
    if (rawPhone.includes(query)) return true;
    if (normalizedQuery && normalizeCode(record.phone).includes(normalizedQuery)) return true;
  }

  // 5. Blood investigations chips match (e.g. "cd4", "vl", "fbc")
  if (Array.isArray(record.bloodInvestigations)) {
    for (const inv of record.bloodInvestigations) {
      if (inv.toLowerCase().includes(query)) {
        return true;
      }
    }
  }

  // 6. Blood other text match
  if (record.bloodOther && record.bloodOther.toLowerCase().includes(query)) {
    return true;
  }

  // 7. Plan text match
  if (record.plan && record.plan.toLowerCase().includes(query)) {
    return true;
  }

  // 8. Blood investigation date match (matches formatted DD/MM/YYYY text)
  if (record.bloodInvestigationDate) {
    const formatted = formatDisplayDate(record.bloodInvestigationDate);
    if (formatted.includes(query) || record.bloodInvestigationDate.includes(query)) {
      return true;
    }
  }

  // 9. TCA date match (matches formatted DD/MM/YYYY text)
  if (record.nextTca) {
    const formatted = formatDisplayDate(record.nextTca);
    if (formatted.includes(query) || record.nextTca.includes(query)) {
      return true;
    }
  }

  return false;
}

/**
 * Filters a list of records using search query and patient type filter.
 */
export function filterRecords(
  records                 ,
  query        ,
  typeFilter                    = 'all'
)                  {
  return records.filter((r) => {
    // 1. Patient type segmented filter
    if (typeFilter !== 'all' && r.patientType !== typeFilter) {
      return false;
    }

    // 2. Search query filter
    return matchesQuery(r, query);
  });
}
