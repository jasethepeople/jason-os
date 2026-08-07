/**
 * keychain.ts — In-memory key management for Jason-OS Privacy Kernel
 *
 * Stores keys in a Map with optional TTL-based expiration.
 * All operations are synchronous; purgeExpired() must be called explicitly.
 */
import type { KeyMaterial } from '@jason-os/shared';
export declare class Keychain {
    private readonly store;
    /**
     * Store a key with an optional TTL (milliseconds).
     */
    storeKey(keyId: string, key: CryptoKey, ttl?: number): void;
    /**
     * Retrieve a key by ID. Returns undefined if not found or expired.
     */
    getKey(keyId: string): CryptoKey | undefined;
    /**
     * Check whether a key exists and is not expired.
     */
    hasKey(keyId: string): boolean;
    /**
     * Remove a key by ID.
     */
    removeKey(keyId: string): boolean;
    /**
     * Remove all expired keys.
     * @returns number of keys removed
     */
    purgeExpired(): number;
    /**
     * List all key IDs (including expired ones — call purgeExpired() first to clean).
     */
    listKeys(): string[];
    /**
     * Remove all keys.
     */
    clear(): void;
    /**
     * Return key metadata as KeyMaterial (without the actual key).
     */
    getKeyMaterial(keyId: string): Omit<KeyMaterial, 'key'> | undefined;
    /**
     * Current number of stored keys.
     */
    size(): number;
}
//# sourceMappingURL=keychain.d.ts.map