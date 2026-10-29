import type { PatientRecord } from '../types';
import { getTCAStatus, formatDisplayDate, isDatePast } from '../utils/date';

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class DetailsModal {
  private overlayEl: HTMLElement;
  private currentRecord: PatientRecord | null = null;
  private onEditCallback: ((record: PatientRecord) => void) | null = null;
  private onDeleteCallback: ((record: PatientRecord) => void) | null = null;
  private previousActiveElement: HTMLElement | null = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Patient Profile');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet profile-modal">
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
        <div class="sheet-footer" style="justify-content: space-between;">
          <button type="button" id="btn-delete-record" class="btn-destructive">Delete</button>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-secondary" data-action="close">Close</button>
            <button type="button" id="btn-edit-record" class="btn-primary">Edit</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

  private bindEvents(): void {
    const editBtn = this.overlayEl.querySelector('#btn-edit-record') as HTMLButtonElement;
    const deleteBtn = this.overlayEl.querySelector('#btn-delete-record') as HTMLButtonElement;

    this.overlayEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
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
      if (this.currentRecord && this.onEditCallback) {
        const rec = this.currentRecord;
        this.close();
        this.onEditCallback(rec);
      }
    });

    deleteBtn.addEventListener('click', () => {
      if (this.currentRecord && this.onDeleteCallback) {
        const rec = this.currentRecord;
        this.onDeleteCallback(rec);
      }
    });
  }

  public open(
    record: PatientRecord,
    onEdit: (record: PatientRecord) => void,
    onDelete: (record: PatientRecord) => void,
    triggerEl?: HTMLElement
  ): void {
    this.currentRecord = record;
    this.onEditCallback = onEdit;
    this.onDeleteCallback = onDelete;
    this.previousActiveElement = triggerEl || (document.activeElement as HTMLElement);

    const contentEl = this.overlayEl.querySelector('#details-content') as HTMLElement;
    const tcaStatus = getTCAStatus(record.nextTca);

    let tcaBadgeHtml = '';
    if (tcaStatus.type !== 'none') {
      tcaBadgeHtml = `
        <div class="tca-indicator tca-${tcaStatus.type}">
          <span class="tca-dot"></span>
          <span>${escapeHTML(tcaStatus.label)}</span>
        </div>
      `;
    }

    const tcaFormatted = record.nextTca ? formatDisplayDate(record.nextTca) : 'No TCA scheduled';

    // Blood Date formatting & status
    let bloodFormatted = 'None';
    let bloodBadgeHtml = '';
    if (record.bloodInvestigationDate) {
      bloodFormatted = formatDisplayDate(record.bloodInvestigationDate);
      const isPast = isDatePast(record.bloodInvestigationDate);
      const hasWork = (record.bloodInvestigations && record.bloodInvestigations.length > 0) || Boolean(record.plan && record.plan.trim());
      if (isPast && hasWork) {
        bloodBadgeHtml = `<span class="blood-status-note overdue" style="margin-left: 6px;">(Overdue)</span>`;
      }
    }

    const phoneLink = record.phone
      ? `<a href="tel:${escapeHTML(record.phone)}" class="profile-tel-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span>${escapeHTML(record.phone)}</span>
         </a>`
      : '<span style="color: var(--color-text-tertiary); font-style: italic;">None</span>';

    // Blood investigations display
    let investigationsDisplay = '<span style="color: var(--color-text-tertiary); font-style: italic;">None selected</span>';
    if (record.bloodInvestigations && record.bloodInvestigations.length > 0) {
      const chips = record.bloodInvestigations.map(inv => {
        const text = inv === 'Other' && record.bloodOther ? `Other: ${record.bloodOther}` : inv;
        return `<span class="mini-chip" style="font-size: 12px; padding: 3px 9px;">${escapeHTML(text)}</span>`;
      }).join('');
      investigationsDisplay = `<div style="display: flex; flex-wrap: wrap; gap: 6px;">${chips}</div>`;
    }

    // Plan display
    const planDisplay = record.plan && record.plan.trim()
      ? `<div class="detail-plan-box">${escapeHTML(record.plan)}</div>`
      : '<span style="color: var(--color-text-tertiary); font-style: italic;">No clinical plan recorded</span>';

    const typeTag = record.patientType === 'New'
      ? `<span class="patient-type-pill pill-new">New Patient</span>`
      : `<span class="patient-type-pill pill-existing">Existing Patient</span>`;

    contentEl.innerHTML = `
      <div class="profile-group-wrapper">
        <!-- Header Section -->
        <div class="profile-header-card">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
            <h2 class="profile-patient-name">${escapeHTML(record.name)}</h2>
            ${typeTag}
          </div>
        </div>

        <!-- Section 1: Identification & Contact -->
        <div class="profile-section-card">
          <div class="profile-section-title">Identification & Contact</div>
          <div class="profile-row-item">
            <span class="profile-row-label">IC Number</span>
            <span class="profile-row-value monospace">${escapeHTML(record.icNumber)}</span>
          </div>
          <div class="profile-row-item">
            <span class="profile-row-label">Phone</span>
            <span class="profile-row-value">${phoneLink}</span>
          </div>
        </div>

        <!-- Section 2: Appointments & Investigations -->
        <div class="profile-section-card">
          <div class="profile-section-title">Appointments & Investigations</div>
          <div class="profile-row-item">
            <span class="profile-row-label">Next TCA</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="profile-row-value" style="font-weight: 600;">${tcaFormatted}</span>
              ${tcaBadgeHtml}
            </div>
          </div>
          <div class="profile-row-item">
            <span class="profile-row-label">Blood Date</span>
            <div style="display: flex; align-items: center;">
              <span class="profile-row-value">${bloodFormatted}</span>
              ${bloodBadgeHtml}
            </div>
          </div>
        </div>

        <!-- Section 3: Blood Investigations -->
        <div class="profile-section-card">
          <div class="profile-section-title">Blood Investigations</div>
          ${investigationsDisplay}
        </div>

        <!-- Section 4: Clinical Plan -->
        <div class="profile-section-card">
          <div class="profile-section-title">Plan</div>
          ${planDisplay}
        </div>
      </div>
    `;

    this.overlayEl.classList.add('is-open');
  }

  public close(): void {
    if (!this.isOpen()) return;
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

  public isOpen(): boolean {
    return this.overlayEl.classList.contains('is-open');
  }
}
