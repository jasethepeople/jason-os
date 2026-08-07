/**
 * @jason-os/storage-adapters
 *
 * In-memory (Map-based) storage adapter.
 *
 * - Ultra-fast O(1) reads/writes
 * - No persistence across reloads
 * - Ideal for unit tests, SSR / Node environments, and GHOST tier data
 */
export class MemoryAdapter {
    name = 'MemoryAdapter';
    type = 'memory';
    /** Internal key-value store scoped to this adapter instance. */
    store = new Map();
    /** Key prefix applied to every key for namespace isolation. */
    prefix;
    constructor(namespace = 'default') {
        this.prefix = `jason-os:${namespace}:`;
    }
    /** The memory adapter is always available. */
    isAvailable() {
        return true;
    }
    /** Build the fully-qualified namespaced key. */
    resolveKey(key) {
        return `${this.prefix}${key}`;
    }
    /** Extract the user-facing key from a fully-qualified key. */
    stripKey(namespaced) {
        return namespaced.startsWith(this.prefix)
            ? namespaced.slice(this.prefix.length)
            : namespaced;
    }
    async get(key) {
        const resolved = this.resolveKey(key);
        return this.store.has(resolved) ? this.store.get(resolved) : null;
    }
    async set(key, value) {
        const resolved = this.resolveKey(key);
        this.store.set(resolved, value);
    }
    async delete(key) {
        const resolved = this.resolveKey(key);
        this.store.delete(resolved);
    }
    async list(prefix) {
        const keys = [];
        for (const key of this.store.keys()) {
            const stripped = this.stripKey(key);
            if (prefix === undefined || stripped.startsWith(prefix)) {
                keys.push(stripped);
            }
        }
        return keys.sort();
    }
    async clear() {
        for (const key of this.store.keys()) {
            if (key.startsWith(this.prefix)) {
                this.store.delete(key);
            }
        }
    }
    async getSize() {
        let count = 0;
        for (const key of this.store.keys()) {
            if (key.startsWith(this.prefix))
                count++;
        }
        return count;
    }
    /** Internal helper for tests — direct access to backing Map. */
    _getStore() {
        return this.store;
    }
}
//# sourceMappingURL=memory-adapter.js.map