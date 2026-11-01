                                                                                              
import { getTCAStatus, formatDisplayDate, isDatePast } from '../utils/date.js';

function escapeHTML(str        )         {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

                                       
                                          
                                            
                                                                       
                                                                              
                                                 
                                                                                
                                                                                                          
 

export class DetailsModal {
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
      <div class="bottom-sheet profile-modal" style="max-width: 620px;">
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

    // Appointments parsing: Upcoming (Scheduled) vs History (Attended, DNA, Rescheduled, Cancelled)
    const appointments                   = Array.isArray(record.appointments) ? record.appointments : [];
    const scheduledApts = appointments.filter(a => a.status === 'Scheduled');
    const historicalApts = appointments.filter(a => a.status !== 'Scheduled').sort((a, b) => b.tcaDate.localeCompare(a.tcaDate));

    // Sort scheduled appointments (earliest first)
    scheduledApts.sort((a, b) => a.tcaDate.localeCompare(b.tcaDate));
    const nextApt = scheduledApts.length > 0 ? scheduledApts[0] : null;

    // SECTION A: Upcoming TCA HTML
    let upcomingSectionHtml = '';
    if (nextApt) {
      const tcaStatus = getTCAStatus(nextApt.tcaDate);
      const isOverdue = tcaStatus.type === 'overdue';
      const formattedDate = formatDisplayDate(nextApt.tcaDate);

      // Overdue alert banner if required
      let overdueBanner = '';
      if (isOverdue) {
        overdueBanner = `
          <div class="overdue-action-required-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <span><strong>Overdue Appointment: Action Required.</strong> Record patient attendance, mark DNA, or reschedule.</span>
          </div>
        `;
      }

      // Blood date
      let bloodFormatted = 'None';
      let bloodBadgeHtml = '';
      if (nextApt.bloodInvestigationDate) {
        bloodFormatted = formatDisplayDate(nextApt.bloodInvestigationDate);
        if (isDatePast(nextApt.bloodInvestigationDate)) {
          bloodBadgeHtml = `<span class="blood-status-note overdue" style="margin-left: 6px;">(Overdue)</span>`;
        }
      }

      // Blood investigations
      let invsHtml = '<span style="color: var(--color-text-tertiary); font-style: italic;">None selected</span>';
      if (nextApt.bloodInvestigations && nextApt.bloodInvestigations.length > 0) {
        const chips = nextApt.bloodInvestigations.map(inv => {
          const text = inv === 'Other' && nextApt.bloodOther ? `Other: ${nextApt.bloodOther}` : inv;
          return `<span class="mini-chip" style="font-size: 12px; padding: 3px 9px;">${escapeHTML(text)}</span>`;
        }).join('');
        invsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 6px;">${chips}</div>`;
      }

      // Plan & notes
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
              + Schedule Another Appointment
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
            <p style="font-size: 13px; color: var(--color-text-tertiary); margin-bottom: 12px;">Patient does not have an active scheduled appointment.</p>
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
          No previous appointment history recorded for this patient.
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

    // Upcoming action buttons
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
