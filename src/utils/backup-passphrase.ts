import { decryptJSON, encryptJSON, isEncryptedEnvelope, WrongPassphraseError } from './crypto';
import type { EncryptedEnvelope } from './crypto';
import { passphraseSheet } from '../components/passphrase-sheet';

/**
 * Backup passphrase handling.
 *
 * - The passphrase lives only in memory for the current session. It is never saved.
 * - A small "verifier" (a known string encrypted with the passphrase) is saved, so a
 *   mistyped passphrase is caught before it can start a second, unreadable set of backups.
 */

const ENCRYPT_FLAG_KEY = 'arv_kkbk_backup_encrypt';
const VERIFIER_KEY = 'arv_kkbk_backup_verifier_v1';
const VERIFIER_TEXT = 'arv-kkbk-passphrase-check';
const MAX_ATTEMPTS = 3;

let cachedPassphrase: string | null = null;
let inFlight: Promise<string | null> | null = null;

/** Encryption is on unless it was explicitly turned off. */
export function isBackupEncryptionEnabled(): boolean {
  try {
    return localStorage.getItem(ENCRYPT_FLAG_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setBackupEncryptionEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENCRYPT_FLAG_KEY, enabled ? '1' : '0');
  } catch {
    // ignore
  }
}

export function hasPassphraseVerifier(): boolean {
  try {
    return !!localStorage.getItem(VERIFIER_KEY);
  } catch {
    return false;
  }
}

export function forgetPassphraseForSession(): void {
  cachedPassphrase = null;
}

export function hasCachedPassphrase(): boolean {
  return cachedPassphrase !== null;
}

async function storeVerifier(passphrase: string): Promise<void> {
  try {
    const envelope = await encryptJSON({ check: VERIFIER_TEXT }, passphrase);
    localStorage.setItem(VERIFIER_KEY, JSON.stringify(envelope));
  } catch {
    // ignore: the verifier is a safety net, not required
  }
}

async function matchesVerifier(passphrase: string): Promise<boolean> {
  try {
    const raw = localStorage.getItem(VERIFIER_KEY);
    if (!raw) return true; // nothing to compare against
    const envelope = JSON.parse(raw) as EncryptedEnvelope;
    const result = (await decryptJSON(envelope, passphrase)) as { check?: string };
    return result?.check === VERIFIER_TEXT;
  } catch {
    return false;
  }
}

/**
 * The passphrase to encrypt a backup with. Asks once per session: to create one the
 * first time, or to enter the existing one afterwards. Returns null if cancelled.
 */
export function ensureBackupPassphrase(): Promise<string | null> {
  if (cachedPassphrase) return Promise.resolve(cachedPassphrase);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      if (!hasPassphraseVerifier()) {
        const created = await passphraseSheet.ask({
          mode: 'create',
          title: 'Protect your backups',
          message: 'Backups are encrypted with a passphrase before they leave this device, so a stolen Google account or a lost file reveals nothing.'
        });
        if (!created) return null;
        await storeVerifier(created);
        cachedPassphrase = created;
        return created;
      }

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const entered = await passphraseSheet.ask({
          mode: 'enter',
          title: 'Backup passphrase',
          message: attempt === 0
            ? 'Enter your backup passphrase to continue. It is asked once each time the app is opened.'
            : 'That passphrase does not match the one used for your backups. Try again.',
          confirmLabel: 'Continue'
        });
        if (!entered) return null;
        if (await matchesVerifier(entered)) {
          cachedPassphrase = entered;
          return entered;
        }
      }
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Replaces the passphrase (asks for a new one). Future backups use it; older files keep the old one. */
export async function changeBackupPassphrase(): Promise<boolean> {
  const created = await passphraseSheet.ask({
    mode: 'create',
    title: 'New backup passphrase',
    message: 'Backups made from now on use the new passphrase. Older backup files still need the passphrase they were made with.'
  });
  if (!created) return false;
  await storeVerifier(created);
  cachedPassphrase = created;
  return true;
}

export type OpenResult =
  | { ok: true; payload: unknown; wasEncrypted: boolean }
  | { ok: false; cancelled: boolean; error: string };

/**
 * Turns the text of a backup file into its payload, asking for the passphrase if the file is encrypted.
 * Works for plain backups too, and for files from before encryption existed.
 */
export async function openBackupText(text: string): Promise<OpenResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, cancelled: false, error: 'The selected file is not a valid JSON document.' };
  }
  return openBackupPayload(parsed);
}

export async function openBackupPayload(parsed: unknown): Promise<OpenResult> {
  if (!isEncryptedEnvelope(parsed)) {
    return { ok: true, payload: parsed, wasEncrypted: false };
  }

  // Try the session passphrase first, so a Drive sync does not ask twice
  if (cachedPassphrase) {
    try {
      return { ok: true, payload: await decryptJSON(parsed, cachedPassphrase), wasEncrypted: true };
    } catch (err) {
      if (!(err instanceof WrongPassphraseError)) {
        return { ok: false, cancelled: false, error: (err as Error).message };
      }
    }
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const entered = await passphraseSheet.ask({
      mode: 'enter',
      title: 'Encrypted backup',
      message: attempt === 0
        ? 'This backup is encrypted. Enter the passphrase it was made with.'
        : 'That passphrase did not open the file. Check it and try again.',
      confirmLabel: 'Open backup'
    });
    if (!entered) return { ok: false, cancelled: true, error: 'Cancelled.' };

    try {
      const payload = await decryptJSON(parsed, entered);
      cachedPassphrase = entered;
      if (!hasPassphraseVerifier()) await storeVerifier(entered);
      return { ok: true, payload, wasEncrypted: true };
    } catch (err) {
      if (!(err instanceof WrongPassphraseError)) {
        return { ok: false, cancelled: false, error: (err as Error).message };
      }
    }
  }
  return { ok: false, cancelled: false, error: 'The passphrase did not open this backup.' };
}
