/**
 * data-namespace.ts — Individual encrypted namespace implementation for Jason-OS
 *
 * Stores data as JSON in an in-memory Map. When encrypted=true, values are
 * encrypted using the PrivacyKernel (AES-256-GCM). Key names remain plaintext
 * for querying purposes.
 */
import type { DataNamespace, DataFilter, NamespacePermissions } from '@jason-os/shared';
import { PrivacyKernel } from '@jason-os/privacy-kernel';
export declare class DataNamespaceImpl implements DataNamespace {
    readonly moduleId: string;
    private readonly _data;
    private _burned;
    private readonly _encrypted;
    private readonly _permissions;
    private readonly _kernel;
    private _keyId;
    constructor(moduleId: string, permissions: NamespacePermissions, kernel: PrivacyKernel, keyId?: string);
    private ensureKey;
    private encryptValue;
    private decryptValue;
    private ensureNotBurned;
    /**
     * Retrieve a value by key. Returns undefined if not found.
     */
    get<T>(key: string): Promise<T | undefined>;
    /**
     * Store a value by key. Overwrites existing.
     */
    set<T>(key: string, value: T): Promise<void>;
    /**
     * Delete a single key.
     */
    delete(key: string): Promise<void>;
    /**
     * Query entries with an optional filter (prefix, time range, pagination).
     */
    query(filter: DataFilter): Promise<Record<string, unknown>>;
    /**
     * List all keys in this namespace.
     */
    listKeys(): Promise<string[]>;
    /**
     * Irreversibly destroy all data in this namespace.
     */
    burn(): Promise<void>;
    /**
     * Get the number of keys stored.
     */
    getSize(): Promise<number>;
    /**
     * Whether this namespace has been burned.
     */
    isBurned(): boolean;
    /**
     * Whether this namespace encrypts its values.
     */
    isEncrypted(): boolean;
    /**
     * Get the permissions for this namespace.
     */
    getPermissions(): NamespacePermissions;
    /**
     * Get the encryption key ID (if encrypted).
     */
    getKeyId(): string | undefined;
}
//# sourceMappingURL=data-namespace.d.ts.map