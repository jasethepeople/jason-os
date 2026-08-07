/**
 * vault.ts — Individual encrypted vault with shadow mode, plausible deniability,
 * and self-destruct capabilities.
 */

import {
  encryptAES256GCM,
  decryptAES256GCM,
  deriveKeyPBKDF2,
  secureRandom,
  sha256,
} from '@jason-os/privacy-kernel';
import { PrivacyError } from '@jason-os/shared';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const VAULT_MAGIC = new Uint8Array([0x4a, 0x41, 0x53, 0x4f, 0x4e, 0x4f, 0x53]); // "JASONOS"
const SALT_SIZE = 32; // 256-bit salt

// ------------------------------------------------------------------
// Interfaces
// ------------------------------------------------------------------

export interface SelfDestructPolicy {
  type: 'time' | 'attempts' | 'duress';
  /** Time limit in ms before auto-burn after inactivity */
  timeLimitMs?: number;
  /** Max failed unlock attempts before auto-burn */
  maxAttempts?: number;
  /** Duress password — entering it triggers immediate burn */
  duressPassword?: string;
}

export interface VaultMetadata {
  id: string;
  name: string;
  isShadow: boolean;
  itemCount: number;
  createdAt: number;
  lastAccessedAt: number;
  selfDestruct: SelfDestructPolicy | undefined;
}

export interface VaultOptions {
  isShadow?: boolean;
  selfDestruct?: SelfDestructPolicy;
}

interface EncryptedItem {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
}

// ------------------------------------------------------------------
// Vault interface
// ------------------------------------------------------------------

export interface Vault {
  readonly id: string;
  readonly name: string;
  readonly isShadow: boolean;
  readonly createdAt: number;
  store<T>(key: string, value: T): Promise<void>;
  retrieve<T>(key: string): Promise<T | undefined>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
  lock(): void;
  unlock(password: string): Promise<boolean>;
  isLocked(): boolean;
  burn(): Promise<void>;
  getMetadata(): VaultMetadata;
}

// ------------------------------------------------------------------
// Internal: serialize / deserialize
// ------------------------------------------------------------------

function serialize<T>(value: T): Uint8Array {
  const json = JSON.stringify(value);
  return new TextEncoder().encode(json);
}

function deserialize<T>(data: Uint8Array): T {
  const json = new TextDecoder().decode(data);
  return JSON.parse(json) as T;
}

// ------------------------------------------------------------------
// EncryptedVault implementation
// ------------------------------------------------------------------

export class EncryptedVault implements Vault {
  readonly id: string;
  readonly isShadow: boolean;
  readonly createdAt: number;

  private _name: string;
  private salt: Uint8Array;
  private verificationTag: Uint8Array; // sha256(key + magic)
  private itemStore: Map<string, EncryptedItem> = new Map();
  private key: Uint8Array | undefined; // derived key (only when unlocked)
  private locked: boolean = true;
  private failedAttempts: number = 0;
  private selfDestruct: SelfDestructPolicy | undefined;
  private lastAccessedAt: number;
  private burnTimer: ReturnType<typeof setTimeout> | undefined;
  private _burned: boolean = false;

  constructor(id: string, name: string, password: string, options?: VaultOptions) {
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

  get name(): string {
    return this._name;
  }

  // -- Lock / Unlock ------------------------------------------------

  async unlock(password: string): Promise<boolean> {
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
      if (
        this.selfDestruct?.type === 'attempts' &&
        this.selfDestruct.maxAttempts !== undefined &&
        this.failedAttempts >= this.selfDestruct.maxAttempts
      ) {
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

  lock(): void {
    if (this.key) {
      this.key.fill(0);
      this.key = undefined;
    }
    this.locked = true;
    this.clearBurnTimer();
  }

  isLocked(): boolean {
    return this.locked || this._burned;
  }

  // -- Data operations ----------------------------------------------

  async store<T>(key: string, value: T): Promise<void> {
    this.ensureUnlocked();
    const encrypted = encryptAES256GCM(serialize(value), this.key!);
    this.itemStore.set(key, {
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    });
    this.lastAccessedAt = Date.now();
    this.resetBurnTimer();
  }

  async retrieve<T>(key: string): Promise<T | undefined> {
    this.ensureUnlocked();
    const item = this.itemStore.get(key);
    if (!item) return undefined;
    const decrypted = decryptAES256GCM(item.ciphertext, item.iv, item.authTag, this.key!);
    this.lastAccessedAt = Date.now();
    this.resetBurnTimer();
    return deserialize<T>(decrypted);
  }

  async delete(key: string): Promise<void> {
    this.ensureUnlocked();
    this.itemStore.delete(key);
    this.lastAccessedAt = Date.now();
    this.resetBurnTimer();
  }

  async list(): Promise<string[]> {
    this.ensureUnlocked();
    this.lastAccessedAt = Date.now();
    this.resetBurnTimer();
    return Array.from(this.itemStore.keys());
  }

  // -- Burn (self-destruct) -----------------------------------------

  async burn(): Promise<void> {
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

  getMetadata(): VaultMetadata {
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

  private ensureUnlocked(): void {
    if (this._burned) {
      throw new PrivacyError('Vault has been burned', { vaultId: this.id });
    }
    if (this.locked || !this.key) {
      throw new PrivacyError('Vault is locked', { vaultId: this.id });
    }
  }

  private resetBurnTimer(): void {
    this.clearBurnTimer();
    if (this.selfDestruct?.type === 'time' && this.selfDestruct.timeLimitMs && !this.locked) {
      this.burnTimer = setTimeout(() => {
        void this.burn();
      }, this.selfDestruct.timeLimitMs);
    }
  }

  private clearBurnTimer(): void {
    if (this.burnTimer !== undefined) {
      clearTimeout(this.burnTimer);
      this.burnTimer = undefined;
    }
  }

  /** Get raw salt bytes (for plausible deniability — looks like random data) */
  getSalt(): Uint8Array {
    return new Uint8Array(this.salt);
  }

  /** Get verification tag bytes */
  getVerificationTag(): Uint8Array {
    return new Uint8Array(this.verificationTag);
  }

  /** Internal: check if burned */
  isBurned(): boolean {
    return this._burned;
  }

  /** Internal: get self-destruct policy */
  getSelfDestructPolicy(): SelfDestructPolicy | undefined {
    return this.selfDestruct;
  }

  /** Internal: get failed attempts count */
  getFailedAttempts(): number {
    return this.failedAttempts;
  }
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

/** Constant-time comparison to prevent timing attacks */
function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}

/** Concatenate two Uint8Arrays */
function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}
