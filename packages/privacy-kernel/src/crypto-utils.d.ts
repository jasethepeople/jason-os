/**
 * crypto-utils.ts — Low-level cryptographic primitives for Jason-OS Privacy Kernel
 *
 * Uses Node.js native `crypto` module (AES-256-GCM, PBKDF2, SHA-256, RSA-OAEP).
 * All functions are async and return typed, serialisable values.
 */
export interface AESGCMResult {
    readonly ciphertext: Uint8Array;
    readonly iv: Uint8Array;
    readonly authTag: Uint8Array;
}
/**
 * Encrypt plaintext using AES-256-GCM.
 * @param data — plaintext
 * @param key — 32-byte symmetric key as Uint8Array
 * @returns ciphertext, IV, and auth tag
 */
export declare function encryptAES256GCM(data: Uint8Array, key: Uint8Array): AESGCMResult;
/**
 * Decrypt AES-256-GCM ciphertext.
 * @param ciphertext — encrypted data
 * @param iv — 16-byte IV
 * @param authTag — 16-byte authentication tag
 * @param key — 32-byte symmetric key
 * @returns plaintext
 */
export declare function decryptAES256GCM(ciphertext: Uint8Array, iv: Uint8Array, authTag: Uint8Array, key: Uint8Array): Uint8Array;
/**
 * Derive a 256-bit key from a password using PBKDF2-HMAC-SHA256.
 * @param password — user password
 * @param salt — at least 16 bytes recommended
 * @returns 32-byte derived key
 */
export declare function deriveKeyPBKDF2(password: string, salt: Uint8Array): Uint8Array;
/**
 * Compute SHA-256 digest.
 * @param data — input bytes
 * @returns 32-byte hash
 */
export declare function sha256(data: Uint8Array): Uint8Array;
/**
 * Generate a random 256-bit symmetric key.
 * @returns 32-byte key
 */
export declare function generateSymmetricKey(): Uint8Array;
/**
 * Generate cryptographically secure random bytes.
 * @param bytes — number of bytes to generate
 * @returns random bytes
 */
export declare function secureRandom(bytes: number): Uint8Array;
/**
 * Compute a short hex fingerprint of key material (first 8 bytes of SHA-256).
 * @param keyData — raw key bytes
 * @returns 16-character hex string
 */
export declare function fingerprintKey(keyData: Uint8Array): string;
//# sourceMappingURL=crypto-utils.d.ts.map