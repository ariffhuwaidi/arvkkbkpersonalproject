import type { ThemeMode } from '../../types';
import { themeManager } from '../../utils/theme';
import {
  AUTO_LOCK_OPTIONS,
  getAutoLockSeconds,
  hasPin,
  isValidPinFormat,
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  removePin,
  setAutoLockSeconds,
  setPin,
  verifyPin
} from '../../utils/app-lock';
import { changeBackupPassphrase, hasPassphraseVerifier } from '../../utils/backup-passphrase';
import { toast } from '../toast';

type PinMode = 'set' | 'change' | 'remove';

const CARD = 'background: var(--color-bg-secondary); border: 0.5px solid var(--color-separator); border-radius: var(--radius-lg); padding: 16px;';
const H4 = 'font-size: 15px; font-weight: 600; margin-bottom: 4px;';
const NOTE = 'font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;';

/** PINs that are refused because they are too easy to guess. */
export function isWeakPin(pin: string): boolean {
  return /^(\d)\1+$/.test(pin) || pin === '1234' || pin === '123456' || pin === '0000';
}

/**
 * More > Security: PIN lock and auto-lock delay, backup passphrase, theme.
 * Renders into `pane` and re-renders itself after each change.
 */
export function renderSecurityPane(pane: HTMLElement, opts: { onLockNow: () => void }): void {
  const pinOn = hasPin();
  const timeout = getAutoLockSeconds();
  const theme = themeManager.getMode();

  pane.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="${CARD}">
        <h4 style="${H4}">App lock</h4>
        <p style="${NOTE}">
          ${pinOn
            ? 'A PIN is required to open the app. The screen is hidden in the app switcher, and the app locks itself after the delay below, or when it is left untouched for that long.'
            : 'Set a PIN so the app cannot be opened by anyone who picks up your phone. This does not replace your phone passcode.'}
        </p>
        <div id="pin-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${pinOn
            ? `<button type="button" class="btn-secondary" data-pin-action="change" style="font-weight: 600;">Change PIN</button>
               <button type="button" class="btn-secondary" data-pin-action="lock" style="font-weight: 600;">Lock now</button>
               <button type="button" class="btn-secondary" data-pin-action="remove" style="font-weight: 600; color: var(--color-destructive);">Turn off PIN</button>`
            : `<button type="button" class="btn-primary" data-pin-action="set">Set a PIN</button>`}
        </div>

        <form id="pin-form" hidden autocomplete="off" style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div id="pin-current-wrap" hidden>
            <label class="pp-label" for="pin-current">Current PIN</label>
            <input id="pin-current" class="form-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="${MAX_PIN_LENGTH}" autocomplete="off" />
          </div>
          <div id="pin-new-wrap">
            <label class="pp-label" for="pin-new">New PIN (${MIN_PIN_LENGTH} to ${MAX_PIN_LENGTH} digits)</label>
            <input id="pin-new" class="form-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="${MAX_PIN_LENGTH}" autocomplete="new-password" />
            <label class="pp-label" for="pin-new2" style="margin-top: 8px; display: block;">Repeat new PIN</label>
            <input id="pin-new2" class="form-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="${MAX_PIN_LENGTH}" autocomplete="new-password" />
          </div>
          <p class="pp-warning" id="pin-warning" hidden>The PIN cannot be recovered. If you forget it, the only way back in is to clear this site's data and restore from an encrypted backup.</p>
          <p class="pp-error" id="pin-error" role="alert"></p>
          <div style="display: flex; gap: 8px;">
            <button type="submit" class="btn-primary" id="pin-save" style="flex: 1;">Save</button>
            <button type="button" class="btn-secondary" id="pin-cancel" style="flex: 1; font-weight: 600;">Cancel</button>
          </div>
        </form>

        ${pinOn ? `
        <label class="pp-label" for="auto-lock-select" style="margin-top: 14px; display: block;">Lock the app</label>
        <select id="auto-lock-select" class="form-input">
          ${AUTO_LOCK_OPTIONS.map(o => `<option value="${o.seconds}" ${o.seconds === timeout ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>` : ''}
      </div>

      <div style="${CARD}">
        <h4 style="${H4}">Backup encryption</h4>
        <p style="${NOTE}">
          Google Drive backups are always locked with a passphrase before they leave this device. Exports are too, unless you choose otherwise when exporting. ${hasPassphraseVerifier() ? 'A passphrase is set up.' : 'You will be asked to create a passphrase at your first backup.'}
        </p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
          <button type="button" class="btn-secondary" id="btn-change-passphrase" style="font-weight: 600;">${hasPassphraseVerifier() ? 'Change passphrase' : 'Create passphrase'}</button>
        </div>
      </div>

      <div style="${CARD}">
        <h4 style="${H4}">Appearance</h4>
        <div class="segmented-control" id="theme-seg" role="radiogroup" aria-label="Theme" style="margin-top: 8px;">
          ${(['system', 'light', 'dark'] as ThemeMode[]).map(m => `<button type="button" class="segment-btn ${m === theme ? 'is-active' : ''}" role="radio" aria-checked="${m === theme}" data-theme-mode="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</button>`).join('')}
        </div>
      </div>
    </div>
  `;

  bindPinForm(pane, opts);

  (pane.querySelector('#auto-lock-select') as HTMLSelectElement | null)?.addEventListener('change', (e) => {
    setAutoLockSeconds(Number((e.target as HTMLSelectElement).value));
    toast.show('Auto-lock updated');
  });

  (pane.querySelector('#btn-change-passphrase') as HTMLElement | null)?.addEventListener('click', async () => {
    if (await changeBackupPassphrase()) {
      toast.show('Backup passphrase updated');
      renderSecurityPane(pane, opts);
    }
  });

  pane.querySelectorAll('[data-theme-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      themeManager.setTheme(btn.getAttribute('data-theme-mode') as ThemeMode);
      pane.querySelectorAll('[data-theme-mode]').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', String(on));
      });
    });
  });
}

function bindPinForm(pane: HTMLElement, opts: { onLockNow: () => void }): void {
  const form = pane.querySelector('#pin-form') as HTMLFormElement;
  const errorEl = pane.querySelector('#pin-error') as HTMLElement;
  let mode: PinMode | null = null;

  const openForm = (next: PinMode) => {
    mode = next;
    form.hidden = false;
    (pane.querySelector('#pin-actions') as HTMLElement).hidden = true;
    errorEl.textContent = '';
    (pane.querySelector('#pin-current-wrap') as HTMLElement).hidden = next === 'set';
    (pane.querySelector('#pin-new-wrap') as HTMLElement).hidden = next === 'remove';
    (pane.querySelector('#pin-warning') as HTMLElement).hidden = next === 'remove';
    (form.querySelector('#pin-save') as HTMLElement).textContent = next === 'remove' ? 'Turn off PIN' : 'Save PIN';
    ((next === 'set' ? form.querySelector('#pin-new') : form.querySelector('#pin-current')) as HTMLInputElement | null)?.focus();
  };
  const done = () => renderSecurityPane(pane, opts);

  pane.querySelectorAll('[data-pin-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-pin-action');
      if (action === 'lock') opts.onLockNow();
      else if (action === 'set' || action === 'change' || action === 'remove') openForm(action);
    });
  });

  (pane.querySelector('#pin-cancel') as HTMLElement).addEventListener('click', done);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const val = (id: string) => (form.querySelector(id) as HTMLInputElement | null)?.value || '';
    if (!mode) return;

    if (mode === 'change' || mode === 'remove') {
      const check = await verifyPin(val('#pin-current'));
      if (!check.ok) {
        errorEl.textContent = check.reason === 'throttled'
          ? `Too many attempts. Try again in ${check.retryInSeconds}s.`
          : 'The current PIN is not correct.';
        return;
      }
    }

    if (mode === 'remove') {
      removePin();
      toast.show('PIN turned off');
      done();
      return;
    }

    const next = val('#pin-new');
    if (!isValidPinFormat(next)) {
      errorEl.textContent = `Use ${MIN_PIN_LENGTH} to ${MAX_PIN_LENGTH} digits, numbers only.`;
      return;
    }
    if (next !== val('#pin-new2')) {
      errorEl.textContent = 'The two PINs do not match.';
      return;
    }
    if (isWeakPin(next)) {
      errorEl.textContent = 'That PIN is too easy to guess. Choose another.';
      return;
    }
    await setPin(next);
    toast.show(mode === 'set' ? 'PIN set' : 'PIN changed');
    done();
  });
}
