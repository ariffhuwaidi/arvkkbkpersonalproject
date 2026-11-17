import type { PatientRecord, MMTDoseStatus } from '../types';
import { doseStatusOn, latestUrine, missedDays, nextReview, urineDue, MISSED_DOSE_ALERT_DAYS } from '../utils/mmt';
import { formatDisplayDate, getLocalTodayISO } from '../utils/date';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface MMTCardActions {
  onView: () => void;
  onQuickDose: (status: 'Dispensed' | 'Missed') => void;
}

export function createMMTCard(record: PatientRecord, actions: MMTCardActions): HTMLElement {
  const mmt = record.mmt!;
  const today = getLocalTodayISO();
  const status: MMTDoseStatus | null = doseStatusOn(mmt, today);
  const missed = missedDays(mmt, today);
  const review = nextReview(mmt);
  const urine = latestUrine(mmt);
  const inactive = record.isActive === false;

  const card = document.createElement('article');
  card.className = `record-card mmt-card ${inactive ? 'is-deactivated' : ''}`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View MMT profile for ${record.name}`);

  const doseText = mmt.currentDoseMg !== undefined ? `${mmt.currentDoseMg} mg` : 'Dose not set';

  let todayHtml = '';
  if (!inactive) {
    if (status === 'Dispensed') todayHtml = `<span class="mmt-chip is-ok">Dispensed today</span>`;
    else if (status === 'Take-home') todayHtml = `<span class="mmt-chip is-ok">Take-home supply</span>`;
    else if (status === 'Missed') todayHtml = `<span class="mmt-chip is-warn">Missed today</span>`;
    else todayHtml = `<span class="mmt-chip">Not yet dispensed</span>`;
  }

  const missedHtml = !inactive && missed > 0
    ? `<span class="mmt-chip ${missed >= MISSED_DOSE_ALERT_DAYS ? 'is-bad' : 'is-warn'}">${missed} ${missed === 1 ? 'day' : 'days'} missed</span>`
    : '';

  const reviewText = review ? `Review ${formatDisplayDate(review.date)}` : 'No review set';
  const urineText = urine
    ? `Urine ${formatDisplayDate(urine.date)}: ${urine.result}`
    : 'No urine test yet';
  const urineFlag = !inactive && urineDue(mmt, today) ? ' (due)' : '';

  const canQuick = !inactive && status === null;

  card.innerHTML = `
    <div class="card-top">
      <div class="card-name-group">
        <h3 class="card-name">${esc(record.name)}</h3>
        <span class="mmt-mode-tag">${doseText} · ${mmt.dispensing === 'Daily' ? 'Daily dispensing' : 'Take-home'}</span>
      </div>
    </div>
    <div class="card-meta-row">
      <span class="meta-item">IC: ${esc(record.icNumber)}</span>
    </div>
    <div class="mmt-chip-row">${todayHtml}${missedHtml}</div>
    <div class="mmt-meta-lines">
      <span>${esc(reviewText)}</span>
      <span>${esc(urineText + urineFlag)}</span>
    </div>
    ${canQuick ? `
    <div class="mmt-quick">
      <button type="button" class="btn-primary mmt-quick-btn" data-dose="Dispensed">Dispensed</button>
      <button type="button" class="btn-secondary mmt-quick-btn" data-dose="Missed">Missed</button>
    </div>` : ''}
  `;

  card.addEventListener('click', (e) => {
    const quick = (e.target as HTMLElement).closest('[data-dose]') as HTMLElement | null;
    if (quick) {
      e.stopPropagation();
      actions.onQuickDose(quick.getAttribute('data-dose') as 'Dispensed' | 'Missed');
      return;
    }
    actions.onView();
  });
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === card) {
      e.preventDefault();
      actions.onView();
    }
  });
  return card;
}
