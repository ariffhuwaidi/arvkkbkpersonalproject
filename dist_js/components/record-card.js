                                                           
import { getTCAStatus, formatDisplayDate, isDatePast } from '../utils/date.js';

function escapeHTML(str        )         {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

                                    
                     
                     
                       
                                                
                                                       
 

export function createRecordCard(
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
    ? `<span class="patient-type-tag type-new">• New Patient</span>`
    : `<span class="patient-type-tag type-existing">• Existing Patient</span>`;

  // Deactivated status tag
  const inactiveBadge = record.isActive === false
    ? `<span class="patient-status-inactive-badge">Deactivated</span>`
    : '';

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
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="19" cy="12" r="1"></circle>
            <circle cx="5" cy="12" r="1"></circle>
          </svg>
        </button>
      </div>
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

    <div class="card-direct-actions" style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 0.5px solid var(--color-separator);">
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
  menu.className = 'sort-dropdown-menu is-anchored';
  menu.style.width = '220px';

  const rect = triggerBtn.getBoundingClientRect();
  let left = rect.right - 220;
  if (left < 10) left = 10;
  let top = rect.bottom + 4;
  if (top + 240 > window.innerHeight && rect.top > 250) {
    top = Math.max(10, rect.top - 240);
  }

  menu.style.position = 'fixed';
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.right = 'auto';
  menu.style.bottom = 'auto';

  const isNew = record.patientType === 'New';
  const switchCategoryText = isNew ? 'Switch to Existing Patient' : 'Switch to New Patient';
  const newCategoryTarget              = isNew ? 'Existing' : 'New';

  const isCurrentlyActive = record.isActive !== false;

  menu.innerHTML = `
    <div style="display: flex; flex-direction: column; padding: 4px;">
      <button type="button" class="sort-dropdown-item" data-menu-action="view">
        <span>👁 View Profile</span>
      </button>
      <button type="button" class="sort-dropdown-item" data-menu-action="edit">
        <span>✎ Edit Patient Details</span>
      </button>
      <button type="button" class="sort-dropdown-item" data-menu-action="category">
        <span>🏷 ${switchCategoryText}</span>
      </button>
      <button type="button" class="sort-dropdown-item" data-menu-action="toggle-active">
        <span>${isCurrentlyActive ? '🚫 Deactivate Patient' : '✓ Reactivate Patient'}</span>
      </button>
      <button type="button" class="sort-dropdown-item" data-menu-action="delete" style="color: var(--color-destructive);">
        <span>🗑 Delete Patient Record</span>
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
