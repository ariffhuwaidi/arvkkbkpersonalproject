import {
  getAutoLockSeconds,
  getPinLength,
  hasPin,
  lockoutSecondsRemaining,
  verifyPin
} from '../utils/app-lock';

/**
 * Full-screen PIN lock plus a privacy cover.
 *
 * - The lock hides the whole app (`body.is-locked`) until the correct PIN is entered.
 * - The cover is shown the moment the page is hidden, so the iOS app switcher
 *   snapshot never contains patient names.
 * - Returning after the auto-lock delay brings the lock back.
 */
export class LockScreen {
  private lockEl: HTMLElement;
  private coverEl: HTMLElement;
  private dotsEl: HTMLElement;
  private errorEl: HTMLElement;
  private subEl: HTMLElement;
  private keypadEl: HTMLElement;
  private helpEl: HTMLElement;

  private entered = '';
  private busy = false;
  private locked = false;
  private hiddenAt = 0;
  private countdownTimer: number | null = null;
  private onUnlock: () => void;

  constructor(onUnlock: () => void) {
    this.onUnlock = onUnlock;

    this.coverEl = document.createElement('div');
    this.coverEl.className = 'privacy-cover';
    this.coverEl.setAttribute('aria-hidden', 'true');
    this.coverEl.innerHTML = `<span class="privacy-cover-title">ARV KKBK</span>`;
    document.body.appendChild(this.coverEl);

    this.lockEl = document.createElement('div');
    this.lockEl.className = 'lock-screen';
    this.lockEl.setAttribute('role', 'dialog');
    this.lockEl.setAttribute('aria-modal', 'true');
    this.lockEl.setAttribute('aria-labelledby', 'lock-title');
    this.lockEl.innerHTML = `
      <div class="lock-card">
        <h2 class="lock-title" id="lock-title">ARV KKBK</h2>
        <p class="lock-sub" id="lock-sub">Enter your PIN</p>
        <div class="lock-dots" aria-hidden="true"></div>
        <p class="lock-error" role="alert" aria-live="assertive"></p>
        <div class="lock-keypad" role="group" aria-label="PIN keypad"></div>
        <button type="button" class="lock-forgot" id="lock-forgot">Forgot PIN?</button>
        <p class="lock-help" id="lock-help" hidden>
          The PIN cannot be recovered. To reset it, clear this site's data in your browser settings,
          then restore your records from an encrypted backup. Data that was never backed up is lost.
        </p>
      </div>
    `;
    document.body.appendChild(this.lockEl);

    this.dotsEl = this.lockEl.querySelector('.lock-dots') as HTMLElement;
    this.errorEl = this.lockEl.querySelector('.lock-error') as HTMLElement;
    this.subEl = this.lockEl.querySelector('#lock-sub') as HTMLElement;
    this.keypadEl = this.lockEl.querySelector('.lock-keypad') as HTMLElement;
    this.helpEl = this.lockEl.querySelector('#lock-help') as HTMLElement;

    this.buildKeypad();
    this.bindEvents();
  }

  public isLocked(): boolean {
    return this.locked;
  }

  /** Locks right away if a PIN exists. Returns true when the lock was shown. */
  public lockIfNeeded(): boolean {
    if (!hasPin()) return false;
    this.lock();
    return true;
  }

  public lock(): void {
    if (!hasPin()) return;
    this.locked = true;
    this.entered = '';
    this.busy = false;
    this.renderDots();
    this.errorEl.textContent = '';
    this.subEl.textContent = 'Enter your PIN';
    this.helpEl.hidden = true;
    document.body.classList.add('is-locked');
    this.lockEl.classList.add('is-open');
    this.coverEl.classList.remove('is-visible');
    this.refreshThrottle();
    this.focusFirstKey();
  }

  private unlock(): void {
    this.locked = false;
    this.entered = '';
    document.body.classList.remove('is-locked');
    this.lockEl.classList.remove('is-open');
    this.coverEl.classList.remove('is-visible');
    this.onUnlock();
  }

  private buildKeypad(): void {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    this.keypadEl.innerHTML = keys
      .map(k => {
        if (k === '') return `<span class="lock-key-spacer"></span>`;
        if (k === 'del') {
          return `<button type="button" class="lock-key lock-key-del" data-key="del" aria-label="Delete last digit">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          </button>`;
        }
        return `<button type="button" class="lock-key" data-key="${k}">${k}</button>`;
      })
      .join('');
  }

