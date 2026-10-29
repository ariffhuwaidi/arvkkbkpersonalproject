import type { PatientRecord, TCAGroupKey } from '../types';
import { formatDisplayDate, getRelativeTCALabel, getDaysDifference, getTCAGroupKey } from '../utils/date';

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTCAView(
  records: PatientRecord[],
  onRecordClick: (record: PatientRecord) => void
): HTMLElement {
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
  const groups: Record<TCAGroupKey, PatientRecord[]> = {
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
  const sortByDate = (a: PatientRecord, b: PatientRecord) => {
    const valA = a.nextTca || '';
    const valB = b.nextTca || '';
    return valA.localeCompare(valB) || a.name.localeCompare(b.name);
  };

  groups.overdue.sort(sortByDate);
  groups.this_week.sort(sortByDate);
  groups.this_month.sort(sortByDate);
  groups.later.sort(sortByDate);
  groups.no_tca.sort((a, b) => a.name.localeCompare(b.name));

  const sectionsConfig: Array<{ key: TCAGroupKey; title: string; count: number; className: string }> = [
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

    const noDateList = details.querySelector('.tca-no-date-list')!;
    for (const record of groups.no_tca) {
      const row = createTCARow(record, () => onRecordClick(record));
      noDateList.appendChild(row);
    }

    container.appendChild(details);
  }

  return container;
}

function createTCARow(record: PatientRecord, onClick: () => void): HTMLElement {
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
