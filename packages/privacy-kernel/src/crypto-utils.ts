/**
 * crypto-utils.ts — Low-level cryptographic primitives for Jason-OS Privacy Kernel
 *
 * Uses Node.js native `crypto` module (AES-256-GCM, PBKDF2, SHA-256, RSA-OAEP).
 * All functions are async and return typed, serialisable values.
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'node:crypto';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const AES_KEY_SIZE = 32; // 256 bits
const AES_IV_SIZE = 16; // 128 bits
const AES_TAG_SIZE = 16; // 128 bits
const PBKDF2_ITERATIONS = 100_000;

// ------------------------------------------------------------------
// AES-256-GCM symmetric encryption / decryption
// ------------------------------------------------------------------

export interface AESGCMResult {
  readonly ciphertext: Uint8Array;
  readonly iv: Uint8Array;
  readonly authTag: Uint8Array;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * @param data — plaintext
 * @param key — 32-byte symmetric key as Uint8Array
 * @returns ciphertext, IV, and auth tag
 */
export function encryptAES256GCM(data: Uint8Array, key: Uint8Array): AESGCMResult {
  if (key.length !== AES_KEY_SIZE) {
    throw new Error(`encryptAES256GCM: expected ${AES_KEY_SIZE}-byte key, got ${key.length}`);
  }
  const iv = secureRandom(AES_IV_SIZE);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: new Uint8Array(encrypted),
    iv,
    authTag: new Uint8Array(authTag),
  };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * @param ciphertext — encrypted data
 * @param iv — 16-byte IV
 * @param authTag — 16-byte authentication tag
 * @param key — 32-byte symmetric key
 * @returns plaintext
 */
export function decryptAES256GCM(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  authTag: Uint8Array,
  key: Uint8Array
): Uint8Array {
  if (key.length !== AES_KEY_SIZE) {
    throw new Error(`decryptAES256GCM: expected ${AES_KEY_SIZE}-byte key, got ${key.length}`);
  }
  if (iv.length !== AES_IV_SIZE) {
    throw new Error(`decryptAES256GCM: expected ${AES_IV_SIZE}-byte IV, got ${iv.length}`);
  }
  if (authTag.length !== AES_TAG_SIZE) {
    throw new Error(`decryptAES256GCM: expected ${AES_TAG_SIZE}-byte authTag, got ${authTag.length}`);
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return new Uint8Array(decrypted);
}

// ------------------------------------------------------------------
// Key derivation (PBKDF2)
// ------------------------------------------------------------------

/**
 * Derive a 256-bit key from a password using PBKDF2-HMAC-SHA256.
 * @param password — user password
 * @param salt — at least 16 bytes recommended
 * @returns 32-byte derived key
 */
export function deriveKeyPBKDF2(password: string, salt: Uint8Array): Uint8Array {
  if (salt.length < 8) {
    throw new Error('deriveKeyPBKDF2: salt must be at least 8 bytes');
  }
  const derived = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, AES_KEY_SIZE, 'sha256');
  return new Uint8Array(derived);
}

// ------------------------------------------------------------------
// Hashing (SHA-256)
// ------------------------------------------------------------------

/**
 * Compute SHA-256 digest.
 * @param data — input bytes
 * @returns 32-byte hash
 */
export function sha256(data: Uint8Array): Uint8Array {
  const hash = createHash('sha256').update(data).digest();
  return new Uint8Array(hash);
}

// ------------------------------------------------------------------
// Key generation
// ------------------------------------------------------------------

/**
 * Generate a random 256-bit symmetric key.
 * @returns 32-byte key
 */
export function generateSymmetricKey(): Uint8Array {
  return secureRandom(AES_KEY_SIZE);
}

// ------------------------------------------------------------------
// Secure random
// ------------------------------------------------------------------

/**
 * Generate cryptographically secure random bytes.
 * @param bytes — number of bytes to generate
 * @returns random bytes
 */
export function secureRandom(bytes: number): Uint8Array {
  if (bytes <= 0 || !Number.isInteger(bytes)) {
    throw new Error('secureRandom: byte count must be a positive integer');
  }
  return randomBytes(bytes);
}

// ------------------------------------------------------------------
// Key fingerprinting
// ------------------------------------------------------------------

/**
 * Compute a short hex fingerprint of key material (first 8 bytes of SHA-256).
 * @param keyData — raw key bytes
 * @returns 16-character hex string
 */
export function fingerprintKey(keyData: Uint8Array): string {
  const hash = sha256(keyData);
  return Buffer.from(hash.slice(0, 8)).toString('hex');
}
