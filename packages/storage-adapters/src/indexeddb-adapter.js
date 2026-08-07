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
import { MemoryAdapter } from './memory-adapter.js';
/** IndexedDB database name. */
const DB_NAME = 'jason-os-storage';
/** Schema version. Bump when object-store layout changes. */
const DB_VERSION = 1;
/** Key path used inside every object store. */
const KEY_PATH = 'key';
export class IndexedDBAdapter {
    name = 'IndexedDBAdapter';
    type = 'indexedDB';
    namespace;
    db = null;
    memoryFallback = null;
    /** Promise that resolves when the DB connection is ready (or failed). */
    ready;
    constructor(namespace = 'default') {
        this.namespace = namespace;
        this.ready = this.init();
    }
    /** IndexedDB is only available inside secure browser contexts. */
    isAvailable() {
        try {
            return (typeof window !== 'undefined' &&
                typeof window.indexedDB !== 'undefined' &&
                window.indexedDB !== null);
        }
        catch {
            return false;
        }
    }
    /** Wait for the DB to open (or fail) before every public operation. */
    async ensureReady() {
        await this.ready;
    }
    /** Open the DB and create the object store for this namespace if needed. */
    async init() {
        if (!this.isAvailable()) {
            this.memoryFallback = new MemoryAdapter(this.namespace);
            return;
        }
        return new Promise((resolve) => {
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
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.namespace)) {
                    const store = db.createObjectStore(this.namespace, { keyPath: KEY_PATH });
                    // Index on timestamp for time-based queries
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }
    /** Get a transaction and object store for this namespace. */
    getStore(mode) {
        if (!this.db)
            return null;
        const tx = this.db.transaction([this.namespace], mode);
        const store = tx.objectStore(this.namespace);
        return { store, tx };
    }
    /** True when the adapter fell back to an in-memory store. */
    isUsingFallback() {
        return this.memoryFallback !== null;
    }
    /** Public proxy to the fallback (tests only). */
    _getFallback() {
        return this.memoryFallback;
    }
    async get(key) {
        await this.ensureReady();
        if (this.memoryFallback) {
            return this.memoryFallback.get(key);
        }
        const result = this.getStore('readonly');
        if (!result)
            return null;
        return new Promise((resolve) => {
            const request = result.store.get(key);
            request.onsuccess = () => {
                resolve(request.result?.value ?? null);
            };
            request.onerror = () => resolve(null);
        });
    }
    async set(key, value) {
        await this.ensureReady();
        if (this.memoryFallback) {
            return this.memoryFallback.set(key, value);
        }
        const result = this.getStore('readwrite');
        if (!result)
            return;
        const record = { key, value, timestamp: Date.now() };
        return new Promise((resolve, reject) => {
            const request = result.store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'));
        });
    }
    async delete(key) {
        await this.ensureReady();
        if (this.memoryFallback) {
            return this.memoryFallback.delete(key);
        }
        const result = this.getStore('readwrite');
        if (!result)
            return;
        return new Promise((resolve, reject) => {
            const request = result.store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'));
        });
    }
    async list(prefix) {
        await this.ensureReady();
        if (this.memoryFallback) {
            return this.memoryFallback.list(prefix);
        }
        const result = this.getStore('readonly');
        if (!result)
            return [];
        return new Promise((resolve) => {
            const keys = [];
            const request = result.store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const record = cursor.value;
                    if (prefix === undefined || record.key.startsWith(prefix)) {
                        keys.push(record.key);
                    }
                    cursor.continue();
                }
                else {
                    resolve(keys.sort());
                }
            };
            request.onerror = () => resolve([]);
        });
    }
    async clear() {
        await this.ensureReady();
        if (this.memoryFallback) {
            return this.memoryFallback.clear();
        }
        const result = this.getStore('readwrite');
        if (!result)
            return;
        return new Promise((resolve, reject) => {
            const request = result.store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error ?? new Error('IndexedDB clear failed'));
        });
    }
    async getSize() {
        await this.ensureReady();
        if (this.memoryFallback) {
            return this.memoryFallback.getSize();
        }
        const result = this.getStore('readonly');
        if (!result)
            return 0;
        return new Promise((resolve) => {
            const request = result.store.count();
            request.onsuccess = () => resolve(request.result ?? 0);
            request.onerror = () => resolve(0);
        });
    }
}
//# sourceMappingURL=indexeddb-adapter.js.map