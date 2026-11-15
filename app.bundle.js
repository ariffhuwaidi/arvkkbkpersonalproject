(() => {
  "use strict";

  // --- Module: types ---
                                             
                                          

                                                           

                                          

                                                                                               

                                 
                                                     
                    
                                            
                            
                 
                
                                  
                                
                      
                                      
                                        
                      
                    
                    
 

                                                                                                   

                                             
                             
                    
                                                  
                                                                
                                
                                                                           
                                                   
                                                                               
                      
                 
                             
                           
                             
                    
                    
 

const BLOOD_INVESTIGATION_OPTIONS = [
  'VL',
  'CD4',
  'FBC',
  'FBS',
  'HbA1c',
  'LFT',
  'AST',
  'RP',
  'FLP',
  'Other'
]         ;

                                                                                  

                                
                                  
               
                   
                 
                                                                   
                                                                          
                                                                      
                                                                                       

                                                                                           
                                             
                                                                                                   
                                                                                
                                                                               
                                                             
                                                 

                    
                    
 

                       
             
              
               
                
                        
              
              
               
            
                

                                       
                
                
                     
 

                                                    

                                                                      

                            
                      
                
                    
                                       
 

                                                                                      

                                     
                   
                
                           
 

                                 
                                   
                                                 
                                                                                                                                    
                                       
                                                                                   
                         
 

// Google Drive Integration Types
                                     
                   
               
                
                       
                    

                                        
             
               
                      
                
 

                                    
                   
                    
                    
 

// Message Generator Types
                                 
                      
                    
                  
                        
                      
             

                                                           

                                         
                                    
                    
                       
                 
                         
                   
                   
                
                  
                   
                        
                         
                     
 


  // --- Module: storage/storage-interface ---


  // --- Module: utils/date ---
                                                       

/**
 * Converts ISO "YYYY-MM-DD" string to "DD/MM/YYYY".
 */
function formatDisplayDate(isoDate         )         {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return '';
  }
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Returns today's date in local time as "YYYY-MM-DD".
 */
function getLocalTodayISO()         {
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
function getDaysDifference(targetIsoDate        )         {
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
function getOneMonthBeforeISO(tcaIso        )         {
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
function isDatePast(isoDate         )          {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  return getDaysDifference(isoDate) < 0;
}

/**
 * Computes the relative friendly string for a TCA date.
 */
function getRelativeTCALabel(isoDate        )         {
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
function getTCAStatus(isoDate         )            {
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
function getTCAGroupKey(tcaIso         )              {
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


  // --- Module: utils/theme ---
const THEME_STORAGE_KEY = 'arv_kkbk_theme_pref';
const DEFAULT_THEME            = 'system';

class ThemeManager {
          currentMode            = DEFAULT_THEME;
          mediaQuery                        = null;

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (this.mediaQuery && typeof this.mediaQuery.addEventListener === 'function') {
          this.mediaQuery.addEventListener('change', () => {
            if (this.currentMode === 'system') {
              this.applyTheme();
            }
          });
        }
      } catch {
        this.mediaQuery = null;
      }
    }
    this.currentMode = this.getSavedTheme();
  }

  getSavedTheme()            {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)             ;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // LocalStorage unavailable
    }
    return DEFAULT_THEME;
  }

  getMode()            {
    return this.currentMode;
  }

  isDark()          {
    if (this.currentMode === 'dark') return true;
    if (this.currentMode === 'light') return false;
    return this.mediaQuery ? Boolean(this.mediaQuery.matches) : false;
  }

  setTheme(mode           )       {
    this.currentMode = mode;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // LocalStorage unavailable
    }
    this.applyTheme();
  }

  applyTheme()       {
    const isDark = this.isDark();
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Update iOS Safari / browser theme-color meta tag
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', isDark ? '#1C1C1E' : '#F2F2F7');
  }
}

const themeManager = new ThemeManager();


  // --- Module: utils/search ---
                                                                 
/**
 * Strips whitespace, hyphens, and slashes from a string for numeric/code matching.
 */
function normalizeCode(val         )         {
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
function matchesQuery(record               , rawQuery        )          {
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
function filterRecords(
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


  // --- Module: utils/sort ---
const SORT_STORAGE_KEY = 'arv_kkbk_sort_pref';
const DEFAULT_SORT            = 'tca_asc';

const SORT_OPTIONS                         = [
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

function getSavedSort()            {
  try {
    const saved = localStorage.getItem(SORT_STORAGE_KEY)             ;
    if (saved && SORT_OPTIONS.some(o => o.id === saved)) {
      return saved;
    }
  } catch {}
  return DEFAULT_SORT;
}

function saveSortPreference(sort           )       {
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

function sortRecords(records                 , sort           )                  {
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


  // --- Module: utils/demo-data ---
                                                              
function getOffsetDateISO(daysOffset        )         {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generates an explicitly fictional demo dataset showcasing:
 * - Patient Category: New Patient & Existing Patient.
 * - Active & Deactivated records.
 * - Multiple TCA appointments per patient (Upcoming Scheduled + TCA History: Attended, DNA, Rescheduled).
 * - Preserved blood investigations and follow-up plans.
 */
function generateDemoRecords()                  {
  const now = new Date().toISOString();

  const pastApt1 = getOffsetDateISO(-90); // 3 months ago (Attended)
  const pastApt2 = getOffsetDateISO(-30); // 1 month ago (Attended)
  const pastAptDna = getOffsetDateISO(-14); // 2 weeks ago (DNA)
  const overdueTca = getOffsetDateISO(-3); // Overdue by 3 days
  const todayTca = getOffsetDateISO(0);    // Today
  const soonTca = getOffsetDateISO(4);     // In 4 days (This week)
  const laterTca = getOffsetDateISO(35);   // Later next month

  // Patient 1: Overdue scheduled TCA + 1 Attended historical TCA
  const p1Apts                   = [
    {
      id: 'apt-001-hist1',
      patientId: 'demo-rec-001',
      tcaDate: pastApt1,
      status: 'Attended',
      attendedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      notes: 'Attended on time. Dispensed 2-month TLD supply.',
      plan: 'Stable on TLD regimen. Repeat FBC, Renal Profile, and LFT next visit.',
      bloodInvestigationDate: getOneMonthBeforeISO(pastApt1),
      bloodInvestigations: ['VL', 'CD4', 'FBC', 'RP'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'apt-001-curr',
      patientId: 'demo-rec-001',
      tcaDate: overdueTca,
      status: 'Scheduled',
      notes: 'Patient overdue for follow-up review',
      plan: 'Repeat viral load check and renal profile. Assess adherence.',
      bloodInvestigationDate: getOneMonthBeforeISO(overdueTca),
      bloodInvestigations: ['VL', 'CD4', 'FBC', 'RP'],
      createdAt: now,
      updatedAt: now
    }
  ];

  // Patient 2: New Patient, Scheduled TCA for today + 1 DNA visit
  const p2Apts                   = [
    {
      id: 'apt-002-dna',
      patientId: 'demo-rec-002',
      tcaDate: pastAptDna,
      status: 'DNA',
      notes: 'Patient did not attend appointment. Traced via phone.',
      plan: 'Reschedule urgently for adherence counseling session.',
      bloodInvestigationDate: getOneMonthBeforeISO(pastAptDna),
      bloodInvestigations: ['VL', 'FBS'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'apt-002-today',
      patientId: 'demo-rec-002',
      tcaDate: todayTca,
      status: 'Scheduled',
      notes: 'Follow-up after DNA. Fasting for FBS & FLP.',
      plan: 'Adherence counseling session scheduled. Fasting lipid profile (FLP) & FBS review.',
      bloodInvestigationDate: getOneMonthBeforeISO(todayTca),
      bloodInvestigations: ['VL', 'FBS', 'FLP'],
      createdAt: now,
      updatedAt: now
    }
  ];

  // Patient 3: Existing Patient with Rescheduled appointment history
  const p3Apts                   = [
    {
      id: 'apt-003-old',
      patientId: 'demo-rec-003',
      tcaDate: getOffsetDateISO(-5),
      status: 'Rescheduled',
      rescheduledToAppointmentId: 'apt-003-new',
      notes: 'Patient called to request postponement due to work outstation.',
      plan: 'CD4 count 650 cells/uL, Viral Load undetectable. Dispense 3-month antiretroviral supply.',
      bloodInvestigationDate: getOneMonthBeforeISO(getOffsetDateISO(-5)),
      bloodInvestigations: ['VL', 'CD4', 'Other'],
      bloodOther: 'TFT & urine protein',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'apt-003-new',
      patientId: 'demo-rec-003',
      tcaDate: soonTca,
      status: 'Scheduled',
      rescheduledFromAppointmentId: 'apt-003-old',
      notes: 'Rescheduled from last week.',
      plan: 'CD4 count 650 cells/uL, Viral Load undetectable. Dispense 3-month antiretroviral supply.',
      bloodInvestigationDate: getOneMonthBeforeISO(soonTca),
      bloodInvestigations: ['VL', 'CD4', 'Other'],
      bloodOther: 'TFT & urine protein',
      createdAt: now,
      updatedAt: now
    }
  ];

  // Patient 4: Existing Patient with 1 upcoming TCA + 1 Attended
  const p4Apts                   = [
    {
      id: 'apt-004-att',
      patientId: 'demo-rec-004',
      tcaDate: pastApt2,
      status: 'Attended',
      attendedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      notes: 'Routine visit completed.',
      plan: 'Annual biochemical surveillance. Hep B sAg non-reactive, anti-HCV negative.',
      bloodInvestigationDate: getOneMonthBeforeISO(pastApt2),
      bloodInvestigations: ['LFT', 'AST', 'RP'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'apt-004-later',
      patientId: 'demo-rec-004',
      tcaDate: laterTca,
      status: 'Scheduled',
      notes: 'Routine 6-month check.',
      plan: 'Annual biochemical surveillance. Hep B sAg non-reactive, anti-HCV negative.',
      bloodInvestigationDate: getOneMonthBeforeISO(laterTca),
      bloodInvestigations: ['LFT', 'AST', 'RP'],
      createdAt: now,
      updatedAt: now
    }
  ];

  return [
    {
      id: 'demo-rec-001',
      name: 'Demo Patient 01 (Ah Kow)',
      icNumber: '000101-00-0001',
      phone: '012-0000001',
      patientType: 'Existing',
      isActive: true,
      appointments: p1Apts,
      nextTca: overdueTca,
      bloodInvestigationDate: getOneMonthBeforeISO(overdueTca),
      bloodInvestigations: ['VL', 'CD4', 'FBC', 'RP'],
      bloodOther: undefined,
      plan: 'Repeat viral load check and renal profile. Assess adherence.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-002',
      name: 'Demo Patient 02 (Siti)',
      icNumber: '000202-00-0002',
      phone: '019-0000002',
      patientType: 'New',
      isActive: true,
      appointments: p2Apts,
      nextTca: todayTca,
      bloodInvestigationDate: getOneMonthBeforeISO(todayTca),
      bloodInvestigations: ['VL', 'FBS', 'FLP'],
      bloodOther: undefined,
      plan: 'Adherence counseling session scheduled. Fasting lipid profile (FLP) & FBS review.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-003',
      name: 'Demo Patient 03 (Muthu)',
      icNumber: '000303-00-0003',
      phone: '013-0000003',
      patientType: 'Existing',
      isActive: true,
      appointments: p3Apts,
      nextTca: soonTca,
      bloodInvestigationDate: getOneMonthBeforeISO(soonTca),
      bloodInvestigations: ['VL', 'CD4', 'Other'],
      bloodOther: 'TFT & urine protein',
      plan: 'CD4 count 650 cells/uL, Viral Load undetectable. Dispense 3-month antiretroviral supply.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-004',
      name: 'Demo Patient 04 (Tan)',
      icNumber: '000404-00-0004',
      phone: '011-0000004',
      patientType: 'Existing',
      isActive: false, // Showcasing Deactivated / Inactive patient
      appointments: p4Apts,
      nextTca: laterTca,
      bloodInvestigationDate: getOneMonthBeforeISO(laterTca),
      bloodInvestigations: ['LFT', 'AST', 'RP'],
      bloodOther: undefined,
      plan: 'Annual biochemical surveillance. Hep B sAg non-reactive, anti-HCV negative.',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'demo-rec-005',
      name: 'Demo Patient 05 (Fatimah)',
      icNumber: '000505-00-0005',
      phone: '017-0000005',
      patientType: 'New',
      isActive: true,
      appointments: [],
      nextTca: undefined, // No TCA scheduled
      bloodInvestigationDate: undefined,
      bloodInvestigations: [],
      bloodOther: undefined,
      plan: 'Newly transferred from private GP clinic. Awaiting baseline workup.',
      createdAt: now,
      updatedAt: now
    }
  ];
}


  // --- Module: storage/indexeddb-storage ---
             
                
                 
              
                 
                             
                       
                  

const DB_NAME = 'arv_kkbk_db';
const DB_VERSION = 5;
const STORE_NAME = 'records';

class IndexedDBStorage                           {
          dbPromise                              = null;

          getDB()                       {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event                       ) => {
          const db = (event.target                    ).result;
          const oldVersion = event.oldVersion;

          let store                ;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('icNumber', 'icNumber', { unique: false });
            store.createIndex('name', 'name', { unique: false });
            store.createIndex('nextTca', 'nextTca', { unique: false });
          } else {
            store = (event.target                    ).transaction .objectStore(STORE_NAME);
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

              // Migration for version < 5: separate blood collections history
              if (oldVersion < 5) {
                if (!Array.isArray(val.bloodCollections)) {
                  val.bloodCollections = [];
                  if (val.bloodInvestigationDate) {
                    val.bloodCollections.push({
                      id: `bld_migrated_${val.id}`,
                      patientId: val.id,
                      scheduledDate: val.bloodInvestigationDate,
                      scheduledTime: 'Before 8.30 am',
                      status: 'Scheduled',
                      bloodInvestigations: val.bloodInvestigations || [],
                      bloodOther: val.bloodOther,
                      notes: 'Initial scheduled blood collection',
                      createdAt: val.createdAt || new Date().toISOString(),
                      updatedAt: val.updatedAt || new Date().toISOString()
                    });
                    val.currentBloodStatus = 'Scheduled';
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

  async list()                           {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result         ).map(r => this.normalizeRecord(r));
        resolve(list);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async get(id        )                                {
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

  async save(record                                                                                             )                         {
    const db = await this.getDB();
    const now = new Date().toISOString();

    const existing = record.id ? await this.get(record.id) : null;
    const investigations = Array.isArray(record.bloodInvestigations) ? record.bloodInvestigations : [];
    const isOtherTicked = investigations.includes('Other');
    const patientId = record.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

    // Manage TCA appointments
    let appointments                   = [];
    if (Array.isArray(record.appointments) && record.appointments.length > 0) {
      appointments = record.appointments;
    } else if (existing && Array.isArray(existing.appointments) && existing.appointments.length > 0) {
      appointments = [...existing.appointments];
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

    // Manage Blood Collection appointments
    let bloodCollections                               = [];
    if (Array.isArray(record.bloodCollections) && record.bloodCollections.length > 0) {
      bloodCollections = record.bloodCollections;
    } else if (existing && Array.isArray(existing.bloodCollections) && existing.bloodCollections.length > 0) {
      bloodCollections = [...existing.bloodCollections];
      if (record.bloodInvestigationDate && record.bloodInvestigationDate.trim()) {
        const scheduledBldIndex = bloodCollections.findIndex(b => b.status === 'Scheduled');
        if (scheduledBldIndex >= 0) {
          bloodCollections[scheduledBldIndex] = {
            ...bloodCollections[scheduledBldIndex],
            scheduledDate: record.bloodInvestigationDate.trim(),
            bloodInvestigations: investigations,
            bloodOther: isOtherTicked && record.bloodOther ? record.bloodOther.trim() : undefined,
            updatedAt: now
          };
        } else {
          bloodCollections.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            patientId,
            scheduledDate: record.bloodInvestigationDate.trim(),
            scheduledTime: 'Before 8.30 am',
            status: 'Scheduled',
            bloodInvestigations: investigations,
            bloodOther: isOtherTicked && record.bloodOther ? record.bloodOther.trim() : undefined,
            notes: 'Scheduled blood collection',
            createdAt: now,
            updatedAt: now
          });
        }
      }
    } else if (record.bloodInvestigationDate && record.bloodInvestigationDate.trim()) {
      bloodCollections = [{
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        patientId,
        scheduledDate: record.bloodInvestigationDate.trim(),
        scheduledTime: 'Before 8.30 am',
        status: 'Scheduled',
        bloodInvestigations: investigations,
        bloodOther: isOtherTicked && record.bloodOther ? record.bloodOther.trim() : undefined,
        notes: 'Initial blood collection',
        createdAt: now,
        updatedAt: now
      }];
    }

    const preRecord      = {
      id: patientId,
      name: record.name.trim(),
      icNumber: record.icNumber.trim(),
      phone: record.phone ? record.phone.trim() : undefined,
      patientType: record.patientType || existing?.patientType || 'Existing',
      isActive: record.isActive !== undefined ? Boolean(record.isActive) : (existing?.isActive !== undefined ? existing.isActive : true),
      appointments,
      bloodCollections,
      nextTca: record.nextTca ? record.nextTca.trim() : undefined,
      bloodInvestigationDate: record.bloodInvestigationDate ? record.bloodInvestigationDate.trim() : undefined,
      currentBloodStatus: record.currentBloodStatus || existing?.currentBloodStatus,
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

  async delete(id        )                   {
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

  async clear()                {
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

  async bulkImport(records                 , mode                     )                             {
    const db = await this.getDB();
    const existingList = mode === 'merge' ? await this.list() : [];
    const existingByIC = new Map                       ();
    const existingById = new Map                       ();

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
        const recordToSave                = {
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

         normalizeRecord(raw     )                {
    const plan = raw.plan !== undefined ? raw.plan : (raw.bloodInvestigationsPlan || undefined);
    const investigations = Array.isArray(raw.bloodInvestigations) ? raw.bloodInvestigations : [];
    const isOther = investigations.includes('Other');
    const isActive = raw.isActive !== undefined ? Boolean(raw.isActive) : true;
    const patientId = raw.id;

    // Normalize TCA appointments
    let appointments                   = [];
    if (Array.isArray(raw.appointments) && raw.appointments.length > 0) {
      appointments = raw.appointments.map((apt     ) => {
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

    // Normalize Blood Collection appointments
    let bloodCollections                               = [];
    if (Array.isArray(raw.bloodCollections) && raw.bloodCollections.length > 0) {
      bloodCollections = raw.bloodCollections.map((b     ) => {
        const bInvs = Array.isArray(b.bloodInvestigations) ? b.bloodInvestigations : investigations;
        const isBOther = bInvs.includes('Other');
        return {
          id: b.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
          patientId: b.patientId || patientId,
          scheduledDate: (b.scheduledDate || '').trim(),
          scheduledTime: b.scheduledTime || 'Before 8.30 am',
          status: b.status || 'Scheduled',
          actualCollectionDate: b.actualCollectionDate,
          actualCollectionTime: b.actualCollectionTime,
          bloodInvestigations: bInvs,
          bloodOther: isBOther && b.bloodOther ? b.bloodOther.trim() : undefined,
          notes: b.notes ? b.notes.trim() : undefined,
          rescheduledReason: b.rescheduledReason ? b.rescheduledReason.trim() : undefined,
          rescheduledToId: b.rescheduledToId,
          rescheduledFromId: b.rescheduledFromId,
          createdAt: b.createdAt || raw.createdAt || new Date().toISOString(),
          updatedAt: b.updatedAt || raw.updatedAt || new Date().toISOString()
        };
      });
    } else if (raw.bloodInvestigationDate && typeof raw.bloodInvestigationDate === 'string' && raw.bloodInvestigationDate.trim()) {
      bloodCollections = [{
        id: `bld_migrated_${patientId}`,
        patientId,
        scheduledDate: raw.bloodInvestigationDate.trim(),
        scheduledTime: 'Before 8.30 am',
        status: 'Scheduled',
        bloodInvestigations: investigations,
        bloodOther: isOther && raw.bloodOther ? raw.bloodOther.trim() : undefined,
        notes: 'Initial scheduled blood collection',
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || new Date().toISOString()
      }];
    }

    // Determine latest upcoming scheduled TCA appointment for fast top-level access
    const scheduledApts = appointments.filter(a => a.status === 'Scheduled');
    let activeApt                            ;

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

    // Determine latest upcoming scheduled Blood Collection appointment
    const scheduledBld = bloodCollections.filter(b => b.status === 'Scheduled');
    let activeBld                                        ;

    if (scheduledBld.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = scheduledBld.filter(b => b.scheduledDate >= today).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
      if (upcoming.length > 0) {
        activeBld = upcoming[0];
      } else {
        const overdue = [...scheduledBld].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
        activeBld = overdue[0];
      }
    }

    const nextTca = activeApt ? activeApt.tcaDate : undefined;
    const bloodDate = activeBld ? activeBld.scheduledDate : (raw.bloodInvestigationDate ? raw.bloodInvestigationDate.trim() : undefined);
    const currentBloodStatus                                    = activeBld
      ? activeBld.status
      : (bloodCollections.length > 0 ? bloodCollections[bloodCollections.length - 1].status : undefined);

    const activeInvs = activeBld ? activeBld.bloodInvestigations : (activeApt ? activeApt.bloodInvestigations : investigations);
    const activeOther = activeBld ? activeBld.bloodOther : (activeApt ? activeApt.bloodOther : (isOther && raw.bloodOther ? raw.bloodOther.trim() : undefined));
    const activePlan = activeApt && activeApt.plan ? activeApt.plan : (plan ? plan.trim() : undefined);

    return {
      id: raw.id,
      name: (raw.name || '').trim(),
      icNumber: (raw.icNumber || '').trim(),
      phone: raw.phone ? raw.phone.trim() : undefined,
      patientType: (raw.patientType               ) || 'Existing',
      isActive,
      appointments,
      bloodCollections,
      nextTca,
      bloodInvestigationDate: bloodDate,
      currentBloodStatus,
      bloodInvestigations: activeInvs,
      bloodOther: activeOther,
      plan: activePlan,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  // --- TCA Appointment Methods ---
  async addAppointment(
    patientId        ,
    aptData                                                                      
  )                          {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const now = new Date().toISOString();
    const aptId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newApt                 = {
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
    patientId        ,
    aptId        ,
    updates                         
  )                          {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const appointments = [...(patient.appointments || [])];
    const index = appointments.findIndex(a => a.id === aptId);
    if (index === -1) throw new Error(`Appointment ${aptId} not found`);

    const now = new Date().toISOString();
    const updatedApt                 = {
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
    patientId        ,
    oldAptId        ,
    newAptData   
                      
                     
                    
                                      
                                     
                          
     
  )                                                              {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const appointments = [...(patient.appointments || [])];
    const oldIndex = appointments.findIndex(a => a.id === oldAptId);
    if (oldIndex === -1) throw new Error(`Appointment ${oldAptId} not found`);

    const now = new Date().toISOString();
    const newAptId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Mark old appointment as Rescheduled, referencing new appointment
    const oldApt                 = {
      ...appointments[oldIndex],
      status: 'Rescheduled',
      rescheduledToAppointmentId: newAptId,
      updatedAt: now
    };
    appointments[oldIndex] = oldApt;

    // Create new appointment
    const newApt                 = {
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

  // --- Blood Collection Methods (Requirement 1 & 2) ---
  async addBloodCollection(
    patientId        ,
    data   
                            
                             
                                     
                          
                     
     
  )                                      {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const now = new Date().toISOString();
    const bldId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newBld                             = {
      id: bldId,
      patientId,
      scheduledDate: data.scheduledDate.trim(),
      scheduledTime: data.scheduledTime || 'Before 8.30 am',
      status: 'Scheduled',
      bloodInvestigations: Array.isArray(data.bloodInvestigations) ? data.bloodInvestigations : (patient.bloodInvestigations || []),
      bloodOther: data.bloodOther || patient.bloodOther,
      notes: data.notes ? data.notes.trim() : undefined,
      createdAt: now,
      updatedAt: now
    };

    const bloodCollections = [...(patient.bloodCollections || []), newBld];
    await this.save({
      ...patient,
      bloodCollections
    });

    return newBld;
  }

  async updateBloodCollectionStatus(
    patientId        ,
    collectionId        ,
    newStatus                       ,
    actualDate         ,
    actualTime         ,
    notes         
  )                                      {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const collections = [...(patient.bloodCollections || [])];
    const index = collections.findIndex(c => c.id === collectionId);
    if (index === -1) throw new Error(`Blood collection ${collectionId} not found`);

    const now = new Date().toISOString();
    const updatedCollection                             = {
      ...collections[index],
      status: newStatus,
      actualCollectionDate: newStatus === 'Attended' ? (actualDate || new Date().toISOString().slice(0, 10)) : collections[index].actualCollectionDate,
      actualCollectionTime: newStatus === 'Attended' ? (actualTime || '08:15 AM') : collections[index].actualCollectionTime,
      notes: notes !== undefined ? notes : collections[index].notes,
      updatedAt: now
    };

    collections[index] = updatedCollection;

    await this.save({
      ...patient,
      bloodCollections: collections
    });

    return updatedCollection;
  }

  async rescheduleBloodCollection(
    patientId        ,
    oldCollectionId        ,
    newDate        ,
    reason         ,
    time         
  )                                                                                                     {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const collections = [...(patient.bloodCollections || [])];
    const oldIndex = collections.findIndex(c => c.id === oldCollectionId);
    if (oldIndex === -1) throw new Error(`Blood collection ${oldCollectionId} not found`);

    const now = new Date().toISOString();
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `bld_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Mark old collection as Rescheduled
    const oldCollection                             = {
      ...collections[oldIndex],
      status: 'Rescheduled',
      rescheduledReason: reason ? reason.trim() : 'Rescheduled to new date',
      rescheduledToId: newId,
      updatedAt: now
    };
    collections[oldIndex] = oldCollection;

    // Create new collection appointment
    const nextCollection                             = {
      id: newId,
      patientId,
      scheduledDate: newDate.trim(),
      scheduledTime: time || oldCollection.scheduledTime || 'Before 8.30 am',
      status: 'Scheduled',
      bloodInvestigations: [...oldCollection.bloodInvestigations],
      bloodOther: oldCollection.bloodOther,
      notes: reason ? `Rescheduled from ${oldCollection.scheduledDate}: ${reason.trim()}` : `Rescheduled from ${oldCollection.scheduledDate}`,
      rescheduledFromId: oldCollectionId,
      createdAt: now,
      updatedAt: now
    };
    collections.push(nextCollection);

    // Save patient profile — preserves all patient data, TCA appointments, investigations!
    await this.save({
      ...patient,
      bloodCollections: collections
    });

    return { oldCollection, nextCollection };
  }

  async setPatientActiveStatus(patientId        , isActive         )                         {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    return this.save({
      ...patient,
      isActive
    });
  }

  async setPatientCategory(patientId        , category             )                         {
    const patient = await this.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    return this.save({
      ...patient,
      patientType: category
    });
  }
}

const recordStorage = new IndexedDBStorage();


  // --- Module: components/toast ---
class ToastManager {
          el             ;
          timeoutId                = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'toast-container';
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.el);
  }

  show(message        , durationMs = 2400)       {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
    }

    this.el.textContent = message;
    this.el.classList.add('is-visible');

    this.timeoutId = window.setTimeout(() => {
      this.el.classList.remove('is-visible');
      this.timeoutId = null;
    }, durationMs);
  }
}

const toast = new ToastManager();


  // --- Module: components/confirm-sheet ---
                                 
                
                  
                        
                       
                          
 

class ConfirmSheet {
          overlayEl             ;
          resolvePromise                                        = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'alertdialog');
    this.overlayEl.setAttribute('aria-modal', 'true');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 400px; text-align: center;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-body" style="padding: 24px 20px 16px 20px; align-items: center;">
          <h3 class="sheet-title" id="confirm-title" style="font-size: 18px; margin-bottom: 8px;"></h3>
          <p id="confirm-message" style="font-size: 14.5px; line-height: 1.45;"></p>
        </div>
        <div class="sheet-footer" style="flex-direction: column; gap: 8px; padding: 12px 20px 16px 20px;">
          <button type="button" id="confirm-action-btn" class="btn-destructive" style="width: 100%; height: 44px;"></button>
          <button type="button" id="confirm-cancel-btn" class="btn-secondary" style="width: 100%; height: 44px; font-weight: 600;">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    const actionBtn = this.overlayEl.querySelector('#confirm-action-btn')                     ;
    const cancelBtn = this.overlayEl.querySelector('#confirm-cancel-btn')                     ;

    actionBtn.addEventListener('click', () => {
      this.close(true);
    });

    cancelBtn.addEventListener('click', () => {
      this.close(false);
    });

    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close(false);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close(false);
      }
    });
  }

         show(options                , triggerEl              )                   {
    this.previousActiveElement = triggerEl || (document.activeElement               );

    const titleEl = this.overlayEl.querySelector('#confirm-title')               ;
    const messageEl = this.overlayEl.querySelector('#confirm-message')               ;
    const actionBtn = this.overlayEl.querySelector('#confirm-action-btn')                     ;
    const cancelBtn = this.overlayEl.querySelector('#confirm-cancel-btn')                     ;

    titleEl.textContent = options.title;
    messageEl.textContent = options.message;
    actionBtn.textContent = options.confirmLabel || 'Confirm';
    cancelBtn.textContent = options.cancelLabel || 'Cancel';

    if (options.isDestructive !== false) {
      actionBtn.className = 'btn-destructive';
    } else {
      actionBtn.className = 'btn-primary';
    }

    this.overlayEl.classList.add('is-open');
    cancelBtn.focus();

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

          close(result         )       {
    if (!this.isOpen()) return;
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }

    if (this.resolvePromise) {
      this.resolvePromise(result);
      this.resolvePromise = null;
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}

const confirmSheet = new ConfirmSheet();


  // --- Module: utils/export-import ---
/**
 * Creates a downloadable JSON file of current records with appointment history.
 */
function exportRecordsToJSON(records                 )       {
  const payload                    = {
    app: 'ARV_KKBK',
    version: '4.0',
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    totalRecords: records.length,
    records
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateTag = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `arv_kkbk_backup_${dateTag}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

                                   
                 
                 
                            
                         
 

const ALLOWED_SET = new Set        (BLOOD_INVESTIGATION_OPTIONS);
const ALLOWED_STATUSES = new Set                   (['Scheduled', 'Attended', 'DNA', 'Rescheduled', 'Cancelled']);

/**
 * Validates an imported JSON string or parsed object against ARV KKBK schema.
 * Safely migrates schema version 1, 2, and 3 records to schema 4.
 */
function validateImportJSON(rawText        )                   {
  let parsed         ;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { valid: false, error: 'The selected file is not a valid JSON document.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, error: 'Invalid JSON root structure.' };
  }

  let recordList           ;
  let schemaVer = 1;

  if (Array.isArray(parsed)) {
    recordList = parsed;
  } else if ('records' in parsed && Array.isArray((parsed                          ).records)) {
    recordList = (parsed                          ).records;
    if ('schemaVersion' in parsed && typeof (parsed                              ).schemaVersion === 'number') {
      schemaVer = (parsed                             ).schemaVersion;
    }
  } else {
    return { valid: false, error: 'File missing "records" array. Please use an export generated from ARV KKBK.' };
  }

  const validRecords                  = [];
  for (let i = 0; i < recordList.length; i++) {
    const item = recordList[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Record at index ${i + 1} is invalid.` };
    }
    const r = item                           ;

    // Name and IC are strictly required
    if (typeof r.name !== 'string' || !r.name.trim()) {
      return { valid: false, error: `Record ${i + 1} is missing a required Name.` };
    }
    if (typeof r.icNumber !== 'string' || !r.icNumber.trim()) {
      return { valid: false, error: `Record "${r.name}" is missing a required IC number.` };
    }

    // Patient type / category: 'New' or 'Existing', defaults to 'Existing'
    let patientType              = 'Existing';
    if (r.patientType === 'New' || r.patientType === 'Existing') {
      patientType = r.patientType;
    }

    const isActive = r.isActive !== undefined ? Boolean(r.isActive) : true;
    const recordId = typeof r.id === 'string' && r.id ? r.id : `imp_${Date.now()}_${i}`;

    // Migration for Plan: if legacy bloodInvestigationsPlan is present and plan is missing, migrate text
    let plan                     = undefined;
    if (typeof r.plan === 'string' && r.plan.trim()) {
      plan = r.plan.trim();
    } else if (typeof r.bloodInvestigationsPlan === 'string' && r.bloodInvestigationsPlan.trim()) {
      plan = r.bloodInvestigationsPlan.trim();
    }

    // Blood investigations validation
    const investigations           = [];
    if (Array.isArray(r.bloodInvestigations)) {
      for (const inv of r.bloodInvestigations) {
        if (typeof inv === 'string' && ALLOWED_SET.has(inv)) {
          investigations.push(inv);
        } else {
          console.warn(`Ignoring unrecognized blood investigation option: "${inv}"`);
        }
      }
    }

    let bloodOther                     = undefined;
    if (investigations.includes('Other') && typeof r.bloodOther === 'string' && r.bloodOther.trim()) {
      bloodOther = r.bloodOther.trim();
    }

    const now = new Date().toISOString();
    const createdAt = typeof r.createdAt === 'string' ? r.createdAt : now;
    const updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : now;

    // Validate or synthesize appointments array
    let appointments                   = [];
    if (Array.isArray(r.appointments) && r.appointments.length > 0) {
      for (let aIdx = 0; aIdx < r.appointments.length; aIdx++) {
        const aptRaw = r.appointments[aIdx]                           ;
        if (!aptRaw || typeof aptRaw !== 'object') continue;

        const aptInvs           = [];
        if (Array.isArray(aptRaw.bloodInvestigations)) {
          for (const inv of aptRaw.bloodInvestigations) {
            if (typeof inv === 'string' && ALLOWED_SET.has(inv)) {
              aptInvs.push(inv);
            }
          }
        }

        const aptOther = aptInvs.includes('Other') && typeof aptRaw.bloodOther === 'string' && aptRaw.bloodOther.trim()
          ? aptRaw.bloodOther.trim()
          : undefined;

        let status                    = 'Scheduled';
        if (typeof aptRaw.status === 'string' && ALLOWED_STATUSES.has(aptRaw.status                     )) {
          status = aptRaw.status                     ;
        }

        appointments.push({
          id: typeof aptRaw.id === 'string' && aptRaw.id ? aptRaw.id : `apt_imp_${Date.now()}_${aIdx}`,
          patientId: recordId,
          tcaDate: typeof aptRaw.tcaDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(aptRaw.tcaDate.trim()) ? aptRaw.tcaDate.trim() : (typeof r.nextTca === 'string' ? r.nextTca : now.slice(0, 10)),
          status,
          notes: typeof aptRaw.notes === 'string' && aptRaw.notes.trim() ? aptRaw.notes.trim() : undefined,
          plan: typeof aptRaw.plan === 'string' && aptRaw.plan.trim() ? aptRaw.plan.trim() : undefined,
          bloodInvestigationDate: typeof aptRaw.bloodInvestigationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(aptRaw.bloodInvestigationDate.trim()) ? aptRaw.bloodInvestigationDate.trim() : undefined,
          bloodInvestigations: aptInvs,
          bloodOther: aptOther,
          rescheduledToAppointmentId: typeof aptRaw.rescheduledToAppointmentId === 'string' ? aptRaw.rescheduledToAppointmentId : undefined,
          rescheduledFromAppointmentId: typeof aptRaw.rescheduledFromAppointmentId === 'string' ? aptRaw.rescheduledFromAppointmentId : undefined,
          attendedAt: typeof aptRaw.attendedAt === 'string' ? aptRaw.attendedAt : undefined,
          createdAt: typeof aptRaw.createdAt === 'string' ? aptRaw.createdAt : createdAt,
          updatedAt: typeof aptRaw.updatedAt === 'string' ? aptRaw.updatedAt : updatedAt
        });
      }
    } else if (typeof r.nextTca === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.nextTca.trim())) {
      // Migrating from older backup files with single nextTca
      appointments.push({
        id: `apt_migrated_${recordId}`,
        patientId: recordId,
        tcaDate: r.nextTca.trim(),
        status: 'Scheduled',
        notes: 'Migrated from backup record',
        plan,
        bloodInvestigationDate: typeof r.bloodInvestigationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.bloodInvestigationDate.trim()) ? r.bloodInvestigationDate.trim() : undefined,
        bloodInvestigations: investigations,
        bloodOther,
        createdAt,
        updatedAt
      });
    }

    validRecords.push({
      id: recordId,
      name: r.name.trim(),
      icNumber: r.icNumber.trim(),
      phone: typeof r.phone === 'string' && r.phone.trim() ? r.phone.trim() : undefined,
      patientType,
      isActive,
      appointments,
      nextTca: typeof r.nextTca === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.nextTca.trim()) ? r.nextTca.trim() : undefined,
      bloodInvestigationDate: typeof r.bloodInvestigationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.bloodInvestigationDate.trim()) ? r.bloodInvestigationDate.trim() : undefined,
      bloodInvestigations: investigations,
      bloodOther,
      plan,
      createdAt,
      updatedAt
    });
  }

  return {
    valid: true,
    records: validRecords,
    schemaVersion: schemaVer
  };
}


  // --- Module: utils/google-drive ---
             
                          
                        
               
                  

const GDRIVE_FOLDER_ID = '1KSu4II21PraMavPwi6q2Y3ZUdPnedMVS';
const GDRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GDRIVE_FOLDER_ID}`;
const GDRIVE_CLIENT_ID_KEY = 'arv_kkbk_gdrive_client_id';
const GDRIVE_TOKEN_KEY = 'arv_kkbk_gdrive_access_token';
const GDRIVE_TOKEN_EXP_KEY = 'arv_kkbk_gdrive_token_exp';
const GDRIVE_LAST_BACKUP_KEY = 'arv_kkbk_gdrive_last_backup_time';
const GDRIVE_LAST_FILE_KEY = 'arv_kkbk_gdrive_last_backup_file';
const PRE_RESTORE_SAFETY_KEY = 'arv_kkbk_pre_restore_safety_backup';

class GoogleDriveBackupService {
          status                          = 'Not Connected';
          isBackingUp = false;
          autoBackupTimer      = null;
          onStatusChangeCallback                                                                                            = null;
          lastError = '';

  constructor() {
    this.checkInitialConnection();
  }

         setStatusListener(callback                                                                                  )       {
    this.onStatusChangeCallback = callback;
    this.notifyStatus();
  }

          notifyStatus()       {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(this.status, this.getLastBackupTime(), this.lastError);
    }
  }

         getStatus()                          {
    return this.status;
  }

         getClientId()         {
    try {
      return localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || '';
    } catch {
      return '';
    }
  }

         setClientId(clientId        )       {
    try {
      localStorage.setItem(GDRIVE_CLIENT_ID_KEY, clientId.trim());
      this.checkInitialConnection();
    } catch {}
  }

         getLastBackupTime()         {
    try {
      return localStorage.getItem(GDRIVE_LAST_BACKUP_KEY) || '';
    } catch {
      return '';
    }
  }

         getLastBackupFile()         {
    try {
      return localStorage.getItem(GDRIVE_LAST_FILE_KEY) || '';
    } catch {
      return '';
    }
  }

          getAccessToken()                {
    try {
      const token = sessionStorage.getItem(GDRIVE_TOKEN_KEY);
      const exp = Number(sessionStorage.getItem(GDRIVE_TOKEN_EXP_KEY) || '0');
      if (token && exp > Date.now()) {
        return token;
      }
    } catch {}
    return null;
  }

          saveAccessToken(token        , expiresInSeconds        )       {
    try {
      const exp = Date.now() + (expiresInSeconds - 60) * 1000;
      sessionStorage.setItem(GDRIVE_TOKEN_KEY, token);
      sessionStorage.setItem(GDRIVE_TOKEN_EXP_KEY, String(exp));
      this.status = 'Connected';
      this.lastError = '';
      this.notifyStatus();
    } catch {}
  }

         disconnect()       {
    try {
      sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
      sessionStorage.removeItem(GDRIVE_TOKEN_EXP_KEY);
      this.status = 'Not Connected';
      this.notifyStatus();
    } catch {}
  }

          checkInitialConnection()       {
    const token = this.getAccessToken();
    if (token) {
      this.status = 'Connected';
    } else {
      this.status = 'Not Connected';
    }
    this.notifyStatus();
  }

  /**
   * Authorizes Google Drive access via Google Identity Services (GIS) token client.
   */
         async authorize(customClientId         )                   {
    const clientId = customClientId || this.getClientId();
    if (!clientId) {
      this.lastError = 'OAuth Client ID not configured. Please enter your Google OAuth 2.0 Web Client ID in Settings.';
      this.status = 'Not Connected';
      this.notifyStatus();
      return false;
    }

    if (customClientId) {
      this.setClientId(customClientId);
    }

    return new Promise((resolve) => {
      // Check if Google Identity Services script is loaded
      const win = window       ;
      if (win.google && win.google.accounts && win.google.accounts.oauth2) {
        try {
          const client = win.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (response     ) => {
              if (response.error) {
                this.lastError = response.error_description || response.error;
                this.status = 'Not Connected';
                this.notifyStatus();
                resolve(false);
                return;
              }
              if (response.access_token) {
                this.saveAccessToken(response.access_token, Number(response.expires_in) || 3600);
                resolve(true);
              } else {
                resolve(false);
              }
            }
          });
          client.requestAccessToken({ prompt: 'consent' });
        } catch (err     ) {
          this.lastError = err.message || 'Google OAuth initialization failed';
          this.status = 'Not Connected';
          this.notifyStatus();
          resolve(false);
        }
      } else {
        // Fallback: standard OAuth 2.0 token popup
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(window.location.origin + window.location.pathname)}&response_type=token&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file')}&include_granted_scopes=true&prompt=consent`;

        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        const popup = window.open(authUrl, 'GoogleAuth', `width=${width},height=${height},left=${left},top=${top}`);

        if (!popup) {
          this.lastError = 'Popup blocked by browser. Please allow popups for Google sign-in.';
          this.status = 'Not Connected';
          this.notifyStatus();
          resolve(false);
          return;
        }

        const pollTimer = window.setInterval(() => {
          try {
            if (popup.closed) {
              window.clearInterval(pollTimer);
              resolve(this.status === 'Connected');
              return;
            }
            if (popup.location && popup.location.hash) {
              const hash = popup.location.hash.substring(1);
              const params = new URLSearchParams(hash);
              const token = params.get('access_token');
              const exp = Number(params.get('expires_in')) || 3600;
              if (token) {
                this.saveAccessToken(token, exp);
                popup.close();
                window.clearInterval(pollTimer);
                resolve(true);
              }
            }
          } catch {
            // Cross-origin access expected before redirect
          }
        }, 500);
      }
    });
  }

  /**
   * Generates formatted backup filename: arv-kkbk-backup-YYYY-MM-DD-HH-mm.json
   */
         generateBackupFilename()         {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `arv-kkbk-backup-${YYYY}-${MM}-${DD}-${HH}-${mm}.json`;
  }

  /**
   * Uploads a complete backup JSON to the designated Google Drive folder.
   */
         async uploadBackup(records                 )                   {
    if (this.isBackingUp) return false;

    const token = this.getAccessToken();
    if (!token) {
      this.status = 'Not Connected';
      this.notifyStatus();
      return false;
    }

    if (!navigator.onLine) {
      this.status = 'Backup Failed';
      this.lastError = 'Device is currently offline. Will retry when connection returns.';
      this.notifyStatus();
      return false;
    }

    this.isBackingUp = true;
    this.status = 'Backing Up';
    this.notifyStatus();

    const filename = this.generateBackupFilename();
    const backupPayload = {
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
      clinic: 'Klinik Kesihatan Bandar Kulim',
      program: 'ARV KKBK',
      destinationFolderId: GDRIVE_FOLDER_ID,
      patientCount: records.length,
      records
    };

    const boundary = '-------arvkkbkboundary' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: [GDRIVE_FOLDER_ID]
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(backupPayload, null, 2) +
      closeDelimiter;

    try {
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errMessage = errorBody.error?.message || `HTTP ${response.status} ${response.statusText}`;
        if (response.status === 401) {
          this.disconnect();
          this.lastError = 'Google Drive session expired. Please reconnect.';
        } else {
          this.lastError = `Google Drive upload error: ${errMessage}`;
        }
        this.status = 'Backup Failed';
        this.notifyStatus();
        return false;
      }

      const result = await response.json();
      if (result && result.id) {
        const nowIso = new Date().toISOString();
        try {
          localStorage.setItem(GDRIVE_LAST_BACKUP_KEY, nowIso);
          localStorage.setItem(GDRIVE_LAST_FILE_KEY, filename);
        } catch {}

        this.status = 'Backup Successful';
        this.lastError = '';
        this.notifyStatus();
        return true;
      }

      this.status = 'Backup Failed';
      this.lastError = 'Incomplete response from Google Drive.';
      this.notifyStatus();
      return false;
    } catch (err     ) {
      this.status = 'Backup Failed';
      this.lastError = err.message || 'Network error during Google Drive upload';
      this.notifyStatus();
      return false;
    } finally {
      this.isBackingUp = false;
    }
  }

  /**
   * Schedules an automatic debounced backup (3 seconds after data changes).
   */
         scheduleAutoBackup(getRecords                                )       {
    if (this.status !== 'Connected' && this.status !== 'Backup Successful') return;

    if (this.autoBackupTimer) {
      clearTimeout(this.autoBackupTimer);
    }

    this.autoBackupTimer = setTimeout(async () => {
      try {
        const records = await getRecords();
        await this.uploadBackup(records);
      } catch (err) {
        console.warn('Auto-backup execution warning:', err);
      }
    }, 3000);
  }

  /**
   * Lists available backup JSON files in the designated Google Drive folder.
   */
         async listBackups()                                   {
    const token = this.getAccessToken();
    if (!token) return [];

    try {
      const q = encodeURIComponent(`'${GDRIVE_FOLDER_ID}' in parents and trashed=false and name contains 'arv-kkbk-backup'`);
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime+desc&pageSize=20`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to list files: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data.files) ? data.files : [];
    } catch (err     ) {
      console.error('List backups failed:', err);
      return [];
    }
  }

  /**
   * Downloads a backup file from Google Drive.
   */
         async downloadBackup(fileId        )               {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not connected to Google Drive');

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to download backup: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Creates an emergency pre-restore safety snapshot of current local records.
   */
         savePreRestoreSafetySnapshot(records                 )       {
    try {
      const snapshot = {
        snapshotTime: new Date().toISOString(),
        recordsCount: records.length,
        records
      };
      localStorage.setItem(PRE_RESTORE_SAFETY_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn('Failed to save pre-restore safety snapshot to localStorage:', err);
    }
  }
}

const googleDriveService = new GoogleDriveBackupService();
const googleDriveBackupService = googleDriveService;


  // --- Module: components/blood-collection-modal ---
             
                
                             
                       
                  
class BloodCollectionModal {
          overlayEl             ;
          currentPatient                       = null;
          currentCollection                                    = null;
          currentAction                   = 'attend';
          onSaveCallback                                                            = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Blood Collection Tracking');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 480px;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title" id="blood-modal-title">Blood Collection Action</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Cancel and close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form id="blood-modal-form" class="sheet-body" novalidate>
          <div id="blood-patient-summary" class="patient-banner-info" style="padding: 10px 14px; background: var(--color-bg-primary); border-radius: var(--radius-md); font-size: 13.5px; margin-bottom: 10px;">
            Patient: <strong id="bld-patient-name" style="color: var(--color-text-primary);"></strong>
            <span id="bld-patient-meta" style="color: var(--color-text-secondary); margin-left: 6px;"></span>
          </div>

          <div id="bld-action-body"></div>
        </form>

        <div class="sheet-footer">
          <button type="button" class="btn-secondary" data-action="close">Cancel</button>
          <button type="submit" form="blood-modal-form" id="btn-save-blood-action" class="btn-primary">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target               ;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    const form = this.overlayEl.querySelector('#blood-modal-form')                   ;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

         open(
    patient               ,
    collection                            ,
    action                  ,
    onSave                                                  ,
    triggerEl              
  )       {
    this.currentPatient = patient;
    this.currentCollection = collection;
    this.currentAction = action;
    this.onSaveCallback = onSave;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    const titleEl = this.overlayEl.querySelector('#blood-modal-title')               ;
    const nameEl = this.overlayEl.querySelector('#bld-patient-name')               ;
    const metaEl = this.overlayEl.querySelector('#bld-patient-meta')               ;
    const saveBtn = this.overlayEl.querySelector('#btn-save-blood-action')                     ;
    const bodyEl = this.overlayEl.querySelector('#bld-action-body')               ;

    nameEl.textContent = patient.name;
    metaEl.textContent = `(IC: ${patient.icNumber})`;

    const scheduledDisplay = formatDisplayDate(collection.scheduledDate);
    const today = getLocalTodayISO();

    if (action === 'attend') {
      titleEl.textContent = 'Record Sample Collection';
      saveBtn.textContent = 'Mark Attended';
      saveBtn.className = 'btn-primary';
      bodyEl.innerHTML = `
        <div style="background-color: var(--color-accent-subtle); border-radius: var(--radius-md); padding: 10px 12px; font-size: 13px; color: var(--color-text-primary); margin-bottom: 12px;">
          Scheduled Date: <strong>${scheduledDisplay}</strong>
          <div style="margin-top: 4px; font-size: 12px; color: var(--color-text-secondary);">
            Sample collected at KK Bandar Kulim. CD4 samples are routed to KK Taman Intan; Viral Load samples to Hospital Sultanah Bahiyah (HSB).
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label required" for="bld-field-actual-date">Actual Collection Date</label>
            <input type="date" id="bld-field-actual-date" class="form-input" value="${today}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="bld-field-actual-time">Collection Time</label>
            <input type="text" id="bld-field-actual-time" class="form-input" value="08:15 AM" placeholder="e.g. 08:15 AM" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="bld-field-notes">Clinical Notes (Optional)</label>
          <input type="text" id="bld-field-notes" class="form-input" placeholder="e.g. Blood drawn without complications, 2 tubes sent" />
        </div>
      `;
    } else if (action === 'reschedule') {
      titleEl.textContent = 'Reschedule Blood Collection';
      saveBtn.textContent = 'Reschedule Collection';
      saveBtn.className = 'btn-primary';
      bodyEl.innerHTML = `
        <div style="background-color: var(--color-accent-subtle); border-radius: var(--radius-md); padding: 10px 12px; font-size: 13px; color: var(--color-text-primary); margin-bottom: 12px;">
          Original Scheduled Date: <strong>${scheduledDisplay}</strong>
          <div style="margin-top: 4px; font-size: 12px; color: var(--color-text-secondary);">
            Rescheduling preserves the original date in Blood History and creates a new scheduled appointment. Patient profile remains completely intact.
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label required" for="bld-field-new-date">New Scheduled Date</label>
            <input type="date" id="bld-field-new-date" class="form-input" required />
            <span class="form-error" id="err-bld-new-date" style="display: none;">Please select a new date</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="bld-field-new-time">Time</label>
            <input type="text" id="bld-field-new-time" class="form-input" value="Before 8.30 am" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="bld-field-reason">Reason for Rescheduling</label>
          <input type="text" id="bld-field-reason" class="form-input" placeholder="e.g. Patient requested postponement / Public holiday" />
        </div>
      `;
    } else if (action === 'dna') {
      titleEl.textContent = 'Record Did Not Attend (DNA)';
      saveBtn.textContent = 'Mark DNA';
      saveBtn.className = 'btn-destructive';
      bodyEl.innerHTML = `
        <div style="background-color: var(--color-destructive-bg); border-radius: var(--radius-md); padding: 10px 12px; font-size: 13px; color: var(--color-destructive); margin-bottom: 12px;">
          Scheduled Date: <strong>${scheduledDisplay}</strong>
          <div style="margin-top: 4px; font-size: 12px;">
            Patient did not attend scheduled blood collection. This DNA record will be permanently preserved in Blood Collection History.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="bld-field-notes">Follow-up Notes / Reason</label>
          <input type="text" id="bld-field-notes" class="form-input" placeholder="e.g. Unreachable by phone, will contact next week" />
        </div>
      `;
    } else if (action === 'cancel') {
      titleEl.textContent = 'Cancel Blood Collection';
      saveBtn.textContent = 'Cancel Appointment';
      saveBtn.className = 'btn-secondary';
      bodyEl.innerHTML = `
        <div style="padding: 10px 12px; background: var(--color-bg-primary); border-radius: var(--radius-md); font-size: 13px; margin-bottom: 12px;">
          Scheduled Date: <strong>${scheduledDisplay}</strong>
        </div>
        <div class="form-group">
          <label class="form-label" for="bld-field-notes">Cancellation Reason</label>
          <input type="text" id="bld-field-notes" class="form-input" placeholder="e.g. Tests already done at hospital" />
        </div>
      `;
    }

    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');

    window.setTimeout(() => {
      const firstInput = this.overlayEl.querySelector('input')                    ;
      if (firstInput) firstInput.focus();
    }, 100);
  }

          async handleSubmit()                {
    if (!this.currentCollection || !this.onSaveCallback) return;

    let newDate = '';
    let newTime = '';
    let reason = '';
    let actualDate = '';
    let actualTime = '';
    let notes = '';

    if (this.currentAction === 'reschedule') {
      const dateInp = this.overlayEl.querySelector('#bld-field-new-date')                    ;
      const timeInp = this.overlayEl.querySelector('#bld-field-new-time')                    ;
      const reasonInp = this.overlayEl.querySelector('#bld-field-reason')                    ;
      const err = this.overlayEl.querySelector('#err-bld-new-date')               ;

      if (!dateInp.value) {
        err.style.display = 'block';
        dateInp.focus();
        return;
      }
      err.style.display = 'none';
      newDate = dateInp.value;
      newTime = timeInp.value;
      reason = reasonInp.value;
    } else if (this.currentAction === 'attend') {
      const actDateInp = this.overlayEl.querySelector('#bld-field-actual-date')                    ;
      const actTimeInp = this.overlayEl.querySelector('#bld-field-actual-time')                    ;
      const notesInp = this.overlayEl.querySelector('#bld-field-notes')                    ;

      actualDate = actDateInp ? actDateInp.value : '';
      actualTime = actTimeInp ? actTimeInp.value : '';
      notes = notesInp ? notesInp.value : '';
    } else {
      const notesInp = this.overlayEl.querySelector('#bld-field-notes')                    ;
      notes = notesInp ? notesInp.value : '';
    }

    const saveBtn = this.overlayEl.querySelector('#btn-save-blood-action')                     ;
    saveBtn.disabled = true;

    try {
      await this.onSaveCallback({
        action: this.currentAction,
        collectionId: this.currentCollection.id,
        newDate: newDate || undefined,
        newTime: newTime || undefined,
        reason: reason || undefined,
        actualDate: actualDate || undefined,
        actualTime: actualTime || undefined,
        notes: notes || undefined
      });
      this.close();
    } finally {
      saveBtn.disabled = false;
    }
  }

         close()       {
    if (!this.isOpen()) return;
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}


  // --- Module: components/record-card ---
                                                           
function escapeHTML(str        )         {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

                                    
                     
                     
                       
                                                
                                                       
 

function createRecordCard(
  record               ,
  actionsOrView                                  
)              {
  const actions                    = typeof actionsOrView === 'function'
    ? {
        onView: actionsOrView,
        onEdit: actionsOrView,
        onDelete: actionsOrView,
        onToggleActive: () => {},
        onChangeCategory: () => {}
      }
    : actionsOrView;

  const card = document.createElement('article');
  card.className = `record-card ${record.isActive === false ? 'is-deactivated' : ''}`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View profile for patient ${record.name}`);

  const tcaStatus = getTCAStatus(record.nextTca);

  let tcaBadgeHtml = '';
  if (tcaStatus.type !== 'none') {
    tcaBadgeHtml = `
      <div class="tca-indicator tca-${tcaStatus.type}" title="${tcaStatus.formattedDate || ''}">
        <span class="tca-dot"></span>
        <span>${escapeHTML(tcaStatus.label)}</span>
      </div>
    `;
  }

  // Patient category subtle label
  const isNew = record.patientType === 'New';
  const patientTypeLabel = isNew
    ? `<span class="patient-type-tag type-new">New Patient</span>`
    : `<span class="patient-type-tag type-existing">Existing Patient</span>`;

  // Deactivated status tag
  const inactiveBadge = record.isActive === false
    ? `<span class="patient-status-inactive-badge">Deactivated</span>`
    : '';

  const phoneHtml = record.phone
    ? `<div class="meta-item">
        <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <span>${escapeHTML(record.phone)}</span>
       </div>`
    : '';

  // Blood date label & subtle overdue/attendance indicator
  let bloodHtml = '';
  if (record.bloodInvestigationDate) {
    const formattedBlood = formatDisplayDate(record.bloodInvestigationDate);
    const isPast = isDatePast(record.bloodInvestigationDate);
    const hasWork = (record.bloodInvestigations && record.bloodInvestigations.length > 0) || Boolean(record.plan && record.plan.trim());

    let statusNote = '';
    if (record.currentBloodStatus === 'Attended') {
      statusNote = `<span class="blood-status-note attended" style="color: #248A3D; font-weight: 600;">(Sample Collected)</span>`;
    } else if (record.currentBloodStatus === 'DNA') {
      statusNote = `<span class="blood-status-note dna" style="color: #C97200; font-weight: 600;">(DNA)</span>`;
    } else if (record.currentBloodStatus === 'Rescheduled') {
      statusNote = `<span class="blood-status-note rescheduled" style="color: #5856D6; font-weight: 600;">(Rescheduled)</span>`;
    } else if (record.currentBloodStatus === 'Cancelled') {
      statusNote = `<span class="blood-status-note cancelled" style="color: var(--color-text-tertiary); font-weight: 600;">(Cancelled)</span>`;
    } else if (isPast && hasWork) {
      statusNote = `<span class="blood-status-note overdue">(Overdue)</span>`;
    }

    bloodHtml = `
      <div class="card-blood-row">
        <span class="card-blood-label">Blood:</span>
        <span class="card-blood-date">${formattedBlood}</span>
        ${statusNote}
      </div>
    `;
  }

  // Mini chips for Blood Investigations (max 3 visible, then "+N")
  let investigationsHtml = '';
  if (record.bloodInvestigations && record.bloodInvestigations.length > 0) {
    const visible = record.bloodInvestigations.slice(0, 3);
    const remaining = record.bloodInvestigations.length - 3;

    const chips = visible.map(inv => {
      const label = inv === 'Other' && record.bloodOther ? `Other: ${record.bloodOther}` : inv;
      return `<span class="mini-chip">${escapeHTML(label)}</span>`;
    }).join('');

    const moreBadge = remaining > 0 ? `<span class="mini-chip mini-chip-more">+${remaining}</span>` : '';
    investigationsHtml = `<div class="card-investigations-row">${chips}${moreBadge}</div>`;
  }

  // Plan truncated to 2 lines
  const planPreviewHtml = record.plan && record.plan.trim()
    ? `<div class="card-plan-preview">${escapeHTML(record.plan)}</div>`
    : '';

  const tcaDateDisplay = tcaStatus.formattedDate
    ? `<div class="card-tca-date-row">
        <span class="card-tca-label">Next TCA:</span>
        <span>${tcaStatus.formattedDate}</span>
       </div>`
    : `<div class="card-tca-date-row" style="color: var(--color-text-tertiary); font-style: italic; font-size: 12.5px;">
        No TCA date scheduled
       </div>`;

  card.innerHTML = `
    <div class="card-header-row">
      <div class="card-title-group">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <h3 class="patient-name">${escapeHTML(record.name)}</h3>
          ${inactiveBadge}
        </div>
        ${patientTypeLabel}
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        ${tcaBadgeHtml}
        <button type="button" class="btn-card-menu" aria-label="Patient actions" title="Patient Actions" aria-haspopup="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="19" cy="12" r="1.5"></circle>
            <circle cx="5" cy="12" r="1.5"></circle>
          </svg>
        </button>
      </div>
    </div>

    ${tcaDateDisplay}
    ${bloodHtml}
    ${investigationsHtml}

    <div class="card-meta-row">
      <div class="meta-item">
        <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2"></rect>
          <line x1="7" y1="8" x2="17" y2="8"></line>
          <line x1="7" y1="12" x2="13" y2="12"></line>
        </svg>
        <span>IC: ${escapeHTML(record.icNumber)}</span>
      </div>
      ${phoneHtml}
    </div>

    ${planPreviewHtml}

    <div class="card-direct-actions">
      <button type="button" class="card-action-btn btn-action-view" data-card-action="view">View</button>
      <button type="button" class="card-action-btn btn-action-edit" data-card-action="edit">Edit</button>
      <button type="button" class="card-action-btn btn-action-deactivate" data-card-action="toggle-active">
        ${record.isActive === false ? 'Reactivate' : 'Deactivate'}
      </button>
      <button type="button" class="card-action-btn btn-action-delete" data-card-action="delete" title="Delete Patient Record">
        Delete
      </button>
    </div>
  `;

  // Direct action buttons
  card.querySelectorAll('[data-card-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-card-action');
      if (action === 'view') actions.onView();
      else if (action === 'edit') actions.onEdit();
      else if (action === 'toggle-active') actions.onToggleActive(record.isActive === false);
      else if (action === 'delete') actions.onDelete();
    });
  });

  // Action menu dropdown trigger
  const menuBtn = card.querySelector('.btn-card-menu')                     ;
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCardDropdownMenu(menuBtn, record, actions);
  });

  card.addEventListener('click', () => {
    actions.onView();
  });

  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Don't trigger if focus was on an internal button
      if ((e.target               ).tagName.toLowerCase() === 'button') return;
      e.preventDefault();
      actions.onView();
    }
  });

  return card;
}

/**
 * Creates and shows an action dropdown anchored to the card menu button
 * Completely free of emojis, uses minimalist SVG line icons and Apple-style menu styling.
 */
function openCardDropdownMenu(
  triggerBtn             ,
  record               ,
  actions                   
)       {
  const existing = document.getElementById('card-action-dropdown-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'card-action-dropdown-overlay';
  overlay.className = 'sort-dropdown-overlay is-open';
  overlay.style.backgroundColor = 'transparent';

  const menu = document.createElement('div');
  menu.className = 'sort-dropdown-menu is-anchored ios-action-menu';
  menu.style.width = '210px';

  const rect = triggerBtn.getBoundingClientRect();
  let left = rect.right - 210;
  if (left < 10) left = 10;
  let top = rect.bottom + 6;
  if (top + 230 > window.innerHeight && rect.top > 240) {
    top = Math.max(10, rect.top - 230);
  }

  menu.style.position = 'fixed';
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.right = 'auto';
  menu.style.bottom = 'auto';

  const isNew = record.patientType === 'New';
  const newCategoryTarget              = isNew ? 'Existing' : 'New';
  const isCurrentlyActive = record.isActive !== false;

  menu.innerHTML = `
    <div class="ios-menu-group" role="menu">
      <button type="button" class="ios-menu-item" data-menu-action="view" role="menuitem">
        <svg class="ios-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
        <span>View Profile</span>
      </button>

      <button type="button" class="ios-menu-item" data-menu-action="edit" role="menuitem">
        <svg class="ios-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span>Edit Patient</span>
      </button>

      <button type="button" class="ios-menu-item" data-menu-action="category" role="menuitem">
        <svg class="ios-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <span>Change Category</span>
      </button>

      <button type="button" class="ios-menu-item" data-menu-action="toggle-active" role="menuitem">
        <svg class="ios-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${isCurrentlyActive
            ? '<circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>'
            : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'}
        </svg>
        <span>${isCurrentlyActive ? 'Deactivate Patient' : 'Reactivate Patient'}</span>
      </button>

      <div class="ios-menu-separator"></div>

      <button type="button" class="ios-menu-item is-destructive" data-menu-action="delete" role="menuitem">
        <svg class="ios-menu-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <span>Delete Patient</span>
      </button>
    </div>
  `;

  overlay.appendChild(menu);
  document.body.appendChild(overlay);

  const closeMenu = () => overlay.remove();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMenu();
  });

  menu.querySelectorAll('[data-menu-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeMenu();
      const action = btn.getAttribute('data-menu-action');
      if (action === 'view') actions.onView();
      else if (action === 'edit') actions.onEdit();
      else if (action === 'category') actions.onChangeCategory(newCategoryTarget);
      else if (action === 'toggle-active') actions.onToggleActive(!isCurrentlyActive);
      else if (action === 'delete') actions.onDelete();
    });
  });
}


  // --- Module: components/sort-sheet ---
class SortSheet {
          overlayEl             ;
          menuEl             ;
          currentActive            = 'tca_asc';
          onSelectCallback                                     = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'sort-dropdown-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Sort Records');

    this.overlayEl.innerHTML = `
      <div class="sort-dropdown-menu" id="sort-dropdown-container">
        <div class="sort-dropdown-header">
          <span class="sort-dropdown-title">Sort By</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close sort menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sort-options-list" id="sort-options-list" role="radiogroup" aria-label="Sort options"></div>
      </div>
    `;

    this.menuEl = this.overlayEl.querySelector('#sort-dropdown-container')               ;
    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target               ;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    // Reposition on window resize if open
    window.addEventListener('resize', () => {
      if (this.isOpen() && this.previousActiveElement) {
        this.positionMenu(this.previousActiveElement);
      }
    });
  }

          positionMenu(triggerEl              )       {
    if (!triggerEl) return;

    const isDesktop = window.innerWidth >= 480;
    if (isDesktop) {
      const rect = triggerEl.getBoundingClientRect();
      const menuWidth = Math.min(300, window.innerWidth - 24);
      let left = rect.right - menuWidth;
      if (left < 12) left = 12;

      let top = rect.bottom + 6;
      const maxHeight = Math.max(200, window.innerHeight - top - 16);

      // If near bottom of screen, flip upwards
      if (top + 280 > window.innerHeight && rect.top > 300) {
        top = Math.max(12, rect.top - 320);
      }

      this.menuEl.style.position = 'fixed';
      this.menuEl.style.top = `${top}px`;
      this.menuEl.style.left = `${left}px`;
      this.menuEl.style.right = 'auto';
      this.menuEl.style.bottom = 'auto';
      this.menuEl.style.width = `${menuWidth}px`;
      this.menuEl.style.maxHeight = `${maxHeight}px`;
      this.menuEl.classList.add('is-anchored');
      this.menuEl.classList.remove('is-sheet');
    } else {
      // Small mobile: smooth bottom sheet anchored to bottom
      this.menuEl.style.position = 'fixed';
      this.menuEl.style.top = 'auto';
      this.menuEl.style.bottom = '0';
      this.menuEl.style.left = '0';
      this.menuEl.style.right = '0';
      this.menuEl.style.width = '100%';
      this.menuEl.style.maxHeight = '75vh';
      this.menuEl.classList.add('is-sheet');
      this.menuEl.classList.remove('is-anchored');
    }
  }

          renderOptions()       {
    const container = this.overlayEl.querySelector('#sort-options-list');
    if (!container) return;

    container.innerHTML = '';
    SORT_OPTIONS.forEach((option                      ) => {
      const isSelected = option.id === this.currentActive;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `sort-dropdown-item ${isSelected ? 'is-active' : ''}`;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      btn.innerHTML = `
        <span class="sort-item-label">${option.label}</span>
        ${
          isSelected
            ? `<svg class="sort-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
               </svg>`
            : ''
        }
      `;

      btn.addEventListener('click', () => {
        this.currentActive = option.id;
        if (this.onSelectCallback) {
          this.onSelectCallback(option.id);
        }
        this.close();
      });

      container.appendChild(btn);
    });
  }

         open(current           , onSelect                           , triggerEl              )       {
    this.currentActive = current;
    this.onSelectCallback = onSelect;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    this.renderOptions();
    this.positionMenu(this.previousActiveElement);
    this.overlayEl.classList.add('is-open');

    // Safe focus with preventScroll so browser never jumps or scrolls viewport
    const activeBtn = this.overlayEl.querySelector('.sort-dropdown-item.is-active')               ;
    if (activeBtn) {
      activeBtn.focus({ preventScroll: true });
    }
  }

         close()       {
    if (!this.isOpen()) return;
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus({ preventScroll: true });
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}


  // --- Module: components/record-modal ---
function maskIC(ic        )         {
  const clean = (ic || '').trim();
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `••••-••-${last4}`;
}

function escapeHTML(str        )         {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class RecordModal {
          overlayEl             ;
          currentRecord                       = null;
          savedRecords                  = [];
          isEditMode = false;
          isBloodDateManuallyEdited = false;
          onSaveCallback                                                                                                                                  = null;
          previousActiveElement                     = null;
          existingSearchQuery = '';

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Patient Record Form');

    const chipsHtml = BLOOD_INVESTIGATION_OPTIONS.map(opt => `
      <button
        type="button"
        class="chip-checkbox"
        data-inv="${opt}"
        role="checkbox"
        aria-checked="false"
      >
        <svg class="chip-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${opt}</span>
      </button>
    `).join('');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title" id="form-modal-title">Add Patient</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Cancel and close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form id="patient-form" class="sheet-body" novalidate>
          <div class="form-group" id="group-patient-type">
            <label class="form-label required">Patient Category</label>
            <div class="segmented-control" id="segmented-patient-type" role="radiogroup" aria-label="Patient Category">
              <button type="button" class="segment-btn is-active" data-value="Existing" role="radio" aria-checked="true">Existing Patient</button>
              <button type="button" class="segment-btn" data-value="New" role="radio" aria-checked="false">New Patient</button>
            </div>
            <input type="hidden" id="field-patient-type" value="Existing" />
            <span class="form-hint">Categorize patient as New Patient or Existing Patient (editable anytime).</span>
          </div>

          <!-- DYNAMIC EXISTING PATIENT DROPDOWN & PICKER (Requirement 1) -->
          <div class="form-group" id="group-existing-picker" style="display: none;">
            <label class="form-label" for="select-existing-patient">Select Existing Patient</label>
            <div class="existing-picker-container">
              <div class="existing-search-row">
                <svg class="search-mini-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="search"
                  id="filter-existing-patients"
                  class="form-input existing-search-input"
                  placeholder="Filter existing patients by name or IC..."
                  autocomplete="off"
                />
              </div>

              <select id="select-existing-patient" class="form-input form-select existing-patient-select">
                <option value="">-- Choose an existing patient --</option>
              </select>

              <div id="existing-picker-empty" class="picker-empty-state" style="display: none;">
                No existing patients available in the system yet. Switch to "New Patient" above to register a patient.
              </div>

              <div id="existing-selected-banner" class="selected-patient-banner" style="display: none;">
                <div class="selected-banner-info">
                  <svg class="selected-banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <div>
                    <span id="existing-selected-name" style="font-weight: 600;"></span>
                    <span id="existing-selected-meta" style="font-size: 12px; color: var(--color-text-secondary); margin-left: 6px;"></span>
                  </div>
                </div>
                <button type="button" id="btn-clear-existing-selection" class="btn-clear-pill">Clear</button>
              </div>
            </div>
            <span class="form-hint">Selecting an existing patient preserves their Patient ID and complete appointment history.</span>
          </div>

          <div class="form-group" id="group-patient-name">
            <label class="form-label required" for="field-name">Patient Name</label>
            <input type="text" id="field-name" class="form-input" placeholder="e.g. Demo Patient 01" autocomplete="off" required />
            <span class="form-error" id="error-name" style="display: none;">Name is required</span>
          </div>

          <div class="form-group">
            <label class="form-label required" for="field-ic">IC Number</label>
            <input type="text" id="field-ic" class="form-input" placeholder="e.g. 000101-02-0001" autocomplete="off" required />
            <span class="form-error" id="error-ic" style="display: none;">IC Number is required (stores leading zeros)</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="field-phone">Phone Number</label>
            <input type="tel" id="field-phone" class="form-input" placeholder="e.g. 012-345 6789" autocomplete="tel" />
          </div>

          <div class="form-group">
            <label class="form-label" for="field-tca">Next TCA (Appointment Date)</label>
            <div class="date-input-container">
              <input type="date" id="field-tca" class="form-input form-date-input" />
              <svg class="date-picker-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <span class="form-hint">Optional. Creates or updates a scheduled appointment for this patient.</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="field-blood-date">Blood Investigation Date ("Blood date")</label>
            <div class="date-input-container">
              <input type="date" id="field-blood-date" class="form-input form-date-input" />
              <svg class="date-picker-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <span class="form-hint">Prefills to 1 month before TCA if untouched. Can be edited or cleared.</span>
            <span class="form-error" id="error-blood-date" style="display: none;">Blood date cannot be after Next TCA</span>
          </div>

          <!-- 1. BLOOD INVESTIGATIONS (TICKABLE) -->
          <div class="form-group">
            <label class="form-label">Blood Investigations</label>
            <div class="investigation-chips-group" id="chips-investigations" role="group" aria-label="Blood Investigations">
              ${chipsHtml}
            </div>
            
            <div class="blood-other-container" id="container-blood-other" style="display: none;">
              <label class="form-label required" for="field-blood-other" style="font-size: 13px;">State other investigation</label>
              <input type="text" id="field-blood-other" class="form-input" placeholder="e.g. TFT, Hep B/C, Urine FEME" autocomplete="off" />
              <span class="form-error" id="error-blood-other" style="display: none;">Please state the other investigation</span>
            </div>
          </div>

          <!-- 2. PLAN (SEPARATE MULTI-LINE TEXTAREA) -->
          <div class="form-group">
            <label class="form-label" for="field-plan">Clinical / Follow-up Plan</label>
            <textarea id="field-plan" class="form-textarea" placeholder="e.g. Adherence counseling, repeat viral load in 6 months, stable on TLD..."></textarea>
          </div>
        </form>
        <div class="sheet-footer">
          <button type="button" class="btn-secondary" data-action="close">Cancel</button>
          <button type="submit" form="patient-form" id="btn-save-record" class="btn-primary">Save Patient</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    const form = this.overlayEl.querySelector('#patient-form')                   ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const segContainer = this.overlayEl.querySelector('#segmented-patient-type')               ;
    const chipsContainer = this.overlayEl.querySelector('#chips-investigations')               ;
    const otherContainer = this.overlayEl.querySelector('#container-blood-other')               ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const otherError = this.overlayEl.querySelector('#error-blood-other')               ;

    const existingSelect = this.overlayEl.querySelector('#select-existing-patient')                     ;
    const existingSearch = this.overlayEl.querySelector('#filter-existing-patients')                    ;
    const clearExistingBtn = this.overlayEl.querySelector('#btn-clear-existing-selection')                     ;

    // Segmented patient category toggle: changes category and updates existing dropdown visibility in Add mode
    segContainer.addEventListener('click', (e) => {
      const target = (e.target               ).closest('.segment-btn')                     ;
      if (!target) return;
      const targetVal = target.getAttribute('data-value')               ;
      this.setPatientCategoryUI(targetVal);

      if (!this.isEditMode) {
        if (targetVal === 'Existing') {
          this.showExistingPicker(true);
        } else {
          this.showExistingPicker(false);
          // If we had an existing patient selected, reset currentRecord so new patient registration is clean
          if (this.currentRecord) {
            this.clearSelectedExistingPatient();
          }
        }
      }
    });

    // Existing patient search filter
    existingSearch.addEventListener('input', () => {
      this.existingSearchQuery = existingSearch.value.trim().toLowerCase();
      this.populateExistingDropdown();
    });

    // Existing patient select change
    existingSelect.addEventListener('change', () => {
      const selectedId = existingSelect.value;
      if (!selectedId) {
        this.clearSelectedExistingPatient();
        return;
      }

      const match = this.savedRecords.find(r => r.id === selectedId);
      if (match) {
        this.applySelectedExistingPatient(match);
      }
    });

    // Clear existing patient selection button
    clearExistingBtn.addEventListener('click', () => {
      this.clearSelectedExistingPatient();
      existingSelect.value = '';
    });

    // Toggle investigation chips
    chipsContainer.addEventListener('click', (e) => {
      const btn = (e.target               ).closest('.chip-checkbox')                     ;
      if (!btn) return;

      const isChecked = btn.classList.toggle('is-checked');
      btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');

      const invKey = btn.getAttribute('data-inv');
      if (invKey === 'Other') {
        if (isChecked) {
          otherContainer.style.display = 'flex';
          otherInput.focus();
        } else {
          otherContainer.style.display = 'none';
          otherInput.value = '';
          otherError.style.display = 'none';
        }
      }
    });

    // Clear error on otherInput input
    otherInput.addEventListener('input', () => {
      if (otherInput.value.trim()) {
        otherError.style.display = 'none';
      }
    });

    // Auto-suggest Blood date 1 month before TCA
    tcaInput.addEventListener('input', () => {
      const tcaVal = tcaInput.value;
      if (!this.isBloodDateManuallyEdited && tcaVal) {
        const suggested = getOneMonthBeforeISO(tcaVal);
        bloodInput.value = suggested;
      }
      this.validateBloodDate();
    });

    // User manual edit of Blood date
    bloodInput.addEventListener('input', () => {
      this.isBloodDateManuallyEdited = true;
      this.validateBloodDate();
    });

    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target               ;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });
  }

          showExistingPicker(show         )       {
    const pickerGroup = this.overlayEl.querySelector('#group-existing-picker')               ;
    pickerGroup.style.display = show ? 'block' : 'none';
    if (show) {
      this.populateExistingDropdown();
    }
  }

          populateExistingDropdown()       {
    const existingSelect = this.overlayEl.querySelector('#select-existing-patient')                     ;
    const emptyNotice = this.overlayEl.querySelector('#existing-picker-empty')               ;

    // Filter to existing patients (those categorized as Existing or active registered clinic patients)
    let candidates = this.savedRecords.filter(r => r.patientType === 'Existing');
    if (candidates.length === 0 && this.savedRecords.length > 0) {
      // Fallback: if no patients are explicitly tagged Existing yet, display all saved patients
      candidates = this.savedRecords;
    }

    if (this.existingSearchQuery) {
      const query = this.existingSearchQuery;
      candidates = candidates.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.icNumber.toLowerCase().includes(query) ||
        (r.phone && r.phone.toLowerCase().includes(query))
      );
    }

    // Deduplicate by ID
    const seen = new Set        ();
    const uniqueCandidates                  = [];
    for (const c of candidates) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        uniqueCandidates.push(c);
      }
    }

    // Sort alphabetically by name
    uniqueCandidates.sort((a, b) => a.name.localeCompare(b.name));

    existingSelect.innerHTML = '';

    if (uniqueCandidates.length === 0) {
      existingSelect.innerHTML = `<option value="">-- No matching existing patients found --</option>`;
      emptyNotice.style.display = 'block';
      return;
    }

    emptyNotice.style.display = 'none';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = `-- Select an existing patient (${uniqueCandidates.length} available) --`;
    existingSelect.appendChild(defaultOpt);

    for (const patient of uniqueCandidates) {
      const opt = document.createElement('option');
      opt.value = patient.id;
      // Privacy-conscious format: Name (IC: ••••-••-1234, ID: rec-...)
      opt.textContent = `${patient.name} (${maskIC(patient.icNumber)})`;
      if (this.currentRecord && this.currentRecord.id === patient.id) {
        opt.selected = true;
      }
      existingSelect.appendChild(opt);
    }
  }

          applySelectedExistingPatient(patient               )       {
    this.currentRecord = patient;

    const nameInput = this.overlayEl.querySelector('#field-name')                    ;
    const icInput = this.overlayEl.querySelector('#field-ic')                    ;
    const phoneInput = this.overlayEl.querySelector('#field-phone')                    ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#field-plan')                       ;

    nameInput.value = patient.name;
    icInput.value = patient.icNumber;
    phoneInput.value = patient.phone || '';
    tcaInput.value = patient.nextTca || '';
    bloodInput.value = patient.bloodInvestigationDate || '';
    otherInput.value = patient.bloodOther || '';
    planInput.value = patient.plan || '';

    this.isBloodDateManuallyEdited = Boolean(patient.bloodInvestigationDate);
    this.setSelectedInvestigations(patient.bloodInvestigations || []);

    // Show selection banner
    const banner = this.overlayEl.querySelector('#existing-selected-banner')               ;
    const nameSpan = this.overlayEl.querySelector('#existing-selected-name')               ;
    const metaSpan = this.overlayEl.querySelector('#existing-selected-meta')               ;

    nameSpan.textContent = patient.name;
    metaSpan.textContent = `(${maskIC(patient.icNumber)} • ID: ${patient.id})`;
    banner.style.display = 'flex';

    // Clear validation errors
    (this.overlayEl.querySelector('#error-name')               ).style.display = 'none';
    (this.overlayEl.querySelector('#error-ic')               ).style.display = 'none';
  }

          clearSelectedExistingPatient()       {
    this.currentRecord = null;

    const nameInput = this.overlayEl.querySelector('#field-name')                    ;
    const icInput = this.overlayEl.querySelector('#field-ic')                    ;
    const phoneInput = this.overlayEl.querySelector('#field-phone')                    ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#field-plan')                       ;

    nameInput.value = '';
    icInput.value = '';
    phoneInput.value = '';
    tcaInput.value = '';
    bloodInput.value = '';
    otherInput.value = '';
    planInput.value = '';

    this.isBloodDateManuallyEdited = false;
    this.setSelectedInvestigations([]);

    const banner = this.overlayEl.querySelector('#existing-selected-banner')               ;
    banner.style.display = 'none';
  }

          setPatientCategoryUI(type             )       {
    const typeInput = this.overlayEl.querySelector('#field-patient-type')                    ;
    typeInput.value = type;

    const segContainer = this.overlayEl.querySelector('#segmented-patient-type')               ;
    segContainer.querySelectorAll('.segment-btn').forEach(btn => {
      const isSelected = btn.getAttribute('data-value') === type;
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  }

          getSelectedInvestigations()           {
    const checkedBtns = this.overlayEl.querySelectorAll('.chip-checkbox.is-checked');
    const result           = [];
    checkedBtns.forEach(btn => {
      const key = btn.getAttribute('data-inv');
      if (key) result.push(key);
    });
    return result;
  }

          setSelectedInvestigations(investigations           = [])       {
    const chipsContainer = this.overlayEl.querySelector('#chips-investigations')               ;
    const otherContainer = this.overlayEl.querySelector('#container-blood-other')               ;
    const set = new Set(investigations);

    chipsContainer.querySelectorAll('.chip-checkbox').forEach(btn => {
      const key = btn.getAttribute('data-inv') || '';
      const isChecked = set.has(key);
      btn.classList.toggle('is-checked', isChecked);
      btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });

    otherContainer.style.display = set.has('Other') ? 'flex' : 'none';
  }

          validateBloodDate()          {
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const errorBlood = this.overlayEl.querySelector('#error-blood-date')               ;

    if (tcaInput.value && bloodInput.value && bloodInput.value > tcaInput.value) {
      errorBlood.style.display = 'block';
      return false;
    }
    errorBlood.style.display = 'none';
    return true;
  }

          async handleFormSubmit()                {
    const nameInput = this.overlayEl.querySelector('#field-name')                    ;
    const icInput = this.overlayEl.querySelector('#field-ic')                    ;
    const phoneInput = this.overlayEl.querySelector('#field-phone')                    ;
    const typeInput = this.overlayEl.querySelector('#field-patient-type')                    ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#field-plan')                       ;

    const errorName = this.overlayEl.querySelector('#error-name')               ;
    const errorIc = this.overlayEl.querySelector('#error-ic')               ;
    const errorOther = this.overlayEl.querySelector('#error-blood-other')               ;

    let hasError = false;

    if (!nameInput.value.trim()) {
      errorName.style.display = 'block';
      hasError = true;
    } else {
      errorName.style.display = 'none';
    }

    if (!icInput.value.trim()) {
      errorIc.style.display = 'block';
      hasError = true;
    } else {
      errorIc.style.display = 'none';
    }

    if (!this.validateBloodDate()) {
      hasError = true;
    }

    const selectedInvs = this.getSelectedInvestigations();
    if (selectedInvs.includes('Other')) {
      if (!otherInput.value.trim()) {
        errorOther.style.display = 'block';
        hasError = true;
      } else {
        errorOther.style.display = 'none';
      }
    } else {
      errorOther.style.display = 'none';
    }

    if (hasError) {
      if (!nameInput.value.trim()) {
        nameInput.focus();
      } else if (!icInput.value.trim()) {
        icInput.focus();
      } else if (selectedInvs.includes('Other') && !otherInput.value.trim()) {
        otherInput.focus();
      } else {
        bloodInput.focus();
      }
      return;
    }

    const patientType = (typeInput.value               ) || 'Existing';
    const trimmedIc = icInput.value.trim();
    const normalizedNewIc = normalizeCode(trimmedIc);

    // Duplicate IC check when saving a new patient (unless updating selected existing patient)
    const isNew = !this.currentRecord;
    if (isNew) {
      const existingMatch = this.savedRecords.find(
        r => normalizeCode(r.icNumber) === normalizedNewIc
      );

      if (existingMatch) {
        const shouldProceed = await confirmSheet.show({
          title: 'Duplicate IC Warning',
          message: `A patient with IC "${trimmedIc}" already exists as "${existingMatch.name}". Are you sure you want to proceed with registering this record?`,
          confirmLabel: 'Save Anyway',
          cancelLabel: 'Review IC',
          isDestructive: false
        });

        if (!shouldProceed) {
          icInput.focus();
          return;
        }
      }
    }

    const saveBtn = this.overlayEl.querySelector('#btn-save-record')                     ;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (this.onSaveCallback) {
        await this.onSaveCallback({
          id: this.currentRecord ? this.currentRecord.id : '',
          name: nameInput.value.trim(),
          icNumber: trimmedIc,
          phone: phoneInput.value.trim() || undefined,
          patientType,
          isActive: this.currentRecord?.isActive !== undefined ? this.currentRecord.isActive : true,
          appointments: this.currentRecord?.appointments,
          nextTca: tcaInput.value || undefined,
          bloodInvestigationDate: bloodInput.value || undefined,
          bloodInvestigations: selectedInvs,
          bloodOther: selectedInvs.includes('Other') && otherInput.value.trim() ? otherInput.value.trim() : undefined,
          plan: planInput.value.trim() || undefined,
          createdAt: this.currentRecord?.createdAt
        });
      }
      this.close();
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = this.isEditMode ? 'Save Changes' : 'Save Patient';
    }
  }

         open(
    record                      ,
    savedRecords                 ,
    onSave                                                                                                                        ,
    triggerEl              
  )       {
    this.currentRecord = record;
    this.savedRecords = savedRecords;
    this.isEditMode = Boolean(record);
    this.onSaveCallback = onSave;
    this.previousActiveElement = triggerEl || (document.activeElement               );
    this.existingSearchQuery = '';

    const titleEl = this.overlayEl.querySelector('#form-modal-title')               ;
    const saveBtn = this.overlayEl.querySelector('#btn-save-record')                     ;
    const nameInput = this.overlayEl.querySelector('#field-name')                    ;
    const icInput = this.overlayEl.querySelector('#field-ic')                    ;
    const phoneInput = this.overlayEl.querySelector('#field-phone')                    ;
    const typeInput = this.overlayEl.querySelector('#field-patient-type')                    ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#field-plan')                       ;
    const existingSearch = this.overlayEl.querySelector('#filter-existing-patients')                    ;
    existingSearch.value = '';

    const errorName = this.overlayEl.querySelector('#error-name')               ;
    const errorIc = this.overlayEl.querySelector('#error-ic')               ;
    const errorBlood = this.overlayEl.querySelector('#error-blood-date')               ;
    const errorOther = this.overlayEl.querySelector('#error-blood-other')               ;
    errorName.style.display = 'none';
    errorIc.style.display = 'none';
    errorBlood.style.display = 'none';
    errorOther.style.display = 'none';

    if (record) {
      // Edit Mode
      titleEl.textContent = 'Edit Patient Details';
      saveBtn.textContent = 'Save Changes';
      nameInput.value = record.name;
      icInput.value = record.icNumber;
      phoneInput.value = record.phone || '';
      typeInput.value = record.patientType || 'Existing';
      tcaInput.value = record.nextTca || '';
      bloodInput.value = record.bloodInvestigationDate || '';
      otherInput.value = record.bloodOther || '';
      planInput.value = record.plan || '';
      this.isBloodDateManuallyEdited = Boolean(record.bloodInvestigationDate);
      this.setSelectedInvestigations(record.bloodInvestigations || []);
      this.showExistingPicker(false);
    } else {
      // Add Mode: heading is "Add Patient" (Requirement 3)
      titleEl.textContent = 'Add Patient';
      saveBtn.textContent = 'Save Patient';
      nameInput.value = '';
      icInput.value = '';
      phoneInput.value = '';
      typeInput.value = 'Existing';
      tcaInput.value = '';
      bloodInput.value = '';
      otherInput.value = '';
      planInput.value = '';
      this.isBloodDateManuallyEdited = false;
      this.setSelectedInvestigations([]);

      // In Add Mode with Existing category active, show dynamic existing picker (Requirement 1)
      this.showExistingPicker(true);
      (this.overlayEl.querySelector('#existing-selected-banner')               ).style.display = 'none';
    }

    this.setPatientCategoryUI((typeInput.value               ) || 'Existing');

    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');

    window.setTimeout(() => {
      if (!record && typeInput.value === 'Existing') {
        const existingSelect = this.overlayEl.querySelector('#select-existing-patient')               ;
        existingSelect.focus();
      } else {
        nameInput.focus();
      }
    }, 100);
  }

         close()       {
    if (!this.isOpen()) return;
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}


  // --- Module: components/appointment-modal ---
class AppointmentModal {
          overlayEl             ;
          mode                       = 'new';
          patient                       = null;
          targetAppointment                        = null;
          isBloodDateManuallyEdited = false;
          onSaveCallback                                                             = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'TCA Appointment Form');

    const chipsHtml = BLOOD_INVESTIGATION_OPTIONS.map(opt => `
      <button
        type="button"
        class="chip-checkbox"
        data-apt-inv="${opt}"
        role="checkbox"
        aria-checked="false"
      >
        <svg class="chip-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${opt}</span>
      </button>
    `).join('');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 500px;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title" id="apt-modal-title">Schedule New TCA</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Cancel and close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form id="apt-form" class="sheet-body" novalidate>
          <div id="apt-patient-banner" style="padding: 8px 12px; background-color: var(--color-bg-secondary); border-radius: var(--radius-md); font-size: 13.5px; color: var(--color-text-secondary); margin-bottom: 4px;">
            Patient: <strong id="apt-patient-name" style="color: var(--color-text-primary);"></strong>
          </div>

          <div id="apt-reschedule-notice" style="display: none; padding: 10px 12px; background-color: var(--color-accent-subtle); border-radius: var(--radius-md); font-size: 13px; color: var(--color-accent); margin-bottom: 6px;">
            Rescheduling will preserve the original appointment in TCA History and schedule this new date.
          </div>

          <div class="form-group">
            <label class="form-label required" for="apt-field-tca">Appointment Date (Next TCA)</label>
            <div class="date-input-container">
              <input type="date" id="apt-field-tca" class="form-input form-date-input" required />
              <svg class="date-picker-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <span class="form-error" id="apt-error-tca" style="display: none;">TCA Date is required</span>
          </div>

          <div class="form-group">
            <label class="form-label" for="apt-field-blood-date">Blood Investigation Date ("Blood date")</label>
            <div class="date-input-container">
              <input type="date" id="apt-field-blood-date" class="form-input form-date-input" />
              <svg class="date-picker-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <span class="form-hint">Prefills to 1 month before TCA if untouched. Can be edited or cleared.</span>
            <span class="form-error" id="apt-error-blood-date" style="display: none;">Blood date cannot be after Next TCA</span>
          </div>

          <!-- BLOOD INVESTIGATIONS (TICKABLE) -->
          <div class="form-group">
            <label class="form-label">Blood Investigations</label>
            <div class="investigation-chips-group" id="apt-chips-investigations" role="group" aria-label="Blood Investigations">
              ${chipsHtml}
            </div>
            
            <div class="blood-other-container" id="apt-container-blood-other" style="display: none;">
              <label class="form-label required" for="apt-field-blood-other" style="font-size: 13px;">State other investigation</label>
              <input type="text" id="apt-field-blood-other" class="form-input" placeholder="e.g. TFT, Hep B/C, Urine FEME" autocomplete="off" />
              <span class="form-error" id="apt-error-blood-other" style="display: none;">Please state the other investigation</span>
            </div>
          </div>

          <!-- PLAN -->
          <div class="form-group">
            <label class="form-label" for="apt-field-plan">Follow-up Plan</label>
            <textarea id="apt-field-plan" class="form-textarea" placeholder="e.g. Review VL & CD4 results, assess ART adherence, renew 3-month supply..."></textarea>
          </div>

          <!-- NOTES -->
          <div class="form-group">
            <label class="form-label" for="apt-field-notes">Appointment Notes</label>
            <input type="text" id="apt-field-notes" class="form-input" placeholder="e.g. Patient requested morning slot; fasting for FBS" autocomplete="off" />
          </div>
        </form>
        <div class="sheet-footer">
          <button type="button" class="btn-secondary" data-action="close">Cancel</button>
          <button type="submit" form="apt-form" id="btn-save-apt" class="btn-primary">Save Appointment</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    const form = this.overlayEl.querySelector('#apt-form')                   ;
    const tcaInput = this.overlayEl.querySelector('#apt-field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#apt-field-blood-date')                    ;
    const chipsContainer = this.overlayEl.querySelector('#apt-chips-investigations')               ;
    const otherContainer = this.overlayEl.querySelector('#apt-container-blood-other')               ;
    const otherInput = this.overlayEl.querySelector('#apt-field-blood-other')                    ;
    const otherError = this.overlayEl.querySelector('#apt-error-blood-other')               ;

    // Toggle investigation chips
    chipsContainer.addEventListener('click', (e) => {
      const btn = (e.target               ).closest('.chip-checkbox')                     ;
      if (!btn) return;

      const isChecked = btn.classList.toggle('is-checked');
      btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');

      const invKey = btn.getAttribute('data-apt-inv');
      if (invKey === 'Other') {
        if (isChecked) {
          otherContainer.style.display = 'flex';
          otherInput.focus();
        } else {
          otherContainer.style.display = 'none';
          otherInput.value = '';
          otherError.style.display = 'none';
        }
      }
    });

    otherInput.addEventListener('input', () => {
      if (otherInput.value.trim()) {
        otherError.style.display = 'none';
      }
    });

    tcaInput.addEventListener('input', () => {
      const tcaVal = tcaInput.value;
      if (!this.isBloodDateManuallyEdited && tcaVal) {
        const suggested = getOneMonthBeforeISO(tcaVal);
        bloodInput.value = suggested;
      }
      this.validateBloodDate();
    });

    bloodInput.addEventListener('input', () => {
      this.isBloodDateManuallyEdited = true;
      this.validateBloodDate();
    });

    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target               ;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });
  }

          validateBloodDate()          {
    const tcaInput = this.overlayEl.querySelector('#apt-field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#apt-field-blood-date')                    ;
    const errorBlood = this.overlayEl.querySelector('#apt-error-blood-date')               ;

    if (tcaInput.value && bloodInput.value && bloodInput.value > tcaInput.value) {
      errorBlood.style.display = 'block';
      return false;
    }
    errorBlood.style.display = 'none';
    return true;
  }

          getSelectedInvestigations()           {
    const checkedBtns = this.overlayEl.querySelectorAll('.chip-checkbox.is-checked');
    const result           = [];
    checkedBtns.forEach(btn => {
      const key = btn.getAttribute('data-apt-inv');
      if (key) result.push(key);
    });
    return result;
  }

          setSelectedInvestigations(investigations           = [])       {
    const chipsContainer = this.overlayEl.querySelector('#apt-chips-investigations')               ;
    const otherContainer = this.overlayEl.querySelector('#apt-container-blood-other')               ;
    const set = new Set(investigations);

    chipsContainer.querySelectorAll('.chip-checkbox').forEach(btn => {
      const key = btn.getAttribute('data-apt-inv') || '';
      const isChecked = set.has(key);
      btn.classList.toggle('is-checked', isChecked);
      btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });

    otherContainer.style.display = set.has('Other') ? 'flex' : 'none';
  }

          async handleFormSubmit()                {
    const tcaInput = this.overlayEl.querySelector('#apt-field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#apt-field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#apt-field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#apt-field-plan')                       ;
    const notesInput = this.overlayEl.querySelector('#apt-field-notes')                    ;

    const errorTca = this.overlayEl.querySelector('#apt-error-tca')               ;
    const errorOther = this.overlayEl.querySelector('#apt-error-blood-other')               ;

    let hasError = false;

    if (!tcaInput.value.trim()) {
      errorTca.style.display = 'block';
      hasError = true;
    } else {
      errorTca.style.display = 'none';
    }

    if (!this.validateBloodDate()) {
      hasError = true;
    }

    const selectedInvs = this.getSelectedInvestigations();
    if (selectedInvs.includes('Other')) {
      if (!otherInput.value.trim()) {
        errorOther.style.display = 'block';
        hasError = true;
      } else {
        errorOther.style.display = 'none';
      }
    } else {
      errorOther.style.display = 'none';
    }

    if (hasError) {
      if (!tcaInput.value.trim()) {
        tcaInput.focus();
      } else if (selectedInvs.includes('Other') && !otherInput.value.trim()) {
        otherInput.focus();
      } else {
        bloodInput.focus();
      }
      return;
    }

    const saveBtn = this.overlayEl.querySelector('#btn-save-apt')                     ;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      if (this.onSaveCallback) {
        await this.onSaveCallback({
          tcaDate: tcaInput.value.trim(),
          bloodInvestigationDate: bloodInput.value || undefined,
          bloodInvestigations: selectedInvs,
          bloodOther: selectedInvs.includes('Other') && otherInput.value.trim() ? otherInput.value.trim() : undefined,
          plan: planInput.value.trim() || undefined,
          notes: notesInput.value.trim() || undefined
        });
      }
      this.close();
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Appointment';
    }
  }

         open(
    patient               ,
    mode                      ,
    targetAppointment                       ,
    onSave                                                   ,
    triggerEl              
  )       {
    this.patient = patient;
    this.mode = mode;
    this.targetAppointment = targetAppointment;
    this.onSaveCallback = onSave;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    const titleEl = this.overlayEl.querySelector('#apt-modal-title')               ;
    const patientNameEl = this.overlayEl.querySelector('#apt-patient-name')               ;
    const rescheduleNotice = this.overlayEl.querySelector('#apt-reschedule-notice')               ;
    const tcaInput = this.overlayEl.querySelector('#apt-field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#apt-field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#apt-field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#apt-field-plan')                       ;
    const notesInput = this.overlayEl.querySelector('#apt-field-notes')                    ;

    patientNameEl.textContent = `${patient.name} (${patient.icNumber})`;

    if (mode === 'reschedule') {
      titleEl.textContent = 'Reschedule Appointment';
      rescheduleNotice.style.display = 'block';
      tcaInput.value = '';
      bloodInput.value = '';
      otherInput.value = targetAppointment?.bloodOther || '';
      planInput.value = targetAppointment?.plan || '';
      notesInput.value = targetAppointment ? `Rescheduled from ${targetAppointment.tcaDate}` : '';
      this.setSelectedInvestigations(targetAppointment?.bloodInvestigations || []);
      this.isBloodDateManuallyEdited = false;
    } else if (mode === 'edit' && targetAppointment) {
      titleEl.textContent = 'Edit Appointment';
      rescheduleNotice.style.display = 'none';
      tcaInput.value = targetAppointment.tcaDate;
      bloodInput.value = targetAppointment.bloodInvestigationDate || '';
      otherInput.value = targetAppointment.bloodOther || '';
      planInput.value = targetAppointment.plan || '';
      notesInput.value = targetAppointment.notes || '';
      this.setSelectedInvestigations(targetAppointment.bloodInvestigations || []);
      this.isBloodDateManuallyEdited = Boolean(targetAppointment.bloodInvestigationDate);
    } else {
      titleEl.textContent = 'Schedule New TCA';
      rescheduleNotice.style.display = 'none';
      tcaInput.value = '';
      bloodInput.value = '';
      otherInput.value = '';
      planInput.value = patient.plan || '';
      notesInput.value = '';
      this.setSelectedInvestigations(patient.bloodInvestigations || []);
      this.isBloodDateManuallyEdited = false;
    }

    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');

    window.setTimeout(() => {
      tcaInput.focus();
    }, 100);
  }

         close()       {
    if (!this.isOpen()) return;
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}


  // --- Module: components/details-modal ---
             
                
                 
              
                    
                             
                       
                  
                                                                 
function escapeHTML(str        )         {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

                                       
                                          
                                            
                                                                       
                                                                              
                                                 
                                                                                
                                                                                                          
                              
                                                                                                                    
                                                              
 

class DetailsModal {
          overlayEl             ;
          currentRecord                       = null;
          handlers                              = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Patient Profile');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet profile-modal" style="max-width: 660px;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title">Patient Profile</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close profile">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sheet-body" id="details-content"></div>
        <div class="sheet-footer profile-footer-actions">
          <div class="footer-left-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" id="btn-toggle-deactivate" class="btn-secondary" style="font-weight: 500; font-size: 13.5px;"></button>
            <button type="button" id="btn-delete-record" class="btn-destructive" style="font-size: 13.5px;">Delete</button>
          </div>
          <div class="footer-right-actions" style="display: flex; gap: 8px;">
            <button type="button" class="btn-secondary" data-action="close">Close</button>
            <button type="button" id="btn-edit-record" class="btn-primary">Edit Patient</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    const editBtn = this.overlayEl.querySelector('#btn-edit-record')                     ;
    const deleteBtn = this.overlayEl.querySelector('#btn-delete-record')                     ;
    const deactivateBtn = this.overlayEl.querySelector('#btn-toggle-deactivate')                     ;

    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target               ;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    editBtn.addEventListener('click', () => {
      if (this.currentRecord && this.handlers) {
        const rec = this.currentRecord;
        this.close();
        this.handlers.onEdit(rec);
      }
    });

    deleteBtn.addEventListener('click', () => {
      if (this.currentRecord && this.handlers) {
        this.handlers.onDelete(this.currentRecord);
      }
    });

    deactivateBtn.addEventListener('click', () => {
      if (this.currentRecord && this.handlers) {
        const isCurrentlyActive = this.currentRecord.isActive !== false;
        this.handlers.onToggleActive(this.currentRecord, !isCurrentlyActive);
      }
    });
  }

         open(
    record               ,
    handlers                      ,
    triggerEl              
  )       {
    this.currentRecord = record;
    this.handlers = handlers;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    const deactivateBtn = this.overlayEl.querySelector('#btn-toggle-deactivate')                     ;
    const isCurrentlyActive = record.isActive !== false;
    deactivateBtn.textContent = isCurrentlyActive ? 'Deactivate Patient' : 'Reactivate Patient';

    this.renderProfileContent();
    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');
  }

         updateRecord(record               )       {
    this.currentRecord = record;
    const deactivateBtn = this.overlayEl.querySelector('#btn-toggle-deactivate')                     ;
    const isCurrentlyActive = record.isActive !== false;
    deactivateBtn.textContent = isCurrentlyActive ? 'Deactivate Patient' : 'Reactivate Patient';
    this.renderProfileContent();
  }

          renderProfileContent()       {
    if (!this.currentRecord) return;
    const record = this.currentRecord;
    const contentEl = this.overlayEl.querySelector('#details-content')               ;

    const isCurrentlyActive = record.isActive !== false;
    const isNew = record.patientType === 'New';

    // Status Banner (Active/Inactive)
    let activeBannerHtml = '';
    if (!isCurrentlyActive) {
      activeBannerHtml = `
        <div class="deactivated-patient-banner">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <div>
            <strong>Patient Record Deactivated</strong>
            <div style="font-size: 12.5px; opacity: 0.9;">All medical history, appointments, and investigations remain safely preserved.</div>
          </div>
        </div>
      `;
    }

    // Patient Category Badge & Toggle Button
    const categoryTag = isNew
      ? `<span class="patient-type-pill pill-new">New Patient</span>`
      : `<span class="patient-type-pill pill-existing">Existing Patient</span>`;

    const switchCategoryLabel = isNew ? 'Switch to Existing Patient' : 'Switch to New Patient';

    // Phone link
    const phoneLink = record.phone
      ? `<a href="tel:${escapeHTML(record.phone)}" class="profile-tel-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>${escapeHTML(record.phone)}</span>
         </a>`
      : '<span style="color: var(--color-text-tertiary); font-style: italic;">None</span>';

    // -------------------------------------------------------------
    // TCA Appointments: Upcoming (Scheduled) vs History
    // -------------------------------------------------------------
    const appointments                   = Array.isArray(record.appointments) ? record.appointments : [];
    const scheduledApts = appointments.filter(a => a.status === 'Scheduled');
    const historicalApts = appointments.filter(a => a.status !== 'Scheduled').sort((a, b) => b.tcaDate.localeCompare(a.tcaDate));

    scheduledApts.sort((a, b) => a.tcaDate.localeCompare(b.tcaDate));
    const nextApt = scheduledApts.length > 0 ? scheduledApts[0] : null;

    // SECTION A: Upcoming TCA HTML
    let upcomingSectionHtml = '';
    if (nextApt) {
      const tcaStatus = getTCAStatus(nextApt.tcaDate);
      const isOverdue = tcaStatus.type === 'overdue';
      const formattedDate = formatDisplayDate(nextApt.tcaDate);

      let overdueBanner = '';
      if (isOverdue) {
        overdueBanner = `
          <div class="overdue-action-required-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span><strong>Overdue TCA Appointment: Action Required.</strong> Record patient attendance, mark DNA, or reschedule.</span>
          </div>
        `;
      }

      let bloodFormatted = 'None';
      let bloodBadgeHtml = '';
      if (nextApt.bloodInvestigationDate) {
        bloodFormatted = formatDisplayDate(nextApt.bloodInvestigationDate);
        if (isDatePast(nextApt.bloodInvestigationDate)) {
          bloodBadgeHtml = `<span class="blood-status-note overdue" style="margin-left: 6px;">(Overdue)</span>`;
        }
      }

      let invsHtml = '<span style="color: var(--color-text-tertiary); font-style: italic;">None selected</span>';
      if (nextApt.bloodInvestigations && nextApt.bloodInvestigations.length > 0) {
        const chips = nextApt.bloodInvestigations.map(inv => {
          const text = inv === 'Other' && nextApt.bloodOther ? `Other: ${nextApt.bloodOther}` : inv;
          return `<span class="mini-chip" style="font-size: 12px; padding: 3px 9px;">${escapeHTML(text)}</span>`;
        }).join('');
        invsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 6px;">${chips}</div>`;
      }

      const planHtml = nextApt.plan && nextApt.plan.trim()
        ? `<div class="detail-plan-box">${escapeHTML(nextApt.plan)}</div>`
        : '<span style="color: var(--color-text-tertiary); font-style: italic;">No specific plan recorded</span>';

      const notesHtml = nextApt.notes && nextApt.notes.trim()
        ? `<div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;"><em>Note: ${escapeHTML(nextApt.notes)}</em></div>`
        : '';

      upcomingSectionHtml = `
        <div class="profile-section-card upcoming-tca-card ${isOverdue ? 'has-overdue' : ''}">
          <div class="profile-section-title" style="display: flex; align-items: center; justify-content: space-between;">
            <span>A. Upcoming Scheduled TCA</span>
            <span class="appointment-status-badge badge-scheduled">Scheduled</span>
          </div>
          ${overdueBanner}
          <div class="profile-row-item">
            <span class="profile-row-label">Appointment Date</span>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="profile-row-value" style="font-size: 16px; font-weight: 700;">${formattedDate}</span>
              <div class="tca-indicator tca-${tcaStatus.type}">
                <span class="tca-dot"></span>
                <span>${escapeHTML(tcaStatus.label)}</span>
              </div>
            </div>
          </div>
          <div class="profile-row-item">
            <span class="profile-row-label">Blood Investigation Date</span>
            <div style="display: flex; align-items: center;">
              <span class="profile-row-value">${bloodFormatted}</span>
              ${bloodBadgeHtml}
            </div>
          </div>
          <div class="profile-row-item" style="flex-direction: column; align-items: flex-start; gap: 6px;">
            <span class="profile-row-label">Investigations to Perform:</span>
            ${invsHtml}
          </div>
          <div class="profile-row-item" style="flex-direction: column; align-items: flex-start; gap: 6px;">
            <span class="profile-row-label">Follow-up Plan:</span>
            ${planHtml}
            ${notesHtml}
          </div>

          <!-- Upcoming Action Buttons -->
          <div class="upcoming-tca-actions">
            <button type="button" class="btn-action-attended" data-action="mark-attended" data-apt-id="${nextApt.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Mark Attended
            </button>
            <button type="button" class="btn-action-dna" data-action="mark-dna" data-apt-id="${nextApt.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              Mark DNA
            </button>
            <button type="button" class="btn-action-reschedule" data-action="reschedule" data-apt-id="${nextApt.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Reschedule
            </button>
            <button type="button" class="btn-action-cancel" data-action="cancel" data-apt-id="${nextApt.id}">
              Cancel
            </button>
          </div>

          <div style="margin-top: 12px; text-align: right;">
            <button type="button" id="btn-create-extra-tca" class="btn-secondary" style="font-size: 13px; padding: 6px 12px;">
              + Schedule Another TCA Appointment
            </button>
          </div>
        </div>
      `;
    } else {
      upcomingSectionHtml = `
        <div class="profile-section-card upcoming-tca-card">
          <div class="profile-section-title">A. Upcoming Scheduled TCA</div>
          <div style="padding: 16px; text-align: center; color: var(--color-text-secondary); background-color: var(--color-bg-secondary); border-radius: var(--radius-md);">
            <p style="font-size: 14.5px; font-weight: 500; margin-bottom: 6px;">No Upcoming TCA Scheduled</p>
            <p style="font-size: 13px; color: var(--color-text-tertiary); margin-bottom: 12px;">Patient does not have an active scheduled clinic TCA appointment.</p>
            <button type="button" id="btn-schedule-new-tca" class="btn-primary" style="font-size: 14px; padding: 8px 18px;">
              + Schedule TCA Appointment
            </button>
          </div>
        </div>
      `;
    }

    // SECTION B: TCA History HTML
    let historyItemsHtml = '';
    if (historicalApts.length > 0) {
      historyItemsHtml = historicalApts.map(apt => {
        const formattedDate = formatDisplayDate(apt.tcaDate);
        let statusClass = 'badge-cancelled';
        if (apt.status === 'Attended') statusClass = 'badge-attended';
        else if (apt.status === 'DNA') statusClass = 'badge-dna';
        else if (apt.status === 'Rescheduled') statusClass = 'badge-rescheduled';

        let reschedNotice = '';
        if (apt.status === 'Rescheduled' && apt.rescheduledToAppointmentId) {
          reschedNotice = `<span style="font-size: 12px; color: var(--color-accent); font-weight: 500;">(Rescheduled to new date)</span>`;
        }

        let bloodInfo = '';
        if (apt.bloodInvestigationDate) {
          bloodInfo = `<div style="font-size: 13px; margin-top: 4px;"><strong>Blood Date:</strong> ${formatDisplayDate(apt.bloodInvestigationDate)}</div>`;
        }

        let invsChips = '';
        if (apt.bloodInvestigations && apt.bloodInvestigations.length > 0) {
          const chips = apt.bloodInvestigations.map(inv => {
            const text = inv === 'Other' && apt.bloodOther ? `Other: ${apt.bloodOther}` : inv;
            return `<span class="mini-chip" style="font-size: 11.5px; padding: 2px 7px;">${escapeHTML(text)}</span>`;
          }).join('');
          invsChips = `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px;">${chips}</div>`;
        }

        let planText = '';
        if (apt.plan && apt.plan.trim()) {
          planText = `<div style="font-size: 13px; color: var(--color-text-primary); margin-top: 5px; background-color: var(--color-bg-secondary); padding: 6px 10px; border-radius: var(--radius-sm);">${escapeHTML(apt.plan)}</div>`;
        }

        let notesText = '';
        if (apt.notes && apt.notes.trim()) {
          notesText = `<div style="font-size: 12.5px; color: var(--color-text-tertiary); margin-top: 4px;"><em>Notes: ${escapeHTML(apt.notes)}</em></div>`;
        }

        return `
          <div class="tca-history-item">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="tca-history-date">${formattedDate}</span>
                ${reschedNotice}
              </div>
              <span class="appointment-status-badge ${statusClass}">${apt.status}</span>
            </div>
            ${bloodInfo}
            ${invsChips}
            ${planText}
            ${notesText}
          </div>
        `;
      }).join('');
    } else {
      historyItemsHtml = `
        <div style="padding: 14px; text-align: center; color: var(--color-text-tertiary); font-style: italic; font-size: 13.5px;">
          No previous TCA appointment history recorded for this patient.
        </div>
      `;
    }

    const historySectionHtml = `
      <div class="profile-section-card">
        <div class="profile-section-title" style="display: flex; align-items: center; justify-content: space-between;">
          <span>B. TCA History (${historicalApts.length} past records)</span>
        </div>
        <div class="tca-history-list">
          ${historyItemsHtml}
        </div>
      </div>
    `;

    // -------------------------------------------------------------
    // Blood Collection Appointments: Upcoming vs History
    // -------------------------------------------------------------
    const bloodCollections                               = Array.isArray(record.bloodCollections) && record.bloodCollections.length > 0
      ? [...record.bloodCollections]
      : (record.bloodInvestigationDate
          ? [{
              id: 'bld-synth-' + record.id,
              patientId: record.id,
              scheduledDate: record.bloodInvestigationDate,
              status: record.currentBloodStatus || 'Scheduled',
              investigations: record.bloodInvestigations || [],
              investigationOther: record.bloodOther,
              notes: record.notes,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt
            }]
          : []);

    const scheduledBld = bloodCollections.filter(b => b.status === 'Scheduled').sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
    const nextBld = scheduledBld.length > 0 ? scheduledBld[0] : null;
    const historicalBld = bloodCollections.filter(b => b.status !== 'Scheduled').sort((a, b) => {
      const dateA = a.actualCollectionDate || a.scheduledDate;
      const dateB = b.actualCollectionDate || b.scheduledDate;
      return dateB.localeCompare(dateA);
    });

    // Facility Routing Notice
    const labRoutingNoticeHtml = `
      <div class="lab-routing-notice" style="display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; padding: 10px 12px; background: var(--color-bg-primary); border: 0.5px solid var(--color-separator); border-left: 3px solid var(--color-accent); border-radius: var(--radius-md); margin-bottom: 12px; line-height: 1.45;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px; color: var(--color-accent);">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <div>
          <strong>Collection & Laboratory Routing:</strong> All blood samples are collected on-site at <strong>KK Bandar Kulim</strong>. CD4 samples are dispatched to <strong>KK Taman Intan</strong>; HIV Viral Load samples are dispatched to <strong>Hospital Sultanah Bahiyah (HSB)</strong>. Receiving facilities are not patient collection locations.
        </div>
      </div>
    `;

    // SECTION C: Upcoming Blood Collection HTML
    let upcomingBloodSectionHtml = '';
    if (nextBld) {
      const isOverdue = isDatePast(nextBld.scheduledDate);
      const formattedDate = formatDisplayDate(nextBld.scheduledDate);
      const timeDisplay = nextBld.scheduledTime ? `at ${escapeHTML(nextBld.scheduledTime)}` : '';

      let overdueBanner = '';
      if (isOverdue) {
        overdueBanner = `
          <div class="overdue-action-required-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span><strong>Blood Collection Overdue: Action Required.</strong> Record sample collection, mark DNA, or reschedule.</span>
          </div>
        `;
      }

      let invsHtml = '<span style="color: var(--color-text-tertiary); font-style: italic;">None specified</span>';
      if (nextBld.investigations && nextBld.investigations.length > 0) {
        const chips = nextBld.investigations.map(inv => {
          const text = inv === 'Other' && nextBld.investigationOther ? `Other: ${nextBld.investigationOther}` : inv;
          return `<span class="mini-chip" style="font-size: 12px; padding: 3px 9px;">${escapeHTML(text)}</span>`;
        }).join('');
        invsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 6px;">${chips}</div>`;
      }

      const notesHtml = nextBld.notes && nextBld.notes.trim()
        ? `<div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;"><em>Note: ${escapeHTML(nextBld.notes)}</em></div>`
        : '';

      upcomingBloodSectionHtml = `
        <div class="profile-section-card ${isOverdue ? 'has-overdue' : ''}">
          <div class="profile-section-title" style="display: flex; align-items: center; justify-content: space-between;">
            <span>C. Upcoming Blood Collection</span>
            <span class="appointment-status-badge badge-scheduled">Scheduled</span>
          </div>
          ${overdueBanner}
          ${labRoutingNoticeHtml}

          <div class="profile-row-item">
            <span class="profile-row-label">Scheduled Date</span>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="profile-row-value" style="font-size: 16px; font-weight: 700;">${formattedDate} ${timeDisplay}</span>
              ${isOverdue ? `<span class="blood-status-note overdue">(Overdue)</span>` : ''}
            </div>
          </div>
          <div class="profile-row-item" style="flex-direction: column; align-items: flex-start; gap: 6px;">
            <span class="profile-row-label">Investigations to Perform:</span>
            ${invsHtml}
          </div>
          ${notesHtml ? `<div class="profile-row-item" style="flex-direction: column; align-items: flex-start; gap: 6px;"><span class="profile-row-label">Staff Notes:</span>${notesHtml}</div>` : ''}

          <!-- Blood Collection Actions -->
          <div class="upcoming-tca-actions" style="margin-top: 14px;">
            <button type="button" class="btn-action-attended" data-blood-action="attend" data-bld-id="${nextBld.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Mark Attended (Sample Collected)
            </button>
            <button type="button" class="btn-action-dna" data-blood-action="dna" data-bld-id="${nextBld.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              Mark DNA
            </button>
            <button type="button" class="btn-action-reschedule" data-blood-action="reschedule" data-bld-id="${nextBld.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              Reschedule Blood Date
            </button>
            <button type="button" class="btn-action-cancel" data-blood-action="cancel" data-bld-id="${nextBld.id}">
              Cancel
            </button>
          </div>
        </div>
      `;
    } else {
      upcomingBloodSectionHtml = `
        <div class="profile-section-card">
          <div class="profile-section-title">C. Upcoming Blood Collection</div>
          ${labRoutingNoticeHtml}
          <div style="padding: 16px; text-align: center; color: var(--color-text-secondary); background-color: var(--color-bg-secondary); border-radius: var(--radius-md);">
            <p style="font-size: 14.5px; font-weight: 500; margin-bottom: 6px;">No Upcoming Blood Collection Scheduled</p>
            <p style="font-size: 13px; color: var(--color-text-tertiary); margin-bottom: 12px;">Patient does not have an active scheduled blood collection appointment.</p>
            <button type="button" id="btn-schedule-new-blood" class="btn-primary" style="font-size: 14px; padding: 8px 18px;">
              + Schedule Blood Collection
            </button>
          </div>
        </div>
      `;
    }

    // SECTION D: Blood Collection History HTML
    let bloodHistoryItemsHtml = '';
    if (historicalBld.length > 0) {
      bloodHistoryItemsHtml = historicalBld.map(bld => {
        const scheduledFormatted = formatDisplayDate(bld.scheduledDate);
        let statusClass = 'badge-cancelled';
        let statusLabel         = bld.status;

        if (bld.status === 'Attended') {
          statusClass = 'badge-attended';
          statusLabel = 'Attended (Sample Collected)';
        } else if (bld.status === 'DNA') {
          statusClass = 'badge-dna';
          statusLabel = 'Did Not Attend (DNA)';
        } else if (bld.status === 'Rescheduled') {
          statusClass = 'badge-rescheduled';
          statusLabel = 'Rescheduled';
        } else if (bld.status === 'Cancelled') {
          statusClass = 'badge-cancelled';
          statusLabel = 'Cancelled';
        }

        let actualCollectionInfo = '';
        if (bld.status === 'Attended' && bld.actualCollectionDate) {
          const actDate = formatDisplayDate(bld.actualCollectionDate);
          const actTime = bld.actualCollectionTime ? `at ${escapeHTML(bld.actualCollectionTime)}` : '';
          actualCollectionInfo = `
            <div style="font-size: 13px; color: #248A3D; font-weight: 500; margin-top: 4px;">
              Actual Collection: ${actDate} ${actTime} (Sample Collected at KK Bandar Kulim)
            </div>
          `;
        }

        let reschedNotice = '';
        if (bld.status === 'Rescheduled') {
          const reasonText = bld.rescheduledReason ? ` - Reason: ${escapeHTML(bld.rescheduledReason)}` : '';
          reschedNotice = `<div style="font-size: 12px; color: #5856D6; font-weight: 500; margin-top: 4px;">Rescheduled to new appointment${reasonText}</div>`;
        }

        let invsChips = '';
        if (bld.investigations && bld.investigations.length > 0) {
          const chips = bld.investigations.map(inv => {
            const text = inv === 'Other' && bld.investigationOther ? `Other: ${bld.investigationOther}` : inv;
            return `<span class="mini-chip" style="font-size: 11.5px; padding: 2px 7px;">${escapeHTML(text)}</span>`;
          }).join('');
          invsChips = `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px;">${chips}</div>`;
        }

        let notesText = '';
        if (bld.notes && bld.notes.trim()) {
          notesText = `<div style="font-size: 12.5px; color: var(--color-text-tertiary); margin-top: 4px;"><em>Notes: ${escapeHTML(bld.notes)}</em></div>`;
        }

        return `
          <div class="tca-history-item">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="tca-history-date">Scheduled: ${scheduledFormatted}</span>
              </div>
              <span class="appointment-status-badge ${statusClass}">${escapeHTML(statusLabel)}</span>
            </div>
            ${actualCollectionInfo}
            ${reschedNotice}
            ${invsChips}
            ${notesText}
          </div>
        `;
      }).join('');
    } else {
      bloodHistoryItemsHtml = `
        <div style="padding: 14px; text-align: center; color: var(--color-text-tertiary); font-style: italic; font-size: 13.5px;">
          No previous blood collection history recorded for this patient.
        </div>
      `;
    }

    const bloodHistorySectionHtml = `
      <div class="profile-section-card">
        <div class="profile-section-title" style="display: flex; align-items: center; justify-content: space-between;">
          <span>D. Blood Collection History (${historicalBld.length} past records)</span>
        </div>
        <div class="tca-history-list">
          ${bloodHistoryItemsHtml}
        </div>
      </div>
    `;

    // -------------------------------------------------------------
    // Full Profile Assembly
    // -------------------------------------------------------------
    contentEl.innerHTML = `
      <div class="profile-group-wrapper">
        ${activeBannerHtml}

        <!-- Header Section -->
        <div class="profile-header-card">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
            <div>
              <h2 class="profile-patient-name">${escapeHTML(record.name)}</h2>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                ${categoryTag}
                <button type="button" id="btn-switch-category" class="btn-text-action" style="font-size: 12.5px; color: var(--color-accent); text-decoration: underline; background: none; border: none; cursor: pointer; padding: 2px;">
                  ${switchCategoryLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Section: Identification & Contact -->
        <div class="profile-section-card">
          <div class="profile-section-title">Patient Identification & Contact</div>
          <div class="profile-row-item">
            <span class="profile-row-label">Patient ID</span>
            <span class="profile-row-value monospace" style="font-size: 13px; color: var(--color-text-secondary);">${escapeHTML(record.id)}</span>
          </div>
          <div class="profile-row-item">
            <span class="profile-row-label">IC Number</span>
            <span class="profile-row-value monospace">${escapeHTML(record.icNumber)}</span>
          </div>
          <div class="profile-row-item">
            <span class="profile-row-label">Phone</span>
            <span class="profile-row-value">${phoneLink}</span>
          </div>
        </div>

        <!-- Section A: Upcoming Scheduled TCA -->
        ${upcomingSectionHtml}

        <!-- Section B: TCA History -->
        ${historySectionHtml}

        <!-- Section C: Upcoming Blood Collection -->
        ${upcomingBloodSectionHtml}

        <!-- Section D: Blood Collection History -->
        ${bloodHistorySectionHtml}
      </div>
    `;

    // Wire up buttons inside profile
    contentEl.querySelector('#btn-switch-category')?.addEventListener('click', () => {
      if (this.currentRecord && this.handlers) {
        const newCategory              = this.currentRecord.patientType === 'New' ? 'Existing' : 'New';
        this.handlers.onChangeCategory(this.currentRecord, newCategory);
      }
    });

    contentEl.querySelector('#btn-schedule-new-tca')?.addEventListener('click', () => {
      if (this.currentRecord && this.handlers) {
        this.handlers.onScheduleTca(this.currentRecord);
      }
    });

    contentEl.querySelector('#btn-create-extra-tca')?.addEventListener('click', () => {
      if (this.currentRecord && this.handlers) {
        this.handlers.onScheduleTca(this.currentRecord);
      }
    });

    contentEl.querySelector('#btn-schedule-new-blood')?.addEventListener('click', () => {
      if (this.currentRecord && this.handlers) {
        if (this.handlers.onScheduleBloodCollection) {
          this.handlers.onScheduleBloodCollection(this.currentRecord);
        } else {
          this.handlers.onScheduleTca(this.currentRecord);
        }
      }
    });

    // Upcoming TCA action buttons
    contentEl.querySelectorAll('[data-action]').forEach(btn => {
      const action = btn.getAttribute('data-action');
      const aptId = btn.getAttribute('data-apt-id');
      if (!action || !aptId || !nextApt) return;

      btn.addEventListener('click', () => {
        if (!this.currentRecord || !this.handlers) return;
        if (action === 'mark-attended') {
          this.handlers.onUpdateStatus(this.currentRecord, nextApt, 'Attended');
        } else if (action === 'mark-dna') {
          this.handlers.onUpdateStatus(this.currentRecord, nextApt, 'DNA');
        } else if (action === 'reschedule') {
          this.handlers.onRescheduleTca(this.currentRecord, nextApt);
        } else if (action === 'cancel') {
          this.handlers.onUpdateStatus(this.currentRecord, nextApt, 'Cancelled');
        }
      });
    });

    // Upcoming Blood Collection action buttons
    contentEl.querySelectorAll('[data-blood-action]').forEach(btn => {
      const bldAction = btn.getAttribute('data-blood-action')                    ;
      const bldId = btn.getAttribute('data-bld-id');
      if (!bldAction || !bldId || !nextBld) return;

      btn.addEventListener('click', () => {
        if (!this.currentRecord || !this.handlers) return;
        if (this.handlers.onBloodAction) {
          this.handlers.onBloodAction(this.currentRecord, nextBld, bldAction);
        }
      });
    });
  }

         close()       {
    if (!this.isOpen()) return;
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}


  // --- Module: components/message-generator ---
             
                      
              
                        
                  
class MessageGenerator {
          containerEl             ;
          currentInputs                         = {
    templateType: 'blood_collection',
    tone: 'polite',
    time: 'Sebelum 8.30 pagi',
    reason: 'keperluan klinikal',
    signature: 'MA Ariff\nKlinik Kesihatan Bandar Kulim'
  };

  constructor() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'message-generator-view';
    this.render();
  }

         getElement()              {
    return this.containerEl;
  }

          render()       {
    this.containerEl.innerHTML = `
      <!-- Section 1: Message Configuration (iOS Inset Group) -->
      <section class="msg-card-section" aria-label="Message Configuration">
        <div class="msg-section-header">
          <span class="msg-section-title">Message Configuration</span>
          <span class="msg-section-subtitle">Type & Tone</span>
        </div>

        <div class="msg-form-grid">
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-select-template">
              <span>Message Type</span>
            </label>
            <div class="select-wrapper">
              <select id="msg-select-template" class="form-select ios-select" aria-label="Select Message Type">
                <option value="blood_collection">Blood Collection Appointment</option>
                <option value="tca_reschedule">TCA Rescheduling</option>
                <option value="tca_reminder">TCA Reminder</option>
                <option value="missed_appointment">Missed Appointment Follow-up</option>
                <option value="general_followup">General Follow-up</option>
                <option value="custom">Custom Message</option>
              </select>
              <span class="select-chevron" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </div>
          </div>

          <div class="msg-field-group">
            <label class="msg-field-label">
              <span>Message Tone</span>
            </label>
            <div class="segmented-control" id="msg-tone-control" role="radiogroup" aria-label="Message Tone">
              <button type="button" class="segment-btn ${this.currentInputs.tone === 'polite' ? 'is-active' : ''}" data-tone="polite" role="radio" aria-checked="${this.currentInputs.tone === 'polite'}">Polite</button>
              <button type="button" class="segment-btn ${this.currentInputs.tone === 'friendly' ? 'is-active' : ''}" data-tone="friendly" role="radio" aria-checked="${this.currentInputs.tone === 'friendly'}">Friendly</button>
              <button type="button" class="segment-btn ${this.currentInputs.tone === 'formal' ? 'is-active' : ''}" data-tone="formal" role="radio" aria-checked="${this.currentInputs.tone === 'formal'}">Formal</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: Patient Details (Optional, Clean Layout) -->
      <section class="msg-card-section" aria-label="Patient Details">
        <div class="msg-section-header">
          <span class="msg-section-title">Patient Details</span>
          <span class="msg-section-subtitle">Personalization</span>
        </div>

        <div class="msg-form-grid msg-form-grid-2">
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-name">
              <span>Patient Name</span>
              <span class="msg-field-optional">(Optional)</span>
            </label>
            <input
              type="text"
              id="msg-inp-name"
              class="form-input"
              placeholder="e.g. Encik Ahmad"
              value="${this.currentInputs.patientName || ''}"
              autocomplete="name"
            />
          </div>

          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-phone">
              <span>WhatsApp / Phone</span>
              <span class="msg-field-optional">(Optional)</span>
            </label>
            <input
              type="tel"
              id="msg-inp-phone"
              class="form-input"
              placeholder="e.g. 012-345 6789"
              value="${this.currentInputs.phone || ''}"
              autocomplete="tel"
            />
          </div>
        </div>
      </section>

      <!-- Section 3: Appointment / Clinical Details (Dynamic Fields) -->
      <section class="msg-card-section" id="msg-appointment-section" aria-label="Appointment Details">
        <div class="msg-section-header">
          <span class="msg-section-title" id="msg-apt-section-title">Appointment Details</span>
          <span class="msg-section-subtitle">Specifics</span>
        </div>
        <div id="msg-dynamic-fields" class="msg-form-grid"></div>
      </section>

      <!-- Section 4: Message Preview & Actions (Full Width Textarea) -->
      <section class="msg-card-section" aria-label="Message Preview">
        <div class="msg-section-header">
          <span class="msg-section-title">Message Preview</span>
          <span class="msg-section-subtitle" style="color: var(--color-accent); font-weight: 500;">Directly Editable</span>
        </div>

        <div class="msg-preview-container">
          <textarea
            id="msg-preview-text"
            class="msg-preview-textarea"
            rows="10"
            aria-label="Generated Patient Message"
            placeholder="Generated message will appear here..."
          ></textarea>

          <div class="msg-actions-grid">
            <button type="button" id="btn-msg-copy" class="btn-primary btn-msg-copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy Message</span>
            </button>

            <button type="button" id="btn-msg-whatsapp" class="btn-whatsapp btn-msg-whatsapp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <span>Open WhatsApp</span>
            </button>

            <button type="button" id="btn-msg-reset" class="btn-secondary btn-msg-reset">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span>Reset</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Section 5: Clinical Privacy Notice -->
      <div class="msg-privacy-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <div>
          <strong>Patient Privacy Safeguard:</strong> Messages are generated 100% locally on your device without external AI or third-party servers. Never mention HIV status, diagnosis, or sensitive medication regimens in patient communications.
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderDynamicFields();
    this.updatePreview();
  }

          bindEvents()       {
    // 1. Message Type Dropdown
    const selectEl = this.containerEl.querySelector('#msg-select-template')                     ;
    if (selectEl) {
      selectEl.value = this.currentInputs.templateType;
      selectEl.addEventListener('change', () => {
        this.currentInputs.templateType = selectEl.value                       ;
        this.renderDynamicFields();
        this.updatePreview();
      });
    }

    // 2. Message Tone Segmented Control
    const toneCtrl = this.containerEl.querySelector('#msg-tone-control');
    if (toneCtrl) {
      toneCtrl.addEventListener('click', (e) => {
        const btn = (e.target               ).closest('.segment-btn')                     ;
        if (!btn) return;
        toneCtrl.querySelectorAll('.segment-btn').forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-checked', 'true');
        this.currentInputs.tone = btn.getAttribute('data-tone')               ;
        this.updatePreview();
      });
    }

    // 3. Patient Details input listeners
    const nameInput = this.containerEl.querySelector('#msg-inp-name')                    ;
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        this.currentInputs.patientName = nameInput.value;
        this.updatePreview();
      });
    }

    const phoneInput = this.containerEl.querySelector('#msg-inp-phone')                    ;
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        this.currentInputs.phone = phoneInput.value;
      });
    }

    // 4. Copy Message Action
    const copyBtn = this.containerEl.querySelector('#btn-msg-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const textarea = this.containerEl.querySelector('#msg-preview-text')                       ;
        if (textarea && textarea.value) {
          try {
            await navigator.clipboard.writeText(textarea.value);
            toast.show('Message copied to clipboard');
          } catch {
            textarea.select();
            document.execCommand('copy');
            toast.show('Message copied to clipboard');
          }
        }
      });
    }

    // 5. Open WhatsApp Action
    const waBtn = this.containerEl.querySelector('#btn-msg-whatsapp');
    if (waBtn) {
      waBtn.addEventListener('click', () => {
        const textarea = this.containerEl.querySelector('#msg-preview-text')                       ;
        const phone = this.currentInputs.phone ? this.currentInputs.phone.replace(/[^0-9]/g, '') : '';
        const encodedMsg = encodeURIComponent(textarea.value || '');

        let formattedPhone = phone;
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '60' + formattedPhone.slice(1);
        }

        if (formattedPhone) {
          window.open(`https://wa.me/${formattedPhone}?text=${encodedMsg}`, '_blank');
        } else {
          window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
        }
      });
    }

    // 6. Reset Action
    const resetBtn = this.containerEl.querySelector('#btn-msg-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentInputs.patientName = '';
        this.currentInputs.phone = '';
        this.currentInputs.scheduledDate = '';
        this.currentInputs.oldDate = '';
        this.currentInputs.newDate = '';
        this.currentInputs.time = this.currentInputs.templateType === 'blood_collection' ? 'Sebelum 8.30 pagi' : '8.30 pagi';
        this.currentInputs.reason = 'keperluan klinikal';
        this.currentInputs.subject = '';
        this.currentInputs.instructions = '';
        this.currentInputs.customContent = '';

        const nameInp = this.containerEl.querySelector('#msg-inp-name')                    ;
        if (nameInp) nameInp.value = '';
        const phoneInp = this.containerEl.querySelector('#msg-inp-phone')                    ;
        if (phoneInp) phoneInp.value = '';

        this.renderDynamicFields();
        this.updatePreview();
        toast.show('Message fields reset');
      });
    }
  }

  /**
   * Renders only fields relevant to the selected message type.
   */
          renderDynamicFields()       {
    const fieldsContainer = this.containerEl.querySelector('#msg-dynamic-fields')               ;
    const titleEl = this.containerEl.querySelector('#msg-apt-section-title')               ;
    if (!fieldsContainer) return;

    const tpl = this.currentInputs.templateType;

    if (tpl === 'blood_collection') {
      if (titleEl) titleEl.textContent = 'Blood Collection Details';
      fieldsContainer.className = 'msg-form-grid msg-form-grid-2';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-date">
            <span>Blood Collection Date</span>
          </label>
          <div class="date-input-container">
            <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
          </div>
        </div>
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-time">
            <span>Arrival Time</span>
          </label>
          <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || 'Sebelum 8.30 pagi'}" placeholder="e.g. Sebelum 8.30 pagi" />
        </div>
      `;
    } else if (tpl === 'tca_reschedule') {
      if (titleEl) titleEl.textContent = 'TCA Rescheduling Details';
      fieldsContainer.className = 'msg-form-grid';
      fieldsContainer.innerHTML = `
        <div class="msg-form-grid msg-form-grid-2" style="margin-bottom: 0;">
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-old-date">
              <span>Original TCA Date</span>
            </label>
            <div class="date-input-container">
              <input type="date" id="msg-inp-old-date" class="form-input" value="${this.currentInputs.oldDate || ''}" />
            </div>
          </div>
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-new-date">
              <span>New TCA Date</span>
            </label>
            <div class="date-input-container">
              <input type="date" id="msg-inp-new-date" class="form-input" value="${this.currentInputs.newDate || ''}" />
            </div>
          </div>
        </div>

        <div class="msg-form-grid msg-form-grid-2">
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-time">
              <span>Time</span>
            </label>
            <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || '8.30 pagi'}" placeholder="e.g. 8.30 pagi" />
          </div>
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-reason">
              <span>Reason for Rescheduling</span>
            </label>
            <input type="text" id="msg-inp-reason" class="form-input" placeholder="e.g. keperluan klinikal / cuti umum" value="${this.currentInputs.reason || 'keperluan klinikal'}" />
          </div>
        </div>
      `;
    } else if (tpl === 'tca_reminder') {
      if (titleEl) titleEl.textContent = 'TCA Reminder Details';
      fieldsContainer.className = 'msg-form-grid msg-form-grid-2';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-date">
            <span>TCA Appointment Date</span>
          </label>
          <div class="date-input-container">
            <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
          </div>
        </div>
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-time">
            <span>Appointment Time</span>
          </label>
          <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || '8.30 pagi'}" placeholder="e.g. 8.30 pagi" />
        </div>
      `;
    } else if (tpl === 'missed_appointment') {
      if (titleEl) titleEl.textContent = 'Missed Appointment Details';
      fieldsContainer.className = 'msg-form-grid';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-date">
            <span>Missed Appointment Date</span>
          </label>
          <div class="date-input-container">
            <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
          </div>
        </div>
      `;
    } else if (tpl === 'general_followup') {
      if (titleEl) titleEl.textContent = 'General Follow-up Details';
      fieldsContainer.className = 'msg-form-grid';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-subject">
            <span>Subject</span>
            <span class="msg-field-optional">(Optional)</span>
          </label>
          <input type="text" id="msg-inp-subject" class="form-input" placeholder="e.g. Susulan Pengambilan Ubat" value="${this.currentInputs.subject || ''}" />
        </div>
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-instr">
            <span>Instructions / Content</span>
          </label>
          <textarea id="msg-inp-instr" class="form-textarea" rows="3" placeholder="Sila hadir ke kaunter farmasi...">${this.currentInputs.instructions || ''}</textarea>
        </div>
      `;
    } else if (tpl === 'custom') {
      if (titleEl) titleEl.textContent = 'Custom Message Content';
      fieldsContainer.className = 'msg-form-grid';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-custom">
            <span>Message Content</span>
          </label>
          <textarea id="msg-inp-custom" class="form-textarea" rows="4" placeholder="Tulis mesej klinikal di sini...">${this.currentInputs.customContent || ''}</textarea>
        </div>
      `;
    }

    // Bind event listeners to newly inserted input elements
    fieldsContainer.querySelectorAll('input, textarea').forEach(inp => {
      inp.addEventListener('input', () => {
        const id = inp.id;
        const val = (inp                                          ).value;

        if (id === 'msg-inp-date') this.currentInputs.scheduledDate = val;
        else if (id === 'msg-inp-old-date') this.currentInputs.oldDate = val;
        else if (id === 'msg-inp-new-date') this.currentInputs.newDate = val;
        else if (id === 'msg-inp-time') this.currentInputs.time = val;
        else if (id === 'msg-inp-reason') this.currentInputs.reason = val;
        else if (id === 'msg-inp-subject') this.currentInputs.subject = val;
        else if (id === 'msg-inp-instr') this.currentInputs.instructions = val;
        else if (id === 'msg-inp-custom') this.currentInputs.customContent = val;

        this.updatePreview();
      });
    });
  }

          generateMessageText()         {
    const { templateType, tone, patientName, scheduledDate, oldDate, newDate, time, reason, subject, instructions, customContent } = this.currentInputs;

    const formattedDate = scheduledDate ? formatDisplayDate(scheduledDate) : '[TARIKH]';
    const formattedOldDate = oldDate ? formatDisplayDate(oldDate) : '[TARIKH ASAL]';
    const formattedNewDate = newDate ? formatDisplayDate(newDate) : '[TARIKH BAHARU]';
    const formattedTime = time ? time.trim() : '8.30 pagi';
    const formattedReason = reason ? reason.trim() : 'keperluan klinikal';

    let salutation = 'Assalamualaikum / Salam sejahtera.';
    if (patientName && patientName.trim()) {
      if (tone === 'friendly') salutation = `Assalamualaikum / Salam mesra ${patientName.trim()}.`;
      else if (tone === 'formal') salutation = `Assalamualaikum dan Salam sejahtera kepada ${patientName.trim()}.`;
      else salutation = `Assalamualaikum / Salam sejahtera ${patientName.trim()}.`;
    } else {
      if (tone === 'friendly') salutation = 'Assalamualaikum / Salam mesra.';
      else if (tone === 'formal') salutation = 'Assalamualaikum dan Salam sejahtera.';
    }

    const signature = `MA Ariff\nKlinik Kesihatan Bandar Kulim`;

    switch (templateType) {
      case 'blood_collection':
        if (tone === 'friendly') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin mengingatkan berkenaan temujanji pengambilan darah tuan/puan pada:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\nLokasi: Klinik Kesihatan Bandar Kulim\n\nSemoga tuan/puan sentiasa sihat. Mohon hadir sebelum jam 8.30 pagi ya bagi melancarkan urusan pengambilan darah di makmal.\n\nTerima kasih banyak atas kerjasama tuan/puan.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nDengan segala hormatnya dimaklumkan bahawa pihak Klinik Kesihatan Bandar Kulim menetapkan temujanji pengambilan darah bagi pihak tuan/puan mengikut ketetapan berikut:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\nLokasi: Klinik Kesihatan Bandar Kulim\n\nSehubungan dengan itu, tuan/puan dipohon hadir sebelum jam 8.30 pagi bagi melancarkan prosedur klinikal berkenaan.\n\nKerjasama tuan/puan amat dihargai. Sekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Default)
        return `${salutation}\n\nDimaklumkan bahawa pihak Klinik Kesihatan Bandar Kulim ingin memaklumkan kepada tuan/puan mengenai pengambilan darah pada:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\nLokasi: Klinik Kesihatan Bandar Kulim\n\nMohon tuan/puan hadir sebelum jam 8.30 pagi bagi melancarkan urusan pengambilan darah.\n\nTerima kasih atas kerjasama tuan/puan.\n\n${signature}`;

      case 'tca_reschedule':
        if (tone === 'friendly') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin memaklumkan bahawa temujanji tuan/puan pada ${formattedOldDate} perlu dijadualkan semula atas sebab ${formattedReason}.\n\nTarikh temujanji baharu: ${formattedNewDate}\nMasa: ${formattedTime}\n\nMohon maklum balas jika tarikh baharu ini bersesuaian dengan pihak tuan/puan. Segala kesulitan amat dikesali.\n\nTerima kasih banyak atas kerjasama tuan/puan.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nAdalah dimaklumkan bahawa temujanji tuan/puan di Klinik Kesihatan Bandar Kulim yang dijadualkan pada ${formattedOldDate} terpaksa dipinda atas sebab ${formattedReason}.\n\nKetetapan tarikh temujanji baharu adalah seperti berikut:\nTarikh: ${formattedNewDate}\nMasa: ${formattedTime}\n\nTuan/puan dipohon membuat pengesahan kehadiran. Segala kesulitan yang timbul amatlah dikesali.\n\nSekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Default)
        return `${salutation}\n\nDimaklumkan bahawa temujanji tuan/puan di Klinik Kesihatan Bandar Kulim pada ${formattedOldDate} perlu dijadualkan semula kerana ${formattedReason}.\n\nTarikh temujanji baharu: ${formattedNewDate}\nMasa: ${formattedTime}\n\nMohon pengesahan dan kerjasama daripada pihak tuan/puan.\n\nSegala kesulitan amat dikesali.\n\nTerima kasih.\n\n${signature}`;

      case 'tca_reminder':
        if (tone === 'friendly') {
          return `${salutation}\n\nIni adalah peringatan mesra temujanji tuan/puan di Klinik Kesihatan Bandar Kulim:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nSemoga tuan/puan sentiasa sihat dan dapat hadir mengikut masa yang ditetapkan. Jika ada kesulitan, sila hubungi kami segera.\n\nTerima kasih.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin mengingatkan tuan/puan berkenaan temujanji rawatan susulan yang dijadualkan seperti berikut:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nTuan/puan dimohon hadir mengikut ketetapan yang ditetapkan demi kelancaran rawatan.\n\nSekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Default)
        return `${salutation}\n\nIni merupakan peringatan mesra berkenaan temujanji tuan/puan di Klinik Kesihatan Bandar Kulim.\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nMohon hadir mengikut tarikh dan masa yang telah ditetapkan.\n\nTerima kasih.\n\n${signature}`;

      case 'missed_appointment':
        if (tone === 'friendly') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin menyemak keadaan tuan/puan susulan temujanji pada ${formattedDate}.\n\nKami amat prihatin dan ingin mengetahui sama ada tuan/puan berkesempatan untuk hadir bagi penetapan tarikh temujanji baharu yang sesuai.\n\nMohon hubungi atau balas mesej ini ya. Terima kasih.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nMerujuk kepada rekod klinikal, tuan/puan didapati tidak dapat hadir pada temujanji yang dijadualkan pada ${formattedDate}.\n\nPihak Klinik Kesihatan Bandar Kulim memohon maklum balas pihak tuan/puan bagi urusan penjadualan semula temujanji pada kadar segera.\n\nPerhatian dan kerjasama tuan/puan amat dihargai. Sekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Default)
        return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin membuat susulan berkenaan temujanji tuan/puan pada ${formattedDate}.\n\nKami ingin mengetahui sama ada tuan/puan berkesempatan untuk hadir bagi penjadualan semula temujanji.\n\nMohon maklum balas daripada pihak tuan/puan.\n\nTerima kasih.\n\n${signature}`;

      case 'general_followup':
        const subjText = subject ? `Perkara: ${subject}\n\n` : '';
        const instrText = instructions ? `${instructions}\n\n` : '';
        return `${salutation}\n\n${subjText}Pihak Klinik Kesihatan Bandar Kulim ingin membuat susulan bersama pihak tuan/puan.\n\n${instrText}Mohon pihak tuan/puan mengambil maklum berkenaan maklumat di atas. Jika terdapat sebarang pertanyaan, sila hubungi pihak klinik.\n\nTerima kasih atas kerjasama tuan/puan.\n\n${signature}`;

      case 'custom':
        const body = customContent && customContent.trim()
          ? customContent.trim()
          : 'Sila masukkan mesej klinikal di sini.';
        return `${salutation}\n\n${body}\n\n${signature}`;

      default:
        return '';
    }
  }

          updatePreview()       {
    const textarea = this.containerEl.querySelector('#msg-preview-text')                       ;
    if (textarea) {
      textarea.value = this.generateMessageText();
    }
  }
}


  // --- Module: components/settings-modal ---
                                              
class SettingsModal {
          overlayEl             ;
          activeTab              = 'message_gen';
          messageGenerator                  ;
          getRecordsCallback                                          = null;
          onImportCallback                                                                                  = null;
          previousActiveElement                     = null;

  constructor() {
    this.messageGenerator = new MessageGenerator();

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Settings and Utilities');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet settings-sheet" style="max-width: 680px; max-height: 90vh;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <div>
            <span class="sheet-title">Settings / More</span>
            <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">
              Clinical Utilities & Data Management
            </div>
          </div>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Top Segmented Navigation -->
        <div class="settings-nav-bar" style="padding: 0 20px 10px 20px;">
          <div class="segmented-control settings-seg-ctrl" role="tablist">
            <button type="button" class="segment-btn is-active" data-set-tab="message_gen">Message Generator</button>
            <button type="button" class="segment-btn" data-set-tab="gdrive">Google Drive</button>
            <button type="button" class="segment-btn" data-set-tab="local_data">Local Data</button>
            <button type="button" class="segment-btn" data-set-tab="about">About</button>
          </div>
        </div>

        <div class="sheet-body settings-body" id="settings-content" style="padding-top: 8px;">
          <!-- Tab 1: Message Generator (Default) -->
          <div id="tab-pane-message_gen" class="settings-tab-pane"></div>

          <!-- Tab 2: Google Drive Backup -->
          <div id="tab-pane-gdrive" class="settings-tab-pane" style="display: none;"></div>

          <!-- Tab 3: Local Data Backup -->
          <div id="tab-pane-local_data" class="settings-tab-pane" style="display: none;"></div>

          <!-- Tab 4: About & Privacy -->
          <div id="tab-pane-about" class="settings-tab-pane" style="display: none;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);

    // Attach message generator element
    const msgPane = this.overlayEl.querySelector('#tab-pane-message_gen')               ;
    msgPane.appendChild(this.messageGenerator.getElement());

    this.bindEvents();
    this.renderGDrivePane();
    this.renderLocalDataPane();
    this.renderAboutPane();
  }

          bindEvents()       {
    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target               ;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    // Top Segment Switching
    const segContainer = this.overlayEl.querySelector('.settings-seg-ctrl')               ;
    segContainer.addEventListener('click', (e) => {
      const btn = (e.target               ).closest('.segment-btn')                     ;
      if (!btn) return;
      const targetTab = btn.getAttribute('data-set-tab')               ;
      this.switchTab(targetTab);
    });

    // Listen to Google Drive Service status changes
    googleDriveService.setStatusListener((status, lastTime, lastError) => {
      this.updateGDriveStatusUI(status, lastTime, lastError);
    });
  }

         switchTab(tab             )       {
    this.activeTab = tab;
    const segContainer = this.overlayEl.querySelector('.settings-seg-ctrl')               ;
    segContainer.querySelectorAll('.segment-btn').forEach(btn => {
      const isMatch = btn.getAttribute('data-set-tab') === tab;
      btn.classList.toggle('is-active', isMatch);
    });

    this.overlayEl.querySelectorAll('.settings-tab-pane').forEach((pane     ) => {
      pane.style.display = pane.id === `tab-pane-${tab}` ? 'block' : 'none';
    });

    if (tab === 'gdrive') {
      this.refreshGDriveFileList();
    }
  }

          renderGDrivePane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive')               ;
    const clientId = googleDriveService.getClientId();
    const status = googleDriveService.getStatus();
    const lastTime = googleDriveService.getLastBackupTime();

    pane.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Status Card -->
        <div class="gdrive-status-card" style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--color-text-secondary); letter-spacing: 0.03em;">Backup Status</div>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                <span id="gdrive-status-dot" class="status-dot"></span>
                <span id="gdrive-status-label" style="font-size: 16px; font-weight: 700;">${status}</span>
              </div>
            </div>
            <div id="gdrive-auth-actions"></div>
          </div>

          <div id="gdrive-last-backup-text" style="font-size: 12.5px; color: var(--color-text-secondary); margin-top: 10px;">
            ${lastTime ? `Last Successful Backup: <strong>${new Date(lastTime).toLocaleString()}</strong>` : 'No Google Drive backup recorded yet on this device.'}
          </div>

          <div id="gdrive-error-banner" style="display: none; margin-top: 10px; padding: 8px 12px; background: var(--color-destructive-bg); color: var(--color-destructive); border-radius: 8px; font-size: 12.5px;"></div>
        </div>

        <!-- Destination Folder & Manual Backup -->
        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Designated Backup Folder</h4>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 10px;">
            Target: <code>${GDRIVE_FOLDER_ID}</code>
          </p>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <a href="${GDRIVE_FOLDER_URL}" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-msg-action" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Open in Google Drive</span>
            </a>
            <button type="button" id="btn-gdrive-backup-now" class="btn-primary btn-msg-action">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Backup Now</span>
            </button>
          </div>
        </div>

        <!-- Google OAuth Client ID Configuration -->
        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Google OAuth 2.0 Client ID</h4>
          <p style="font-size: 12.5px; color: var(--color-text-secondary); margin-bottom: 10px;">
            Google requires a Web Client ID configured with your GitHub Pages origin. Enter your Google OAuth Client ID below:
          </p>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="gdrive-client-id-input" class="form-input" placeholder="e.g. 123456789-xxxx.apps.googleusercontent.com" value="${clientId}" style="font-family: monospace; font-size: 12.5px;" />
            <button type="button" id="btn-save-gdrive-client-id" class="btn-secondary" style="font-weight: 600; flex-shrink: 0;">Save ID</button>
          </div>
        </div>

        <!-- Available Backups in Google Drive for Restore -->
        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <h4 style="font-size: 15px; font-weight: 600;">Restore from Google Drive</h4>
            <button type="button" id="btn-refresh-gdrive-files" class="btn-icon" style="width: 28px; height: 28px;" title="Refresh list">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          </div>
          <p style="font-size: 12.5px; color: var(--color-text-secondary); margin-bottom: 10px;">
            Select a verified backup file to restore. A safety local snapshot is automatically created before any database changes.
          </p>
          <div id="gdrive-file-list" style="display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 12.5px; color: var(--color-text-tertiary); font-style: italic;">
              ${status === 'Connected' ? 'Loading backups from Google Drive...' : 'Connect Google Drive above to view backups.'}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindGDrivePaneEvents();
    this.updateGDriveStatusUI(status, lastTime);
  }

          bindGDrivePaneEvents()       {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive')               ;

    // Save Client ID
    const saveIdBtn = pane.querySelector('#btn-save-gdrive-client-id')                     ;
    const idInput = pane.querySelector('#gdrive-client-id-input')                    ;
    if (saveIdBtn && idInput) {
      saveIdBtn.addEventListener('click', () => {
        const val = idInput.value.trim();
        googleDriveService.setClientId(val);
        toast.show('Client ID saved');
      });
    }

    // Backup Now
    const backupNowBtn = pane.querySelector('#btn-gdrive-backup-now')                     ;
    if (backupNowBtn) {
      backupNowBtn.addEventListener('click', async () => {
        if (!this.getRecordsCallback) return;
        backupNowBtn.disabled = true;
        backupNowBtn.textContent = 'Uploading...';
        try {
          const records = await this.getRecordsCallback();
          const ok = await googleDriveService.uploadBackup(records);
          if (ok) {
            toast.show('Backup uploaded to Google Drive');
            this.refreshGDriveFileList();
          } else {
            toast.show('Backup failed. Check connection.');
          }
        } finally {
          backupNowBtn.disabled = false;
          backupNowBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Backup Now</span>
          `;
        }
      });
    }

    // Refresh Files
    const refreshBtn = pane.querySelector('#btn-refresh-gdrive-files')                     ;
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshGDriveFileList());
    }
  }

          updateGDriveStatusUI(status        , lastTime         , lastError         )       {
    const pane = this.overlayEl.querySelector('#tab-pane-gdrive')               ;
    if (!pane) return;

    const dot = pane.querySelector('#gdrive-status-dot')               ;
    const label = pane.querySelector('#gdrive-status-label')               ;
    const authActions = pane.querySelector('#gdrive-auth-actions')               ;
    const lastText = pane.querySelector('#gdrive-last-backup-text')               ;
    const errorBanner = pane.querySelector('#gdrive-error-banner')               ;

    if (label) label.textContent = status;

    if (dot) {
      dot.className = 'status-dot';
      if (status === 'Connected') dot.classList.add('status-connected');
      else if (status === 'Backup Successful') dot.classList.add('status-success');
      else if (status === 'Backing Up') dot.classList.add('status-backingup');
      else if (status === 'Backup Failed') dot.classList.add('status-failed');
      else dot.classList.add('status-disconnected');
    }

    if (lastText && lastTime) {
      lastText.innerHTML = `Last Successful Backup: <strong>${new Date(lastTime).toLocaleString()}</strong>`;
    }

    if (errorBanner) {
      if (lastError) {
        errorBanner.textContent = lastError;
        errorBanner.style.display = 'block';
      } else {
        errorBanner.style.display = 'none';
      }
    }

    if (authActions) {
      if (status === 'Not Connected') {
        authActions.innerHTML = `
          <button type="button" id="btn-gdrive-connect" class="btn-primary" style="font-size: 13px; padding: 6px 14px;">
            Connect Account
          </button>
        `;
        authActions.querySelector('#btn-gdrive-connect')?.addEventListener('click', async () => {
          const ok = await googleDriveService.authorize();
          if (ok) {
            toast.show('Connected to Google Drive');
            this.refreshGDriveFileList();
          }
        });
      } else {
        authActions.innerHTML = `
          <button type="button" id="btn-gdrive-disconnect" class="btn-secondary" style="font-size: 12.5px; padding: 4px 10px;">
            Disconnect
          </button>
        `;
        authActions.querySelector('#btn-gdrive-disconnect')?.addEventListener('click', () => {
          googleDriveService.disconnect();
          toast.show('Disconnected from Google Drive');
        });
      }
    }
  }

          async refreshGDriveFileList()                {
    const listEl = this.overlayEl.querySelector('#gdrive-file-list')               ;
    if (!listEl) return;

    if (googleDriveService.getStatus() === 'Not Connected') {
      listEl.innerHTML = `<div style="font-size: 12.5px; color: var(--color-text-tertiary); font-style: italic;">Connect Google Drive above to list backups.</div>`;
      return;
    }

    listEl.innerHTML = `<div style="font-size: 12.5px; color: var(--color-text-secondary);">Querying Google Drive folder...</div>`;
    const files = await googleDriveService.listBackups();

    if (files.length === 0) {
      listEl.innerHTML = `<div style="font-size: 12.5px; color: var(--color-text-secondary); padding: 8px 0;">No backup files found in designated Google Drive folder yet. Tap "Backup Now" to create your first backup.</div>`;
      return;
    }

    listEl.innerHTML = files.map(f => {
      const createdDate = f.createdTime ? new Date(f.createdTime).toLocaleString() : '';
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: var(--color-bg-primary); border-radius: var(--radius-sm); font-size: 13px;">
          <div>
            <div style="font-weight: 600; font-family: monospace; font-size: 12px;">${f.name}</div>
            <div style="font-size: 11.5px; color: var(--color-text-secondary); margin-top: 2px;">${createdDate}</div>
          </div>
          <button type="button" class="btn-secondary btn-restore-file" data-file-id="${f.id}" data-file-name="${f.name}" style="font-size: 12px; padding: 4px 10px;">
            Restore
          </button>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.btn-restore-file').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fileId = btn.getAttribute('data-file-id');
        const fileName = btn.getAttribute('data-file-name');
        if (!fileId || !fileName) return;

        await this.handleRestoreGDriveFile(fileId, fileName);
      });
    });
  }

          async handleRestoreGDriveFile(fileId        , fileName        )                {
    try {
      toast.show('Downloading backup from Google Drive...');
      const payload = await googleDriveService.downloadBackup(fileId);

      const records = Array.isArray(payload.records) ? payload.records : (Array.isArray(payload) ? payload : null);
      if (!records) {
        throw new Error('Invalid backup file: no records found');
      }

      const count = records.length;
      const exportTime = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString() : 'Unknown';

      // Confirmation Dialogue
      const confirmed = await confirmSheet.show({
        title: 'Restore Backup from Google Drive?',
        message: `File: "${fileName}"\nExported: ${exportTime}\nRecords Count: ${count} patients\n\nRestoring will replace current local database with this backup. A safety backup of current data will be created first.`,
        confirmLabel: 'Restore Database',
        cancelLabel: 'Cancel',
        isDestructive: true
      });

      if (!confirmed) return;

      // Create safety snapshot of local data before restoration
      if (this.getRecordsCallback) {
        const currentRecords = await this.getRecordsCallback();
        googleDriveService.savePreRestoreSafetySnapshot(currentRecords);
      }

      if (this.onImportCallback) {
        await this.onImportCallback(records, 'replace');
        toast.show(`Restored ${count} patient records`);
        this.close();
      }
    } catch (err     ) {
      console.error(err);
      toast.show(`Restore failed: ${err.message || 'Error'}`);
    }
  }

          renderLocalDataPane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-local_data')               ;
    pane.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Export Local JSON</h4>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
            Download an uncompressed JSON file containing all patient records, TCA histories, and blood collection records stored on this device.
          </p>
          <button type="button" id="btn-export-local-json" class="btn-primary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export JSON File</span>
          </button>
        </div>

        <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;">
          <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Import Local JSON</h4>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
            Restore or merge patient records from an ARV KKBK JSON backup file. Validates schema before applying.
          </p>
          <input type="file" id="local-file-import-input" accept=".json,application/json" style="display: none;" />
          <button type="button" id="btn-trigger-local-import" class="btn-secondary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Select JSON File</span>
          </button>
        </div>
      </div>
    `;

    // Wire local export/const importBtn = pane.querySelector('#btn-trigger-local-import')                     ;
    const fileInput = pane.querySelector('#local-file-import-input')                    ;

    exportBtn?.addEventListener('click', async () => {
      if (this.getRecordsCallback) {
        const records = await this.getRecordsCallback();
        exportRecordsToJSON(records);
        toast.show(`Exported ${records.length} records`);
      }
    });

    importBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const { valid, records, error } = validateImportJSON(json);

        if (!valid || !records) {
          toast.show(`Import error: ${error || 'Invalid JSON format'}`);
          return;
        }

        const modeChoice = await confirmSheet.show({
          title: 'Import Records',
          message: `Found ${records.length} valid patient records in file "${file.name}".\n\nChoose 'Merge' to combine with existing data, or 'Replace' to overwrite all existing records.`,
          confirmLabel: 'Merge Records',
          cancelLabel: 'Replace All',
          isDestructive: false
        });

        const mode                      = modeChoice ? 'merge' : 'replace';

        if (this.onImportCallback) {
          await this.onImportCallback(records, mode);
          toast.show(`Successfully imported ${records.length} records (${mode})`);
          this.close();
        }
      } catch (err     ) {
        toast.show(`Failed to parse file: ${err.message || 'Error'}`);
      } finally {
        fileInput.value = '';
      }
    });
  }

          renderAboutPane()       {
    const pane = this.overlayEl.querySelector('#tab-pane-about')               ;
    pane.innerHTML = `
      <div style="background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 18px; font-size: 13.5px; line-height: 1.5;">
        <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">ARV KKBK — Personal Record Tracker</h4>
        <p style="color: var(--color-text-secondary); margin-bottom: 12px;">
          Designed for Klinik Kesihatan Bandar Kulim (KKBK) Antiretroviral & TCA clinical administration.
        </p>

        <div style="background: var(--color-bg-primary); border: 1px solid var(--color-separator); border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px; font-size: 12.5px;">
          <strong>Laboratory Routing Rules:</strong>
          <ul style="margin-left: 18px; margin-top: 6px;">
            <li>All samples collected at: <strong>Klinik Kesihatan Bandar Kulim</strong>.</li>
            <li>CD4 samples sent to: <strong>KK Taman Intan</strong>.</li>
            <li>HIV Viral Load samples sent to: <strong>Hospital Sultanah Bahiyah (HSB)</strong>.</li>
          </ul>
        </div>

        <div style="font-size: 12px; color: var(--color-text-tertiary); line-height: 1.45;">
          <strong>Security Notice:</strong> All data is stored locally in client-side IndexedDB on this device. Never upload unencrypted identifiable patient medical records to public cloud repositories without appropriate KKM approvals.
        </div>
      </div>
    `;
  }

         open(
    getRecords                                ,
    onImport                                                                        ,
    initialTab              = 'message_gen',
    triggerEl              
  )       {
    this.getRecordsCallback = getRecords;
    this.onImportCallback = onImport;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    this.switchTab(initialTab);
    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');
  }

         close()       {
    if (!this.isOpen()) return;
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}


  // --- Module: components/data-modal ---
class DataModal {
          overlayEl             ;
          getRecordsCallback                                          = null;
          onImportCallback                                                                                  = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Data Management');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 480px;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title">Data Management</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close data sheet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="sheet-body">
          <div style="background-color: var(--color-accent-subtle); border: 1px solid var(--color-separator); border-radius: var(--radius-md); padding: 12px; font-size: 13px; line-height: 1.45; color: var(--color-text-primary);">
            <strong>Privacy & Data Portability:</strong>
            All patient records are stored 100% locally on this device's IndexedDB. Export files allow safe, manual transfer between your phone and laptop (e.g. via AirDrop or direct USB). Do not upload exported clinical files to public clouds.
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
            <div style="border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 14px; background-color: var(--color-bg-secondary);">
              <h4 style="font-size: 15px; margin-bottom: 4px;">Export Records (JSON)</h4>
              <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
                Download an uncompressed JSON file of all records currently stored on this device.
              </p>
              <button type="button" id="btn-export-json" class="btn-primary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export JSON File
              </button>
            </div>

            <div style="border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 14px; background-color: var(--color-bg-secondary);">
              <h4 style="font-size: 15px; margin-bottom: 4px;">Import Records (JSON)</h4>
              <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
                Import records from an ARV KKBK JSON backup. Validates schema before applying.
              </p>
              <input type="file" id="file-import-input" accept=".json,application/json" style="display: none;" />
              <button type="button" id="btn-trigger-import" class="btn-secondary" style="width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Select JSON File to Import
              </button>
              <div id="import-status-box" style="display: none; margin-top: 12px; padding: 10px; border-radius: var(--radius-md); font-size: 13px;"></div>
            </div>
          </div>
        </div>
        <div class="sheet-footer">
          <button type="button" class="btn-secondary" data-action="close">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
    const exportBtn = this.overlayEl.querySelector('#btn-export-json')                     ;
    const triggerImportBtn = this.overlayEl.querySelector('#btn-trigger-import')                     ;
    const fileInput = this.overlayEl.querySelector('#file-import-input')                    ;

    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target               ;
      if (target === this.overlayEl || target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    exportBtn.addEventListener('click', async () => {
      if (this.getRecordsCallback) {
        const records = await this.getRecordsCallback();
        if (records.length === 0) {
          toast.show('No records to export');
          return;
        }
        exportRecordsToJSON(records);
        toast.show(`Exported ${records.length} records`);
      }
    });

    triggerImportBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const statusBox = this.overlayEl.querySelector('#import-status-box')               ;
      statusBox.style.display = 'block';
      statusBox.style.backgroundColor = 'var(--color-bg-tertiary)';
      statusBox.style.color = 'var(--color-text-primary)';
      statusBox.textContent = `Reading ${file.name}...`;

      try {
        const text = await file.text();
        const validation = validateImportJSON(text);

        if (!validation.valid || !validation.records) {
          statusBox.style.backgroundColor = 'var(--status-overdue-bg)';
          statusBox.style.color = 'var(--status-overdue-text)';
          statusBox.textContent = validation.error || 'Invalid file schema.';
          return;
        }

        const validCount = validation.records.length;
        statusBox.style.backgroundColor = 'var(--status-upcoming-bg)';
        statusBox.style.color = 'var(--status-upcoming-text)';
        statusBox.textContent = `Found ${validCount} valid record(s). Please choose how to import:`;

        // Ask Merge or Replace
        const choice = await this.promptImportChoice(validCount);
        if (!choice) {
          statusBox.textContent = 'Import cancelled.';
          return;
        }

        if (choice === 'replace') {
          const confirmed = await confirmSheet.show({
            title: 'Replace All Current Records?',
            message: `This will permanently delete all existing records and replace them with the ${validCount} imported records. This cannot be undone.`,
            confirmLabel: 'Replace Everything',
            isDestructive: true
          });

          if (!confirmed) {
            statusBox.textContent = 'Replace cancelled.';
            return;
          }
        }

        if (this.onImportCallback) {
          await this.onImportCallback(validation.records, choice);
          toast.show(`Imported ${validCount} records (${choice === 'replace' ? 'Replaced' : 'Merged'})`);
          this.close();
        }
      } catch (err) {
        statusBox.style.backgroundColor = 'var(--status-overdue-bg)';
        statusBox.style.color = 'var(--status-overdue-text)';
        statusBox.textContent = `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
      }
    });
  }

          async promptImportChoice(count        )                                      {
    return new Promise((resolve) => {
      const choiceOverlay = document.createElement('div');
      choiceOverlay.className = 'modal-overlay is-open';
      choiceOverlay.setAttribute('role', 'dialog');
      choiceOverlay.innerHTML = `
        <div class="bottom-sheet" style="max-width: 420px; text-align: center;">
          <div class="sheet-grab-bar"></div>
          <div class="sheet-body" style="padding: 24px 20px 16px 20px;">
            <h3 class="sheet-title" style="font-size: 18px; margin-bottom: 8px;">Import ${count} Records</h3>
            <p style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.45;">
              Choose whether to merge the imported records with your current data or replace your entire database.
            </p>
          </div>
          <div class="sheet-footer" style="flex-direction: column; gap: 8px; padding: 12px 20px 16px 20px;">
            <button type="button" id="btn-choice-merge" class="btn-primary" style="width: 100%; height: 44px;">
              Merge (Keep existing & add new)
            </button>
            <button type="button" id="btn-choice-replace" class="btn-destructive" style="width: 100%; height: 44px;">
              Replace (Overwrite all data)
            </button>
            <button type="button" id="btn-choice-cancel" class="btn-secondary" style="width: 100%; height: 44px; font-weight: 600;">
              Cancel
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(choiceOverlay);

      const cleanup = (choice                            ) => {
        document.body.removeChild(choiceOverlay);
        resolve(choice);
      };

      choiceOverlay.querySelector('#btn-choice-merge')?.addEventListener('click', () => cleanup('merge'));
      choiceOverlay.querySelector('#btn-choice-replace')?.addEventListener('click', () => cleanup('replace'));
      choiceOverlay.querySelector('#btn-choice-cancel')?.addEventListener('click', () => cleanup(null));
      choiceOverlay.addEventListener('click', (e) => {
        if (e.target === choiceOverlay) cleanup(null);
      });
    });
  }

         open(
    getRecords                                ,
    onImport                                                                        ,
    triggerEl              
  )       {
    this.getRecordsCallback = getRecords;
    this.onImportCallback = onImport;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    const statusBox = this.overlayEl.querySelector('#import-status-box')               ;
    statusBox.style.display = 'none';
    statusBox.textContent = '';

    this.overlayEl.classList.add('is-open');
  }

         close()       {
    if (!this.isOpen()) return;
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

         isOpen()          {
    return this.overlayEl.classList.contains('is-open');
  }
}


  // --- Module: components/nav-bar ---
                                          

const TAB_STORAGE_KEY = 'arv_kkbk_active_tab';

function getSavedTab()            {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved === 'records' || saved === 'tca') {
      return saved;
    }
  } catch {}
  return 'records';
}

function saveActiveTab(tab           )       {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {}
}

class NavigationBar {
          activeTab           ;
          onTabChangeCallback                          ;
          mobileNavEl              ;

  constructor(initialTab           , onTabChange                          ) {
    this.activeTab = initialTab;
    this.onTabChangeCallback = onTabChange;
    this.createMobileBar();
  }

          createMobileBar()       {
    this.mobileNavEl = document.createElement('nav');
    this.mobileNavEl.className = 'bottom-tab-bar ios-tab-bar';
    this.mobileNavEl.setAttribute('role', 'tablist');
    this.mobileNavEl.setAttribute('aria-label', 'Main Navigation');

    this.mobileNavEl.innerHTML = `
      <button type="button" class="tab-item ${this.activeTab === 'records' ? 'is-active' : ''}" data-tab="records" role="tab" aria-selected="${this.activeTab === 'records'}">
        <div class="tab-icon-wrapper">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="2" ry="2"></rect>
            <line x1="8" y1="8" x2="16" y2="8"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
            <line x1="8" y1="16" x2="12" y2="16"></line>
          </svg>
        </div>
        <span class="tab-label">Records</span>
      </button>

      <button type="button" class="tab-item ${this.activeTab === 'tca' ? 'is-active' : ''}" data-tab="tca" role="tab" aria-selected="${this.activeTab === 'tca'}">
        <div class="tab-icon-wrapper">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2.5"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <circle cx="12" cy="15" r="1.5"></circle>
          </svg>
        </div>
        <span class="tab-label">TCA</span>
      </button>
    `;

    document.body.appendChild(this.mobileNavEl);

    this.mobileNavEl.addEventListener('click', (e) => {
      const btn = (e.target               ).closest('.tab-item')                     ;
      if (!btn) return;
      const tab = btn.getAttribute('data-tab')             ;
      this.setActiveTab(tab);
    });
  }

         setActiveTab(tab           )       {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    saveActiveTab(tab);

    // Update mobile tab items
    this.mobileNavEl.querySelectorAll('.tab-item').forEach(btn => {
      const matches = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('is-active', matches);
      btn.setAttribute('aria-selected', matches ? 'true' : 'false');
    });

    // Update desktop header segment if present
    const desktopSegment = document.querySelector('#header-desktop-tabs');
    if (desktopSegment) {
      desktopSegment.querySelectorAll('.desktop-tab-btn').forEach(btn => {
        const matches = btn.getAttribute('data-tab') === tab;
        btn.classList.toggle('is-active', matches);
        btn.setAttribute('aria-selected', matches ? 'true' : 'false');
      });
    }

    this.onTabChangeCallback(tab);
  }

         getActiveTab()            {
    return this.activeTab;
  }

         hideMobileBar(hide         )       {
    this.mobileNavEl.classList.toggle('tab-bar-hidden', hide);
  }
}


  // --- Module: components/tca-view ---
                                                           
function escapeHTML(str        )         {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTCAView(
  records                 ,
  onRecordClick                                 
)              {
  const container = document.createElement('div');
  container.className = 'tca-timeline-view';

  if (records.length === 0) {
    const emptyBox = document.createElement('div');
    emptyBox.className = 'empty-state';
    emptyBox.innerHTML = `
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <h3 class="empty-title">No TCA Appointments Scheduled</h3>
      <p class="empty-desc">
        There are no matching patient appointments to display in the TCA timeline.
      </p>
    `;
    container.appendChild(emptyBox);
    return container;
  }

  // Group records
  const groups                                       = {
    overdue: [],
    this_week: [],
    this_month: [],
    later: [],
    no_tca: []
  };

  for (const r of records) {
    const key = getTCAGroupKey(r.nextTca);
    groups[key].push(r);
  }

  // Sort groups with TCA chronologically (earliest first)
  const sortByDate = (a               , b               ) => {
    const valA = a.nextTca || '';
    const valB = b.nextTca || '';
    return valA.localeCompare(valB) || a.name.localeCompare(b.name);
  };

  groups.overdue.sort(sortByDate);
  groups.this_week.sort(sortByDate);
  groups.this_month.sort(sortByDate);
  groups.later.sort(sortByDate);
  groups.no_tca.sort((a, b) => a.name.localeCompare(b.name));

  const sectionsConfig                                                                               = [
    { key: 'overdue', title: 'Overdue', count: groups.overdue.length, className: 'section-overdue' },
    { key: 'this_week', title: 'This Week (Next 7 Days)', count: groups.this_week.length, className: 'section-upcoming' },
    { key: 'this_month', title: 'This Month', count: groups.this_month.length, className: 'section-month' },
    { key: 'later', title: 'Later', count: groups.later.length, className: 'section-later' }
  ];

  for (const sec of sectionsConfig) {
    if (sec.count === 0) continue;

    const sectionEl = document.createElement('section');
    sectionEl.className = `tca-group-section ${sec.className}`;

    const headerEl = document.createElement('div');
    headerEl.className = 'tca-sticky-header';
    headerEl.innerHTML = `
      <span class="tca-header-title">${sec.title}</span>
      <span class="tca-header-count">${sec.count}</span>
    `;
    sectionEl.appendChild(headerEl);

    const listEl = document.createElement('div');
    listEl.className = 'tca-items-list';

    for (const record of groups[sec.key]) {
      const row = createTCARow(record, () => onRecordClick(record));
      listEl.appendChild(row);
    }

    sectionEl.appendChild(listEl);
    container.appendChild(sectionEl);
  }

  // Collapsed "No TCA date" disclosure section
  if (groups.no_tca.length > 0) {
    const details = document.createElement('details');
    details.className = 'tca-no-date-disclosure';
    details.innerHTML = `
      <summary class="tca-disclosure-summary">
        <span>No TCA Date Scheduled (${groups.no_tca.length})</span>
        <svg class="disclosure-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </summary>
      <div class="tca-items-list tca-no-date-list"></div>
    `;

    const noDateList = details.querySelector('.tca-no-date-list') ;
    for (const record of groups.no_tca) {
      const row = createTCARow(record, () => onRecordClick(record));
      noDateList.appendChild(row);
    }

    container.appendChild(details);
  }

  return container;
}

function createTCARow(record               , onClick            )              {
  const row = document.createElement('div');
  row.className = 'tca-row-item';
  row.setAttribute('role', 'button');
  row.setAttribute('tabindex', '0');
  row.setAttribute('aria-label', `View profile for ${record.name}`);

  const formattedTca = record.nextTca ? formatDisplayDate(record.nextTca) : 'No date';
  const relativeLabel = record.nextTca ? getRelativeTCALabel(record.nextTca) : 'Unscheduled';

  const typeLabel = record.patientType === 'New'
    ? `<span class="patient-type-tag type-new">• New</span>`
    : `<span class="patient-type-tag type-existing">• Existing</span>`;

  const bloodLabel = record.bloodInvestigationDate
    ? `<span class="tca-blood-pill">Blood: ${formatDisplayDate(record.bloodInvestigationDate)}</span>`
    : '';

  let investigationsLabel = '';
  if (record.bloodInvestigations && record.bloodInvestigations.length > 0) {
    const list = record.bloodInvestigations.map(i => i === 'Other' && record.bloodOther ? `Other: ${record.bloodOther}` : i);
    investigationsLabel = `<span class="tca-blood-pill" style="color: var(--color-text-secondary);">${escapeHTML(list.join(', '))}</span>`;
  }

  row.innerHTML = `
    <div class="tca-row-main">
      <div class="tca-row-title-line">
        <span class="tca-patient-name">${escapeHTML(record.name)}</span>
        ${typeLabel}
      </div>
      <div class="tca-row-sub">
        <span class="tca-date-badge">${formattedTca}</span>
        <span class="tca-relative-text">${escapeHTML(relativeLabel)}</span>
        ${bloodLabel}
        ${investigationsLabel}
      </div>
    </div>
    <div class="tca-row-chevron">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </div>
  `;

  row.addEventListener('click', onClick);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  });

  return row;
}


  // --- Module: components/header ---
                                                     
function createHeader(callbacks                 )              {
  const header = document.createElement('header');
  header.className = 'app-header ios-header';

  function getThemeIcon(mode           )         {
    if (mode === 'light') {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>`;
    }
    if (mode === 'dark') {
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>`;
    }
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>`;
  }

  header.innerHTML = `
    <div class="header-inner">
      <div class="brand-group">
        <div class="brand-title-wrap">
          <h1 class="app-title">ARV KKBK</h1>
          <span class="brand-badge">Personal</span>
        </div>

        <!-- Desktop Segmented Navigation (>= 900px) -->
        <div class="desktop-nav-tabs" id="header-desktop-tabs" role="tablist" aria-label="Desktop Views">
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'records' ? 'is-active' : ''}" data-tab="records" role="tab" aria-selected="${callbacks.activeTab === 'records'}">
            Records
          </button>
          <button type="button" class="desktop-tab-btn ${callbacks.activeTab === 'tca' ? 'is-active' : ''}" data-tab="tca" role="tab" aria-selected="${callbacks.activeTab === 'tca'}">
            TCA
          </button>
        </div>
      </div>

      <div class="header-actions">
        <button type="button" class="btn-icon header-icon-btn" id="btn-theme-toggle" aria-label="Toggle theme mode" title="Current: ${themeManager.getMode()}">
          ${getThemeIcon(themeManager.getMode())}
        </button>

        <button type="button" class="btn-pill header-pill-btn" id="btn-open-data" aria-label="Open settings, message generator and backups">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
          <span>Settings / More</span>
        </button>

        <button type="button" class="btn-pill btn-desktop-add" id="btn-header-add" aria-label="Add Patient">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Add Patient</span>
        </button>
      </div>
    </div>
  `;

  const themeBtn = header.querySelector('#btn-theme-toggle')                     ;
  const dataBtn = header.querySelector('#btn-open-data')                     ;
  const addBtn = header.querySelector('#btn-header-add')                     ;
  const desktopTabs = header.querySelector('#header-desktop-tabs')               ;

  themeBtn.addEventListener('click', () => {
    callbacks.onThemeToggle();
    const newMode = themeManager.getMode();
    themeBtn.innerHTML = getThemeIcon(newMode);
    themeBtn.title = `Current: ${newMode}`;
  });

  dataBtn.addEventListener('click', () => {
    callbacks.onDataClick();
  });

  addBtn.addEventListener('click', () => {
    callbacks.onAddClick();
  });

  desktopTabs.addEventListener('click', (e) => {
    const btn = (e.target               ).closest('.desktop-tab-btn')                     ;
    if (!btn) return;
    const tab = btn.getAttribute('data-tab')             ;
    callbacks.onTabSelect(tab);
  });

  return header;
}


  // --- Module: main ---
class App {
          records                  = [];
          searchQuery         = '';
          currentSort            = getSavedSort();
          currentFilter                    = 'all';
          activeTab            = getSavedTab();

          navBar                ;
          recordModal              ;
          detailsModal               ;
          sortSheet            ;
          settingsModal                ;
          appointmentModal                   ;
          bloodCollectionModal                       ;

          recordCountEl              ;
          sortTriggerEl                    ;
          viewContainerEl              ;
          searchInputEl                   ;
          searchClearBtn                    ;
          segmentedFilterEl              ;
          summaryStripEl              ;

  constructor() {
    // 1. Initial theme setup
    themeManager.applyTheme();

    // 2. Initialize modal and sheet components
    this.recordModal = new RecordModal();
    this.detailsModal = new DetailsModal();
    this.sortSheet = new SortSheet();
    this.settingsModal = new SettingsModal();
    this.appointmentModal = new AppointmentModal();
    this.bloodCollectionModal = new BloodCollectionModal();

    // 3. Initialize navigation bar
    this.navBar = new NavigationBar(this.activeTab, (newTab) => {
      this.activeTab = newTab;
      this.renderCurrentView();
    });

    // 4. Render base DOM structure
    this.renderLayout();

    // 5. Load records from IndexedDB
    this.loadRecords();

    // 6. Register simple Service Worker for offline app shell
    this.registerServiceWorker();

    (window       ).__ARV_APP_INITIALIZED__ = true;
  }

          renderLayout()       {
    const appEl = document.getElementById('app') ;
    appEl.innerHTML = '';

    // Sticky Liquid Glass Header
    const header = createHeader({
      activeTab: this.activeTab,
      onTabSelect: (tab) => this.navBar.setActiveTab(tab),
      onAddClick: () => this.recordModal.open(null, this.records, (rec) => this.handleSaveRecord(rec)),
      onDataClick: () => this.settingsModal.open(
        () => Promise.resolve(this.records),
        (recs, mode) => this.handleImportRecords(recs, mode)
      ),
      onThemeToggle: () => {
        const modes                                     = ['light', 'dark', 'system'];
        const current = themeManager.getMode();
        const next = modes[(modes.indexOf(current) + 1) % modes.length];
        themeManager.setTheme(next);
        toast.show(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`);
      }
    });
    appEl.appendChild(header);

    // Main Content Container
    const mainEl = document.createElement('main');
    mainEl.className = 'main-content';

    mainEl.innerHTML = `
      <!-- Apple App Store-Inspired Clinic Summary Overview -->
      <section id="summary-metrics-strip" class="ios-summary-grid"></section>

      <section class="toolbar-section">
        <div class="search-wrapper">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="search"
            id="search-input"
            class="search-input"
            placeholder="Search name, IC, phone, date, plan..."
            autocomplete="off"
            aria-label="Search records"
          />
          <button type="button" id="search-clear-btn" class="search-clear-btn" style="display: none;" aria-label="Clear search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Patient Type Segmented Filter -->
        <div class="segmented-control" id="patient-type-filter" role="radiogroup" aria-label="Filter Patient Type">
          <button type="button" class="segment-btn is-active" data-filter="all" role="radio" aria-checked="true">All Patients</button>
          <button type="button" class="segment-btn" data-filter="New" role="radio" aria-checked="false">New</button>
          <button type="button" class="segment-btn" data-filter="Existing" role="radio" aria-checked="false">Existing</button>
        </div>

        <div class="meta-bar">
          <span id="record-count" class="record-count">Loading records...</span>
          <button type="button" id="btn-sort-trigger" class="btn-sort-trigger" aria-haspopup="dialog">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="12" x2="14" y2="12"></line>
              <line x1="4" y1="18" x2="8" y2="18"></line>
            </svg>
            <span id="sort-trigger-label">Sort</span>
          </button>
        </div>
      </section>

      <section id="view-container" class="records-container"></section>
    `;

    appEl.appendChild(mainEl);

    // Floating Action Button (Mobile) - opens Add Patient from either tab
    const fabBtn = document.createElement('button');
    fabBtn.type = 'button';
    fabBtn.className = 'fab-add';
    fabBtn.setAttribute('aria-label', 'Add Patient');
    fabBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    fabBtn.addEventListener('click', () => {
      this.recordModal.open(null, this.records, (rec) => this.handleSaveRecord(rec), fabBtn);
    });
    appEl.appendChild(fabBtn);

    // Cache element references
    this.recordCountEl = mainEl.querySelector('#record-count') ;
    this.sortTriggerEl = mainEl.querySelector('#btn-sort-trigger') ;
    this.viewContainerEl = mainEl.querySelector('#view-container') ;
    this.searchInputEl = mainEl.querySelector('#search-input') ;
    this.searchClearBtn = mainEl.querySelector('#search-clear-btn') ;
    this.segmentedFilterEl = mainEl.querySelector('#patient-type-filter') ;
    this.summaryStripEl = mainEl.querySelector('#summary-metrics-strip') ;

    this.bindToolbarEvents();
    this.updateSortTriggerLabel();
  }

          bindToolbarEvents()       {
    // Search input typing
    this.searchInputEl.addEventListener('input', () => {
      this.searchQuery = this.searchInputEl.value;
      this.searchClearBtn.style.display = this.searchQuery ? 'flex' : 'none';
      this.renderCurrentView();
    });

    // Clear search button
    this.searchClearBtn.addEventListener('click', () => {
      this.searchInputEl.value = '';
      this.searchQuery = '';
      this.searchClearBtn.style.display = 'none';
      this.searchInputEl.focus();
      this.renderCurrentView();
    });

    // Segmented Patient Type filter toggle
    this.segmentedFilterEl.addEventListener('click', (e) => {
      const btn = (e.target               ).closest('.segment-btn')                     ;
      if (!btn) return;
      const filterVal = btn.getAttribute('data-filter')                     ;
      this.currentFilter = filterVal;

      this.segmentedFilterEl.querySelectorAll('.segment-btn').forEach(b => {
        const isSelected = b === btn;
        b.classList.toggle('is-active', isSelected);
        b.setAttribute('aria-checked', isSelected ? 'true' : 'false');
      });

      this.renderCurrentView();
    });

    // Sort trigger button -> opens Reusable SortSheet
    this.sortTriggerEl.addEventListener('click', () => {
      this.sortSheet.open(
        this.currentSort,
        (newSort) => {
          this.currentSort = newSort;
          saveSortPreference(newSort);
          this.updateSortTriggerLabel();
          this.renderCurrentView();
        },
        this.sortTriggerEl
      );
    });
  }

          updateSortTriggerLabel()       {
    const currentDef = SORT_OPTIONS.find(o => o.id === this.currentSort);
    const labelSpan = this.sortTriggerEl.querySelector('#sort-trigger-label');
    if (labelSpan && currentDef) {
      labelSpan.textContent = currentDef.shortLabel;
    }
  }

          async loadRecords()                {
    try {
      this.records = await recordStorage.list();
      this.renderCurrentView();
    } catch (err) {
      this.recordCountEl.textContent = 'Error loading records from IndexedDB';
      console.error(err);
    }
  }

          renderCurrentView()       {
    const isTcaTab = this.activeTab === 'tca';

    // Update Apple-style summary metrics
    this.updateSummaryMetrics();

    // Requirement 2: REMOVE the All / New / Existing filter from the TCA tab only.
    if (isTcaTab) {
      this.segmentedFilterEl.style.display = 'none';
      this.sortTriggerEl.style.display = 'none';
      this.viewContainerEl.className = 'tca-view-container';
    } else {
      this.segmentedFilterEl.style.display = 'flex';
      this.sortTriggerEl.style.display = 'inline-flex';
      this.viewContainerEl.className = 'records-container';
    }

    // On TCA tab, patient type filter does not apply (shows all scheduled records); on Records tab, applies active filter
    const effectiveFilter = isTcaTab ? 'all' : this.currentFilter;
    const filtered = filterRecords(this.records, this.searchQuery, effectiveFilter);

    // Update count display
    const labelPrefix = isTcaTab ? 'appointments' : 'records';
    if (this.records.length === 0) {
      this.recordCountEl.textContent = `0 ${labelPrefix}`;
    } else if (this.searchQuery || (!isTcaTab && this.currentFilter !== 'all')) {
      this.recordCountEl.textContent = `Showing ${filtered.length} of ${this.records.length} ${labelPrefix}`;
    } else {
      this.recordCountEl.textContent = `${this.records.length} ${labelPrefix}`;
    }

    this.viewContainerEl.innerHTML = '';

    // Empty state 1: Database empty -> Show "Load Demo Data"
    if (this.records.length === 0) {
      const emptyBox = document.createElement('div');
      emptyBox.className = 'empty-state';
      emptyBox.innerHTML = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        <h3 class="empty-title">No Patient Records Yet</h3>
        <p class="empty-desc">
          Add your first patient record or load safe, fictional demo data to test tracking, blood dates, and TCA sorting.
        </p>
        <button type="button" id="btn-load-demo" class="btn-demo-load">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <polyline points="23 20 23 14 17 14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          Load Demo Data (Fictional)
        </button>
      `;

      emptyBox.querySelector('#btn-load-demo')?.addEventListener('click', async () => {
        await this.handleLoadDemoData();
      });

      this.viewContainerEl.appendChild(emptyBox);
      return;
    }

    // Empty state 2: Search or Filter yields 0 matches
    if (filtered.length === 0) {
      const emptySearchBox = document.createElement('div');
      emptySearchBox.className = 'empty-state';
      emptySearchBox.innerHTML = `
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          <line x1="8" y1="11" x2="14" y2="11"></line>
        </svg>
        <h3 class="empty-title">No Matching Records</h3>
        <p class="empty-desc">
          No records match your active search and filter selection.
        </p>
        <button type="button" id="btn-clear-search-empty" class="btn-secondary" style="font-weight: 600;">
          Reset Filters
        </button>
      `;

      emptySearchBox.querySelector('#btn-clear-search-empty')?.addEventListener('click', () => {
        this.searchInputEl.value = '';
        this.searchQuery = '';
        this.searchClearBtn.style.display = 'none';
        this.currentFilter = 'all';
        this.segmentedFilterEl.querySelectorAll('.segment-btn').forEach(b => {
          const isAll = b.getAttribute('data-filter') === 'all';
          b.classList.toggle('is-active', isAll);
          b.setAttribute('aria-checked', isAll ? 'true' : 'false');
        });
        this.renderCurrentView();
      });

      this.viewContainerEl.appendChild(emptySearchBox);
      return;
    }

    // TAB 1: Records Tab View
    if (this.activeTab === 'records') {
      const sorted = sortRecords(filtered, this.currentSort);
      for (const record of sorted) {
        const cardEl = createRecordCard(record, this.buildCardActions(record));
        this.viewContainerEl.appendChild(cardEl);
      }
      return;
    }

    // TAB 2: TCA Timeline View
    if (this.activeTab === 'tca') {
      const tcaViewEl = renderTCAView(filtered, (record) => {
        this.detailsModal.open(record, this.buildDetailsHandlers(record));
      });
      this.viewContainerEl.appendChild(tcaViewEl);
    }
  }

          buildDetailsHandlers(record               )                       {
    return {
      onEdit: (rec) => this.recordModal.open(rec, this.records, (saved) => this.handleSaveRecord(saved)),
      onDelete: (rec) => this.handleDeleteRecord(rec),
      onToggleActive: (rec, makeActive) => this.handleToggleActive(rec, makeActive),
      onChangeCategory: (rec, newCategory) => this.handleChangeCategory(rec, newCategory),
      onScheduleTca: (rec) => this.handleScheduleTca(rec),
      onRescheduleTca: (rec, apt) => this.handleRescheduleTca(rec, apt),
      onUpdateStatus: (rec, apt, status) => this.handleUpdateStatus(rec, apt, status),
      onBloodAction: (rec, collection, action) => this.handleBloodAction(rec, collection, action),
      onScheduleBloodCollection: (rec) => this.handleScheduleBloodCollection(rec)
    };
  }

          buildCardActions(record               )                    {
    return {
      onView: () => {
        this.detailsModal.open(record, this.buildDetailsHandlers(record));
      },
      onEdit: () => {
        this.recordModal.open(record, this.records, (saved) => this.handleSaveRecord(saved));
      },
      onDelete: () => {
        this.handleDeleteRecord(record);
      },
      onToggleActive: (makeActive) => {
        this.handleToggleActive(record, makeActive);
      },
      onChangeCategory: (newCategory) => {
        this.handleChangeCategory(record, newCategory);
      }
    };
  }

          async handleSaveRecord(
    recordData                                                                                             
  )                {
    const isNew = !recordData.id;
    const saved = await recordStorage.save(recordData);

    if (isNew) {
      this.records.unshift(saved);
      toast.show('Patient registered');
    } else {
      this.updateRecordInState(saved);
      toast.show('Patient record updated');
    }

    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
  }

          updateSummaryMetrics()       {
    if (!this.summaryStripEl) return;

    if (this.records.length === 0) {
      this.summaryStripEl.style.display = 'none';
      return;
    }

    this.summaryStripEl.style.display = 'grid';

    const totalActive = this.records.filter(r => r.isActive !== false).length;
    let overdueCount = 0;
    let upcomingWeekCount = 0;
    let bloodDueCount = 0;

    for (const r of this.records) {
      if (r.isActive === false) continue;
      if (r.nextTca) {
        const diff = getDaysDifference(r.nextTca);
        if (diff < 0) overdueCount++;
        else if (diff <= 7) upcomingWeekCount++;
      }
      if (r.bloodInvestigationDate) {
        const bDiff = getDaysDifference(r.bloodInvestigationDate);
        if (bDiff <= 7) bloodDueCount++;
      }
    }

    this.summaryStripEl.innerHTML = `
      <div class="ios-summary-card">
        <span class="ios-summary-val color-accent">${totalActive}</span>
        <span class="ios-summary-lbl">Active Patients</span>
      </div>
      <div class="ios-summary-card">
        <span class="ios-summary-val ${overdueCount > 0 ? 'color-overdue' : ''}">${overdueCount}</span>
        <span class="ios-summary-lbl">Overdue TCA</span>
      </div>
      <div class="ios-summary-card">
        <span class="ios-summary-val color-upcoming">${upcomingWeekCount}</span>
        <span class="ios-summary-lbl">TCA This Week</span>
      </div>
      <div class="ios-summary-card">
        <span class="ios-summary-val">${bloodDueCount}</span>
        <span class="ios-summary-lbl">Blood Due</span>
      </div>
    `;
  }

          async handleDeleteRecord(record               )                {
    const aptCount = Array.isArray(record.appointments) ? record.appointments.length : (record.nextTca ? 1 : 0);
    const hasHistory = aptCount > 0 || (record.bloodInvestigations && record.bloodInvestigations.length > 0);

    if (hasHistory) {
      const choice = await confirmSheet.show({
        title: 'Delete Patient Medical Record?',
        message: `Patient "${record.name}" has ${aptCount} appointment(s) and clinical investigation records in their history. Deleting will permanently remove all medical history.\n\nWe recommend deactivating the patient record instead to safely preserve medical records.`,
        confirmLabel: 'Deactivate Instead',
        cancelLabel: 'Delete Permanently',
        isDestructive: false
      });

      if (choice) {
        await this.handleToggleActive(record, false);
        return;
      }

      const finalConfirm = await confirmSheet.show({
        title: 'Confirm Permanent Deletion',
        message: `Are you absolutely certain? This will PERMANENTLY erase all records, appointments, and lab history for "${record.name}". This cannot be undone.`,
        confirmLabel: 'Permanently Erase',
        cancelLabel: 'Keep Record',
        isDestructive: true
      });

      if (!finalConfirm) return;
    } else {
      const confirmed = await confirmSheet.show({
        title: 'Delete Patient Record?',
        message: `Are you sure you want to delete the record for "${record.name}"? This action cannot be undone.`,
        confirmLabel: 'Delete Record',
        isDestructive: true
      });
      if (!confirmed) return;
    }

    await recordStorage.delete(record.id);
    this.records = this.records.filter(r => r.id !== record.id);
    this.detailsModal.close();
    toast.show('Patient record deleted');
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
  }

          async handleToggleActive(record               , makeActive         )                {
    if (!makeActive) {
      const confirmed = await confirmSheet.show({
        title: 'Deactivate Patient Record?',
        message: `Deactivate record for "${record.name}"? The patient will be marked inactive, but their complete TCA history and lab records will be preserved safely.`,
        confirmLabel: 'Deactivate Patient',
        cancelLabel: 'Keep Active',
        isDestructive: false
      });
      if (!confirmed) return;
    }

    const updated = await recordStorage.setPatientActiveStatus(record.id, makeActive);
    this.updateRecordInState(updated);
    toast.show(makeActive ? 'Patient reactivated' : 'Patient deactivated');
    this.detailsModal.updateRecord(updated);
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
  }

          async handleChangeCategory(record               , newCategory             )                {
    const updated = await recordStorage.setPatientCategory(record.id, newCategory);
    this.updateRecordInState(updated);
    toast.show(`Category changed to ${newCategory} Patient`);
    this.detailsModal.updateRecord(updated);
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
  }

          handleScheduleTca(record               )       {
    this.appointmentModal.open(record, 'new', null, async (data) => {
      await recordStorage.addAppointment(record.id, {
        tcaDate: data.tcaDate,
        status: 'Scheduled',
        notes: data.notes,
        plan: data.plan,
        bloodInvestigationDate: data.bloodInvestigationDate,
        bloodInvestigations: data.bloodInvestigations,
        bloodOther: data.bloodOther
      });
      const updated = await recordStorage.get(record.id);
      if (updated) {
        this.updateRecordInState(updated);
        this.detailsModal.updateRecord(updated);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
      }
      toast.show('New TCA appointment scheduled');
    });
  }

          handleRescheduleTca(record               , appointment                )       {
    this.appointmentModal.open(record, 'reschedule', appointment, async (data) => {
      await recordStorage.rescheduleAppointment(record.id, appointment.id, data);
      const updated = await recordStorage.get(record.id);
      if (updated) {
        this.updateRecordInState(updated);
        this.detailsModal.updateRecord(updated);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
      }
      toast.show('Appointment rescheduled');
    });
  }

          async handleUpdateStatus(
    record               ,
    appointment                ,
    newStatus                   
  )                {
    await recordStorage.updateAppointment(record.id, appointment.id, { status: newStatus });
    let updated = await recordStorage.get(record.id);
    if (!updated) return;

    this.updateRecordInState(updated);
    this.detailsModal.updateRecord(updated);
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
    toast.show(`Appointment recorded as ${newStatus}`);

    // If marked Attended and patient was New Patient, suggest changing to Existing Patient
    if (newStatus === 'Attended' && updated.patientType === 'New') {
      const shouldSwitch = await confirmSheet.show({
        title: 'Update Patient Category?',
        message: `First visit recorded as Attended for "${updated.name}". Would you like to change their category to "Existing Patient"?`,
        confirmLabel: 'Update to Existing Patient',
        cancelLabel: 'Keep as New Patient',
        isDestructive: false
      });

      if (shouldSwitch) {
        await this.handleChangeCategory(updated, 'Existing');
      }
    }
  }

          handleBloodAction(
    record               ,
    collection                            ,
    action                  
  )       {
    this.bloodCollectionModal.open(record, collection, action, async (data) => {
      if (data.action === 'attend') {
        await recordStorage.updateBloodCollectionStatus(
          record.id,
          data.collectionId,
          'Attended',
          data.actualDate,
          data.actualTime,
          data.notes
        );
        toast.show('Sample collection recorded as Attended');
      } else if (data.action === 'dna') {
        await recordStorage.updateBloodCollectionStatus(
          record.id,
          data.collectionId,
          'DNA',
          undefined,
          undefined,
          data.notes
        );
        toast.show('Blood appointment recorded as DNA');
      } else if (data.action === 'reschedule') {
        if (!data.newDate) return;
        await recordStorage.rescheduleBloodCollection(
          record.id,
          data.collectionId,
          data.newDate,
          data.reason,
          data.newTime
        );
        toast.show('Blood collection date rescheduled');
      } else if (data.action === 'cancel') {
        await recordStorage.updateBloodCollectionStatus(
          record.id,
          data.collectionId,
          'Cancelled',
          undefined,
          undefined,
          data.notes
        );
        toast.show('Blood collection appointment cancelled');
      }

      const updated = await recordStorage.get(record.id);
      if (updated) {
        this.updateRecordInState(updated);
        this.detailsModal.updateRecord(updated);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
      }
    });
  }

          handleScheduleBloodCollection(record               )       {
    this.appointmentModal.open(record, 'new', null, async (data) => {
      if (data.bloodInvestigationDate) {
        await recordStorage.addBloodCollection(record.id, {
          scheduledDate: data.bloodInvestigationDate,
          investigations: data.bloodInvestigations,
          investigationOther: data.bloodOther,
          notes: data.notes
        });
      }
      if (data.tcaDate) {
        await recordStorage.addAppointment(record.id, {
          tcaDate: data.tcaDate,
          status: 'Scheduled',
          notes: data.notes,
          plan: data.plan,
          bloodInvestigationDate: data.bloodInvestigationDate,
          bloodInvestigations: data.bloodInvestigations,
          bloodOther: data.bloodOther
        });
      }
      const updated = await recordStorage.get(record.id);
      if (updated) {
        this.updateRecordInState(updated);
        this.detailsModal.updateRecord(updated);
        this.renderCurrentView();
        googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
      }
      toast.show('New appointment saved');
    });
  }

          updateRecordInState(updated               )       {
    const idx = this.records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      this.records[idx] = updated;
    }
  }

          async handleLoadDemoData()                {
    const demo = generateDemoRecords();
    await recordStorage.bulkImport(demo, 'replace');
    this.records = await recordStorage.list();
    toast.show(`Loaded ${demo.length} demo records`);
    this.renderCurrentView();
  }

          async handleImportRecords(records                 , mode                     )                {
    await recordStorage.bulkImport(records, mode);
    this.records = await recordStorage.list();
    this.renderCurrentView();
    googleDriveBackupService.scheduleAutoBackup(() => Promise.resolve(this.records));
  }

          registerServiceWorker()       {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
        console.warn('SW registration warning:', err);
      });
    }
  }
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}


})();
