/**
 * @jason-os/storage-adapters
 *
 * In-memory (Map-based) storage adapter.
 *
 * - Ultra-fast O(1) reads/writes
 * - No persistence across reloads
 * - Ideal for unit tests, SSR / Node environments, and GHOST tier data
 */

import type { StorageAdapter } from './storage-adapter.js';

export class MemoryAdapter implements StorageAdapter {
  readonly name = 'MemoryAdapter';
  readonly type = 'memory' as const;

  /** Internal key-value store scoped to this adapter instance. */
  private readonly store = new Map<string, string>();

  /** Key prefix applied to every key for namespace isolation. */
  private readonly prefix: string;

  constructor(namespace = 'default') {
    this.prefix = `jason-os:${namespace}:`;
  }

  /** The memory adapter is always available. */
  isAvailable(): boolean {
    return true;
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

  async get(key: string): Promise<string | null> {
    const resolved = this.resolveKey(key);
    return this.store.has(resolved) ? this.store.get(resolved)! : null;
  }

  async set(key: string, value: string): Promise<void> {
    const resolved = this.resolveKey(key);
    this.store.set(resolved, value);
  }

  async delete(key: string): Promise<void> {
    const resolved = this.resolveKey(key);
    this.store.delete(resolved);
  }

  async list(prefix?: string): Promise<string[]> {
    const keys: string[] = [];
    for (const key of this.store.keys()) {
      const stripped = this.stripKey(key);
      if (prefix === undefined || stripped.startsWith(prefix)) {
        keys.push(stripped);
      }
    }
    return keys.sort();
  }

  async clear(): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(this.prefix)) {
        this.store.delete(key);
      }
    }
  }

  async getSize(): Promise<number> {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(this.prefix)) count++;
    }
    return count;
  }

  /** Internal helper for tests — direct access to backing Map. */
  _getStore(): Map<string, string> {
    return this.store;
  }
}
