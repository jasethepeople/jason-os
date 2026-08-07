/**
 * @jason-os/privacy-kernel
 *
 * Privacy kernel — encryption, key management, zero-knowledge architecture.
 * Re-exports all public APIs.
 */
export { encryptAES256GCM, decryptAES256GCM, deriveKeyPBKDF2, sha256, generateSymmetricKey, secureRandom, fingerprintKey, } from './crypto-utils.js';
export type { AESGCMResult } from './crypto-utils.js';
export { Keychain } from './keychain.js';
export { PrivacyKernel } from './privacy-kernel.js';
//# sourceMappingURL=index.d.ts.map