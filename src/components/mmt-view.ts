import type { PatientRecord } from '../types';
import { followUpReasons, missedDays, nextReview, reviewGroup, urineDue } from '../utils/mmt';
import type { MMTReviewGroup } from '../utils/mmt';
import { formatDisplayDate, getLocalTodayISO, getRelativeTCALabel } from '../utils/date';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The second tab while in MMT: who needs follow-up, and upcoming reviews. */
export function renderMMTReviewView(records: PatientRecord[], onOpen: (r: PatientRecord) => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'tca-timeline';
  const today = getLocalTodayISO();

  const active = records.filter(r => r.mmt && r.isActive !== false);

  if (active.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<h2 class="empty-title">No MMT patients to review</h2><p class="empty-desc">Patients enrolled in MMT appear here with their review dates and follow-up.</p>`;
    container.appendChild(empty);
    return container;
  }

  const groups: Record<MMTReviewGroup, PatientRecord[]> = { follow_up: [], this_week: [], later: [], none: [] };
  for (const r of active) groups[reviewGroup(r, today)].push(r);

  const byReview = (a: PatientRecord, b: PatientRecord) =>
    (nextReview(a.mmt!)?.date || '9999').localeCompare(nextReview(b.mmt!)?.date || '9999') || a.name.localeCompare(b.name);
  groups.follow_up.sort((a, b) => missedDays(b.mmt!, today) - missedDays(a.mmt!, today) || a.name.localeCompare(b.name));
  groups.this_week.sort(byReview);
  groups.later.sort(byReview);
  groups.none.sort((a, b) => a.name.localeCompare(b.name));

  const sections: Array<{ key: MMTReviewGroup; title: string; cls: string }> = [
    { key: 'follow_up', title: 'Needs follow-up', cls: 'section-overdue' },
    { key: 'this_week', title: 'Review this week', cls: 'section-upcoming' },
    { key: 'later', title: 'Review later', cls: 'section-later' },
    { key: 'none', title: 'No review scheduled', cls: 'section-month' }
  ];

  for (const sec of sections) {
    const list = groups[sec.key];
    if (list.length === 0) continue;
    const section = document.createElement('section');
    section.className = `tca-group-section ${sec.cls}`;
    section.innerHTML = `<div class="tca-sticky-header"><span class="tca-header-title">${sec.title}</span><span class="tca-header-count">${list.length}</span></div>`;
    const items = document.createElement('div');
    items.className = 'tca-items-list';

    for (const r of list) {
      const mmt = r.mmt!;
      const review = nextReview(mmt);
      const reasons = followUpReasons(r, today);
      const bits: string[] = [];
      const missed = missedDays(mmt, today);
      if (reasons.includes('missed')) bits.push(`${missed} days missed`);
      if (review) bits.push(`${formatDisplayDate(review.date)} · ${getRelativeTCALabel(review.date)}`);
      if (urineDue(mmt, today)) bits.push('Urine test due');

      const row = document.createElement('div');
      row.className = 'tca-row-item';
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-label', `View MMT profile for ${r.name}`);
      row.innerHTML = `
        <div class="tca-row-main">
          <div class="tca-row-title-line"><span class="tca-patient-name">${esc(r.name)}</span></div>
          <div class="tca-row-sub"><span class="tca-relative-text">${esc(bits.join(' · ') || 'Nothing scheduled')}</span></div>
        </div>
        <div class="tca-row-chevron"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></div>`;
      row.addEventListener('click', () => onOpen(r));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(r); }
      });
      items.appendChild(row);
    }
    section.appendChild(items);
    container.appendChild(section);
  }
  return container;
}
