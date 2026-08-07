/**
 * privacy-kernel.test.ts — Unit tests for PrivacyKernel implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrivacyKernel } from './privacy-kernel.js';
import type { PrivacyTier, EncryptedBlob } from '@jason-os/shared';
import { PrivacyError } from '@jason-os/shared';

describe('PrivacyKernel — interface methods', () => {
  let kernel: PrivacyKernel;

  beforeEach(() => {
    kernel = new PrivacyKernel();
    kernel.destroy();
  });

  it('should default to PUBLIC tier', () => {
    expect(kernel.getPrivacyTier()).toBe('PUBLIC');
  });

  it('should encrypt and decrypt in PUBLIC tier (passthrough)', async () => {
    const data = new TextEncoder().encode('public data');
    const blob = await kernel.encrypt(data, 'key1');
    expect(blob.ciphertext).toEqual(data);
    expect(blob.iv.length).toBe(0);
    expect(blob.authTag.length).toBe(0);

    const decrypted = await kernel.decrypt(blob, 'key1');
    expect(decrypted).toEqual(data);
  });

  it('should encrypt and decrypt in SOFT tier', async () => {
    kernel.setPrivacyTier('SOFT');
    const keyMaterial = await kernel.generateSymmetricKey();
    const data = new TextEncoder().encode('soft-tier secret');
    const blob = await kernel.encrypt(data, keyMaterial.keyId);

    expect(blob.ciphertext).not.toEqual(data);
    expect(blob.iv.length).toBe(16);
    expect(blob.authTag.length).toBe(16);

    const decrypted = await kernel.decrypt(blob, keyMaterial.keyId);
    expect(decrypted).toEqual(data);
  });

  it('should encrypt and decrypt in SHADOW tier', async () => {
    kernel.setPrivacyTier('SHADOW');
    const keyMaterial = await kernel.generateSymmetricKey();
    const data = new TextEncoder().encode('shadow-tier secret');
    const blob = await kernel.encrypt(data, keyMaterial.keyId);

    expect(blob.ciphertext).not.toEqual(data);
    expect(blob.iv.length).toBe(16);
    expect(blob.authTag.length).toBe(16);

    const decrypted = await kernel.decrypt(blob, keyMaterial.keyId);
    expect(decrypted).toEqual(data);
  });

  it('should encrypt and decrypt in GHOST tier', async () => {
    kernel.setPrivacyTier('GHOST');
    const keyMaterial = await kernel.generateSymmetricKey();
    const data = new TextEncoder().encode('ghost-tier secret');
    const blob = await kernel.encrypt(data, keyMaterial.keyId);

    expect(blob.ciphertext).not.toEqual(data);
    expect(blob.iv.length).toBe(16);
    expect(blob.authTag.length).toBe(16);

    const decrypted = await kernel.decrypt(blob, keyMaterial.keyId);
    expect(decrypted).toEqual(data);
  });

  it('should throw when decrypting with missing key', async () => {
    kernel.setPrivacyTier('SOFT');
    const keyMaterial = await kernel.generateSymmetricKey();
    const data = new TextEncoder().encode('secret');
    const blob = await kernel.encrypt(data, keyMaterial.keyId);
    await expect(kernel.decrypt(blob, 'nonexistent-key')).rejects.toThrow(PrivacyError);
  });

  it('should throw on unsupported algorithm in blob', async () => {
    kernel.setPrivacyTier('SOFT');
    const keyMaterial = await kernel.generateSymmetricKey();
    const data = new TextEncoder().encode('test');
    const blob = await kernel.encrypt(data, keyMaterial.keyId);

    const tamperedBlob: EncryptedBlob = { ...blob, algorithm: 'DES-EDE3' };
    await expect(kernel.decrypt(tamperedBlob, keyMaterial.keyId)).rejects.toThrow('Unsupported algorithm');
  });

  it('should derive key deterministically from password+salt', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key1 = await kernel.deriveKey('password', salt);
    const key2 = await kernel.deriveKey('password', salt);
    const exported1 = await kernel.exportKey(key1);
    const exported2 = await kernel.exportKey(key2);
    expect(exported1).toEqual(exported2);
  });

  it('should derive different keys for different passwords', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key1 = await kernel.deriveKey('password1', salt);
    const key2 = await kernel.deriveKey('password2', salt);
    const exported1 = await kernel.exportKey(key1);
    const exported2 = await kernel.exportKey(key2);
    expect(exported1).not.toEqual(exported2);
  });

  it('should generate an RSA-OAEP key pair', async () => {
    const keyPair = await kernel.generateKeyPair();
    expect(keyPair.keyId).toBeDefined();
    expect(keyPair.keyId.startsWith('pk-')).toBe(true);
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
  });

  it('should generate symmetric key material', async () => {
    const keyMaterial = await kernel.generateSymmetricKey();
    expect(keyMaterial.keyId.startsWith('pk-')).toBe(true);
    expect(keyMaterial.createdAt).toBeGreaterThan(0);
    expect(keyMaterial.key).toBeDefined();
    expect(keyMaterial.key.type).toBe('secret');
  });

  it('should import and export a raw key', async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const key = await kernel.importKey(rawKey, 'AES-GCM');
    const exported = await kernel.exportKey(key);
    expect(exported).toEqual(rawKey);
  });

  it('should compute SHA-256 hash', async () => {
    const data = new TextEncoder().encode('hash me');
    const hash1 = await kernel.hash(data);
    const hash2 = await kernel.hash(data);
    expect(hash1.length).toBe(32);
    expect(hash1).toEqual(hash2);
  });

  it('should list generated key IDs', async () => {
    kernel.setPrivacyTier('SHADOW');
    await kernel.generateSymmetricKey();
    await kernel.generateSymmetricKey();
    const ids = kernel.listKeyIds();
    expect(ids.length).toBe(2);
  });

  it('should remove a key by ID', async () => {
    kernel.setPrivacyTier('SOFT');
    const km = await kernel.generateSymmetricKey();
    expect(kernel.listKeyIds()).toContain(km.keyId);
    kernel.removeKey(km.keyId);
    expect(kernel.listKeyIds()).not.toContain(km.keyId);
  });

  it('should purge expired keys', async () => {
    kernel.setPrivacyTier('GHOST');
    const km = await kernel.generateSymmetricKey();
    expect(kernel.listKeyIds()).toContain(km.keyId);
    // Keys in GHOST mode have 1-minute TTL; simulate expiry
    const keychain = kernel.getKeychain();
    keychain.storeKey('expired-key', km.key, 1); // 1ms TTL
    await new Promise((r) => setTimeout(r, 10)); // wait for expiry
    const removed = kernel.purgeExpiredKeys();
    expect(removed).toBe(1);
    expect(kernel.listKeyIds()).not.toContain('expired-key');
  });

  it('should clear all keys on destroy', async () => {
    kernel.setPrivacyTier('SHADOW');
    await kernel.generateSymmetricKey();
    await kernel.generateSymmetricKey();
    expect(kernel.listKeyIds().length).toBe(2);
    kernel.destroy();
    expect(kernel.listKeyIds().length).toBe(0);
    expect(kernel.getPrivacyTier()).toBe('PUBLIC');
  });
});

describe('PrivacyKernel — tier transitions', () => {
  let kernel: PrivacyKernel;

  beforeEach(() => {
    kernel = new PrivacyKernel();
    kernel.destroy();
  });

  it('should transition PUBLIC → SOFT', () => {
    kernel.setPrivacyTier('SOFT');
    expect(kernel.getPrivacyTier()).toBe('SOFT');
  });

  it('should transition SOFT → SHADOW', () => {
    kernel.setPrivacyTier('SOFT');
    kernel.setPrivacyTier('SHADOW');
    expect(kernel.getPrivacyTier()).toBe('SHADOW');
  });

  it('should transition SHADOW → GHOST', () => {
    kernel.setPrivacyTier('SHADOW');
    kernel.setPrivacyTier('GHOST');
    expect(kernel.getPrivacyTier()).toBe('GHOST');
  });

  it('should transition GHOST → PUBLIC', () => {
    kernel.setPrivacyTier('GHOST');
    kernel.setPrivacyTier('PUBLIC');
    expect(kernel.getPrivacyTier()).toBe('PUBLIC');
  });

  it('should clear keys when entering GHOST', async () => {
    kernel.setPrivacyTier('SOFT');
    await kernel.generateSymmetricKey();
    expect(kernel.listKeyIds().length).toBeGreaterThan(0);
    kernel.setPrivacyTier('GHOST');
    expect(kernel.listKeyIds().length).toBe(0);
  });

  it('should clear keys when downgrading from SHADOW to PUBLIC', async () => {
    kernel.setPrivacyTier('SHADOW');
    await kernel.generateSymmetricKey();
    expect(kernel.listKeyIds().length).toBeGreaterThan(0);
    kernel.setPrivacyTier('PUBLIC');
    expect(kernel.listKeyIds().length).toBe(0);
  });

  it('should clear keys when downgrading from SHADOW to SOFT', async () => {
    kernel.setPrivacyTier('SHADOW');
    await kernel.generateSymmetricKey();
    expect(kernel.listKeyIds().length).toBeGreaterThan(0);
    kernel.setPrivacyTier('SOFT');
    expect(kernel.listKeyIds().length).toBe(0);
  });

  it('should clear keys when downgrading from GHOST to SOFT', async () => {
    kernel.setPrivacyTier('GHOST');
    await kernel.generateSymmetricKey();
    expect(kernel.listKeyIds().length).toBe(0); // GHOST clears immediately
    kernel.setPrivacyTier('SOFT');
    expect(kernel.listKeyIds().length).toBe(0);
  });

  it('should not clear keys when staying in same tier', async () => {
    kernel.setPrivacyTier('SOFT');
    await kernel.generateSymmetricKey();
    const idsBefore = kernel.listKeyIds();
    kernel.setPrivacyTier('SOFT');
    expect(kernel.listKeyIds()).toEqual(idsBefore);
  });
});

describe('PrivacyKernel — tier change callbacks', () => {
  let kernel: PrivacyKernel;

  beforeEach(() => {
    kernel = new PrivacyKernel();
    kernel.destroy();
  });

  it('should call handler on tier change', () => {
    const called: PrivacyTier[] = [];
    kernel.onTierChange((tier) => called.push(tier));
    kernel.setPrivacyTier('SOFT');
    expect(called).toEqual(['SOFT']);
  });

  it('should call multiple handlers', () => {
    const called1: PrivacyTier[] = [];
    const called2: PrivacyTier[] = [];
    kernel.onTierChange((tier) => called1.push(tier));
    kernel.onTierChange((tier) => called2.push(tier));
    kernel.setPrivacyTier('SHADOW');
    expect(called1).toEqual(['SHADOW']);
    expect(called2).toEqual(['SHADOW']);
  });

  it('should not call handler after unsubscribe', () => {
    const called: PrivacyTier[] = [];
    const unsubscribe = kernel.onTierChange((tier) => called.push(tier));
    unsubscribe();
    kernel.setPrivacyTier('SOFT');
    expect(called.length).toBe(0);
  });

  it('should not call handler when tier stays the same', () => {
    const called: PrivacyTier[] = [];
    kernel.onTierChange((tier) => called.push(tier));
    kernel.setPrivacyTier('PUBLIC');
    expect(called.length).toBe(0);
  });

  it('should not break transition if handler throws', () => {
    kernel.onTierChange(() => {
      throw new Error('handler error');
    });
    expect(() => kernel.setPrivacyTier('SOFT')).not.toThrow();
    expect(kernel.getPrivacyTier()).toBe('SOFT');
  });

  it('should pass correct tier value to handler', () => {
    const received: PrivacyTier[] = [];
    kernel.onTierChange((tier) => received.push(tier));
    kernel.setPrivacyTier('SOFT');
    kernel.setPrivacyTier('SHADOW');
    kernel.setPrivacyTier('GHOST');
    kernel.setPrivacyTier('PUBLIC');
    expect(received).toEqual(['SOFT', 'SHADOW', 'GHOST', 'PUBLIC']);
  });
});

describe('PrivacyKernel — concurrent operations', () => {
  let kernel: PrivacyKernel;

  beforeEach(() => {
    kernel = new PrivacyKernel();
    kernel.destroy();
  });

  it('should handle concurrent encryptions', async () => {
    kernel.setPrivacyTier('SOFT');
    const km = await kernel.generateSymmetricKey();
    const plaintext = new TextEncoder().encode('concurrent test');
    const promises = Array.from({ length: 10 }, () => kernel.encrypt(plaintext, km.keyId));
    const blobs = await Promise.all(promises);
    expect(blobs.length).toBe(10);
    // All IVs should be unique
    const ivs = blobs.map((b) => Buffer.from(b.iv).toString('hex'));
    expect(new Set(ivs).size).toBe(10);
  });

  it('should handle concurrent key generations', async () => {
    kernel.setPrivacyTier('SHADOW');
    const promises = Array.from({ length: 20 }, () => kernel.generateSymmetricKey());
    const keys = await Promise.all(promises);
    expect(keys.length).toBe(20);
    const ids = keys.map((k) => k.keyId);
    expect(new Set(ids).size).toBe(20);
  });

  it('should handle interleaved encrypt and decrypt', async () => {
    kernel.setPrivacyTier('SOFT');
    const km = await kernel.generateSymmetricKey();
    const plaintext = new TextEncoder().encode('roundtrip');

    const encrypted: EncryptedBlob[] = [];
    for (let i = 0; i < 5; i++) {
      encrypted.push(await kernel.encrypt(plaintext, km.keyId));
    }

    const decrypted = await Promise.all(
      encrypted.map((blob) => kernel.decrypt(blob, km.keyId))
    );

    for (const d of decrypted) {
      expect(d).toEqual(plaintext);
    }
  });

  it('should generate unique key IDs under concurrency', async () => {
    kernel.setPrivacyTier('SHADOW');
    const promises = Array.from({ length: 50 }, () => kernel.generateSymmetricKey());
    const keys = await Promise.all(promises);
    const ids = keys.map((k) => k.keyId);
    const unique = new Set(ids);
    expect(unique.size).toBe(50);
  });
});
