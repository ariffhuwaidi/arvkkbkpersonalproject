import { BLOOD_INVESTIGATION_OPTIONS } from '../types';
import type { PatientRecord, PatientType, BloodInvestigationOption } from '../types';
import { getOneMonthBeforeISO } from '../utils/date';
import { normalizeCode } from '../utils/search';
import { confirmSheet } from './confirm-sheet';

export class RecordModal {
  private overlayEl: HTMLElement;
  private pickerOverlayEl!: HTMLElement;
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
          <span class="sheet-title" id="form-modal-title">New Patient Record</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Cancel and close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <form id="patient-form" class="sheet-body" novalidate>
          <div class="form-group" id="group-patient-type">
            <label class="form-label required">Patient Type</label>
            <div class="segmented-control" id="segmented-patient-type" role="radiogroup" aria-label="Patient Type">
              <button type="button" class="segment-btn is-active" data-value="Existing" role="radio" aria-checked="true">Existing</button>
              <button type="button" class="segment-btn" data-value="New" role="radio" aria-checked="false">New</button>
            </div>
            <input type="hidden" id="field-patient-type" value="Existing" />
          </div>

          <div class="form-group" id="group-patient-name">
            <label class="form-label required" for="field-name">Patient Name</label>
            <!-- Normal text input (used for New patients and in Edit mode) -->
            <input type="text" id="field-name" class="form-input" placeholder="e.g. Demo Patient 01" autocomplete="off" />
            
            <!-- Existing Patient Picker Button (used when adding for Existing patient) -->
            <button type="button" id="btn-patient-picker-trigger" class="btn-patient-picker is-placeholder" style="display: none;" aria-haspopup="dialog">
              <span id="picker-trigger-text">Select existing patient...</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
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
            <input type="date" id="field-tca" class="form-input" />
          </div>

