import type { PatientRecord, MMTProfile, MMTDispensing, MMTDoseStatus, UrineResult, AppointmentStatus } from '../types';
import { addDays, doseStatusOn, latestUrine, missedDays, nextReview, urineDue } from '../utils/mmt';
import { formatDisplayDate, getLocalTodayISO } from '../utils/date';
import { escapeHtml } from '../utils/escape';
import { toast } from './toast';

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export interface MMTModalHandlers {
  /** Saves the new MMT block and returns the saved record. */
  onChange: (record: PatientRecord, mmt: MMTProfile) => Promise<PatientRecord>;
  onRemoveFromMMT: (record: PatientRecord) => void;
}

/** Profile sheet for a patient's MMT enrolment: dose log, take-home, urine tests, reviews. */
export class MMTModal {
  private overlayEl: HTMLElement;
  private bodyEl: HTMLElement;
  private titleEl: HTMLElement;
  private record: PatientRecord | null = null;
  private handlers: MMTModalHandlers | null = null;

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-label', 'MMT profile');
    this.overlayEl.innerHTML = `
      <div class="bottom-sheet" style="max-width: 560px; max-height: 92vh;">
        <div class="sheet-grab-bar"></div>
        <div class="sheet-header">
          <span class="sheet-title" id="mmt-title"></span>
          <button type="button" class="btn-icon" data-action="close" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="sheet-body" id="mmt-body"></div>
      </div>`;
    document.body.appendChild(this.overlayEl);
    this.bodyEl = this.overlayEl.querySelector('#mmt-body') as HTMLElement;
    this.titleEl = this.overlayEl.querySelector('#mmt-title') as HTMLElement;

