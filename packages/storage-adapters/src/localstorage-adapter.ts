/**
 * @jason-os/storage-adapters
 *
 * localStorage adapter with namespaced keys, JSON serialization,
 * and 5 MB quota detection.
 *
 * Falls back silently when `window.localStorage` is unavailable
 * (e.g. Node / SSR) — the router should substitute MemoryAdapter instead.
 */

import type { StorageAdapter } from './storage-adapter.js';

/** Approximate localStorage quota in bytes (5 MB). */
const LOCAL_STORAGE_QUOTA = 5 * 1024 * 1024;

export class LocalStorageAdapter implements StorageAdapter {
  readonly name = 'LocalStorageAdapter';
  readonly type = 'localStorage' as const;

  /** Key prefix applied to every key for namespace isolation. */
  private readonly prefix: string;

  constructor(namespace = 'default') {
    this.prefix = `jason-os:${namespace}:`;
  }

  /** localStorage is only available in browser environments. */
  isAvailable(): boolean {
    try {
      return (
        typeof window !== 'undefined' &&
        window.localStorage !== null &&
        typeof window.localStorage.setItem === 'function'
      );
    } catch {
      return false;
    }
  }

  /** Build the fully-qualified namespaced key. */
  private resolveKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /** Extract the user-facing key from a fully-qualified key. */
  private stripKey(namespaced: string): string {
    return namespaced.startsWith(this.prefix)
      ? namespaced.slice(this.prefix.length)
      : namespaced;
  }

  private getStorage(): Storage | null {
    if (!this.isAvailable()) return null;
    return window.localStorage;
  }

  async get(key: string): Promise<string | null> {
    const storage = this.getStorage();
    if (!storage) return null;

    const raw = storage.getItem(this.resolveKey(key));
    if (raw === null) return null;

    try {
      const parsed = JSON.parse(raw) as { value: string; _jason?: boolean };
      if (parsed._jason && typeof parsed.value === 'string') {
        return parsed.value;
      }
      // Legacy plain-string fallback
      return raw;
    } catch {
      // Not JSON-wrapped — return raw value
      return raw;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    this.checkQuota(value);

    const payload = JSON.stringify({ value, _jason: true });
    storage.setItem(this.resolveKey(key), payload);
  }

  async delete(key: string): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;
    storage.removeItem(this.resolveKey(key));
  }

  async list(prefix?: string): Promise<string[]> {
    const storage = this.getStorage();
    if (!storage) return [];

    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const rawKey = storage.key(i);
      if (rawKey && rawKey.startsWith(this.prefix)) {
        const stripped = this.stripKey(rawKey);
        if (prefix === undefined || stripped.startsWith(prefix)) {
          keys.push(stripped);
        }
      }
    }
    return keys.sort();
  }

  async clear(): Promise<void> {
    const storage = this.getStorage();
    if (!storage) return;

    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const rawKey = storage.key(i);
      if (rawKey && rawKey.startsWith(this.prefix)) {
        toRemove.push(rawKey);
      }
    }
    for (const key of toRemove) {
      storage.removeItem(key);
    }
  }

  async getSize(): Promise<number> {
    const storage = this.getStorage();
    if (!storage) return 0;

    let count = 0;
    for (let i = 0; i < storage.length; i++) {
      const rawKey = storage.key(i);
      if (rawKey && rawKey.startsWith(this.prefix)) count++;
    }
    return count;
  }

  /**
   * Rough quota check — throws when the *new* value alone would exceed
   * the 5 MB localStorage limit. Does not account for existing data.
   */
  checkQuota(value: string): void {
    const byteLength = new Blob([value]).size;
    if (byteLength > LOCAL_STORAGE_QUOTA) {
      throw new Error(
        `Storage quota exceeded: value of ${byteLength} bytes exceeds ` +
          `localStorage limit of ${LOCAL_STORAGE_QUOTA} bytes`
      );
    }
  }

  /** Return the full namespaced key (useful for debugging / assertions). */
  getNamespacedKey(key: string): string {
    return this.resolveKey(key);
  }
}
