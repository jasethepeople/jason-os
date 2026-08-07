/**
 * crypto-utils.test.ts — Unit tests for low-level cryptographic primitives
 */

import { describe, it, expect } from 'vitest';
import {
  encryptAES256GCM,
  decryptAES256GCM,
  deriveKeyPBKDF2,
  sha256,
  generateSymmetricKey,
  secureRandom,
  fingerprintKey,
} from './crypto-utils.js';

describe('encryptAES256GCM / decryptAES256GCM', () => {
  it('should round-trip plaintext successfully', () => {
    const key = generateSymmetricKey();
    const plaintext = new TextEncoder().encode('Hello, Jason-OS Privacy Kernel!');
    const { ciphertext, iv, authTag } = encryptAES256GCM(plaintext, key);

    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(iv.length).toBe(16);
    expect(authTag.length).toBe(16);

    const decrypted = decryptAES256GCM(ciphertext, iv, authTag, key);
    expect(decrypted).toEqual(plaintext);
  });

  it('should handle empty plaintext', () => {
    const key = generateSymmetricKey();
    const plaintext = new Uint8Array(0);
    const { ciphertext, iv, authTag } = encryptAES256GCM(plaintext, key);
    const decrypted = decryptAES256GCM(ciphertext, iv, authTag, key);
    expect(decrypted).toEqual(plaintext);
  });

  it('should handle large plaintext (1 MB)', () => {
    const key = generateSymmetricKey();
    const plaintext = secureRandom(1024 * 1024);
    const { ciphertext, iv, authTag } = encryptAES256GCM(plaintext, key);
    const decrypted = decryptAES256GCM(ciphertext, iv, authTag, key);
    expect(decrypted).toEqual(plaintext);
  });

  it('should produce different ciphertexts for same plaintext (IV uniqueness)', () => {
    const key = generateSymmetricKey();
    const plaintext = new TextEncoder().encode('Deterministic input');
    const result1 = encryptAES256GCM(plaintext, key);
    const result2 = encryptAES256GCM(plaintext, key);

    expect(result1.iv).not.toEqual(result2.iv);
    expect(result1.ciphertext).not.toEqual(result2.ciphertext);
    expect(result1.authTag).not.toEqual(result2.authTag);
  });

  it('should decrypt two independent ciphertexts with same key', () => {
    const key = generateSymmetricKey();
    const plaintext = new TextEncoder().encode('Shared key test');
    const result1 = encryptAES256GCM(plaintext, key);
    const result2 = encryptAES256GCM(plaintext, key);

    expect(decryptAES256GCM(result1.ciphertext, result1.iv, result1.authTag, key)).toEqual(plaintext);
    expect(decryptAES256GCM(result2.ciphertext, result2.iv, result2.authTag, key)).toEqual(plaintext);
  });

  it('should fail decryption with tampered ciphertext', () => {
    const key = generateSymmetricKey();
    const plaintext = new TextEncoder().encode('Sensitive data');
    const { ciphertext, iv, authTag } = encryptAES256GCM(plaintext, key);

    ciphertext[0] ^= 0xff; // flip bits

    expect(() => decryptAES256GCM(ciphertext, iv, authTag, key)).toThrow();
  });

  it('should fail decryption with tampered IV', () => {
    const key = generateSymmetricKey();
    const plaintext = new TextEncoder().encode('Sensitive data');
    const { ciphertext, iv, authTag } = encryptAES256GCM(plaintext, key);

    iv[0] ^= 0xff;

    expect(() => decryptAES256GCM(ciphertext, iv, authTag, key)).toThrow();
  });

  it('should fail decryption with tampered authTag', () => {
    const key = generateSymmetricKey();
    const plaintext = new TextEncoder().encode('Sensitive data');
    const { ciphertext, iv, authTag } = encryptAES256GCM(plaintext, key);

    authTag[0] ^= 0xff;

    expect(() => decryptAES256GCM(ciphertext, iv, authTag, key)).toThrow();
  });

  it('should fail decryption with wrong key', () => {
    const key1 = generateSymmetricKey();
    const key2 = generateSymmetricKey();
    const plaintext = new TextEncoder().encode('Secret message');
    const { ciphertext, iv, authTag } = encryptAES256GCM(plaintext, key1);

    expect(() => decryptAES256GCM(ciphertext, iv, authTag, key2)).toThrow();
  });

  it('should throw on wrong key size (encrypt)', () => {
    const badKey = secureRandom(16);
    const plaintext = new TextEncoder().encode('test');
    expect(() => encryptAES256GCM(plaintext, badKey)).toThrow('expected 32-byte key');
  });

  it('should throw on wrong key size (decrypt)', () => {
    const badKey = secureRandom(16);
    const ciphertext = secureRandom(32);
    const iv = secureRandom(16);
    const authTag = secureRandom(16);
    expect(() => decryptAES256GCM(ciphertext, iv, authTag, badKey)).toThrow('expected 32-byte key');
  });

  it('should throw on wrong IV size', () => {
    const key = generateSymmetricKey();
    const ciphertext = secureRandom(32);
    const badIv = secureRandom(8);
    const authTag = secureRandom(16);
    expect(() => decryptAES256GCM(ciphertext, badIv, authTag, key)).toThrow('expected 16-byte IV');
  });

  it('should throw on wrong authTag size', () => {
    const key = generateSymmetricKey();
    const ciphertext = secureRandom(32);
    const iv = secureRandom(16);
    const badTag = secureRandom(8);
    expect(() => decryptAES256GCM(ciphertext, iv, badTag, key)).toThrow('expected 16-byte authTag');
  });
});

