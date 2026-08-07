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
export declare class IndexedDBAdapter implements StorageAdapter {
    readonly name = "IndexedDBAdapter";
    readonly type: 'indexedDB';
    private readonly namespace;
    private db;
    private memoryFallback;
    /** Promise that resolves when the DB connection is ready (or failed). */
    private readonly ready;
    constructor(namespace?: string);
    /** IndexedDB is only available inside secure browser contexts. */
    isAvailable(): boolean;
    /** Wait for the DB to open (or fail) before every public operation. */
    private ensureReady;
    /** Open the DB and create the object store for this namespace if needed. */
    private init;
    /** Get a transaction and object store for this namespace. */
    private getStore;
    /** True when the adapter fell back to an in-memory store. */
    isUsingFallback(): boolean;
    /** Public proxy to the fallback (tests only). */
    _getFallback(): MemoryAdapter | null;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<string[]>;
    clear(): Promise<void>;
    getSize(): Promise<number>;
}
//# sourceMappingURL=indexeddb-adapter.d.ts.map