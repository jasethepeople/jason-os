/**
 * privacy-kernel.ts — Main PrivacyKernel implementation for Jason-OS
 *
 * Implements the full PrivacyKernel interface with four privacy tiers:
 *   PUBLIC  — passthrough (no encryption)
 *   SOFT    — light encryption (AES-256-GCM with derived keys)
 *   SHADOW  — full encryption (per-session keys, RSA key pair)
 *   GHOST   — maximum + ephemeral (keys auto-expire, memory cleared)
 *
 * Integrates with the Keychain for in-memory key storage.
 */
import type { PrivacyKernel as IPrivacyKernel, PrivacyTier, EncryptedBlob, KeyPair, KeyMaterial } from '@jason-os/shared';
import { Keychain } from './keychain.js';
export declare class PrivacyKernel implements IPrivacyKernel {
    private _tier;
    private readonly keychain;
    private readonly tierHandlers;
    private _keyCounter;
    getPrivacyTier(): PrivacyTier;
    setPrivacyTier(tier: PrivacyTier): void;
    onTierChange(handler: (tier: PrivacyTier) => void): () => void;
    encrypt(data: Uint8Array, keyId: string): Promise<EncryptedBlob>;
    decrypt(blob: EncryptedBlob, keyId: string): Promise<Uint8Array>;
    deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
    generateKeyPair(): Promise<KeyPair>;
    generateSymmetricKey(): Promise<KeyMaterial>;
    importKey(rawKey: Uint8Array, algorithm: string): Promise<CryptoKey>;
    exportKey(key: CryptoKey): Promise<Uint8Array>;
    hash(data: Uint8Array): Promise<Uint8Array>;
    /**
     * Purge expired keys from the keychain.
     */
    purgeExpiredKeys(): number;
    /**
     * Get the underlying keychain instance (for testing / advanced use).
     */
    getKeychain(): Keychain;
    /**
     * List all key IDs currently in the keychain.
     */
    listKeyIds(): string[];
    /**
     * Manually remove a key.
     */
    removeKey(keyId: string): boolean;
    /**
     * Clear all keys and handlers. Used for testing and teardown.
     */
    destroy(): void;
    private makeKeyId;
    private resolveKey;
    private importRawKey;
    private exportKeyToRaw;
}
//# sourceMappingURL=privacy-kernel.d.ts.map