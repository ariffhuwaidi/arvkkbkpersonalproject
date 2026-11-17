import type { PatientRecord, MMTDispensing } from '../types';
import { getLocalTodayISO } from '../utils/date';

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface MMTEnrolData {
  existingId?: string;
  name: string;
  icNumber: string;
  phone: string;
  startDate: string;
  doseMg?: number;
  dispensing: MMTDispensing;
}

/** Sheet for adding a patient to MMT: a new person, or someone already registered in ARV. */
export class MMTEnrolModal {
  private overlayEl: HTMLElement;
  private onSubmit: ((data: MMTEnrolData) => Promise<string | null>) | null = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'Add MMT patient');
    document.body.appendChild(this.overlayEl);
    this.overlayEl.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.overlayEl || t.closest('[data-action="close"]')) this.close();
    });
  }

  public open(candidates: PatientRecord[], onSubmit: (data: MMTEnrolData) => Promise<string | null>): void {
    this.onSubmit = onSubmit;
    const today = getLocalTodayISO();
    const sorted = [...candidates].sort((a, b) => a.name.localeCompare(b.name));

    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 520px; max-height: 92vh;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title">Add MMT patient</span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <form class="sheet-body mmt-form" id="mmt-enrol-form" autocomplete="off">
          ${sorted.length ? `
          <label class="pp-label" for="mmt-existing">Already registered in ARV?</label>
          <select class="form-input" id="mmt-existing" name="existing">
            <option value="">No, register a new person</option>
            ${sorted.map(r => `<option value="${esc(r.id)}">${esc(r.name)} (${esc(r.icNumber)})</option>`).join('')}
          </select>` : ''}
          <div id="mmt-new-fields">
            <label class="pp-label" for="mmt-name">Name</label>
            <input class="form-input" id="mmt-name" name="name" type="text" />
            <label class="pp-label" for="mmt-ic">IC number</label>
            <input class="form-input" id="mmt-ic" name="ic" type="text" inputmode="numeric" />
            <label class="pp-label" for="mmt-phone">Phone (optional)</label>
            <input class="form-input" id="mmt-phone" name="phone" type="tel" />
          </div>
          <label class="pp-label" for="mmt-start">MMT start date</label>
          <input class="form-input" id="mmt-start" name="start" type="date" value="${today}" required />
          <label class="pp-label" for="mmt-dose">Starting dose (mg)</label>
          <input class="form-input" id="mmt-dose" name="dose" type="number" step="any" min="0" inputmode="decimal" />
          <label class="pp-label" for="mmt-disp">Dispensing</label>
          <select class="form-input" id="mmt-disp" name="disp">
            <option value="Daily">Daily dispensing</option>
            <option value="Take-home">Take-home</option>
          </select>
          <p class="pp-error" id="mmt-enrol-error" role="alert"></p>
          <button type="submit" class="btn-primary">Add to MMT</button>
        </form>
      </div>`;

    const form = this.overlayEl.querySelector('#mmt-enrol-form') as HTMLFormElement;
    const existing = this.overlayEl.querySelector('#mmt-existing') as HTMLSelectElement | null;
    const newFields = this.overlayEl.querySelector('#mmt-new-fields') as HTMLElement;
    existing?.addEventListener('change', () => { newFields.hidden = existing.value !== ''; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = this.overlayEl.querySelector('#mmt-enrol-error') as HTMLElement;
      err.textContent = '';
      const get = (n: string) => (form.elements.namedItem(n) as HTMLInputElement).value.trim();
      const existingId = existing?.value || '';
      if (!existingId && (!get('name') || !get('ic'))) {
        err.textContent = 'Enter a name and IC number, or choose an existing patient.';
        return;
      }
      const doseRaw = get('dose');
      const message = await this.onSubmit!({
        existingId: existingId || undefined,
        name: get('name'),
        icNumber: get('ic'),
        phone: get('phone'),
        startDate: get('start'),
        doseMg: doseRaw === '' ? undefined : Number(doseRaw),
        dispensing: get('disp') as MMTDispensing
      });
      if (message) err.textContent = message;
      else this.close();
    });

    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');
  }

  public close(): void {
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');
  }
}
