import { BLOOD_INVESTIGATION_OPTIONS } from '../types.js';
import { getOneMonthBeforeISO } from '../utils/date.js';
import { normalizeCode } from '../utils/search.js';
import { confirmSheet } from './confirm-sheet.js';

function maskIC(ic        )         {
  const clean = (ic || '').trim();
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `••••-••-${last4}`;
}

function escapeHTML(str        )         {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class RecordModal {
          overlayEl             ;
          currentRecord                       = null;
          savedRecords                  = [];
          isEditMode = false;
          isBloodDateManuallyEdited = false;
          onSaveCallback                                                                                                                                  = null;
          previousActiveElement                     = null;
          existingSearchQuery = '';

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
          <span class="sheet-title" id="form-modal-title">Add Patient</span>
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

          <!-- DYNAMIC EXISTING PATIENT DROPDOWN & PICKER (Requirement 1) -->
          <div class="form-group" id="group-existing-picker" style="display: none;">
            <label class="form-label" for="select-existing-patient">Select Existing Patient</label>
            <div class="existing-picker-container">
              <div class="existing-search-row">
                <svg class="search-mini-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="search"
                  id="filter-existing-patients"
                  class="form-input existing-search-input"
                  placeholder="Filter existing patients by name or IC..."
                  autocomplete="off"
                />
              </div>

              <select id="select-existing-patient" class="form-input form-select existing-patient-select">
                <option value="">-- Choose an existing patient --</option>
              </select>

              <div id="existing-picker-empty" class="picker-empty-state" style="display: none;">
                No existing patients available in the system yet. Switch to "New Patient" above to register a patient.
              </div>

              <div id="existing-selected-banner" class="selected-patient-banner" style="display: none;">
                <div class="selected-banner-info">
                  <svg class="selected-banner-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <div>
                    <span id="existing-selected-name" style="font-weight: 600;"></span>
                    <span id="existing-selected-meta" style="font-size: 12px; color: var(--color-text-secondary); margin-left: 6px;"></span>
                  </div>
                </div>
                <button type="button" id="btn-clear-existing-selection" class="btn-clear-pill">Clear</button>
              </div>
            </div>
            <span class="form-hint">Selecting an existing patient preserves their Patient ID and complete appointment history.</span>
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
            <span class="form-hint">Optional. Creates or updates a scheduled appointment for this patient.</span>
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

          bindEvents()       {
    const form = this.overlayEl.querySelector('#patient-form')                   ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const segContainer = this.overlayEl.querySelector('#segmented-patient-type')               ;
    const chipsContainer = this.overlayEl.querySelector('#chips-investigations')               ;
    const otherContainer = this.overlayEl.querySelector('#container-blood-other')               ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const otherError = this.overlayEl.querySelector('#error-blood-other')               ;

    const existingSelect = this.overlayEl.querySelector('#select-existing-patient')                     ;
    const existingSearch = this.overlayEl.querySelector('#filter-existing-patients')                    ;
    const clearExistingBtn = this.overlayEl.querySelector('#btn-clear-existing-selection')                     ;

    // Segmented patient category toggle: changes category and updates existing dropdown visibility in Add mode
    segContainer.addEventListener('click', (e) => {
      const target = (e.target               ).closest('.segment-btn')                     ;
      if (!target) return;
      const targetVal = target.getAttribute('data-value')               ;
      this.setPatientCategoryUI(targetVal);

      if (!this.isEditMode) {
        if (targetVal === 'Existing') {
          this.showExistingPicker(true);
        } else {
          this.showExistingPicker(false);
          // If we had an existing patient selected, reset currentRecord so new patient registration is clean
          if (this.currentRecord) {
            this.clearSelectedExistingPatient();
          }
        }
      }
    });

    // Existing patient search filter
    existingSearch.addEventListener('input', () => {
      this.existingSearchQuery = existingSearch.value.trim().toLowerCase();
      this.populateExistingDropdown();
    });

    // Existing patient select change
    existingSelect.addEventListener('change', () => {
      const selectedId = existingSelect.value;
      if (!selectedId) {
        this.clearSelectedExistingPatient();
        return;
      }

      const match = this.savedRecords.find(r => r.id === selectedId);
      if (match) {
        this.applySelectedExistingPatient(match);
      }
    });

    // Clear existing patient selection button
    clearExistingBtn.addEventListener('click', () => {
      this.clearSelectedExistingPatient();
      existingSelect.value = '';
    });

    // Toggle investigation chips
    chipsContainer.addEventListener('click', (e) => {
      const btn = (e.target               ).closest('.chip-checkbox')                     ;
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

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });
  }

          showExistingPicker(show         )       {
    const pickerGroup = this.overlayEl.querySelector('#group-existing-picker')               ;
    pickerGroup.style.display = show ? 'block' : 'none';
    if (show) {
      this.populateExistingDropdown();
    }
  }

          populateExistingDropdown()       {
    const existingSelect = this.overlayEl.querySelector('#select-existing-patient')                     ;
    const emptyNotice = this.overlayEl.querySelector('#existing-picker-empty')               ;

    // Filter to existing patients (those categorized as Existing or active registered clinic patients)
    let candidates = this.savedRecords.filter(r => r.patientType === 'Existing');
    if (candidates.length === 0 && this.savedRecords.length > 0) {
      // Fallback: if no patients are explicitly tagged Existing yet, display all saved patients
      candidates = this.savedRecords;
    }

    if (this.existingSearchQuery) {
      const query = this.existingSearchQuery;
      candidates = candidates.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.icNumber.toLowerCase().includes(query) ||
        (r.phone && r.phone.toLowerCase().includes(query))
      );
    }

    // Deduplicate by ID
    const seen = new Set        ();
    const uniqueCandidates                  = [];
    for (const c of candidates) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        uniqueCandidates.push(c);
      }
    }

    // Sort alphabetically by name
    uniqueCandidates.sort((a, b) => a.name.localeCompare(b.name));

    existingSelect.innerHTML = '';

    if (uniqueCandidates.length === 0) {
      existingSelect.innerHTML = `<option value="">-- No matching existing patients found --</option>`;
      emptyNotice.style.display = 'block';
      return;
    }

    emptyNotice.style.display = 'none';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = `-- Select an existing patient (${uniqueCandidates.length} available) --`;
    existingSelect.appendChild(defaultOpt);

    for (const patient of uniqueCandidates) {
      const opt = document.createElement('option');
      opt.value = patient.id;
      // Privacy-conscious format: Name (IC: ••••-••-1234, ID: rec-...)
      opt.textContent = `${patient.name} (${maskIC(patient.icNumber)})`;
      if (this.currentRecord && this.currentRecord.id === patient.id) {
        opt.selected = true;
      }
      existingSelect.appendChild(opt);
    }
  }

          applySelectedExistingPatient(patient               )       {
    this.currentRecord = patient;

    const nameInput = this.overlayEl.querySelector('#field-name')                    ;
    const icInput = this.overlayEl.querySelector('#field-ic')                    ;
    const phoneInput = this.overlayEl.querySelector('#field-phone')                    ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#field-plan')                       ;

    nameInput.value = patient.name;
    icInput.value = patient.icNumber;
    phoneInput.value = patient.phone || '';
    tcaInput.value = patient.nextTca || '';
    bloodInput.value = patient.bloodInvestigationDate || '';
    otherInput.value = patient.bloodOther || '';
    planInput.value = patient.plan || '';

    this.isBloodDateManuallyEdited = Boolean(patient.bloodInvestigationDate);
    this.setSelectedInvestigations(patient.bloodInvestigations || []);

    // Show selection banner
    const banner = this.overlayEl.querySelector('#existing-selected-banner')               ;
    const nameSpan = this.overlayEl.querySelector('#existing-selected-name')               ;
    const metaSpan = this.overlayEl.querySelector('#existing-selected-meta')               ;

    nameSpan.textContent = patient.name;
    metaSpan.textContent = `(${maskIC(patient.icNumber)} • ID: ${patient.id})`;
    banner.style.display = 'flex';

    // Clear validation errors
    (this.overlayEl.querySelector('#error-name')               ).style.display = 'none';
    (this.overlayEl.querySelector('#error-ic')               ).style.display = 'none';
  }

          clearSelectedExistingPatient()       {
    this.currentRecord = null;

    const nameInput = this.overlayEl.querySelector('#field-name')                    ;
    const icInput = this.overlayEl.querySelector('#field-ic')                    ;
    const phoneInput = this.overlayEl.querySelector('#field-phone')                    ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#field-plan')                       ;

    nameInput.value = '';
    icInput.value = '';
    phoneInput.value = '';
    tcaInput.value = '';
    bloodInput.value = '';
    otherInput.value = '';
    planInput.value = '';

    this.isBloodDateManuallyEdited = false;
    this.setSelectedInvestigations([]);

    const banner = this.overlayEl.querySelector('#existing-selected-banner')               ;
    banner.style.display = 'none';
  }

          setPatientCategoryUI(type             )       {
    const typeInput = this.overlayEl.querySelector('#field-patient-type')                    ;
    typeInput.value = type;

    const segContainer = this.overlayEl.querySelector('#segmented-patient-type')               ;
    segContainer.querySelectorAll('.segment-btn').forEach(btn => {
      const isSelected = btn.getAttribute('data-value') === type;
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  }

          getSelectedInvestigations()           {
    const checkedBtns = this.overlayEl.querySelectorAll('.chip-checkbox.is-checked');
    const result           = [];
    checkedBtns.forEach(btn => {
      const key = btn.getAttribute('data-inv');
      if (key) result.push(key);
    });
    return result;
  }

          setSelectedInvestigations(investigations           = [])       {
    const chipsContainer = this.overlayEl.querySelector('#chips-investigations')               ;
    const otherContainer = this.overlayEl.querySelector('#container-blood-other')               ;
    const set = new Set(investigations);

    chipsContainer.querySelectorAll('.chip-checkbox').forEach(btn => {
      const key = btn.getAttribute('data-inv') || '';
      const isChecked = set.has(key);
      btn.classList.toggle('is-checked', isChecked);
      btn.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });

    otherContainer.style.display = set.has('Other') ? 'flex' : 'none';
  }

          validateBloodDate()          {
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const errorBlood = this.overlayEl.querySelector('#error-blood-date')               ;

    if (tcaInput.value && bloodInput.value && bloodInput.value > tcaInput.value) {
      errorBlood.style.display = 'block';
      return false;
    }
    errorBlood.style.display = 'none';
    return true;
  }

          async handleFormSubmit()                {
    const nameInput = this.overlayEl.querySelector('#field-name')                    ;
    const icInput = this.overlayEl.querySelector('#field-ic')                    ;
    const phoneInput = this.overlayEl.querySelector('#field-phone')                    ;
    const typeInput = this.overlayEl.querySelector('#field-patient-type')                    ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#field-plan')                       ;

    const errorName = this.overlayEl.querySelector('#error-name')               ;
    const errorIc = this.overlayEl.querySelector('#error-ic')               ;
    const errorOther = this.overlayEl.querySelector('#error-blood-other')               ;

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

    const patientType = (typeInput.value               ) || 'Existing';
    const trimmedIc = icInput.value.trim();
    const normalizedNewIc = normalizeCode(trimmedIc);

    // Duplicate IC check when saving a new patient (unless updating selected existing patient)
    const isNew = !this.currentRecord;
    if (isNew) {
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

    const saveBtn = this.overlayEl.querySelector('#btn-save-record')                     ;
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
      saveBtn.textContent = this.isEditMode ? 'Save Changes' : 'Save Patient';
    }
  }

         open(
    record                      ,
    savedRecords                 ,
    onSave                                                                                                                        ,
    triggerEl              
  )       {
    this.currentRecord = record;
    this.savedRecords = savedRecords;
    this.isEditMode = Boolean(record);
    this.onSaveCallback = onSave;
    this.previousActiveElement = triggerEl || (document.activeElement               );
    this.existingSearchQuery = '';

    const titleEl = this.overlayEl.querySelector('#form-modal-title')               ;
    const saveBtn = this.overlayEl.querySelector('#btn-save-record')                     ;
    const nameInput = this.overlayEl.querySelector('#field-name')                    ;
    const icInput = this.overlayEl.querySelector('#field-ic')                    ;
    const phoneInput = this.overlayEl.querySelector('#field-phone')                    ;
    const typeInput = this.overlayEl.querySelector('#field-patient-type')                    ;
    const tcaInput = this.overlayEl.querySelector('#field-tca')                    ;
    const bloodInput = this.overlayEl.querySelector('#field-blood-date')                    ;
    const otherInput = this.overlayEl.querySelector('#field-blood-other')                    ;
    const planInput = this.overlayEl.querySelector('#field-plan')                       ;
    const existingSearch = this.overlayEl.querySelector('#filter-existing-patients')                    ;
    existingSearch.value = '';

    const errorName = this.overlayEl.querySelector('#error-name')               ;
    const errorIc = this.overlayEl.querySelector('#error-ic')               ;
    const errorBlood = this.overlayEl.querySelector('#error-blood-date')               ;
    const errorOther = this.overlayEl.querySelector('#error-blood-other')               ;
    errorName.style.display = 'none';
    errorIc.style.display = 'none';
    errorBlood.style.display = 'none';
    errorOther.style.display = 'none';

    if (record) {
      // Edit Mode
      titleEl.textContent = 'Edit Patient Details';
      saveBtn.textContent = 'Save Changes';
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
      this.showExistingPicker(false);
    } else {
      // Add Mode: heading is "Add Patient" (Requirement 3)
      titleEl.textContent = 'Add Patient';
      saveBtn.textContent = 'Save Patient';
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

      // In Add Mode with Existing category active, show dynamic existing picker (Requirement 1)
      this.showExistingPicker(true);
      (this.overlayEl.querySelector('#existing-selected-banner')               ).style.display = 'none';
    }

    this.setPatientCategoryUI((typeInput.value               ) || 'Existing');

    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');

    window.setTimeout(() => {
      if (!record && typeInput.value === 'Existing') {
        const existingSelect = this.overlayEl.querySelector('#select-existing-patient')               ;
        existingSelect.focus();
      } else {
        nameInput.focus();
      }
    }, 100);
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
