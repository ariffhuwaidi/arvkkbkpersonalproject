import { BLOOD_INVESTIGATION_OPTIONS } from '../types';
import type { PatientRecord, PatientType, BloodInvestigationOption } from '../types';
import { getOneMonthBeforeISO } from '../utils/date';
import { normalizeCode } from '../utils/search';
import { confirmSheet } from './confirm-sheet';

export class RecordModal {
  private overlayEl: HTMLElement;
  private currentRecord: PatientRecord | null = null;
  private savedRecords: PatientRecord[] = [];
  private isEditMode = false;
  private isBloodDateManuallyEdited = false;
  private onSaveCallback: ((record: Omit<PatientRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }) => Promise<void>) | null = null;
  private previousActiveElement: HTMLElement | null = null;

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
          <span class="sheet-title" id="form-modal-title">New Patient Registration</span>
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
            <span class="form-hint">Optional. Creates an initial scheduled appointment for this patient.</span>
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

  private bindEvents(): void {
    const form = this.overlayEl.querySelector('#patient-form') as HTMLFormElement;
    const tcaInput = this.overlayEl.querySelector('#field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date') as HTMLInputElement;
    const segContainer = this.overlayEl.querySelector('#segmented-patient-type') as HTMLElement;
    const chipsContainer = this.overlayEl.querySelector('#chips-investigations') as HTMLElement;
    const otherContainer = this.overlayEl.querySelector('#container-blood-other') as HTMLElement;
    const otherInput = this.overlayEl.querySelector('#field-blood-other') as HTMLInputElement;
    const otherError = this.overlayEl.querySelector('#error-blood-other') as HTMLElement;

    // Segmented patient category toggle: smoothly changes category without clearing data
    segContainer.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.segment-btn') as HTMLButtonElement;
      if (!target) return;
      const targetVal = target.getAttribute('data-value') as PatientType;
      this.setPatientCategoryUI(targetVal);
    });

    // Toggle investigation chips
    chipsContainer.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.chip-checkbox') as HTMLButtonElement;
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

  private setPatientCategoryUI(type: PatientType): void {
    const typeInput = this.overlayEl.querySelector('#field-patient-type') as HTMLInputElement;
    typeInput.value = type;

    const segContainer = this.overlayEl.querySelector('#segmented-patient-type') as HTMLElement;
    segContainer.querySelectorAll('.segment-btn').forEach(btn => {
      const isSelected = btn.getAttribute('data-value') === type;
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  }

  private getSelectedInvestigations(): string[] {
    const checkedBtns = this.overlayEl.querySelectorAll('.chip-checkbox.is-checked');
    const result: string[] = [];
    checkedBtns.forEach(btn => {
      const key = btn.getAttribute('data-inv');
      if (key) result.push(key);
    });
    return result;
  }

  private setSelectedInvestigations(investigations: string[] = []): void {
    const chipsContainer = this.overlayEl.querySelector('#chips-investigations') as HTMLElement;
    const otherContainer = this.overlayEl.querySelector('#container-blood-other') as HTMLElement;
    const set = new Set(investigations);

    chipsContainer.querySelectorAll('.chip-checkbox').forEach(btn => {
      const key = btn.getAttribute('data-inv') || '';
      const isChecked = set.has(key);
      btn.classList.toggle('is-checked', isChecked);
      btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });

    otherContainer.style.display = set.has('Other') ? 'flex' : 'none';
  }

  private getPatientTypeValue(): PatientType {
    const typeInput = this.overlayEl.querySelector('#field-patient-type') as HTMLInputElement;
    return (typeInput.value as PatientType) || 'Existing';
  }

  private validateBloodDate(): boolean {
    const tcaInput = this.overlayEl.querySelector('#field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date') as HTMLInputElement;
    const errorBlood = this.overlayEl.querySelector('#error-blood-date') as HTMLElement;

    if (tcaInput.value && bloodInput.value && bloodInput.value > tcaInput.value) {
      errorBlood.style.display = 'block';
      return false;
    }
    errorBlood.style.display = 'none';
    return true;
  }

  private async handleFormSubmit(): Promise<void> {
    const nameInput = this.overlayEl.querySelector('#field-name') as HTMLInputElement;
    const icInput = this.overlayEl.querySelector('#field-ic') as HTMLInputElement;
    const phoneInput = this.overlayEl.querySelector('#field-phone') as HTMLInputElement;
    const typeInput = this.overlayEl.querySelector('#field-patient-type') as HTMLInputElement;
    const tcaInput = this.overlayEl.querySelector('#field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date') as HTMLInputElement;
    const otherInput = this.overlayEl.querySelector('#field-blood-other') as HTMLInputElement;
    const planInput = this.overlayEl.querySelector('#field-plan') as HTMLTextAreaElement;

    const errorName = this.overlayEl.querySelector('#error-name') as HTMLElement;
    const errorIc = this.overlayEl.querySelector('#error-ic') as HTMLElement;
    const errorOther = this.overlayEl.querySelector('#error-blood-other') as HTMLElement;

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

    const patientType = (typeInput.value as PatientType) || 'Existing';
    const trimmedIc = icInput.value.trim();
    const normalizedNewIc = normalizeCode(trimmedIc);

    // Duplicate IC check when saving a new patient
    if (!this.isEditMode) {
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

    const saveBtn = this.overlayEl.querySelector('#btn-save-record') as HTMLButtonElement;
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
      saveBtn.textContent = 'Save Patient';
    }
  }

  public open(
    record: PatientRecord | null,
    savedRecords: PatientRecord[],
    onSave: (record: Omit<PatientRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string }) => Promise<void>,
    triggerEl?: HTMLElement
  ): void {
    this.currentRecord = record;
    this.savedRecords = savedRecords;
    this.isEditMode = Boolean(record);
    this.onSaveCallback = onSave;
    this.previousActiveElement = triggerEl || (document.activeElement as HTMLElement);

    const titleEl = this.overlayEl.querySelector('#form-modal-title') as HTMLElement;
    const nameInput = this.overlayEl.querySelector('#field-name') as HTMLInputElement;
    const icInput = this.overlayEl.querySelector('#field-ic') as HTMLInputElement;
    const phoneInput = this.overlayEl.querySelector('#field-phone') as HTMLInputElement;
    const typeInput = this.overlayEl.querySelector('#field-patient-type') as HTMLInputElement;
    const tcaInput = this.overlayEl.querySelector('#field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date') as HTMLInputElement;
    const otherInput = this.overlayEl.querySelector('#field-blood-other') as HTMLInputElement;
    const planInput = this.overlayEl.querySelector('#field-plan') as HTMLTextAreaElement;

    const errorName = this.overlayEl.querySelector('#error-name') as HTMLElement;
    const errorIc = this.overlayEl.querySelector('#error-ic') as HTMLElement;
    const errorBlood = this.overlayEl.querySelector('#error-blood-date') as HTMLElement;
    const errorOther = this.overlayEl.querySelector('#error-blood-other') as HTMLElement;
    errorName.style.display = 'none';
    errorIc.style.display = 'none';
    errorBlood.style.display = 'none';
    errorOther.style.display = 'none';

    if (record) {
      titleEl.textContent = 'Edit Patient Record';
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
    } else {
      titleEl.textContent = 'New Patient Registration';
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
    }

    this.setPatientCategoryUI((typeInput.value as PatientType) || 'Existing');

    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');

    window.setTimeout(() => {
      nameInput.focus();
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
