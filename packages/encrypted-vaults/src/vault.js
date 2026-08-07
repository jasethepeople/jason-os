/**
 * vault.ts — Individual encrypted vault with shadow mode, plausible deniability,
 * and self-destruct capabilities.
 */
import { encryptAES256GCM, decryptAES256GCM, deriveKeyPBKDF2, secureRandom, sha256, } from '@jason-os/privacy-kernel';
import { PrivacyError } from '@jason-os/shared';
// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------
const VAULT_MAGIC = new Uint8Array([0x4a, 0x41, 0x53, 0x4f, 0x4e, 0x4f, 0x53]); // "JASONOS"
const SALT_SIZE = 32; // 256-bit salt
// ------------------------------------------------------------------
// Internal: serialize / deserialize
// ------------------------------------------------------------------
function serialize(value) {
    const json = JSON.stringify(value);
    return new TextEncoder().encode(json);
}
function deserialize(data) {
    const json = new TextDecoder().decode(data);
    return JSON.parse(json);
}
// ------------------------------------------------------------------
// EncryptedVault implementation
// ------------------------------------------------------------------
export class EncryptedVault {
    id;
    isShadow;
    createdAt;
    _name;
    salt;
    verificationTag; // sha256(key + magic)
    itemStore = new Map();
    key; // derived key (only when unlocked)
    locked = true;
    failedAttempts = 0;
    selfDestruct;
    lastAccessedAt;
    burnTimer;
    _burned = false;
    constructor(id, name, password, options) {
        this.id = id;
        this._name = name;
        this.isShadow = options?.isShadow ?? false;
        this.createdAt = Date.now();
        this.lastAccessedAt = this.createdAt;
        this.selfDestruct = options?.selfDestruct;
        this.salt = secureRandom(SALT_SIZE);
        // Derive key and store verification tag
        this.key = deriveKeyPBKDF2(password, this.salt);
        this.verificationTag = sha256(concat(this.key, VAULT_MAGIC));
        this.locked = false;
        // Start self-destruct timer if time-based
        this.resetBurnTimer();
    }
    get name() {
        return this._name;
    }
    // -- Lock / Unlock ------------------------------------------------
    async unlock(password) {
        if (this._burned) {
            throw new PrivacyError('Vault has been burned', { vaultId: this.id });
        }
        // Check duress password first
        if (this.selfDestruct?.type === 'duress' && this.selfDestruct.duressPassword === password) {
            await this.burn();
            return false; // Vault burned
        }
        const candidateKey = deriveKeyPBKDF2(password, this.salt);
        const candidateTag = sha256(concat(candidateKey, VAULT_MAGIC));
        if (!constantTimeEquals(candidateTag, this.verificationTag)) {
            // Wrong password
            this.failedAttempts++;
            // Check attempt-based self-destruct
            if (this.selfDestruct?.type === 'attempts' &&
                this.selfDestruct.maxAttempts !== undefined &&
                this.failedAttempts >= this.selfDestruct.maxAttempts) {
                await this.burn();
            }
            // Securely discard candidate key
            candidateKey.fill(0);
            return false;
        }
        // Success
        this.key = candidateKey;
        this.locked = false;
        this.failedAttempts = 0;
        this.lastAccessedAt = Date.now();
        this.resetBurnTimer();
        return true;
    }
    lock() {
        if (this.key) {
            this.key.fill(0);
            this.key = undefined;
        }
        this.locked = true;
        this.clearBurnTimer();
    }
    isLocked() {
        return this.locked || this._burned;
    }
    // -- Data operations ----------------------------------------------
    async store(key, value) {
        this.ensureUnlocked();
        const encrypted = encryptAES256GCM(serialize(value), this.key);
        this.itemStore.set(key, {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
        });
        this.lastAccessedAt = Date.now();
        this.resetBurnTimer();
    }
    async retrieve(key) {
        this.ensureUnlocked();
        const item = this.itemStore.get(key);
        if (!item)
            return undefined;
        const decrypted = decryptAES256GCM(item.ciphertext, item.iv, item.authTag, this.key);
        this.lastAccessedAt = Date.now();
        this.resetBurnTimer();
        return deserialize(decrypted);
    }
    async delete(key) {
        this.ensureUnlocked();
        this.itemStore.delete(key);
        this.lastAccessedAt = Date.now();
        this.resetBurnTimer();
    }
    async list() {
        this.ensureUnlocked();
        this.lastAccessedAt = Date.now();
        this.resetBurnTimer();
        return Array.from(this.itemStore.keys());
    }
    // -- Burn (self-destruct) -----------------------------------------
    async burn() {
        this._burned = true;
        this.clearBurnTimer();
        // Wipe key material
        if (this.key) {
            this.key.fill(0);
            this.key = undefined;
        }
        this.salt.fill(0);
        this.verificationTag.fill(0);
        this.locked = true;
        // Overwrite and clear all encrypted items
        for (const [, item] of this.itemStore) {
            item.ciphertext.fill(0);
            item.iv.fill(0);
            item.authTag.fill(0);
        }
        this.itemStore.clear();
    }
    // -- Metadata -----------------------------------------------------
    getMetadata() {
        return {
            id: this.id,
            name: this._name,
            isShadow: this.isShadow,
            itemCount: this.itemStore.size,
            createdAt: this.createdAt,
            lastAccessedAt: this.lastAccessedAt,
            selfDestruct: this.selfDestruct,
        };
    }
    // -- Internal helpers ---------------------------------------------
    ensureUnlocked() {
        if (this._burned) {
            throw new PrivacyError('Vault has been burned', { vaultId: this.id });
        }
        if (this.locked || !this.key) {
            throw new PrivacyError('Vault is locked', { vaultId: this.id });
        }
    }
    resetBurnTimer() {
        this.clearBurnTimer();
        if (this.selfDestruct?.type === 'time' && this.selfDestruct.timeLimitMs && !this.locked) {
            this.burnTimer = setTimeout(() => {
                void this.burn();
            }, this.selfDestruct.timeLimitMs);
        }
    }
    clearBurnTimer() {
        if (this.burnTimer !== undefined) {
            clearTimeout(this.burnTimer);
            this.burnTimer = undefined;
        }
    }
    /** Get raw salt bytes (for plausible deniability — looks like random data) */
    getSalt() {
        return new Uint8Array(this.salt);
    }
    /** Get verification tag bytes */
    getVerificationTag() {
        return new Uint8Array(this.verificationTag);
    }
    /** Internal: check if burned */
    isBurned() {
        return this._burned;
    }
    /** Internal: get self-destruct policy */
    getSelfDestructPolicy() {
        return this.selfDestruct;
    }
    /** Internal: get failed attempts count */
    getFailedAttempts() {
        return this.failedAttempts;
    }
}
// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------
/** Constant-time comparison to prevent timing attacks */
function constantTimeEquals(a, b) {
    if (a.length !== b.length)
        return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a[i] ^ b[i];
    }
    return result === 0;
}
/** Concatenate two Uint8Arrays */
function concat(a, b) {
    const result = new Uint8Array(a.length + b.length);
    result.set(a, 0);
    result.set(b, a.length);
    return result;
}
//# sourceMappingURL=vault.js.map