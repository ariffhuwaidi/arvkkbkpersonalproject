                                              
import { getTCAStatus, formatDisplayDate, isDatePast } from '../utils/date.js';

function escapeHTML(str        )         {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createRecordCard(record               , onClick            )              {
  const card = document.createElement('article');
  card.className = 'record-card';
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

  // Patient type subtle label (no loud badge)
  const patientTypeLabel = record.patientType === 'New'
    ? `<span class="patient-type-tag type-new">• New</span>`
    : `<span class="patient-type-tag type-existing">• Existing</span>`;

  const phoneHtml = record.phone
    ? `<div class="meta-item">
        <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg>
        <span>${escapeHTML(record.phone)}</span>
       </div>`
    : '';

  // Blood date label & subtle overdue indicator
  let bloodHtml = '';
  if (record.bloodInvestigationDate) {
    const formattedBlood = formatDisplayDate(record.bloodInvestigationDate);
    const isPast = isDatePast(record.bloodInvestigationDate);
    const hasWork = (record.bloodInvestigations && record.bloodInvestigations.length > 0) || Boolean(record.plan && record.plan.trim());

    let statusNote = '';
    if (isPast && hasWork) {
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
        <h3 class="patient-name">${escapeHTML(record.name)}</h3>
        ${patientTypeLabel}
      </div>
      ${tcaBadgeHtml}
    </div>

    ${tcaDateDisplay}
    ${bloodHtml}
    ${investigationsHtml}

    <div class="card-meta-row">
      <div class="meta-item">
        <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2"></rect>
          <line x1="7" y1="8" x2="17" y2="8"></line>
          <line x1="7" y1="12" x2="13" y2="12"></line>
        </svg>
        <span>IC: ${escapeHTML(record.icNumber)}</span>
      </div>
      ${phoneHtml}
    </div>

    ${planPreviewHtml}
  `;

  card.addEventListener('click', () => {
    onClick();
  });

  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  });

  return card;
}
