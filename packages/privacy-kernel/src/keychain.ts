/**
 * keychain.ts — In-memory key management for Jason-OS Privacy Kernel
 *
 * Stores keys in a Map with optional TTL-based expiration.
 * All operations are synchronous; purgeExpired() must be called explicitly.
 */

import type { KeyMaterial } from '@jason-os/shared';

// ------------------------------------------------------------------
// Internal key entry
// ------------------------------------------------------------------

interface KeyEntry {
  readonly key: CryptoKey;
  readonly createdAt: number;
  readonly expiresAt: number | undefined;
}

// ------------------------------------------------------------------
// Keychain
// ------------------------------------------------------------------

export class Keychain {
  private readonly store: Map<string, KeyEntry> = new Map();

  /**
   * Store a key with an optional TTL (milliseconds).
   */
  storeKey(keyId: string, key: CryptoKey, ttl?: number): void {
    const now = Date.now();
    const entry: KeyEntry = {
      key,
      createdAt: now,
      expiresAt: ttl !== undefined && ttl >= 0 ? now + ttl : undefined,
    };
    this.store.set(keyId, entry);
  }

  /**
   * Retrieve a key by ID. Returns undefined if not found or expired.
   */
  getKey(keyId: string): CryptoKey | undefined {
    const entry = this.store.get(keyId);
    if (entry === undefined) return undefined;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(keyId);
      return undefined;
    }
    return entry.key;
  }

  /**
   * Check whether a key exists and is not expired.
   */
  hasKey(keyId: string): boolean {
    return this.getKey(keyId) !== undefined;
  }

  /**
   * Remove a key by ID.
   */
  removeKey(keyId: string): boolean {
    return this.store.delete(keyId);
  }

  /**
   * Remove all expired keys.
   * @returns number of keys removed
   */
  purgeExpired(): number {
    const now = Date.now();
    let removed = 0;
    for (const [keyId, entry] of this.store) {
      if (entry.expiresAt !== undefined && now > entry.expiresAt) {
        this.store.delete(keyId);
        removed++;
      }
    }
    return removed;
  }

  /**
   * List all key IDs (including expired ones — call purgeExpired() first to clean).
   */
  listKeys(): string[] {
    return Array.from(this.store.keys());
  }

  /**
   * Remove all keys.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Return key metadata as KeyMaterial (without the actual key).
   */
  getKeyMaterial(keyId: string): Omit<KeyMaterial, 'key'> | undefined {
    const entry = this.store.get(keyId);
    if (entry === undefined) return undefined;
    return {
      keyId,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
    };
  }

  /**
   * Current number of stored keys.
   */
  size(): number {
    return this.store.size;
  }
}
