/**
 * Passphrase encryption for backups and exports.
 *
 * AES-256-GCM with a key derived from the passphrase by PBKDF2-SHA256.
 * Everything runs in the browser through Web Crypto; the passphrase and key
 * are never stored or sent anywhere.
 */

export interface EncryptedEnvelope {
  app: 'ARV_KKBK';
  encrypted: true;
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 ciphertext (includes the GCM tag)
}

export const KDF_ITERATIONS = 250_000;

export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase, or the file is damaged.');
    this.name = 'WrongPassphraseError';
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.encrypted === true &&
    typeof v.salt === 'string' &&
    typeof v.iv === 'string' &&
    typeof v.data === 'string' &&
    typeof v.iterations === 'number'
  );
}

export async function encryptJSON(payload: unknown, passphrase: string): Promise<EncryptedEnvelope> {
  if (!passphrase) throw new Error('A passphrase is required.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, KDF_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));

  return {
    app: 'ARV_KKBK',
    encrypted: true,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(ciphertext)
  };
}

export async function decryptJSON(envelope: EncryptedEnvelope, passphrase: string): Promise<unknown> {
  // Guard against absurd iteration counts in a tampered file
  if (envelope.iterations < 10_000 || envelope.iterations > 5_000_000) {
    throw new Error('Unsupported encryption settings in this file.');
  }
  try {
    const key = await deriveKey(passphrase, fromBase64(envelope.salt), envelope.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) as BufferSource },
      key,
      fromBase64(envelope.data) as BufferSource
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new WrongPassphraseError();
  }
}
