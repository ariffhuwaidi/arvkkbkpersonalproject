export interface PassphraseRequest {
  /** 'create' asks twice and warns that a lost passphrase cannot be recovered. */
  mode: 'create' | 'enter';
  title: string;
  message: string;
  confirmLabel?: string;
}

export const MIN_PASSPHRASE_LENGTH = 8;

/**
 * Bottom sheet that asks for a backup passphrase.
 * Resolves with the passphrase, or null if the person cancels.
 */
export class PassphraseSheet {
  private overlayEl: HTMLElement;
  private resolvePromise: ((value: string | null) => void) | null = null;
  private mode: 'create' | 'enter' = 'enter';

  constructor() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'modal-overlay passphrase-overlay';
    this.overlayEl.setAttribute('role', 'dialog');
    this.overlayEl.setAttribute('aria-modal', 'true');
    this.overlayEl.setAttribute('aria-labelledby', 'pp-title');

    this.overlayEl.innerHTML = `
      <form class="bottom-sheet" style="max-width: 420px;" autocomplete="off" novalidate>
        <div class="sheet-grab-bar"></div>
        <div class="sheet-body" style="padding: 20px 20px 8px 20px; gap: 10px;">
          <h3 class="sheet-title" id="pp-title" style="font-size: 18px;"></h3>
          <p id="pp-message" style="font-size: 14px; line-height: 1.45; color: var(--color-text-secondary);"></p>
          <label class="pp-label" for="pp-input">Passphrase</label>
          <input id="pp-input" class="form-input" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false" />
          <div id="pp-confirm-wrap">
            <label class="pp-label" for="pp-confirm">Repeat passphrase</label>
            <input id="pp-confirm" class="form-input" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false" />
          </div>
          <p id="pp-warning" class="pp-warning"></p>
          <p id="pp-error" class="pp-error" role="alert"></p>
        </div>
        <div class="sheet-footer" style="flex-direction: column; gap: 8px; padding: 8px 20px 16px 20px;">
          <button type="submit" id="pp-ok" class="btn-primary" style="width: 100%; height: 44px;"></button>
          <button type="button" id="pp-cancel" class="btn-secondary" style="width: 100%; height: 44px; font-weight: 600;">Cancel</button>
        </div>
      </form>
    `;
    document.body.appendChild(this.overlayEl);

    const form = this.overlayEl.querySelector('form') as HTMLFormElement;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    (this.overlayEl.querySelector('#pp-cancel') as HTMLElement).addEventListener('click', () => this.finish(null));
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) this.finish(null);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) this.finish(null);
    });
  }

  public isOpen(): boolean {
    return this.overlayEl.classList.contains('is-open');
  }

  public ask(request: PassphraseRequest): Promise<string | null> {
    this.mode = request.mode;
    const q = <T extends HTMLElement>(sel: string) => this.overlayEl.querySelector(sel) as T;

    q('#pp-title').textContent = request.title;
    q('#pp-message').textContent = request.message;
    q<HTMLInputElement>('#pp-input').value = '';
    q<HTMLInputElement>('#pp-confirm').value = '';
    q('#pp-error').textContent = '';
    q('#pp-ok').textContent = request.confirmLabel || (request.mode === 'create' ? 'Set passphrase' : 'Unlock backup');

    const creating = request.mode === 'create';
    q('#pp-confirm-wrap').style.display = creating ? 'block' : 'none';
    q('#pp-warning').textContent = creating
      ? 'There is no way to recover this passphrase. If you forget it, encrypted backups cannot be opened. Write it down and keep it somewhere safe, away from the phone.'
      : '';
    q('#pp-warning').style.display = creating ? 'block' : 'none';

    this.overlayEl.classList.add('is-open');
    window.setTimeout(() => q<HTMLInputElement>('#pp-input').focus(), 50);

    return new Promise((resolve) => {
      // A new request replaces a pending one
      if (this.resolvePromise) this.resolvePromise(null);
      this.resolvePromise = resolve;
    });
  }

  private submit(): void {
    const input = this.overlayEl.querySelector('#pp-input') as HTMLInputElement;
    const confirm = this.overlayEl.querySelector('#pp-confirm') as HTMLInputElement;
    const error = this.overlayEl.querySelector('#pp-error') as HTMLElement;
    const value = input.value;

    if (this.mode === 'create') {
      if (value.length < MIN_PASSPHRASE_LENGTH) {
        error.textContent = `Use at least ${MIN_PASSPHRASE_LENGTH} characters. A few random words work well.`;
        return;
      }
      if (value !== confirm.value) {
        error.textContent = 'The two passphrases do not match.';
        return;
      }
    } else if (!value) {
      error.textContent = 'Enter the passphrase.';
      return;
    }
    this.finish(value);
  }

  private finish(value: string | null): void {
    this.overlayEl.classList.remove('is-open');
    (this.overlayEl.querySelector('#pp-input') as HTMLInputElement).value = '';
    (this.overlayEl.querySelector('#pp-confirm') as HTMLInputElement).value = '';
    if (this.resolvePromise) {
      this.resolvePromise(value);
      this.resolvePromise = null;
    }
  }
}

export const passphraseSheet = new PassphraseSheet();
