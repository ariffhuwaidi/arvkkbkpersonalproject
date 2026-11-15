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
      <div class="msg-gen-header">
        <h3 class="msg-gen-title">Message Generator</h3>
        <p class="msg-gen-desc">Create ready-to-send patient messages for WhatsApp and SMS.</p>
      </div>

      <!-- Template Selection Pills -->
      <div class="msg-template-chips" role="radiogroup" aria-label="Select Message Template">
        <button type="button" class="template-chip is-active" data-tpl="blood_collection">Blood Collection</button>
        <button type="button" class="template-chip" data-tpl="tca_reschedule">TCA Rescheduling</button>
        <button type="button" class="template-chip" data-tpl="tca_reminder">TCA Reminder</button>
        <button type="button" class="template-chip" data-tpl="missed_appointment">Missed Appointment</button>
        <button type="button" class="template-chip" data-tpl="general_followup">General Follow-up</button>
        <button type="button" class="template-chip" data-tpl="custom">Custom Message</button>
      </div>

      <!-- Tone Selection -->
      <div class="msg-tone-section">
        <label class="form-label" style="margin-bottom: 6px;">Message Tone</label>
        <div class="segmented-control" id="msg-tone-control" role="radiogroup">
          <button type="button" class="segment-btn is-active" data-tone="polite">Polite</button>
          <button type="button" class="segment-btn" data-tone="friendly">Friendly</button>
          <button type="button" class="segment-btn" data-tone="formal">Formal</button>
        </div>
      </div>

      <!-- Dynamic Form Fields -->
      <div class="msg-inputs-form" id="msg-inputs-form"></div>

      <!-- Message Preview & Edit Area -->
      <div class="msg-preview-card">
        <div class="msg-preview-head">
          <span class="preview-badge">Live Message Preview</span>
          <span style="font-size: 11.5px; color: var(--color-text-tertiary);">Directly editable below</span>
        </div>
        <textarea id="msg-preview-text" class="msg-preview-textarea" rows="10" aria-label="Generated Message Preview"></textarea>

        <div class="msg-preview-actions">
          <button type="button" id="btn-msg-copy" class="btn-primary btn-msg-action">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Message</span>
          </button>

          <button type="button" id="btn-msg-whatsapp" class="btn-whatsapp btn-msg-action">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            <span>Open WhatsApp</span>
          </button>

          <button type="button" id="btn-msg-reset" class="btn-secondary btn-msg-action" style="font-weight: 500;">
            Reset
          </button>
        </div>
      </div>

      <!-- Privacy Notice -->
      <div class="msg-privacy-notice">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span>
          <strong>Patient Privacy Safeguard:</strong> Messages are generated 100% locally on this device without external AI. Never include HIV status, diagnosis, or sensitive medication regimens in patient messages.
        </span>
      </div>
    `;

    this.bindEvents();
    this.renderInputs();
    this.updatePreview();
  }

  private bindEvents(): void {
    // Template selection
    this.containerEl.querySelectorAll('.template-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.containerEl.querySelectorAll('.template-chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        const tpl = chip.getAttribute('data-tpl') as MessageTemplateType;
        this.currentInputs.templateType = tpl;
        this.renderInputs();
        this.updatePreview();
      });
    });

    // Tone selection
    const toneCtrl = this.containerEl.querySelector('#msg-tone-control');
    if (toneCtrl) {
      toneCtrl.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.segment-btn') as HTMLButtonElement;
        if (!btn) return;
        toneCtrl.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const tone = btn.getAttribute('data-tone') as MessageTone;
        this.currentInputs.tone = tone;
        this.updatePreview();
      });
    }

    // Copy message button
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

    // Open WhatsApp button (pre-fills message, does NOT auto-send)
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
          // Open WhatsApp web without specific phone so user can choose recipient
          window.open(`https://api.whatsapp.com/send?text=${encodedMsg}`, '_blank');
        }
      });
    }

    // Reset button
    const resetBtn = this.containerEl.querySelector('#btn-msg-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.currentInputs.patientName = '';
        this.currentInputs.phone = '';
        this.currentInputs.scheduledDate = '';
        this.currentInputs.oldDate = '';
        this.currentInputs.newDate = '';
        this.currentInputs.reason = 'keperluan klinikal';
        this.currentInputs.subject = '';
        this.currentInputs.instructions = '';
        this.currentInputs.customContent = '';
        this.renderInputs();
        this.updatePreview();
        toast.show('Fields reset to default');
      });
    }
  }

  private renderInputs(): void {
    const form = this.containerEl.querySelector('#msg-inputs-form') as HTMLElement;
    if (!form) return;

    const tpl = this.currentInputs.templateType;

    let html = `
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label" for="msg-inp-name">Patient Name (Optional)</label>
          <input type="text" id="msg-inp-name" class="form-input" placeholder="e.g. Encik Ahmad" value="${this.currentInputs.patientName || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="msg-inp-phone">Phone Number (Optional)</label>
          <input type="tel" id="msg-inp-phone" class="form-input" placeholder="e.g. 012-345 6789" value="${this.currentInputs.phone || ''}" />
        </div>
      </div>
    `;

    if (tpl === 'blood_collection') {
      html += `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label required" for="msg-inp-date">Blood Collection Date</label>
            <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="msg-inp-time">Time</label>
            <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || 'Sebelum 8.30 pagi'}" />
          </div>
        </div>
      `;
    } else if (tpl === 'tca_reschedule') {
      html += `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label required" for="msg-inp-old-date">Original Appointment Date</label>
            <input type="date" id="msg-inp-old-date" class="form-input" value="${this.currentInputs.oldDate || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label required" for="msg-inp-new-date">New Appointment Date</label>
            <input type="date" id="msg-inp-new-date" class="form-input" value="${this.currentInputs.newDate || ''}" />
          </div>
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label" for="msg-inp-time">Time</label>
            <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || '8.30 pagi'}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="msg-inp-reason">Reason for Rescheduling</label>
            <input type="text" id="msg-inp-reason" class="form-input" placeholder="e.g. pertukaran jadual klinik / cuti umum" value="${this.currentInputs.reason || 'keperluan klinikal'}" />
          </div>
        </div>
      `;
    } else if (tpl === 'tca_reminder') {
      html += `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label required" for="msg-inp-date">TCA Appointment Date</label>
            <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label" for="msg-inp-time">Time</label>
            <input type="text" id="msg-inp-time" class="form-input" value="${this.currentInputs.time || '8.30 pagi'}" />
          </div>
        </div>
      `;
    } else if (tpl === 'missed_appointment') {
      html += `
        <div class="form-group">
          <label class="form-label required" for="msg-inp-date">Missed Appointment Date</label>
          <input type="date" id="msg-inp-date" class="form-input" value="${this.currentInputs.scheduledDate || ''}" />
        </div>
      `;
    } else if (tpl === 'general_followup') {
      html += `
        <div class="form-group">
          <label class="form-label" for="msg-inp-subject">Subject</label>
          <input type="text" id="msg-inp-subject" class="form-input" placeholder="e.g. Susulan Pengambilan Ubat" value="${this.currentInputs.subject || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="msg-inp-instr">Instructions / Message Details</label>
          <textarea id="msg-inp-instr" class="form-textarea" rows="3" placeholder="Sila hadir ke kaunter farmasi...">${this.currentInputs.instructions || ''}</textarea>
        </div>
      `;
    } else if (tpl === 'custom') {
      html += `
        <div class="form-group">
          <label class="form-label" for="msg-inp-custom">Custom Message Content</label>
          <textarea id="msg-inp-custom" class="form-textarea" rows="4" placeholder="Tulis mesej klinikal di sini...">${this.currentInputs.customContent || ''}</textarea>
        </div>
      `;
    }

    form.innerHTML = html;

    // Attach listeners to input elements
    form.querySelectorAll('input, textarea').forEach(input => {
      input.addEventListener('input', () => {
        const id = input.id;
        const val = (input as HTMLInputElement | HTMLTextAreaElement).value;

        if (id === 'msg-inp-name') this.currentInputs.patientName = val;
        else if (id === 'msg-inp-phone') this.currentInputs.phone = val;
        else if (id === 'msg-inp-date') this.currentInputs.scheduledDate = val;
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
        // Polite (Default specified in prompt)
        return `${salutation}\n\nDimaklumkan bahawa pihak Klinik Kesihatan Bandar Kulim ingin memaklumkan kepada tuan/puan mengenai pengambilan darah pada:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\nLokasi: Klinik Kesihatan Bandar Kulim\n\nMohon tuan/puan hadir sebelum jam 8.30 pagi bagi melancarkan urusan pengambilan darah.\n\nTerima kasih atas kerjasama tuan/puan.\n\n${signature}`;

      case 'tca_reschedule':
        if (tone === 'friendly') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin memaklumkan bahawa temujanji tuan/puan pada ${formattedOldDate} perlu dijadualkan semula atas sebab ${formattedReason}.\n\nTarikh temujanji baharu: ${formattedNewDate}\nMasa: ${formattedTime}\n\nMohon maklum balas jika tarikh baharu ini bersesuaian dengan pihak tuan/puan. Segala kesulitan amat dikesali.\n\nTerima kasih banyak atas kerjasama tuan/puan.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nAdalah dimaklumkan bahawa temujanji tuan/puan di Klinik Kesihatan Bandar Kulim yang dijadualkan pada ${formattedOldDate} terpaksa dipinda atas sebab ${formattedReason}.\n\nKetetapan tarikh temujanji baharu adalah seperti berikut:\nTarikh: ${formattedNewDate}\nMasa: ${formattedTime}\n\nTuan/puan dipohon membuat pengesahan kehadiran. Segala kesulitan yang timbul amatlah dikesali.\n\nSekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Prompt standard)
        return `${salutation}\n\nDimaklumkan bahawa temujanji tuan/puan di Klinik Kesihatan Bandar Kulim pada ${formattedOldDate} perlu dijadualkan semula kerana ${formattedReason}.\n\nTarikh temujanji baharu: ${formattedNewDate}\nMasa: ${formattedTime}\n\nMohon pengesahan dan kerjasama daripada pihak tuan/puan.\n\nSegala kesulitan amat dikesali.\n\nTerima kasih.\n\n${signature}`;

      case 'tca_reminder':
        if (tone === 'friendly') {
          return `${salutation}\n\nIni adalah peringatan mesra temujanji tuan/puan di Klinik Kesihatan Bandar Kulim:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nSemoga tuan/puan sentiasa sihat dan dapat hadir mengikut masa yang ditetapkan. Jika ada kesulitan, sila hubungi kami segera.\n\nTerima kasih.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin mengingatkan tuan/puan berkenaan temujanji rawatan susulan yang dijadualkan seperti berikut:\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nTuan/puan dimohon hadir mengikut ketetapan yang ditetapkan demi kelancaran rawatan.\n\nSekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Prompt standard)
        return `${salutation}\n\nIni merupakan peringatan mesra berkenaan temujanji tuan/puan di Klinik Kesihatan Bandar Kulim.\n\nTarikh: ${formattedDate}\nMasa: ${formattedTime}\n\nMohon hadir mengikut tarikh dan masa yang telah ditetapkan.\n\nTerima kasih.\n\n${signature}`;

      case 'missed_appointment':
        if (tone === 'friendly') {
          return `${salutation}\n\nPihak Klinik Kesihatan Bandar Kulim ingin menyemak keadaan tuan/puan susulan temujanji pada ${formattedDate}.\n\nKami amat prihatin dan ingin mengetahui sama ada tuan/puan berkesempatan untuk hadir bagi penetapan tarikh temujanji baharu yang sesuai.\n\nMohon hubungi atau balas mesej ini ya. Terima kasih.\n\n${signature}`;
        }
        if (tone === 'formal') {
          return `${salutation}\n\nMerujuk kepada rekod klinikal, tuan/puan didapati tidak dapat hadir pada temujanji yang dijadualkan pada ${formattedDate}.\n\nPihak Klinik Kesihatan Bandar Kulim memohon maklum balas pihak tuan/puan bagi urusan penjadualan semula temujanji pada kadar segera.\n\nPerhatian dan kerjasama tuan/puan amat dihargai. Sekian, terima kasih.\n\n${signature}`;
        }
        // Polite (Prompt standard)
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
