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
export declare class MemoryAdapter implements StorageAdapter {
    readonly name = "MemoryAdapter";
    readonly type: 'memory';
    /** Internal key-value store scoped to this adapter instance. */
    private readonly store;
    /** Key prefix applied to every key for namespace isolation. */
    private readonly prefix;
    constructor(namespace?: string);
    /** The memory adapter is always available. */
    isAvailable(): boolean;
    /** Build the fully-qualified namespaced key. */
    private resolveKey;
    /** Extract the user-facing key from a fully-qualified key. */
    private stripKey;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<string[]>;
    clear(): Promise<void>;
    getSize(): Promise<number>;
    /** Internal helper for tests — direct access to backing Map. */
    _getStore(): Map<string, string>;
}
//# sourceMappingURL=memory-adapter.d.ts.map