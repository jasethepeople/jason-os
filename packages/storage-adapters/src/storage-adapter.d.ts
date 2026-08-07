/**
 * @jason-os/storage-adapters
 *
 * Base StorageAdapter interface — implemented by all storage backends.
 * Every adapter provides the same CRUD contract regardless of the
 * underlying engine (localStorage, IndexedDB, SQLite, memory).
 */
export interface StorageAdapter {
    /** Human-readable adapter name (e.g. "localStorage", "IndexedDB") */
    readonly name: string;
    /** Underlying engine type */
    readonly type: 'localStorage' | 'indexedDB' | 'sqlite' | 'memory';
    /** Check whether the backing store is usable in the current environment */
    isAvailable(): boolean;
    /** Retrieve a value by key. Returns `null` when the key is absent. */
    get(key: string): Promise<string | null>;
    /** Store a value (overwrites existing). */
    set(key: string, value: string): Promise<void>;
    /** Remove a single key. */
    delete(key: string): Promise<void>;
    /** List keys, optionally filtered by prefix. */
    list(prefix?: string): Promise<string[]>;
    /** Remove every key managed by this adapter instance. */
    clear(): Promise<void>;
    /** Return the count of keys managed by this adapter instance. */
    getSize(): Promise<number>;
}
//# sourceMappingURL=storage-adapter.d.ts.map