describe('deriveKeyPBKDF2', () => {
  it('should derive a 32-byte key from password and salt', () => {
    const salt = secureRandom(16);
    const key = deriveKeyPBKDF2('my-password', salt);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it('should derive deterministic key for same inputs', () => {
    const salt = secureRandom(16);
    const key1 = deriveKeyPBKDF2('same-password', salt);
    const key2 = deriveKeyPBKDF2('same-password', salt);
    expect(key1).toEqual(key2);
  });

  it('should derive different keys for different salts', () => {
    const salt1 = secureRandom(16);
    const salt2 = secureRandom(16);
    const key1 = deriveKeyPBKDF2('same-password', salt1);
    const key2 = deriveKeyPBKDF2('same-password', salt2);
    expect(key1).not.toEqual(key2);
  });

  it('should derive different keys for different passwords', () => {
    const salt = secureRandom(16);
    const key1 = deriveKeyPBKDF2('password-one', salt);
    const key2 = deriveKeyPBKDF2('password-two', salt);
    expect(key1).not.toEqual(key2);
  });

  it('should throw on short salt', () => {
    expect(() => deriveKeyPBKDF2('password', secureRandom(4))).toThrow('salt must be at least 8 bytes');
  });
});

describe('sha256', () => {
  it('should produce a 32-byte hash', () => {
    const data = new TextEncoder().encode('hello');
    const hash = sha256(data);
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32);
  });

  it('should produce deterministic hash', () => {
    const data = new TextEncoder().encode('deterministic');
    const hash1 = sha256(data);
    const hash2 = sha256(data);
    expect(hash1).toEqual(hash2);
  });

  it('should produce different hashes for different inputs', () => {
    const hash1 = sha256(new TextEncoder().encode('input-a'));
    const hash2 = sha256(new TextEncoder().encode('input-b'));
    expect(hash1).not.toEqual(hash2);
  });
});

describe('generateSymmetricKey', () => {
  it('should produce a 32-byte key', () => {
    const key = generateSymmetricKey();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it('should produce different keys on each call', () => {
    const key1 = generateSymmetricKey();
    const key2 = generateSymmetricKey();
    expect(key1).not.toEqual(key2);
  });
});

describe('secureRandom', () => {
  it('should produce requested number of bytes', () => {
    const bytes = secureRandom(32);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(32);
  });

  it('should produce different values on each call', () => {
    const r1 = secureRandom(32);
    const r2 = secureRandom(32);
    expect(r1).not.toEqual(r2);
  });

  it('should throw on zero bytes', () => {
    expect(() => secureRandom(0)).toThrow();
  });

  it('should throw on negative bytes', () => {
    expect(() => secureRandom(-1)).toThrow();
  });
});

describe('fingerprintKey', () => {
  it('should produce a 16-character hex string', () => {
    const key = generateSymmetricKey();
    const fp = fingerprintKey(key);
    expect(typeof fp).toBe('string');
    expect(fp.length).toBe(16);
    expect(/^[0-9a-f]{16}$/.test(fp)).toBe(true);
  });

  it('should produce different fingerprints for different keys', () => {
    const fp1 = fingerprintKey(generateSymmetricKey());
    const fp2 = fingerprintKey(generateSymmetricKey());
    expect(fp1).not.toEqual(fp2);
  });

  it('should produce deterministic fingerprint for same key', () => {
    const key = generateSymmetricKey();
    const fp1 = fingerprintKey(key);
    const fp2 = fingerprintKey(key);
    expect(fp1).toEqual(fp2);
  });
});
