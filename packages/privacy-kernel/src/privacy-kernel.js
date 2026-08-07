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
import { PrivacyError } from '@jason-os/shared';
import { Keychain } from './keychain.js';
import { encryptAES256GCM, decryptAES256GCM, deriveKeyPBKDF2, sha256, generateSymmetricKey, secureRandom, fingerprintKey, } from './crypto-utils.js';
// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const KEY_ID_BYTES = 16;
const GHOST_KEY_TTL_MS = 60_000; // 1 minute
const CURRENT_VERSION = 1;
// ------------------------------------------------------------------
// PrivacyKernel implementation
// ------------------------------------------------------------------
export class PrivacyKernel {
    _tier = 'PUBLIC';
    keychain = new Keychain();
    tierHandlers = new Set();
    _keyCounter = 0;
    // ------------------------------------------------------------------
    // Privacy tier management
    // ------------------------------------------------------------------
    getPrivacyTier() {
        return this._tier;
    }
    setPrivacyTier(tier) {
        if (this._tier === tier)
            return;
        const previousTier = this._tier;
        this._tier = tier;
        // GHOST tier: clear all existing keys and set ephemeral TTL
        if (tier === 'GHOST') {
            this.keychain.clear();
        }
        // Downgrading from GHOST/SHADOW to PUBLIC/SOFT: clear sensitive keys
        if ((previousTier === 'GHOST' || previousTier === 'SHADOW') && (tier === 'PUBLIC' || tier === 'SOFT')) {
            this.keychain.clear();
        }
        for (const handler of this.tierHandlers) {
            try {
                handler(tier);
            }
            catch {
                // Callback errors must not break tier transition
            }
        }
    }
    onTierChange(handler) {
        this.tierHandlers.add(handler);
        return () => {
            this.tierHandlers.delete(handler);
        };
    }
    // ------------------------------------------------------------------
    // Encryption / Decryption
    // ------------------------------------------------------------------
    async encrypt(data, keyId) {
        const tier = this._tier;
        if (tier === 'PUBLIC') {
            // PUBLIC: store plaintext with a null-encryption marker
            return {
                ciphertext: data,
                iv: new Uint8Array(0),
                authTag: new Uint8Array(0),
                keyId,
                algorithm: 'AES-256-GCM',
                version: CURRENT_VERSION,
            };
        }
        const key = this.resolveKey(keyId);
        const rawKey = await this.exportKeyToRaw(key);
        const result = encryptAES256GCM(data, rawKey);
        return {
            ciphertext: result.ciphertext,
            iv: result.iv,
            authTag: result.authTag,
            keyId,
            algorithm: 'AES-256-GCM',
            version: CURRENT_VERSION,
        };
    }
    async decrypt(blob, keyId) {
        if (this._tier === 'PUBLIC') {
            // PUBLIC tier: passthrough
            return blob.ciphertext;
        }
        // Validate blob
        if (blob.algorithm !== 'AES-256-GCM') {
            throw new PrivacyError(`Unsupported algorithm: ${blob.algorithm}`);
        }
        // PUBLIC-tier blob has empty IV/authTag
        if (blob.iv.length === 0 && blob.authTag.length === 0) {
            return blob.ciphertext;
        }
        const key = this.resolveKey(keyId);
        const rawKey = await this.exportKeyToRaw(key);
        return decryptAES256GCM(blob.ciphertext, blob.iv, blob.authTag, rawKey);
    }
    // ------------------------------------------------------------------
    // Key derivation
    // ------------------------------------------------------------------
    async deriveKey(password, salt) {
        const rawKey = deriveKeyPBKDF2(password, salt);
        return this.importRawKey(rawKey, 'AES-GCM');
    }
    // ------------------------------------------------------------------
    // KeyPair generation (RSA-OAEP)
    // ------------------------------------------------------------------
    async generateKeyPair() {
        const crypto = globalThis.crypto;
        const pair = await crypto.subtle.generateKey({
            name: 'RSA-OAEP',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        }, true, // extractable
        ['encrypt', 'decrypt']);
        const keyId = this.makeKeyId();
        this.keychain.storeKey(keyId, pair.privateKey);
        return {
            publicKey: pair.publicKey,
            privateKey: pair.privateKey,
            keyId,
        };
    }
    // ------------------------------------------------------------------
    // Symmetric key generation
    // ------------------------------------------------------------------
    async generateSymmetricKey() {
        const rawKey = generateSymmetricKey();
        const key = await this.importRawKey(rawKey, 'AES-GCM');
        const keyId = this.makeKeyId();
        const ttl = this._tier === 'GHOST' ? GHOST_KEY_TTL_MS : undefined;
        this.keychain.storeKey(keyId, key, ttl);
        return {
            keyId,
            key,
            createdAt: Date.now(),
            expiresAt: ttl !== undefined ? Date.now() + ttl : undefined,
        };
    }
    // ------------------------------------------------------------------
    // Key import / export
    // ------------------------------------------------------------------
    async importKey(rawKey, algorithm) {
        const normalized = algorithm.toUpperCase();
        if (normalized === 'AES-256-GCM' || normalized === 'AES-GCM') {
            return this.importRawKey(rawKey, 'AES-GCM');
        }
        if (normalized === 'RSA-OAEP') {
            return this.importRawKey(rawKey, 'RSA-OAEP');
        }
        throw new PrivacyError(`Unsupported import algorithm: ${algorithm}`);
    }
    async exportKey(key) {
        const crypto = globalThis.crypto;
        const exported = await crypto.subtle.exportKey('raw', key);
        return new Uint8Array(exported);
    }
    // ------------------------------------------------------------------
    // Hashing
    // ------------------------------------------------------------------
    async hash(data) {
        return sha256(data);
    }
    // ------------------------------------------------------------------
    // Keychain helpers
    // ------------------------------------------------------------------
    /**
     * Purge expired keys from the keychain.
     */
    purgeExpiredKeys() {
        return this.keychain.purgeExpired();
    }
    /**
     * Get the underlying keychain instance (for testing / advanced use).
     */
    getKeychain() {
        return this.keychain;
    }
    /**
     * List all key IDs currently in the keychain.
     */
    listKeyIds() {
        return this.keychain.listKeys();
    }
    /**
     * Manually remove a key.
     */
    removeKey(keyId) {
        return this.keychain.removeKey(keyId);
    }
    /**
     * Clear all keys and handlers. Used for testing and teardown.
     */
    destroy() {
        this.keychain.clear();
        this.tierHandlers.clear();
        this._tier = 'PUBLIC';
        this._keyCounter = 0;
    }
    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------
    makeKeyId() {
        this._keyCounter++;
        const random = secureRandom(KEY_ID_BYTES);
        const fp = fingerprintKey(random);
        return `pk-${fp}-${this._keyCounter}`;
    }
    resolveKey(keyId) {
        const key = this.keychain.getKey(keyId);
        if (key === undefined) {
            throw new PrivacyError(`Key not found: ${keyId}`);
        }
        return key;
    }
    async importRawKey(rawKey, algorithm) {
        const crypto = globalThis.crypto;
        return crypto.subtle.importKey('raw', rawKey, algorithm, true, // extractable
        algorithm === 'AES-GCM' ? ['encrypt', 'decrypt'] : ['encrypt', 'decrypt']);
    }
    async exportKeyToRaw(key) {
        return this.exportKey(key);
    }
}
//# sourceMappingURL=privacy-kernel.js.map