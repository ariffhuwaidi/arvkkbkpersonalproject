import { BLOOD_INVESTIGATION_OPTIONS } from '../types';
import type { TCAAppointment, PatientRecord } from '../types';
import { getOneMonthBeforeISO } from '../utils/date';

export type AppointmentModalMode = 'new' | 'reschedule' | 'edit';

export interface AppointmentModalSaveData {
  tcaDate: string;
  notes?: string;
  plan?: string;
  bloodInvestigationDate?: string;
  bloodInvestigations: string[];
  bloodOther?: string;
}

export class AppointmentModal {
  private overlayEl: HTMLElement;
  private mode: AppointmentModalMode = 'new';
  private patient: PatientRecord | null = null;
  private targetAppointment: TCAAppointment | null = null;
  private isBloodDateManuallyEdited = false;
  private onSaveCallback: ((data: AppointmentModalSaveData) => Promise<void>) | null = null;
  private previousActiveElement: HTMLElement | null = null;

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

  private bindEvents(): void {
    const form = this.overlayEl.querySelector('#apt-form') as HTMLFormElement;
    const tcaInput = this.overlayEl.querySelector('#apt-field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#apt-field-blood-date') as HTMLInputElement;
    const chipsContainer = this.overlayEl.querySelector('#apt-chips-investigations') as HTMLElement;
    const otherContainer = this.overlayEl.querySelector('#apt-container-blood-other') as HTMLElement;
    const otherInput = this.overlayEl.querySelector('#apt-field-blood-other') as HTMLInputElement;
    const otherError = this.overlayEl.querySelector('#apt-error-blood-other') as HTMLElement;

    // Toggle investigation chips
    chipsContainer.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.chip-checkbox') as HTMLButtonElement;
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });
  }

  private validateBloodDate(): boolean {
    const tcaInput = this.overlayEl.querySelector('#apt-field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#apt-field-blood-date') as HTMLInputElement;
    const errorBlood = this.overlayEl.querySelector('#apt-error-blood-date') as HTMLElement;

    if (tcaInput.value && bloodInput.value && bloodInput.value > tcaInput.value) {
      errorBlood.style.display = 'block';
      return false;
    }
    errorBlood.style.display = 'none';
    return true;
  }

  private getSelectedInvestigations(): string[] {
    const checkedBtns = this.overlayEl.querySelectorAll('.chip-checkbox.is-checked');
    const result: string[] = [];
    checkedBtns.forEach(btn => {
      const key = btn.getAttribute('data-apt-inv');
      if (key) result.push(key);
    });
    return result;
  }

  private setSelectedInvestigations(investigations: string[] = []): void {
    const chipsContainer = this.overlayEl.querySelector('#apt-chips-investigations') as HTMLElement;
    const otherContainer = this.overlayEl.querySelector('#apt-container-blood-other') as HTMLElement;
    const set = new Set(investigations);

    chipsContainer.querySelectorAll('.chip-checkbox').forEach(btn => {
      const key = btn.getAttribute('data-apt-inv') || '';
      const isChecked = set.has(key);
      btn.classList.toggle('is-checked', isChecked);
      btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });

    otherContainer.style.display = set.has('Other') ? 'flex' : 'none';
  }

  private async handleFormSubmit(): Promise<void> {
    const tcaInput = this.overlayEl.querySelector('#apt-field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#apt-field-blood-date') as HTMLInputElement;
    const otherInput = this.overlayEl.querySelector('#apt-field-blood-other') as HTMLInputElement;
    const planInput = this.overlayEl.querySelector('#apt-field-plan') as HTMLTextAreaElement;
    const notesInput = this.overlayEl.querySelector('#apt-field-notes') as HTMLInputElement;

    const errorTca = this.overlayEl.querySelector('#apt-error-tca') as HTMLElement;
    const errorOther = this.overlayEl.querySelector('#apt-error-blood-other') as HTMLElement;

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

    const saveBtn = this.overlayEl.querySelector('#btn-save-apt') as HTMLButtonElement;
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

  public open(
    patient: PatientRecord,
    mode: AppointmentModalMode,
    targetAppointment: TCAAppointment | null,
    onSave: (data: AppointmentModalSaveData) => Promise<void>,
    triggerEl?: HTMLElement
  ): void {
    this.patient = patient;
    this.mode = mode;
    this.targetAppointment = targetAppointment;
    this.onSaveCallback = onSave;
    this.previousActiveElement = triggerEl || (document.activeElement as HTMLElement);

    const titleEl = this.overlayEl.querySelector('#apt-modal-title') as HTMLElement;
    const patientNameEl = this.overlayEl.querySelector('#apt-patient-name') as HTMLElement;
    const rescheduleNotice = this.overlayEl.querySelector('#apt-reschedule-notice') as HTMLElement;
    const tcaInput = this.overlayEl.querySelector('#apt-field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#apt-field-blood-date') as HTMLInputElement;
    const otherInput = this.overlayEl.querySelector('#apt-field-blood-other') as HTMLInputElement;
    const planInput = this.overlayEl.querySelector('#apt-field-plan') as HTMLTextAreaElement;
    const notesInput = this.overlayEl.querySelector('#apt-field-notes') as HTMLInputElement;

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

  public close(): void {
    if (!this.isOpen()) return;
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

  public isOpen(): boolean {
    return this.overlayEl.classList.contains('is-open');
  }
}
