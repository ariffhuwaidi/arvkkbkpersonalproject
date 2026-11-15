import type {
  MessageTemplateType,
  MessageTone,
  MessageGeneratorInputs
} from '../types';
import { formatDisplayDate } from '../utils/date';
import { toast } from './toast';

export class MessageGenerator {
  private containerEl: HTMLElement;
  private currentInputs: MessageGeneratorInputs = {
    templateType: 'blood_collection',
    tone: 'polite',
    time: 'Sebelum 8.30 pagi',
    reason: 'keperluan klinikal',
    signature: 'MA Ariff\nKlinik Kesihatan Bandar Kulim'
  };

  constructor() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'message-generator-view';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.containerEl;
  }

  private render(): void {
    this.containerEl.innerHTML = `
      <!-- Section 1: Message Configuration (iOS Inset Group) -->
      <section class="msg-card-section" aria-label="Message Configuration">
        <div class="msg-section-header">
          <span class="msg-section-title">Message Configuration</span>
          <span class="msg-section-subtitle">Type & Tone</span>
        </div>

        <div class="msg-form-grid">
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-select-template">
              <span>Message Type</span>
            </label>
            <div class="select-wrapper">
              <select id="msg-select-template" class="form-select ios-select" aria-label="Select Message Type">
                <option value="blood_collection">Blood Collection Appointment</option>
                <option value="tca_reschedule">TCA Rescheduling</option>
                <option value="tca_reminder">TCA Reminder</option>
                <option value="missed_appointment">Missed Appointment Follow-up</option>
                <option value="general_followup">General Follow-up</option>
                <option value="custom">Custom Message</option>
              </select>
              <span class="select-chevron" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </div>
          </div>

          <div class="msg-field-group">
            <label class="msg-field-label">
              <span>Message Tone</span>
            </label>
            <div class="segmented-control" id="msg-tone-control" role="radiogroup" aria-label="Message Tone">
              <button type="button" class="segment-btn ${this.currentInputs.tone === 'polite' ? 'is-active' : ''}" data-tone="polite" role="radio" aria-checked="${this.currentInputs.tone === 'polite'}">Polite</button>
              <button type="button" class="segment-btn ${this.currentInputs.tone === 'friendly' ? 'is-active' : ''}" data-tone="friendly" role="radio" aria-checked="${this.currentInputs.tone === 'friendly'}">Friendly</button>
              <button type="button" class="segment-btn ${this.currentInputs.tone === 'formal' ? 'is-active' : ''}" data-tone="formal" role="radio" aria-checked="${this.currentInputs.tone === 'formal'}">Formal</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Section 2: Patient Details (Optional, Clean Layout) -->
      <section class="msg-card-section" aria-label="Patient Details">
        <div class="msg-section-header">
          <span class="msg-section-title">Patient Details</span>
          <span class="msg-section-subtitle">Personalization</span>
        </div>

        <div class="msg-form-grid msg-form-grid-2">
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-name">
              <span>Patient Name</span>
              <span class="msg-field-optional">(Optional)</span>
            </label>
            <input
              type="text"
              id="msg-inp-name"
              class="form-input"
              placeholder="e.g. Encik Ahmad"
              value="${this.currentInputs.patientName || ''}"
              autocomplete="name"
            />
          </div>

          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-phone">
              <span>WhatsApp / Phone</span>
              <span class="msg-field-optional">(Optional)</span>
            </label>
            <input
              type="tel"
              id="msg-inp-phone"
              class="form-input"
              placeholder="e.g. 012-345 6789"
              value="${this.currentInputs.phone || ''}"
              autocomplete="tel"
            />
          </div>
        </div>
      </section>

      <!-- Section 3: Appointment / Clinical Details (Dynamic Fields) -->
      <section class="msg-card-section" id="msg-appointment-section" aria-label="Appointment Details">
        <div class="msg-section-header">
          <span class="msg-section-title" id="msg-apt-section-title">Appointment Details</span>
          <span class="msg-section-subtitle">Specifics</span>
        </div>
        <div id="msg-dynamic-fields" class="msg-form-grid"></div>
      </section>

      <!-- Section 4: Message Preview & Actions (Full Width Textarea) -->
      <section class="msg-card-section" aria-label="Message Preview">
        <div class="msg-section-header">
          <span class="msg-section-title">Message Preview</span>
          <span class="msg-section-subtitle" style="color: var(--color-accent); font-weight: 500;">Directly Editable</span>
        </div>

        <div class="msg-preview-container">
          <textarea
            id="msg-preview-text"
            class="msg-preview-textarea"
            rows="10"
            aria-label="Generated Patient Message"
            placeholder="Generated message will appear here..."
          ></textarea>

          <div class="msg-actions-grid">
            <button type="button" id="btn-msg-copy" class="btn-primary btn-msg-copy">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy Message</span>
            </button>

            <button type="button" id="btn-msg-whatsapp" class="btn-whatsapp btn-msg-whatsapp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
              <span>Open WhatsApp</span>
            </button>

            <button type="button" id="btn-msg-reset" class="btn-secondary btn-msg-reset">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span>Reset</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Section 5: Clinical Privacy Notice -->
      <div class="msg-privacy-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; margin-top: 2px;">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <div>
          <strong>Patient Privacy Safeguard:</strong> Messages are generated 100% locally on your device without external AI or third-party servers. Never mention HIV status, diagnosis, or sensitive medication regimens in patient communications.
        </div>
      </div>
    `;

    this.bindEvents();
    this.renderDynamicFields();
    this.updatePreview();
  }

  private bindEvents(): void {
    // 1. Message Type Dropdown
    const selectEl = this.containerEl.querySelector('#msg-select-template') as HTMLSelectElement;
    if (selectEl) {
      selectEl.value = this.currentInputs.templateType;
      selectEl.addEventListener('change', () => {
        this.currentInputs.templateType = selectEl.value as MessageTemplateType;
        this.renderDynamicFields();
        this.updatePreview();
      });
    }

    // 2. Message Tone Segmented Control
    const toneCtrl = this.containerEl.querySelector('#msg-tone-control');
    if (toneCtrl) {
      toneCtrl.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.segment-btn') as HTMLButtonElement;
        if (!btn) return;
        toneCtrl.querySelectorAll('.segment-btn').forEach(b => {
          b.classList.remove('is-active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-checked', 'true');
        this.currentInputs.tone = btn.getAttribute('data-tone') as MessageTone;
        this.updatePreview();
      });
    }

    // 3. Patient Details input listeners
    const nameInput = this.containerEl.querySelector('#msg-inp-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        this.currentInputs.patientName = nameInput.value;
        this.updatePreview();
      });
    }

    const phoneInput = this.containerEl.querySelector('#msg-inp-phone') as HTMLInputElement;
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        this.currentInputs.phone = phoneInput.value;
      });
    }

    // 4. Copy Message Action
    const copyBtn = this.containerEl.querySelector('#btn-msg-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const textarea = this.containerEl.querySelector('#msg-preview-text') as HTMLTextAreaElement;
        if (textarea && textarea.value) {
          try {
            await navigator.clipboard.writeText(textarea.value);
            toast.show('Message copied to clipboard');
          } catch {
            textarea.select();
            document.execCommand('copy');
            toast.show('Message copied to clipboard');
          }
        }
      });
    }

    // 5. Open WhatsApp Action
    const waBtn = this.containerEl.querySelector('#btn-msg-whatsapp');
    if (waBtn) {
      waBtn.addEventListener('click', () => {
        const textarea = this.containerEl.querySelector('#msg-preview-text') as HTMLTextAreaElement;
        const phone = this.currentInputs.phone ? this.currentInputs.phone.replace(/[^0-9]/g, '') : '';
        const encodedMsg = encodeURIComponent(textarea.value || '');

        let formattedPhone = phone;
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '60' + formattedPhone.slice(1);
        }

        if (formattedPhone) {
          window.open(`https://wa.me/${formattedPhone}?text=${encodedMsg}`, '_blank');
        } else {
          window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
        }
      });
    }

    // 6. Reset Action
    const resetBtn = this.containerEl.querySelector('#btn-msg-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentInputs.patientName = '';
        this.currentInputs.phone = '';
        this.currentInputs.scheduledDate = '';
        this.currentInputs.oldDate = '';
        this.currentInputs.newDate = '';
        this.currentInputs.time = this.currentInputs.templateType === 'blood_collection' ? 'Sebelum 8.30 pagi' : '8.30 pagi';
        this.currentInputs.reason = 'keperluan klinikal';
        this.currentInputs.subject = '';
        this.currentInputs.instructions = '';
        this.currentInputs.customContent = '';

        const nameInp = this.containerEl.querySelector('#msg-inp-name') as HTMLInputElement;
        if (nameInp) nameInp.value = '';
        const phoneInp = this.containerEl.querySelector('#msg-inp-phone') as HTMLInputElement;
        if (phoneInp) phoneInp.value = '';

        this.renderDynamicFields();
        this.updatePreview();
        toast.show('Message fields reset');
      });
    }
  }

  /**
   * Renders only fields relevant to the selected message type.
   */
  private renderDynamicFields(): void {
    const fieldsContainer = this.containerEl.querySelector('#msg-dynamic-fields') as HTMLElement;
    const titleEl = this.containerEl.querySelector('#msg-apt-section-title') as HTMLElement;
    if (!fieldsContainer) return;

    const tpl = this.currentInputs.templateType;

    if (tpl === 'blood_collection') {
      if (titleEl) titleEl.textContent = 'Blood Collection Details';
      fieldsContainer.className = 'msg-form-grid msg-form-grid-2';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-date">
            <span>Blood Collection Date</span>
          </label>
          <div class="date-input-container">
            <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
          </div>
        </div>
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-time">
            <span>Arrival Time</span>
          </label>
          <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || 'Sebelum 8.30 pagi'}" placeholder="e.g. Sebelum 8.30 pagi" />
        </div>
      `;
    } else if (tpl === 'tca_reschedule') {
      if (titleEl) titleEl.textContent = 'TCA Rescheduling Details';
      fieldsContainer.className = 'msg-form-grid';
      fieldsContainer.innerHTML = `
        <div class="msg-form-grid msg-form-grid-2" style="margin-bottom: 0;">
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-old-date">
              <span>Original TCA Date</span>
            </label>
            <div class="date-input-container">
              <input type="date" id="msg-inp-old-date" class="form-input" value="${this.currentInputs.oldDate || ''}" />
            </div>
          </div>
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-new-date">
              <span>New TCA Date</span>
            </label>
            <div class="date-input-container">
              <input type="date" id="msg-inp-new-date" class="form-input" value="${this.currentInputs.newDate || ''}" />
            </div>
          </div>
        </div>

        <div class="msg-form-grid msg-form-grid-2">
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-time">
              <span>Time</span>
            </label>
            <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || '8.30 pagi'}" placeholder="e.g. 8.30 pagi" />
          </div>
          <div class="msg-field-group">
            <label class="msg-field-label" for="msg-inp-reason">
              <span>Reason for Rescheduling</span>
            </label>
            <input type="text" id="msg-inp-reason" class="form-input" placeholder="e.g. keperluan klinikal / cuti umum" value="${this.currentInputs.reason || 'keperluan klinikal'}" />
          </div>
        </div>
      `;
    } else if (tpl === 'tca_reminder') {
      if (titleEl) titleEl.textContent = 'TCA Reminder Details';
      fieldsContainer.className = 'msg-form-grid msg-form-grid-2';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-date">
            <span>TCA Appointment Date</span>
          </label>
          <div class="date-input-container">
            <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
          </div>
        </div>
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-time">
            <span>Appointment Time</span>
          </label>
          <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || '8.30 pagi'}" placeholder="e.g. 8.30 pagi" />
        </div>
      `;
    } else if (tpl === 'missed_appointment') {
      if (titleEl) titleEl.textContent = 'Missed Appointment Details';
      fieldsContainer.className = 'msg-form-grid';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-date">
            <span>Missed Appointment Date</span>
          </label>
          <div class="date-input-container">
            <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
          </div>
        </div>
      `;
    } else if (tpl === 'general_followup') {
      if (titleEl) titleEl.textContent = 'General Follow-up Details';
      fieldsContainer.className = 'msg-form-grid';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-subject">
            <span>Subject</span>
            <span class="msg-field-optional">(Optional)</span>
          </label>
          <input type="text" id="msg-inp-subject" class="form-input" placeholder="e.g. Susulan Pengambilan Ubat" value="${this.currentInputs.subject || ''}" />
        </div>
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-instr">
            <span>Instructions / Content</span>
          </label>
          <textarea id="msg-inp-instr" class="form-textarea" rows="3" placeholder="Sila hadir ke kaunter farmasi...">${this.currentInputs.instructions || ''}</textarea>
        </div>
      `;
    } else if (tpl === 'custom') {
      if (titleEl) titleEl.textContent = 'Custom Message Content';
      fieldsContainer.className = 'msg-form-grid';
      fieldsContainer.innerHTML = `
        <div class="msg-field-group">
          <label class="msg-field-label" for="msg-inp-custom">
            <span>Message Content</span>
          </label>
          <textarea id="msg-inp-custom" class="form-textarea" rows="4" placeholder="Tulis mesej klinikal di sini...">${this.currentInputs.customContent || ''}</textarea>
        </div>
      `;
    }

    // Bind event listeners to newly inserted input elements
    fieldsContainer.querySelectorAll('input, textarea').forEach(inp => {
      inp.addEventListener('input', () => {
        const id = inp.id;
        const val = (inp as HTMLInputElement | HTMLTextAreaElement).value;

        if (id === 'msg-inp-date') this.currentInputs.scheduledDate = val;
        else if (id === 'msg-inp-old-date') this.currentInputs.oldDate = val;
        else if (id === 'msg-inp-new-date') this.currentInputs.newDate = val;
        else if (id === 'msg-inp-time') this.currentInputs.time = val;
        else if (id === 'msg-inp-reason') this.currentInputs.reason = val;
        else if (id === 'msg-inp-subject') this.currentInputs.subject = val;
        else if (id === 'msg-inp-instr') this.currentInputs.instructions = val;
        else if (id === 'msg-inp-custom') this.currentInputs.customContent = val;

        this.updatePreview();
      });
    });
  }

  private generateMessageText(): string {
    const { templateType, tone, patientName, scheduledDate, oldDate, newDate, time, reason, subject, instructions, customContent } = this.currentInputs;

    const formattedDate = scheduledDate ? formatDisplayDate(scheduledDate) : '[TARIKH]';
    const formattedOldDate = oldDate ? formatDisplayDate(oldDate) : '[TARIKH ASAL]';
    const formattedNewDate = newDate ? formatDisplayDate(newDate) : '[TARIKH BAHARU]';
    const formattedTime = time ? time.trim() : '8.30 pagi';
    const formattedReason = reason ? reason.trim() : 'keperluan klinikal';

    let salutation = 'Assalamualaikum / Salam sejahtera.';
    if (patientName && patientName.trim()) {
      if (tone === 'friendly') salutation = `Assalamualaikum / Salam mesra ${patientName.trim()}.`;
      else if (tone === 'formal') salutation = `Assalamualaikum dan Salam sejahtera kepada ${patientName.trim()}.`;
      else salutation = `Assalamualaikum / Salam sejahtera ${patientName.trim()}.`;
    } else {
      if (tone === 'friendly') salutation = 'Assalamualaikum / Salam mesra.';
      else if (tone === 'formal') salutation = 'Assalamualaikum dan Salam sejahtera.';
    }

    const signature = `MA Ariff\nKlinik Kesihatan Bandar Kulim`;

    switch (templateType) {
      case 'blood_collection':
        if (tone === 'friendly') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin mengingatkan berkenaan temujanji pengambilan darah tuan/puan pada:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\nLokasi: Klinik Kesihatan Bandar Kulim\n\nSemoga tuan/puan sentiasa sihat. Mohon hadir sebelum jam 8.30 pagi ya bagi melancarkan urusan pengambilan darah di makmal.\n\nTerima kasih banyak atas kerjasama tuan/puan.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nDengan segala hormatnya dimaklumkan bahawa pihak Klinik Kesihatan Bandar Kulim menetapkan temujanji pengambilan darah bagi pihak tuan/puan mengikut ketetapan berikut:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\nLokasi: Klinik Kesihatan Bandar Kulim\n\nSehubungan dengan itu, tuan/puan dipohon hadir sebelum jam 8.30 pagi bagi melancarkan prosedur klinikal berkenaan.\n\nKerjasama tuan/puan amat dihargai. Sekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Default)
        return `${salutation}\n\nDimaklumkan bahawa pihak Klinik Kesihatan Bandar Kulim ingin memaklumkan kepada tuan/puan mengenai pengambilan darah pada:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\nLokasi: Klinik Kesihatan Bandar Kulim\n\nMohon tuan/puan hadir sebelum jam 8.30 pagi bagi melancarkan urusan pengambilan darah.\n\nTerima kasih atas kerjasama tuan/puan.\n\n${signature}`;

      case 'tca_reschedule':
        if (tone === 'friendly') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin memaklumkan bahawa temujanji tuan/puan pada ${formattedOldDate} perlu dijadualkan semula atas sebab ${formattedReason}.\n\nTarikh temujanji baharu: ${formattedNewDate}\nMasa: ${formattedTime}\n\nMohon maklum balas jika tarikh baharu ini bersesuaian dengan pihak tuan/puan. Segala kesulitan amat dikesali.\n\nTerima kasih banyak atas kerjasama tuan/puan.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nAdalah dimaklumkan bahawa temujanji tuan/puan di Klinik Kesihatan Bandar Kulim yang dijadualkan pada ${formattedOldDate} terpaksa dipinda atas sebab ${formattedReason}.\n\nKetetapan tarikh temujanji baharu adalah seperti berikut:\nTarikh: ${formattedNewDate}\nMasa: ${formattedTime}\n\nTuan/puan dipohon membuat pengesahan kehadiran. Segala kesulitan yang timbul amatlah dikesali.\n\nSekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Default)
        return `${salutation}\n\nDimaklumkan bahawa temujanji tuan/puan di Klinik Kesihatan Bandar Kulim pada ${formattedOldDate} perlu dijadualkan semula kerana ${formattedReason}.\n\nTarikh temujanji baharu: ${formattedNewDate}\nMasa: ${formattedTime}\n\nMohon pengesahan dan kerjasama daripada pihak tuan/puan.\n\nSegala kesulitan amat dikesali.\n\nTerima kasih.\n\n${signature}`;

      case 'tca_reminder':
        if (tone === 'friendly') {
          return `${salutation}\n\nIni adalah peringatan mesra temujanji tuan/puan di Klinik Kesihatan Bandar Kulim:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nSemoga tuan/puan sentiasa sihat dan dapat hadir mengikut masa yang ditetapkan. Jika ada kesulitan, sila hubungi kami segera.\n\nTerima kasih.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin mengingatkan tuan/puan berkenaan temujanji rawatan susulan yang dijadualkan seperti berikut:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nTuan/puan dimohon hadir mengikut ketetapan yang ditetapkan demi kelancaran rawatan.\n\nSekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Default)
        return `${salutation}\n\nIni merupakan peringatan mesra berkenaan temujanji tuan/puan di Klinik Kesihatan Bandar Kulim.\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nMohon hadir mengikut tarikh dan masa yang telah ditetapkan.\n\nTerima kasih.\n\n${signature}`;

      case 'missed_appointment':
        if (tone === 'friendly') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin menyemak keadaan tuan/puan susulan temujanji pada ${formattedDate}.\n\nKami amat prihatin dan ingin mengetahui sama ada tuan/puan berkesempatan untuk hadir bagi penetapan tarikh temujanji baharu yang sesuai.\n\nMohon hubungi atau balas mesej ini ya. Terima kasih.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nMerujuk kepada rekod klinikal, tuan/puan didapati tidak dapat hadir pada temujanji yang dijadualkan pada ${formattedDate}.\n\nPihak Klinik Kesihatan Bandar Kulim memohon maklum balas pihak tuan/puan bagi urusan penjadualan semula temujanji pada kadar segera.\n\nPerhatian dan kerjasama tuan/puan amat dihargai. Sekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Default)
        return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin membuat susulan berkenaan temujanji tuan/puan pada ${formattedDate}.\n\nKami ingin mengetahui sama ada tuan/puan berkesempatan untuk hadir bagi penjadualan semula temujanji.\n\nMohon maklum balas daripada pihak tuan/puan.\n\nTerima kasih.\n\n${signature}`;

      case 'general_followup':
        const subjText = subject ? `Perkara: ${subject}\n\n` : '';
        const instrText = instructions ? `${instructions}\n\n` : '';
        return `${salutation}\n\n${subjText}Pihak Klinik Kesihatan Bandar Kulim ingin membuat susulan bersama pihak tuan/puan.\n\n${instrText}Mohon pihak tuan/puan mengambil maklum berkenaan maklumat di atas. Jika terdapat sebarang pertanyaan, sila hubungi pihak klinik.\n\nTerima kasih atas kerjasama tuan/puan.\n\n${signature}`;

      case 'custom':
        const body = customContent && customContent.trim()
          ? customContent.trim()
          : 'Sila masukkan mesej klinikal di sini.';
        return `${salutation}\n\n${body}\n\n${signature}`;

      default:
        return '';
    }
  }

  private updatePreview(): void {
    const textarea = this.containerEl.querySelector('#msg-preview-text') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = this.generateMessageText();
    }
  }
}
