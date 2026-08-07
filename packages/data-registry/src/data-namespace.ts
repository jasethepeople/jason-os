/**
 * data-namespace.ts — Individual encrypted namespace implementation for Jason-OS
 *
 * Stores data as JSON in an in-memory Map. When encrypted=true, values are
 * encrypted using the PrivacyKernel (AES-256-GCM). Key names remain plaintext
 * for querying purposes.
 */

import type {
  DataNamespace,
  DataFilter,
  NamespacePermissions,
  EncryptedBlob,
} from '@jason-os/shared';
import { PrivacyError } from '@jason-os/shared';
import { PrivacyKernel } from '@jason-os/privacy-kernel';

// ------------------------------------------------------------------
// Internal entry with metadata
// ------------------------------------------------------------------

interface DataEntry {
  value: string; // encrypted JSON string or plaintext JSON string
  createdAt: number;
  modifiedAt: number;
}

// ------------------------------------------------------------------
// Helpers for Uint8Array <-> base64 serialization
// ------------------------------------------------------------------

function uint8ArrayToBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString('base64');
}

function base64ToUint8Array(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

function serializeEncryptedBlob(blob: EncryptedBlob): string {
  return JSON.stringify({
    ciphertext: uint8ArrayToBase64(blob.ciphertext),
    iv: uint8ArrayToBase64(blob.iv),
    authTag: uint8ArrayToBase64(blob.authTag),
    keyId: blob.keyId,
    algorithm: blob.algorithm,
    version: blob.version,
  });
}

function deserializeEncryptedBlob(json: string): EncryptedBlob {
  const parsed = JSON.parse(json) as {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyId: string;
    algorithm: 'AES-256-GCM';
    version: number;
  };
  return {
    ciphertext: base64ToUint8Array(parsed.ciphertext),
    iv: base64ToUint8Array(parsed.iv),
    authTag: base64ToUint8Array(parsed.authTag),
    keyId: parsed.keyId,
    algorithm: parsed.algorithm,
    version: parsed.version,
  };
}

// ------------------------------------------------------------------
// DataNamespaceImpl
// ------------------------------------------------------------------

export class DataNamespaceImpl implements DataNamespace {
  readonly moduleId: string;
  private readonly _data: Map<string, DataEntry>;
  private _burned: boolean;
  private readonly _encrypted: boolean;
  private readonly _permissions: NamespacePermissions;
  private readonly _kernel: PrivacyKernel;
  private _keyId: string | undefined;

  constructor(
    moduleId: string,
    permissions: NamespacePermissions,
    kernel: PrivacyKernel,
    keyId?: string
  ) {
    this.moduleId = moduleId;
    this._data = new Map();
    this._burned = false;
    this._encrypted = permissions.encrypted;
    this._permissions = permissions;
    this._kernel = kernel;
    this._keyId = keyId;
  }

  // ------------------------------------------------------------------
  // Encryption helpers
  // ------------------------------------------------------------------

  private async ensureKey(): Promise<string> {
    if (!this._encrypted) {
      return '';
    }
    if (this._keyId === undefined) {
      const keyMaterial = await this._kernel.generateSymmetricKey();
      this._keyId = keyMaterial.keyId;
    }
    return this._keyId;
  }

  private async encryptValue(value: unknown): Promise<string> {
    if (!this._encrypted) {
      return JSON.stringify(value);
    }

    const keyId = await this.ensureKey();
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const blob = await this._kernel.encrypt(plaintext, keyId);
    return serializeEncryptedBlob(blob);
  }

  private async decryptValue(stored: string): Promise<unknown> {
    if (!this._encrypted) {
      return JSON.parse(stored) as unknown;
    }

    const keyId = this._keyId;
    if (keyId === undefined) {
      throw new PrivacyError(`No encryption key available for namespace ${this.moduleId}`);
    }

    const blob = deserializeEncryptedBlob(stored);
    const plaintext = await this._kernel.decrypt(blob, keyId);
    const json = new TextDecoder().decode(plaintext);
    return JSON.parse(json) as unknown;
  }

  private ensureNotBurned(): void {
    if (this._burned) {
      throw new PrivacyError(
        `Namespace ${this.moduleId} has been burned and is no longer accessible`
      );
    }
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Retrieve a value by key. Returns undefined if not found.
   */
  async get<T>(key: string): Promise<T | undefined> {
    this.ensureNotBurned();

    const entry = this._data.get(key);
    if (entry === undefined) {
      return undefined;
    }

    const value = await this.decryptValue(entry.value);
    return value as T;
  }

  /**
   * Store a value by key. Overwrites existing.
   */
  async set<T>(key: string, value: T): Promise<void> {
    this.ensureNotBurned();

    const encrypted = await this.encryptValue(value);
    const now = Date.now();
    const existing = this._data.get(key);

    this._data.set(key, {
      value: encrypted,
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
    });
  }

  /**
   * Delete a single key.
   */
  async delete(key: string): Promise<void> {
    this.ensureNotBurned();
    this._data.delete(key);
  }

  /**
   * Query entries with an optional filter (prefix, time range, pagination).
   */
  async query(filter: DataFilter): Promise<Record<string, unknown>> {
    this.ensureNotBurned();

    const results: Record<string, unknown> = {};
    const entries: Array<{ key: string; entry: DataEntry }> = [];

    for (const [key, entry] of this._data) {
      // Key prefix filter
      if (filter.keyPrefix !== undefined && !key.startsWith(filter.keyPrefix)) {
        continue;
      }

      // Time range filters (applied to modifiedAt)
      if (filter.since !== undefined && entry.modifiedAt < filter.since) {
        continue;
      }
      if (filter.until !== undefined && entry.modifiedAt > filter.until) {
        continue;
      }

      entries.push({ key, entry });
    }

    // Sort by key for stable ordering
    entries.sort((a, b) => a.key.localeCompare(b.key));

    // Pagination
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? entries.length;
    const paginated = entries.slice(offset, offset + limit);

    for (const { key, entry } of paginated) {
      const value = await this.decryptValue(entry.value);
      results[key] = value;
    }

    return results;
  }

  /**
   * List all keys in this namespace.
   */
  async listKeys(): Promise<string[]> {
    this.ensureNotBurned();
    return Array.from(this._data.keys());
  }

  /**
   * Irreversibly destroy all data in this namespace.
   */
  async burn(): Promise<void> {
    this._data.clear();
    this._burned = true;
    this._keyId = undefined;
  }

  /**
   * Get the number of keys stored.
   */
  async getSize(): Promise<number> {
    this.ensureNotBurned();
    return this._data.size;
  }

  // ------------------------------------------------------------------
  // Internal accessors
  // ------------------------------------------------------------------

  /**
   * Whether this namespace has been burned.
   */
  isBurned(): boolean {
    return this._burned;
  }

  /**
   * Whether this namespace encrypts its values.
   */
  isEncrypted(): boolean {
    return this._encrypted;
  }

  /**
   * Get the permissions for this namespace.
   */
  getPermissions(): NamespacePermissions {
    return this._permissions;
  }

  /**
   * Get the encryption key ID (if encrypted).
   */
  getKeyId(): string | undefined {
    return this._keyId;
  }
}