  private renderDots(): void {
    const length = getPinLength();
    let html = '';
    for (let i = 0; i < length; i++) {
      html += `<span class="lock-dot ${i < this.entered.length ? 'is-filled' : ''}"></span>`;
    }
    this.dotsEl.innerHTML = html;
  }

  private focusFirstKey(): void {
    const first = this.keypadEl.querySelector('.lock-key') as HTMLButtonElement | null;
    if (first) window.setTimeout(() => first.focus({ preventScroll: true }), 30);
  }

  private bindEvents(): void {
    this.keypadEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.lock-key') as HTMLButtonElement | null;
      if (!btn) return;
      const key = btn.getAttribute('data-key');
      if (key === 'del') this.backspace();
      else if (key) this.pressDigit(key);
    });

    this.lockEl.addEventListener('keydown', (e) => {
      if (!this.locked) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        this.pressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        this.backspace();
      }
    });

    window.addEventListener('keydown', (e) => {
      // Desktop: allow typing without focusing a key first
      if (this.locked && /^\d$/.test(e.key) && !this.lockEl.contains(document.activeElement)) {
        this.pressDigit(e.key);
      }
    });

    (this.lockEl.querySelector('#lock-forgot') as HTMLElement).addEventListener('click', () => {
      this.helpEl.hidden = !this.helpEl.hidden;
    });

    // Privacy cover + auto-lock
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.onHidden();
      else this.onVisible();
    });
    window.addEventListener('pagehide', () => this.onHidden());
    window.addEventListener('pageshow', (e) => {
      if ((e as PageTransitionEvent).persisted) this.onVisible();
    });
  }

  private onHidden(): void {
    if (!hasPin()) return;
    if (!this.hiddenAt) this.hiddenAt = Date.now();
    if (!this.locked) this.coverEl.classList.add('is-visible');
  }

  private onVisible(): void {
    const away = this.hiddenAt ? Date.now() - this.hiddenAt : 0;
    this.hiddenAt = 0;
    if (!hasPin()) {
      this.coverEl.classList.remove('is-visible');
      return;
    }
    if (!this.locked && away >= getAutoLockSeconds() * 1000) {
      this.lock();
    } else {
      this.coverEl.classList.remove('is-visible');
    }
  }

  private pressDigit(digit: string): void {
    if (this.busy || lockoutSecondsRemaining() > 0) return;
    const length = getPinLength();
    if (this.entered.length >= length) return;
    this.entered += digit;
    this.errorEl.textContent = '';
    this.renderDots();
    if (this.entered.length === length) void this.submit();
  }

  private backspace(): void {
    if (this.busy) return;
    this.entered = this.entered.slice(0, -1);
    this.renderDots();
  }

  private async submit(): Promise<void> {
    this.busy = true;
    const pin = this.entered;
    const result = await verifyPin(pin);
    this.busy = false;

    if (result.ok) {
      this.unlock();
      return;
    }

    this.entered = '';
    this.renderDots();
    this.lockEl.classList.remove('is-shaking');
    void this.lockEl.offsetWidth; // restart the animation
    this.lockEl.classList.add('is-shaking');

    if (result.reason === 'throttled') {
      this.refreshThrottle();
    } else {
      const left = result.attemptsLeft;
      this.errorEl.textContent = left > 0
        ? `Incorrect PIN. ${left} ${left === 1 ? 'try' : 'tries'} before a short wait.`
        : 'Incorrect PIN.';
    }
  }

  private refreshThrottle(): void {
    if (this.countdownTimer !== null) {
      window.clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    const tick = () => {
      const left = lockoutSecondsRemaining();
      if (left <= 0) {
        if (this.countdownTimer !== null) window.clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.keypadEl.classList.remove('is-disabled');
        this.errorEl.textContent = '';
        return;
      }
      this.keypadEl.classList.add('is-disabled');
      this.errorEl.textContent = `Too many attempts. Try again in ${left}s.`;
    };
    if (lockoutSecondsRemaining() > 0) {
      tick();
      this.countdownTimer = window.setInterval(tick, 1000);
    }
  }
}
