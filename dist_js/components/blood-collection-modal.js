             
                
                             
                       
                  
import { formatDisplayDate, getLocalTodayISO } from '../utils/date.js';

                                                                          

                                          
                           
                       
                   
                   
                  
                      
                      
                 
 

export class BloodCollectionModal {
          overlayEl             ;
          currentPatient                       = null;
          currentCollection                                    = null;
          currentAction                   = 'attend';
          onSaveCallback                                                            = null;
          previousActiveElement                     = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Blood Collection Tracking');

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 480px;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title" id="blood-modal-title">Blood Collection Action</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Cancel and close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form id="blood-modal-form" class="sheet-body" novalidate>
          <div id="blood-patient-summary" class="patient-banner-info" style="padding: 10px 14px; background: var(--color-bg-primary); border-radius: var(--radius-md); font-size: 13.5px; margin-bottom: 10px;">
            Patient: <strong id="bld-patient-name" style="color: var(--color-text-primary);"></strong>
            <span id="bld-patient-meta" style="color: var(--color-text-secondary); margin-left: 6px;"></span>
          </div>

          <div id="bld-action-body"></div>
        </form>

        <div class="sheet-footer">
          <button type="button" class="btn-secondary" data-action="close">Cancel</button>
          <button type="submit" form="blood-modal-form" id="btn-save-blood-action" class="btn-primary">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.bindEvents();
  }

          bindEvents()       {
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

    const form = this.overlayEl.querySelector('#blood-modal-form')                   ;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

         open(
    patient               ,
    collection                            ,
    action                  ,
    onSave                                                  ,
    triggerEl              
  )       {
    this.currentPatient = patient;
    this.currentCollection = collection;
    this.currentAction = action;
    this.onSaveCallback = onSave;
    this.previousActiveElement = triggerEl || (document.activeElement               );

    const titleEl = this.overlayEl.querySelector('#blood-modal-title')               ;
    const nameEl = this.overlayEl.querySelector('#bld-patient-name')               ;
    const metaEl = this.overlayEl.querySelector('#bld-patient-meta')               ;
    const saveBtn = this.overlayEl.querySelector('#btn-save-blood-action')                     ;
    const bodyEl = this.overlayEl.querySelector('#bld-action-body')               ;

    nameEl.textContent = patient.name;
    metaEl.textContent = `(IC: ${patient.icNumber})`;

    const scheduledDisplay = formatDisplayDate(collection.scheduledDate);
    const today = getLocalTodayISO();

    if (action === 'attend') {
      titleEl.textContent = 'Record Sample Collection';
      saveBtn.textContent = 'Mark Attended';
      saveBtn.className = 'btn-primary';
      bodyEl.innerHTML = `
        <div style="background-color: var(--color-accent-subtle); border-radius: var(--radius-md); padding: 10px 12px; font-size: 13px; color: var(--color-text-primary); margin-bottom: 12px;">
          Scheduled Date: <strong>${scheduledDisplay}</strong>
          <div style="margin-top: 4px; font-size: 12px; color: var(--color-text-secondary);">
            Sample collected at KK Bandar Kulim. CD4 samples are routed to KK Taman Intan; Viral Load samples to Hospital Sultanah Bahiyah (HSB).
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label required" for="bld-field-actual-date">Actual Collection Date</label>
            <input type="date" id="bld-field-actual-date" class="form-input" value="${today}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="bld-field-actual-time">Collection Time</label>
            <input type="text" id="bld-field-actual-time" class="form-input" value="08:15 AM" placeholder="e.g. 08:15 AM" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="bld-field-notes">Clinical Notes (Optional)</label>
          <input type="text" id="bld-field-notes" class="form-input" placeholder="e.g. Blood drawn without complications, 2 tubes sent" />
        </div>
      `;
    } else if (action === 'reschedule') {
      titleEl.textContent = 'Reschedule Blood Collection';
      saveBtn.textContent = 'Reschedule Collection';
      saveBtn.className = 'btn-primary';
      bodyEl.innerHTML = `
        <div style="background-color: var(--color-accent-subtle); border-radius: var(--radius-md); padding: 10px 12px; font-size: 13px; color: var(--color-text-primary); margin-bottom: 12px;">
          Original Scheduled Date: <strong>${scheduledDisplay}</strong>
          <div style="margin-top: 4px; font-size: 12px; color: var(--color-text-secondary);">
            Rescheduling preserves the original date in Blood History and creates a new scheduled appointment. Patient profile remains completely intact.
          </div>
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label required" for="bld-field-new-date">New Scheduled Date</label>
            <input type="date" id="bld-field-new-date" class="form-input" required />
            <span class="form-error" id="err-bld-new-date" style="display: none;">Please select a new date</span>
          </div>
          <div class="form-group">
            <label class="form-label" for="bld-field-new-time">Time</label>
            <input type="text" id="bld-field-new-time" class="form-input" value="Before 8.30 am" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="bld-field-reason">Reason for Rescheduling</label>
          <input type="text" id="bld-field-reason" class="form-input" placeholder="e.g. Patient requested postponement / Public holiday" />
        </div>
      `;
    } else if (action === 'dna') {
      titleEl.textContent = 'Record Did Not Attend (DNA)';
      saveBtn.textContent = 'Mark DNA';
      saveBtn.className = 'btn-destructive';
      bodyEl.innerHTML = `
        <div style="background-color: var(--color-destructive-bg); border-radius: var(--radius-md); padding: 10px 12px; font-size: 13px; color: var(--color-destructive); margin-bottom: 12px;">
          Scheduled Date: <strong>${scheduledDisplay}</strong>
          <div style="margin-top: 4px; font-size: 12px;">
            Patient did not attend scheduled blood collection. This DNA record will be permanently preserved in Blood Collection History.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="bld-field-notes">Follow-up Notes / Reason</label>
          <input type="text" id="bld-field-notes" class="form-input" placeholder="e.g. Unreachable by phone, will contact next week" />
        </div>
      `;
    } else if (action === 'cancel') {
      titleEl.textContent = 'Cancel Blood Collection';
      saveBtn.textContent = 'Cancel Appointment';
      saveBtn.className = 'btn-secondary';
      bodyEl.innerHTML = `
        <div style="padding: 10px 12px; background: var(--color-bg-primary); border-radius: var(--radius-md); font-size: 13px; margin-bottom: 12px;">
          Scheduled Date: <strong>${scheduledDisplay}</strong>
        </div>
        <div class="form-group">
          <label class="form-label" for="bld-field-notes">Cancellation Reason</label>
          <input type="text" id="bld-field-notes" class="form-input" placeholder="e.g. Tests already done at hospital" />
        </div>
      `;
    }

    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');

    window.setTimeout(() => {
      const firstInput = this.overlayEl.querySelector('input')                    ;
      if (firstInput) firstInput.focus();
    }, 100);
  }

          async handleSubmit()                {
    if (!this.currentCollection || !this.onSaveCallback) return;

    let newDate = '';
    let newTime = '';
    let reason = '';
    let actualDate = '';
    let actualTime = '';
    let notes = '';

    if (this.currentAction === 'reschedule') {
      const dateInp = this.overlayEl.querySelector('#bld-field-new-date')                    ;
      const timeInp = this.overlayEl.querySelector('#bld-field-new-time')                    ;
      const reasonInp = this.overlayEl.querySelector('#bld-field-reason')                    ;
      const err = this.overlayEl.querySelector('#err-bld-new-date')               ;

      if (!dateInp.value) {
        err.style.display = 'block';
        dateInp.focus();
        return;
      }
      err.style.display = 'none';
      newDate = dateInp.value;
      newTime = timeInp.value;
      reason = reasonInp.value;
    } else if (this.currentAction === 'attend') {
      const actDateInp = this.overlayEl.querySelector('#bld-field-actual-date')                    ;
      const actTimeInp = this.overlayEl.querySelector('#bld-field-actual-time')                    ;
      const notesInp = this.overlayEl.querySelector('#bld-field-notes')                    ;

      actualDate = actDateInp ? actDateInp.value : '';
      actualTime = actTimeInp ? actTimeInp.value : '';
      notes = notesInp ? notesInp.value : '';
    } else {
      const notesInp = this.overlayEl.querySelector('#bld-field-notes')                    ;
      notes = notesInp ? notesInp.value : '';
    }

    const saveBtn = this.overlayEl.querySelector('#btn-save-blood-action')                     ;
    saveBtn.disabled = true;

    try {
      await this.onSaveCallback({
        action: this.currentAction,
        collectionId: this.currentCollection.id,
        newDate: newDate || undefined,
        newTime: newTime || undefined,
        reason: reason || undefined,
        actualDate: actualDate || undefined,
        actualTime: actualTime || undefined,
        notes: notes || undefined
      });
      this.close();
    } finally {
      saveBtn.disabled = false;
    }
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
