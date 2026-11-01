import type { PatientRecord, PatientType } from '../types';
import { getTCAStatus, formatDisplayDate, isDatePast } from '../utils/date';

function escapeHTML(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RecordCardActions {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (makeActive: boolean) => void;
  onChangeCategory: (newCategory: PatientType) => void;
}

export function createRecordCard(
  record: PatientRecord,
  actionsOrView: RecordCardActions | (() => void)
): HTMLElement {
  const actions: RecordCardActions = typeof actionsOrView === 'function'
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
  const menuBtn = card.querySelector('.btn-card-menu') as HTMLButtonElement;
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
      if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
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
  triggerBtn: HTMLElement,
  record: PatientRecord,
  actions: RecordCardActions
): void {
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
  const newCategoryTarget: PatientType = isNew ? 'Existing' : 'New';
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
