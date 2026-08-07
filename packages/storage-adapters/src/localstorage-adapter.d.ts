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
export declare class LocalStorageAdapter implements StorageAdapter {
    readonly name = "LocalStorageAdapter";
    readonly type: 'localStorage';
    /** Key prefix applied to every key for namespace isolation. */
    private readonly prefix;
    constructor(namespace?: string);
    /** localStorage is only available in browser environments. */
    isAvailable(): boolean;
    /** Build the fully-qualified namespaced key. */
    private resolveKey;
    /** Extract the user-facing key from a fully-qualified key. */
    private stripKey;
    private getStorage;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<string[]>;
    clear(): Promise<void>;
    getSize(): Promise<number>;
    /**
     * Rough quota check — throws when the *new* value alone would exceed
     * the 5 MB localStorage limit. Does not account for existing data.
     */
    checkQuota(value: string): void;
    /** Return the full namespaced key (useful for debugging / assertions). */
    getNamespacedKey(key: string): string;
}
//# sourceMappingURL=localstorage-adapter.d.ts.map