    this.overlayEl.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.overlayEl || t.closest('[data-action="close"]')) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  public open(record: PatientRecord, handlers: MMTModalHandlers): void {
    this.record = record;
    this.handlers = handlers;
    this.render();
    document.body.classList.add('modal-open');
    this.overlayEl.classList.add('is-open');
  }

  public close(): void {
    document.body.classList.remove('modal-open');
    this.overlayEl.classList.remove('is-open');
  }

  public isOpen(): boolean {
    return this.overlayEl.classList.contains('is-open');
  }

  /** Re-draw with fresher data, keeping the scroll position. */
  public refresh(record: PatientRecord): void {
    this.record = record;
    if (this.isOpen()) this.render();
  }

  private async commit(mutator: (m: MMTProfile) => void, message: string): Promise<void> {
    if (!this.record || !this.handlers || !this.record.mmt) return;
    const next: MMTProfile = JSON.parse(JSON.stringify(this.record.mmt));
    mutator(next);
    next.updatedAt = new Date().toISOString();
    try {
      const saved = await this.handlers.onChange(this.record, next);
      this.refresh(saved);
      toast.show(message);
    } catch (err: any) {
      toast.show(`Could not save: ${err?.message || 'error'}`);
    }
  }

  private render(): void {
    const rec = this.record!;
    const mmt = rec.mmt!;
    const today = getLocalTodayISO();
    const scroll = this.bodyEl.scrollTop;
    this.titleEl.textContent = rec.name;

    const todayStatus = doseStatusOn(mmt, today);
    const missed = missedDays(mmt, today);
    const review = nextReview(mmt);
    const urine = latestUrine(mmt);

    const doseLog = [...mmt.doseLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
    const history = [...mmt.doseHistory].sort((a, b) => b.date.localeCompare(a.date));
    const takeHomes = [...mmt.takeHomes].sort((a, b) => b.startDate.localeCompare(a.startDate));
    const urines = [...mmt.urineTests].sort((a, b) => b.date.localeCompare(a.date));
    const reviews = [...mmt.reviews].sort((a, b) => b.date.localeCompare(a.date));

    const defaultDose = mmt.currentDoseMg !== undefined ? String(mmt.currentDoseMg) : '';

    this.bodyEl.innerHTML = `
      <div class="mmt-sheet">
        <div class="mmt-summary">
          <div><span class="mmt-k">IC</span><span class="mmt-v">${escapeHtml(rec.icNumber)}</span></div>
          <div><span class="mmt-k">Dose</span><span class="mmt-v">${mmt.currentDoseMg !== undefined ? `${escapeHtml(mmt.currentDoseMg)} mg` : 'Not set'}</span></div>
          <div><span class="mmt-k">Today</span><span class="mmt-v">${escapeHtml(todayStatus ?? 'Not yet dispensed')}</span></div>
          <div><span class="mmt-k">Missed</span><span class="mmt-v">${missed} ${missed === 1 ? 'day' : 'days'}</span></div>
          <div><span class="mmt-k">Next review</span><span class="mmt-v">${review ? formatDisplayDate(review.date) : 'None'}</span></div>
          <div><span class="mmt-k">Last urine</span><span class="mmt-v">${urine ? `${formatDisplayDate(urine.date)} (${escapeHtml(urine.result)})` : 'None'}${urineDue(mmt, today) ? ' · due' : ''}</span></div>
        </div>

        <section class="mmt-section">
          <h3 class="mmt-h">Daily dose</h3>
          <form class="mmt-form" data-form="dose">
            <label class="pp-label">Date</label>
            <input class="form-input" type="date" name="date" value="${today}" required />
            <label class="pp-label">Result</label>
            <select class="form-input" name="status">
              <option value="Dispensed">Dispensed</option>
              <option value="Missed">Missed</option>
            </select>
            <label class="pp-label">Dose (mg)</label>
            <input class="form-input" type="number" name="dose" step="any" min="0" inputmode="decimal" value="${escapeHtml(defaultDose)}" />
            <button type="submit" class="btn-primary">Log dose</button>
          </form>
          ${doseLog.length ? `<ul class="mmt-list">${doseLog.map(e => `
            <li><span>${formatDisplayDate(e.date)}</span><span>${escapeHtml(e.status)}${e.doseMg !== undefined ? ` · ${escapeHtml(e.doseMg)} mg` : ''}</span>
            <button type="button" class="mmt-del" data-del-dose="${escapeHtml(e.date)}" aria-label="Remove entry">Remove</button></li>`).join('')}</ul>` : '<p class="mmt-empty">No doses logged yet.</p>'}
        </section>

        <section class="mmt-section">
          <h3 class="mmt-h">Dispensing and dose</h3>
          <div class="segmented-control" id="mmt-mode" role="radiogroup" aria-label="Dispensing mode">
            ${(['Daily', 'Take-home'] as MMTDispensing[]).map(m => `<button type="button" role="radio" class="segment-btn ${mmt.dispensing === m ? 'is-active' : ''}" aria-checked="${mmt.dispensing === m}" data-mode="${m}">${m === 'Daily' ? 'Daily dispensing' : 'Take-home'}</button>`).join('')}
          </div>
          <details class="mmt-add"><summary>Change dose</summary>
          <form class="mmt-form" data-form="dosechange">
            <label class="pp-label">Change dose from</label>
            <input class="form-input" type="date" name="date" value="${today}" required />
            <label class="pp-label">New dose (mg)</label>
            <input class="form-input" type="number" name="dose" step="any" min="0" inputmode="decimal" required />
            <label class="pp-label">Reason (optional)</label>
            <input class="form-input" type="text" name="reason" autocomplete="off" />
            <button type="submit" class="btn-secondary" style="font-weight:600;">Save dose change</button>
          </form>
          </details>
          ${history.length ? `<ul class="mmt-list">${history.map(h => `<li><span>${formatDisplayDate(h.date)}</span><span>${escapeHtml(h.doseMg)} mg${h.reason ? ` · ${escapeHtml(h.reason)}` : ''}</span></li>`).join('')}</ul>` : ''}
        </section>

        <section class="mmt-section">
          <h3 class="mmt-h">Take-home supply</h3>
          <details class="mmt-add"><summary>Add take-home supply</summary>
          <form class="mmt-form" data-form="takehome">
            <label class="pp-label">Starts</label>
            <input class="form-input" type="date" name="start" value="${today}" required />
            <label class="pp-label">Days of supply</label>
            <input class="form-input" type="number" name="days" min="1" max="60" inputmode="numeric" required />
            <label class="pp-label">Dose per day (mg)</label>
            <input class="form-input" type="number" name="dose" step="any" min="0" inputmode="decimal" value="${escapeHtml(defaultDose)}" />
            <button type="submit" class="btn-secondary" style="font-weight:600;">Add take-home</button>
          </form>
          </details>
          ${takeHomes.length ? `<ul class="mmt-list">${takeHomes.map(t => `
            <li><span>${formatDisplayDate(t.startDate)} to ${formatDisplayDate(addDays(t.startDate, t.days - 1))}</span><span>${escapeHtml(t.days)} ${t.days === 1 ? 'day' : 'days'}${t.doseMg !== undefined ? ` · ${escapeHtml(t.doseMg)} mg` : ''}</span>
            <button type="button" class="mmt-del" data-del-th="${escapeHtml(t.id)}">Remove</button></li>`).join('')}</ul>` : ''}
        </section>

        <section class="mmt-section">
          <h3 class="mmt-h">Urine tests</h3>
          <details class="mmt-add"><summary>Add urine test</summary>
          <form class="mmt-form" data-form="urine">
            <label class="pp-label">Date</label>
            <input class="form-input" type="date" name="date" value="${today}" required />
            <label class="pp-label">Result</label>
            <select class="form-input" name="result">
              <option value="Negative">Negative</option><option value="Positive">Positive</option><option value="Pending">Pending</option>
            </select>
            <label class="pp-label">Substances or notes (optional)</label>
            <input class="form-input" type="text" name="substances" autocomplete="off" />
            <button type="submit" class="btn-secondary" style="font-weight:600;">Add urine test</button>
          </form>
          </details>
          ${urines.length ? `<ul class="mmt-list">${urines.map(u => `
            <li><span>${formatDisplayDate(u.date)}</span><span>${escapeHtml(u.result)}${u.substances ? ` · ${escapeHtml(u.substances)}` : ''}</span>
            <span class="mmt-row-actions">${u.result === 'Pending' ? `<button type="button" class="mmt-act" data-urine-set="${escapeHtml(u.id)}:Negative">Negative</button><button type="button" class="mmt-act" data-urine-set="${escapeHtml(u.id)}:Positive">Positive</button>` : ''}<button type="button" class="mmt-del" data-del-urine="${escapeHtml(u.id)}">Remove</button></span></li>`).join('')}</ul>` : ''}
        </section>

        <section class="mmt-section">
          <h3 class="mmt-h">Review</h3>
          <details class="mmt-add"><summary>Schedule a review</summary>
          <form class="mmt-form" data-form="review">
            <label class="pp-label">Next review date</label>
            <input class="form-input" type="date" name="date" min="${today}" required />
            <button type="submit" class="btn-secondary" style="font-weight:600;">Schedule review</button>
          </form>
          </details>
          ${reviews.length ? `<ul class="mmt-list">${reviews.map(r => `
            <li><span>${formatDisplayDate(r.date)}</span><span>${escapeHtml(r.status)}</span>
            <span class="mmt-row-actions">${r.status === 'Scheduled' ? `<button type="button" class="mmt-act" data-review-set="${escapeHtml(r.id)}:Attended">Attended</button><button type="button" class="mmt-act" data-review-set="${escapeHtml(r.id)}:DNA">DNA</button>` : ''}<button type="button" class="mmt-del" data-del-review="${escapeHtml(r.id)}">Remove</button></span></li>`).join('')}</ul>` : ''}
        </section>

        <section class="mmt-section">
          <h3 class="mmt-h">Notes</h3>
          <textarea class="form-input" id="mmt-notes" rows="3" style="min-height: 84px;">${escapeHtml(mmt.notes || '')}</textarea>
          <button type="button" class="btn-secondary" id="mmt-save-notes" style="font-weight:600; margin-top: 8px;">Save notes</button>
        </section>

        <section class="mmt-section">
          <button type="button" class="btn-secondary" id="mmt-remove" style="font-weight:600; color: var(--color-destructive); width: 100%;">Remove from MMT</button>
        </section>
      </div>`;

    this.bodyEl.scrollTop = scroll;
    this.bindForms();
  }

  private bindForms(): void {
    const body = this.bodyEl;
    const val = (f: HTMLFormElement, n: string) => (f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement).value.trim();
    const numOrUndef = (s: string) => (s === '' ? undefined : Number(s));

    body.querySelectorAll('form[data-form]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = e.target as HTMLFormElement;
        const kind = f.getAttribute('data-form');

        if (kind === 'dose') {
          const date = val(f, 'date');
          const status = val(f, 'status') as MMTDoseStatus;
          const dose = numOrUndef(val(f, 'dose'));
          void this.commit(m => {
            m.doseLog = m.doseLog.filter(x => x.date !== date);
            m.doseLog.push({ date, status, doseMg: status === 'Dispensed' ? dose : undefined });
          }, status === 'Dispensed' ? 'Dose logged' : 'Missed dose logged');
        } else if (kind === 'dosechange') {
          const date = val(f, 'date');
          const dose = Number(val(f, 'dose'));
          const reason = val(f, 'reason');
          void this.commit(m => {
            m.doseHistory.push({ id: uid('dose'), date, doseMg: dose, reason: reason || undefined });
            m.currentDoseMg = dose;
          }, `Dose set to ${dose} mg`);
        } else if (kind === 'takehome') {
          const start = val(f, 'start');
          const days = Math.max(1, Math.min(60, Math.round(Number(val(f, 'days')))));
          const dose = numOrUndef(val(f, 'dose'));
          void this.commit(m => {
            m.takeHomes.push({ id: uid('th'), startDate: start, days, doseMg: dose });
          }, 'Take-home added');
        } else if (kind === 'urine') {
          void this.commit(m => {
            m.urineTests.push({ id: uid('urine'), date: val(f, 'date'), result: val(f, 'result') as UrineResult, substances: val(f, 'substances') || undefined });
          }, 'Urine test added');
        } else if (kind === 'review') {
          const date = val(f, 'date');
          const now = new Date().toISOString();
          void this.commit(m => {
            m.reviews.push({ id: uid('rev'), date, status: 'Scheduled', createdAt: now, updatedAt: now });
          }, 'Review scheduled');
        }
      });
    });

    body.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as MMTDispensing;
        if (this.record?.mmt?.dispensing === mode) return;
        void this.commit(m => { m.dispensing = mode; }, `Dispensing: ${mode === 'Daily' ? 'daily' : 'take-home'}`);
      });
    });

    const on = (attr: string, fn: (v: string) => void) =>
      body.querySelectorAll(`[${attr}]`).forEach(b => b.addEventListener('click', () => fn(b.getAttribute(attr) || '')));

    on('data-del-dose', d => void this.commit(m => { m.doseLog = m.doseLog.filter(x => x.date !== d); }, 'Entry removed'));
    on('data-del-th', id => void this.commit(m => { m.takeHomes = m.takeHomes.filter(x => x.id !== id); }, 'Take-home removed'));
    on('data-del-urine', id => void this.commit(m => { m.urineTests = m.urineTests.filter(x => x.id !== id); }, 'Urine test removed'));
    on('data-del-review', id => void this.commit(m => { m.reviews = m.reviews.filter(x => x.id !== id); }, 'Review removed'));
    on('data-urine-set', v => {
      const [id, result] = v.split(':');
      void this.commit(m => { const u = m.urineTests.find(x => x.id === id); if (u) u.result = result as UrineResult; }, `Result: ${result}`);
    });
    on('data-review-set', v => {
      const [id, status] = v.split(':');
      void this.commit(m => {
        const r = m.reviews.find(x => x.id === id);
        if (r) { r.status = status as AppointmentStatus; r.updatedAt = new Date().toISOString(); }
      }, `Review marked ${status}`);
    });

    (body.querySelector('#mmt-save-notes') as HTMLElement).addEventListener('click', () => {
      const notes = (body.querySelector('#mmt-notes') as HTMLTextAreaElement).value.trim();
      void this.commit(m => { m.notes = notes || undefined; }, 'Notes saved');
    });

    (body.querySelector('#mmt-remove') as HTMLElement).addEventListener('click', async () => {
      if (!this.record) return;
      const rec = this.record;
      this.close();
      this.handlers?.onRemoveFromMMT(rec);
    });
  }
}
