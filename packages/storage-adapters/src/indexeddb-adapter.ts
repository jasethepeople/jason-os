/**
 * @jason-os/storage-adapters
 *
 * IndexedDB adapter with per-namespace object stores.
 *
 * Features:
 * - One object store per namespace (isolated & indexed)
 * - Transaction-based reads / writes
 * - Automatic upgrade / schema creation
 * - Graceful fallback to MemoryAdapter when IndexedDB is unavailable
 */

import type { StorageAdapter } from './storage-adapter.js';
import { MemoryAdapter } from './memory-adapter.js';

/** IndexedDB database name. */
const DB_NAME = 'jason-os-storage';

/** Schema version. Bump when object-store layout changes. */
const DB_VERSION = 1;

/** Key path used inside every object store. */
const KEY_PATH = 'key';

interface StoreRecord {
  key: string;
  value: string;
  timestamp: number;
}

export class IndexedDBAdapter implements StorageAdapter {
  readonly name = 'IndexedDBAdapter';
  readonly type = 'indexedDB' as const;

  private readonly namespace: string;
  private db: IDBDatabase | null = null;
  private memoryFallback: MemoryAdapter | null = null;

  /** Promise that resolves when the DB connection is ready (or failed). */
  private readonly ready: Promise<void>;

  constructor(namespace = 'default') {
    this.namespace = namespace;
    this.ready = this.init();
  }

  /** IndexedDB is only available inside secure browser contexts. */
  isAvailable(): boolean {
    try {
      return (
        typeof window !== 'undefined' &&
        typeof window.indexedDB !== 'undefined' &&
        window.indexedDB !== null
      );
    } catch {
      return false;
    }
  }

  /** Wait for the DB to open (or fail) before every public operation. */
  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  /** Open the DB and create the object store for this namespace if needed. */
  private async init(): Promise<void> {
    if (!this.isAvailable()) {
      this.memoryFallback = new MemoryAdapter(this.namespace);
      return;
    }

    return new Promise<void>((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        // Graceful fallback — degrade to memory adapter
        this.memoryFallback = new MemoryAdapter(this.namespace);
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.namespace)) {
          const store = db.createObjectStore(this.namespace, { keyPath: KEY_PATH });
          // Index on timestamp for time-based queries
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /** Get a transaction and object store for this namespace. */
  private getStore(mode: IDBTransactionMode): { store: IDBObjectStore; tx: IDBTransaction } | null {
    if (!this.db) return null;
    const tx = this.db.transaction([this.namespace], mode);
    const store = tx.objectStore(this.namespace);
    return { store, tx };
  }

  /** True when the adapter fell back to an in-memory store. */
  isUsingFallback(): boolean {
    return this.memoryFallback !== null;
  }

  /** Public proxy to the fallback (tests only). */
  _getFallback(): MemoryAdapter | null {
    return this.memoryFallback;
  }

  async get(key: string): Promise<string | null> {
    await this.ensureReady();

    if (this.memoryFallback) {
      return this.memoryFallback.get(key);
    }

    const result = this.getStore('readonly');
    if (!result) return null;

    return new Promise<string | null>((resolve) => {
      const request = result.store.get(key) as IDBRequest<StoreRecord | undefined>;
      request.onsuccess = () => {
        resolve(request.result?.value ?? null);
      };
      request.onerror = () => resolve(null);
    });
  }

  async set(key: string, value: string): Promise<void> {
    await this.ensureReady();

    if (this.memoryFallback) {
      return this.memoryFallback.set(key, value);
    }

    const result = this.getStore('readwrite');
    if (!result) return;

    const record: StoreRecord = { key, value, timestamp: Date.now() };
    return new Promise<void>((resolve, reject) => {
      const request = result.store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'));
    });
  }

  async delete(key: string): Promise<void> {
    await this.ensureReady();

    if (this.memoryFallback) {
      return this.memoryFallback.delete(key);
    }

    const result = this.getStore('readwrite');
    if (!result) return;

    return new Promise<void>((resolve, reject) => {
      const request = result.store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'));
    });
  }

  async list(prefix?: string): Promise<string[]> {
    await this.ensureReady();

    if (this.memoryFallback) {
      return this.memoryFallback.list(prefix);
    }

    const result = this.getStore('readonly');
    if (!result) return [];

    return new Promise<string[]>((resolve) => {
      const keys: string[] = [];
      const request = result.store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue | null;
        if (cursor) {
          const record = cursor.value as StoreRecord;
          if (prefix === undefined || record.key.startsWith(prefix)) {
            keys.push(record.key);
          }
          cursor.continue();
        } else {
          resolve(keys.sort());
        }
      };

      request.onerror = () => resolve([]);
    });
  }

  async clear(): Promise<void> {
    await this.ensureReady();

    if (this.memoryFallback) {
      return this.memoryFallback.clear();
    }

    const result = this.getStore('readwrite');
    if (!result) return;

    return new Promise<void>((resolve, reject) => {
      const request = result.store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('IndexedDB clear failed'));
    });
  }

  async getSize(): Promise<number> {
    await this.ensureReady();

    if (this.memoryFallback) {
      return this.memoryFallback.getSize();
    }

    const result = this.getStore('readonly');
    if (!result) return 0;

    return new Promise<number>((resolve) => {
      const request = result.store.count();
      request.onsuccess = () => resolve(request.result ?? 0);
      request.onerror = () => resolve(0);
    });
  }
}