          <div class="form-group">
            <label class="form-label" for="field-blood-date">Blood Investigation Date ("Blood date")</label>
            <input type="date" id="field-blood-date" class="form-input" />
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
            <label class="form-label" for="field-plan">Plan</label>
            <textarea id="field-plan" class="form-textarea" placeholder="e.g. Adherence counseling, repeat viral load in 6 months, stable on TLD..."></textarea>
          </div>
        </form>
        <div class="sheet-footer">
          <button type="button" class="btn-secondary" data-action="close">Cancel</button>
          <button type="submit" form="patient-form" id="btn-save-record" class="btn-primary">Save Record</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.createPickerOverlay();
    this.bindEvents();
  }

  private createPickerOverlay(): void {
    this.pickerOverlayEl = document.createElement('div');
    this.pickerOverlayEl.className = 'modal-overlay';
    this.pickerOverlayEl.setAttribute('role', 'dialog');
    this.pickerOverlayEl.setAttribute('aria-modal', 'true');
    this.pickerOverlayEl.setAttribute('aria-label', 'Select Existing Patient');

    this.pickerOverlayEl.innerHTML = `
      <div class="bottom-sheet picker-sheet">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title">Select Existing Patient</span>
          <button type="button" class="btn-icon" data-picker-action="close" aria-label="Close patient picker">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="picker-search-container">
          <div class="search-wrapper">
            <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              id="picker-search-input"
              class="search-input"
              placeholder="Search existing patients..."
              autocomplete="off"
            />
          </div>
        </div>
        <div class="picker-list-container" id="picker-patient-list" role="listbox"></div>
      </div>
    `;

    document.body.appendChild(this.pickerOverlayEl);

    // Picker search listener
    const searchInput = this.pickerOverlayEl.querySelector('#picker-search-input') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
      this.renderPickerList(searchInput.value);
    });

    this.pickerOverlayEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === this.pickerOverlayEl || target.closest('[data-picker-action="close"]')) {
        this.closePicker();
      }
    });
  }

  private bindEvents(): void {
    const form = this.overlayEl.querySelector('#patient-form') as HTMLFormElement;
    const tcaInput = this.overlayEl.querySelector('#field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date') as HTMLInputElement;
    const segContainer = this.overlayEl.querySelector('#segmented-patient-type') as HTMLElement;
    const pickerTrigger = this.overlayEl.querySelector('#btn-patient-picker-trigger') as HTMLButtonElement;
    const chipsContainer = this.overlayEl.querySelector('#chips-investigations') as HTMLElement;
    const otherContainer = this.overlayEl.querySelector('#container-blood-other') as HTMLElement;
    const otherInput = this.overlayEl.querySelector('#field-blood-other') as HTMLInputElement;
    const otherError = this.overlayEl.querySelector('#error-blood-other') as HTMLElement;

    // Segmented patient type toggle with unsaved changes confirmation
    segContainer.addEventListener('click', async (e) => {
      const target = (e.target as HTMLElement).closest('.segment-btn') as HTMLButtonElement;
      if (!target) return;
      const targetVal = target.getAttribute('data-value') as PatientType;
      const currentVal = this.getPatientTypeValue();
      if (targetVal === currentVal) return;

      if (this.isFormDirty()) {
        const confirmed = await confirmSheet.show({
          title: 'Switch Patient Type?',
          message: 'Switching patient type will clear the current form data. Continue?',
          confirmLabel: 'Clear and Switch',
          cancelLabel: 'Keep Current',
          isDestructive: false
        });

        if (!confirmed) return;
      }

      this.switchPatientType(targetVal);
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
          // Unticking Other clears its text and hides
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

    // Open Existing Patient Picker
    pickerTrigger.addEventListener('click', () => {
      this.openPicker();
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
      if (e.key === 'Escape') {
        if (this.isPickerOpen()) {
          this.closePicker();
        } else if (this.isOpen()) {
          this.close();
        }
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
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

  private isFormDirty(): boolean {
    const nameInput = this.overlayEl.querySelector('#field-name') as HTMLInputElement;
    const icInput = this.overlayEl.querySelector('#field-ic') as HTMLInputElement;
    const phoneInput = this.overlayEl.querySelector('#field-phone') as HTMLInputElement;
    const planInput = this.overlayEl.querySelector('#field-plan') as HTMLTextAreaElement;
    const otherInput = this.overlayEl.querySelector('#field-blood-other') as HTMLInputElement;
    const currentInvs = this.getSelectedInvestigations();

    if (this.currentRecord) {
      const origInvs = this.currentRecord.bloodInvestigations || [];
      const invsMatch = currentInvs.length === origInvs.length && currentInvs.every(i => origInvs.includes(i));
      return (
        nameInput.value !== this.currentRecord.name ||
        icInput.value !== this.currentRecord.icNumber ||
        phoneInput.value !== (this.currentRecord.phone || '') ||
        planInput.value !== (this.currentRecord.plan || '') ||
        otherInput.value !== (this.currentRecord.bloodOther || '') ||
        !invsMatch
      );
    }

    return Boolean(
      nameInput.value.trim() ||
      icInput.value.trim() ||
      phoneInput.value.trim() ||
      planInput.value.trim() ||
      otherInput.value.trim() ||
      currentInvs.length > 0
    );
  }

  private switchPatientType(type: PatientType): void {
    const typeInput = this.overlayEl.querySelector('#field-patient-type') as HTMLInputElement;
    typeInput.value = type;

    const segContainer = this.overlayEl.querySelector('#segmented-patient-type') as HTMLElement;
    segContainer.querySelectorAll('.segment-btn').forEach(btn => {
      const isSelected = btn.getAttribute('data-value') === type;
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    this.currentRecord = null;
    this.resetFormFields();
    this.updateNameInputVisibility();
  }

  private resetFormFields(): void {
    const nameInput = this.overlayEl.querySelector('#field-name') as HTMLInputElement;
    const icInput = this.overlayEl.querySelector('#field-ic') as HTMLInputElement;
    const phoneInput = this.overlayEl.querySelector('#field-phone') as HTMLInputElement;
    const tcaInput = this.overlayEl.querySelector('#field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date') as HTMLInputElement;
    const otherInput = this.overlayEl.querySelector('#field-blood-other') as HTMLInputElement;
    const planInput = this.overlayEl.querySelector('#field-plan') as HTMLTextAreaElement;
    const pickerTriggerText = this.overlayEl.querySelector('#picker-trigger-text') as HTMLElement;
    const pickerBtn = this.overlayEl.querySelector('#btn-patient-picker-trigger') as HTMLButtonElement;

    nameInput.value = '';
    icInput.value = '';
    phoneInput.value = '';
    tcaInput.value = '';
    bloodInput.value = '';
    otherInput.value = '';
    planInput.value = '';
    this.isBloodDateManuallyEdited = false;
    this.setSelectedInvestigations([]);

    pickerTriggerText.textContent = 'Select existing patient...';
    pickerBtn.classList.add('is-placeholder');

    const errorName = this.overlayEl.querySelector('#error-name') as HTMLElement;
    const errorIc = this.overlayEl.querySelector('#error-ic') as HTMLElement;
    const errorBlood = this.overlayEl.querySelector('#error-blood-date') as HTMLElement;
    const errorOther = this.overlayEl.querySelector('#error-blood-other') as HTMLElement;
    errorName.style.display = 'none';
    errorIc.style.display = 'none';
    errorBlood.style.display = 'none';
    errorOther.style.display = 'none';
  }

  private updateNameInputVisibility(): void {
    const nameInput = this.overlayEl.querySelector('#field-name') as HTMLInputElement;
    const pickerBtn = this.overlayEl.querySelector('#btn-patient-picker-trigger') as HTMLButtonElement;
    const patientType = this.getPatientTypeValue();

    if (!this.isEditMode && patientType === 'Existing') {
      nameInput.style.display = 'none';
      pickerBtn.style.display = 'flex';
    } else {
      nameInput.style.display = 'block';
      pickerBtn.style.display = 'none';
    }
  }

  private openPicker(): void {
    const searchInput = this.pickerOverlayEl.querySelector('#picker-search-input') as HTMLInputElement;
    searchInput.value = '';
    this.renderPickerList('');
    this.pickerOverlayEl.classList.add('is-open');
    window.setTimeout(() => searchInput.focus(), 100);
  }

  private closePicker(): void {
    this.pickerOverlayEl.classList.remove('is-open');
  }

  private isPickerOpen(): boolean {
    return this.pickerOverlayEl.classList.contains('is-open');
  }

  private renderPickerList(query: string): void {
    const listEl = this.pickerOverlayEl.querySelector('#picker-patient-list') as HTMLElement;
    listEl.innerHTML = '';

    const sorted = [...this.savedRecords].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    const q = query.trim().toLowerCase();
    const filtered = q
      ? sorted.filter(r => r.name.toLowerCase().includes(q) || r.icNumber.includes(q))
      : sorted;

    if (this.savedRecords.length === 0) {
      listEl.innerHTML = `
        <div class="picker-empty-state">
          <p style="font-size: 14.5px; font-weight: 500;">No existing patients yet</p>
          <button type="button" id="btn-picker-switch-new" class="btn-primary" style="height: 36px; padding: 0 14px; font-size: 13.5px;">
            Switch to New Patient
          </button>
        </div>
      `;
      listEl.querySelector('#btn-picker-switch-new')?.addEventListener('click', () => {
        this.closePicker();
        this.switchPatientType('New');
      });
      return;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="picker-empty-state">
          <p style="font-size: 14px;">No patients match "${this.escapeText(query)}"</p>
        </div>
      `;
      return;
    }

    for (const record of filtered) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'picker-item';
      btn.setAttribute('role', 'option');

      const cleanIC = record.icNumber.replace(/[\s-]/g, '');
      const last4 = cleanIC.length >= 4 ? cleanIC.slice(-4) : cleanIC;

      btn.innerHTML = `
        <span class="picker-item-name">${this.escapeText(record.name)}</span>
        <span class="picker-item-ic">IC: •••• ${this.escapeText(last4)}</span>
      `;

      btn.addEventListener('click', () => {
        this.selectExistingPatient(record);
        this.closePicker();
      });

      listEl.appendChild(btn);
    }
  }

  private selectExistingPatient(record: PatientRecord): void {
    this.currentRecord = record;

    const nameInput = this.overlayEl.querySelector('#field-name') as HTMLInputElement;
    const icInput = this.overlayEl.querySelector('#field-ic') as HTMLInputElement;
    const phoneInput = this.overlayEl.querySelector('#field-phone') as HTMLInputElement;
    const tcaInput = this.overlayEl.querySelector('#field-tca') as HTMLInputElement;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date') as HTMLInputElement;
    const otherInput = this.overlayEl.querySelector('#field-blood-other') as HTMLInputElement;
    const planInput = this.overlayEl.querySelector('#field-plan') as HTMLTextAreaElement;
    const pickerTriggerText = this.overlayEl.querySelector('#picker-trigger-text') as HTMLElement;
    const pickerBtn = this.overlayEl.querySelector('#btn-patient-picker-trigger') as HTMLButtonElement;

    nameInput.value = record.name;
    icInput.value = record.icNumber;
    phoneInput.value = record.phone || '';
    tcaInput.value = record.nextTca || '';
    bloodInput.value = record.bloodInvestigationDate || '';
    otherInput.value = record.bloodOther || '';
    planInput.value = record.plan || '';
    this.isBloodDateManuallyEdited = Boolean(record.bloodInvestigationDate);

    this.setSelectedInvestigations(record.bloodInvestigations || []);

    pickerTriggerText.textContent = record.name;
    pickerBtn.classList.remove('is-placeholder');
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

    // "Other" validation: required only if Other is ticked
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
        const patientType = this.getPatientTypeValue();
        if (!this.isEditMode && patientType === 'Existing') {
          this.openPicker();
        } else {
          nameInput.focus();
        }
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

    // Duplicate IC check when saving a "New" patient
    if (patientType === 'New' && !this.isEditMode) {
      const existingMatch = this.savedRecords.find(
        r => normalizeCode(r.icNumber) === normalizedNewIc
      );

      if (existingMatch) {
        const shouldOpenExisting = await confirmSheet.show({
          title: 'Duplicate IC Number Warning',
          message: `A record with IC "${trimmedIc}" already exists as "${existingMatch.name}". Would you like to open that record instead of creating a duplicate?`,
          confirmLabel: 'Open Existing Record',
          cancelLabel: 'Keep Editing',
          isDestructive: false
        });

        if (shouldOpenExisting) {
          this.switchPatientType('Existing');
          this.selectExistingPatient(existingMatch);
        }
        return;
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
      saveBtn.textContent = 'Save Record';
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
    const segContainer = this.overlayEl.querySelector('#segmented-patient-type') as HTMLElement;
    const typeGroup = this.overlayEl.querySelector('#group-patient-type') as HTMLElement;
    const pickerTriggerText = this.overlayEl.querySelector('#picker-trigger-text') as HTMLElement;
    const pickerBtn = this.overlayEl.querySelector('#btn-patient-picker-trigger') as HTMLButtonElement;

    const errorName = this.overlayEl.querySelector('#error-name') as HTMLElement;
    const errorIc = this.overlayEl.querySelector('#error-ic') as HTMLElement;
    const errorBlood = this.overlayEl.querySelector('#error-blood-date') as HTMLElement;
    const errorOther = this.overlayEl.querySelector('#error-blood-other') as HTMLElement;
    errorName.style.display = 'none';
    errorIc.style.display = 'none';
    errorBlood.style.display = 'none';
    errorOther.style.display = 'none';

    if (record) {
      titleEl.textContent = 'Edit Record';
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
      typeGroup.style.display = 'none';
    } else {
      titleEl.textContent = 'New Patient Record';
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
      typeGroup.style.display = 'flex';
      pickerTriggerText.textContent = 'Select existing patient...';
      pickerBtn.classList.add('is-placeholder');
    }

    segContainer.querySelectorAll('.segment-btn').forEach(btn => {
      const isSelected = btn.getAttribute('data-value') === typeInput.value;
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });

    this.updateNameInputVisibility();
    this.overlayEl.classList.add('is-open');

    window.setTimeout(() => {
      if (!this.isEditMode && this.getPatientTypeValue() === 'Existing') {
        pickerBtn.focus();
      } else {
        nameInput.focus();
      }
    }, 100);
  }

  public close(): void {
    if (!this.isOpen()) return;
    this.overlayEl.classList.remove('is-open');
    this.closePicker();

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

  public isOpen(): boolean {
    return this.overlayEl.classList.contains('is-open');
  }

  private escapeText(text: string): string {
    return text.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m] || m);
  }
}
