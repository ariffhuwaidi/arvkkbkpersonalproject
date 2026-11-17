/**
 * App lock: a PIN stored as a salted PBKDF2 hash (never the PIN itself),
 * an auto-lock timer, and wrong-attempt throttling.
 *
 * This keeps a casual person who picks up an unlocked phone out of the app.
 * It is not a replacement for the device passcode, and the data in IndexedDB is
 * not encrypted by it. Encrypted backups cover data that leaves the device.
 */

const PIN_KEY = 'arv_kkbk_pin_v1';
const TIMEOUT_KEY = 'arv_kkbk_lock_timeout_s';
const FAIL_KEY = 'arv_kkbk_pin_fail_v1';

const PIN_ITERATIONS = 150_000;

export const AUTO_LOCK_OPTIONS: Array<{ seconds: number; label: string }> = [
  { seconds: 0, label: 'Immediately' },
  { seconds: 30, label: 'After 30 seconds' },
  { seconds: 60, label: 'After 1 minute' },
  { seconds: 300, label: 'After 5 minutes' }
];

export const DEFAULT_AUTO_LOCK_SECONDS = 60;
export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 6;
export const MAX_FREE_ATTEMPTS = 5;

interface StoredPin {
  salt: string;
  hash: string;
  iterations: number;
  length: number;
}

interface FailState {
  count: number;
  lockedUntil: number;
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function hashPin(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, material, 256);
  return b64(new Uint8Array(bits));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readStored(): StoredPin | null {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPin;
    if (parsed && typeof parsed.salt === 'string' && typeof parsed.hash === 'string') return parsed;
  } catch {
    // unavailable or corrupt
  }
  return null;
}

function readFails(): FailState {
  try {
    const raw = localStorage.getItem(FAIL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FailState;
      if (typeof parsed.count === 'number' && typeof parsed.lockedUntil === 'number') return parsed;
    }
  } catch {
    // ignore
  }
  return { count: 0, lockedUntil: 0 };
}

function writeFails(state: FailState): void {
  try {
    localStorage.setItem(FAIL_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${MIN_PIN_LENGTH},${MAX_PIN_LENGTH}}$`).test(pin);
}

export function hasPin(): boolean {
  return readStored() !== null;
}

export function getPinLength(): number {
  return readStored()?.length ?? MIN_PIN_LENGTH;
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPinFormat(pin)) {
    throw new Error(`PIN must be ${MIN_PIN_LENGTH} to ${MAX_PIN_LENGTH} digits.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPin(pin, salt, PIN_ITERATIONS);
  const stored: StoredPin = { salt: b64(salt), hash, iterations: PIN_ITERATIONS, length: pin.length };
  localStorage.setItem(PIN_KEY, JSON.stringify(stored));
  writeFails({ count: 0, lockedUntil: 0 });
}

export function removePin(): void {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(FAIL_KEY);
  } catch {
    // ignore
  }
}

/** Seconds left on a wrong-attempt lockout, or 0. */
export function lockoutSecondsRemaining(): number {
  const { lockedUntil } = readFails();
  const left = Math.ceil((lockedUntil - Date.now()) / 1000);
  return left > 0 ? left : 0;
}

export type VerifyResult = { ok: true } | { ok: false; reason: 'wrong' | 'throttled'; retryInSeconds: number; attemptsLeft: number };

export async function verifyPin(pin: string): Promise<VerifyResult> {
  const wait = lockoutSecondsRemaining();
  if (wait > 0) return { ok: false, reason: 'throttled', retryInSeconds: wait, attemptsLeft: 0 };

  const stored = readStored();
  if (!stored) return { ok: true };

  const hash = await hashPin(pin, unb64(stored.salt), stored.iterations);
  if (constantTimeEqual(hash, stored.hash)) {
    writeFails({ count: 0, lockedUntil: 0 });
    return { ok: true };
  }

  const fails = readFails();
  const count = fails.count + 1;
  let lockedUntil = 0;
  if (count >= MAX_FREE_ATTEMPTS) {
    // 30s, then doubling, capped at 15 minutes
    const steps = count - MAX_FREE_ATTEMPTS;
    const seconds = Math.min(30 * 2 ** steps, 900);
    lockedUntil = Date.now() + seconds * 1000;
  }
  writeFails({ count, lockedUntil });
  return {
    ok: false,
    reason: lockedUntil ? 'throttled' : 'wrong',
    retryInSeconds: lockedUntil ? Math.ceil((lockedUntil - Date.now()) / 1000) : 0,
    attemptsLeft: Math.max(0, MAX_FREE_ATTEMPTS - count)
  };
}

export function getAutoLockSeconds(): number {
  try {
    const raw = localStorage.getItem(TIMEOUT_KEY);
    if (raw !== null) {
      const n = Number(raw);
      if (AUTO_LOCK_OPTIONS.some(o => o.seconds === n)) return n;
    }
  } catch {
    // ignore
  }
  return DEFAULT_AUTO_LOCK_SECONDS;
}

export function setAutoLockSeconds(seconds: number): void {
  try {
    localStorage.setItem(TIMEOUT_KEY, String(seconds));
  } catch {
    // ignore
  }
}
