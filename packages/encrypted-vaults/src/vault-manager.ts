/**
 * vault-manager.ts — Vault manager for creating, retrieving, and managing
 * encrypted vaults including shadow vaults with plausible deniability.
 */

import { EncryptedVault, Vault, VaultOptions, VaultMetadata } from './vault.js';
import { PrivacyError } from '@jason-os/shared';
import { secureRandom, sha256 } from '@jason-os/privacy-kernel';

// ------------------------------------------------------------------
// Interfaces
// ------------------------------------------------------------------

export interface VaultManager {
  createVault(name: string, password: string, options?: VaultOptions): Vault;
  createShadowVault(name: string, password: string, options?: VaultOptions): Vault;
  getVault(id: string): Vault | undefined;
  listVaults(): VaultMetadata[];
  listShadowVaults(authToken: string): VaultMetadata[];
  deleteVault(id: string): Promise<void>;
  setDefaultVault(id: string): void;
  getDefaultVault(): Vault | undefined;
}

// ------------------------------------------------------------------
// Internal: Auth token for shadow vault access
// ------------------------------------------------------------------

interface ShadowAuth {
  token: string;
  createdAt: number;
  expiresAt: number;
}

// ------------------------------------------------------------------
// EncryptedVaultManager implementation
// ------------------------------------------------------------------

export class EncryptedVaultManager implements VaultManager {
  private vaults: Map<string, EncryptedVault> = new Map();
  private shadowVaults: Map<string, EncryptedVault> = new Map();
  private defaultVaultId: string | undefined;
  private shadowAuths: Map<string, ShadowAuth> = new Map();
  private authTokenHash: Uint8Array | undefined;

  /**
   * Create a new vault manager.
   * @param shadowAccessSecret — secret used to derive shadow vault access tokens.
   *    If not provided, shadow vault access tokens can be generated via `generateShadowToken()`.
   */
  constructor(shadowAccessSecret?: string) {
    if (shadowAccessSecret) {
      const salt = new Uint8Array(0); // deterministic for the secret
      this.authTokenHash = sha256(concat(new TextEncoder().encode(shadowAccessSecret), salt));
    }
  }

  // -- Vault creation -----------------------------------------------

  createVault(name: string, password: string, options?: VaultOptions): Vault {
    const id = this.generateVaultId(false);
    const vault = new EncryptedVault(id, name, password, {
      ...options,
      isShadow: false,
    });
    this.vaults.set(id, vault);
    if (!this.defaultVaultId) {
      this.defaultVaultId = id;
    }
    return vault;
  }

  createShadowVault(name: string, password: string, options?: VaultOptions): Vault {
    const id = this.generateVaultId(true);
    const vault = new EncryptedVault(id, name, password, {
      ...options,
      isShadow: true,
    });
    this.shadowVaults.set(id, vault);
    return vault;
  }

  // -- Vault retrieval ----------------------------------------------

  getVault(id: string): Vault | undefined {
    return this.vaults.get(id) ?? this.shadowVaults.get(id);
  }

  listVaults(): VaultMetadata[] {
    const results: VaultMetadata[] = [];
    for (const vault of this.vaults.values()) {
      if (!vault.isBurned()) {
        results.push(vault.getMetadata());
      }
    }
    return results;
  }

  listShadowVaults(authToken: string): VaultMetadata[] {
    if (!this.validateShadowToken(authToken)) {
      throw new PrivacyError('Invalid shadow vault access token', { code: 'INVALID_SHADOW_TOKEN' });
    }
    const results: VaultMetadata[] = [];
    for (const vault of this.shadowVaults.values()) {
      if (!vault.isBurned()) {
        results.push(vault.getMetadata());
      }
    }
    return results;
  }

  // -- Vault deletion -----------------------------------------------

  async deleteVault(id: string): Promise<void> {
    const vault = this.vaults.get(id);
    const shadowVault = this.shadowVaults.get(id);

    if (vault) {
      await vault.burn();
      this.vaults.delete(id);
    }

    if (shadowVault) {
      await shadowVault.burn();
      this.shadowVaults.delete(id);
    }

    if (this.defaultVaultId === id) {
      // Pick a new default from remaining non-shadow vaults
      const remaining = Array.from(this.vaults.keys()).filter(
        (k) => k !== id && !this.vaults.get(k)?.isBurned()
      );
      this.defaultVaultId = remaining[0];
    }
  }

  // -- Default vault ------------------------------------------------

  setDefaultVault(id: string): void {
    if (!this.vaults.has(id) && !this.shadowVaults.has(id)) {
      throw new PrivacyError(`Vault not found: ${id}`, { code: 'VAULT_NOT_FOUND' });
    }
    this.defaultVaultId = id;
  }

  getDefaultVault(): Vault | undefined {
    if (!this.defaultVaultId) return undefined;
    return this.getVault(this.defaultVaultId);
  }

  // -- Shadow token management --------------------------------------

  /**
   * Generate an access token for listing shadow vaults.
   * Requires the shadow access secret if one was configured at construction.
   */
  generateShadowToken(secret?: string): string {
    if (this.authTokenHash && secret) {
      const salt = new Uint8Array(0);
      const candidate = sha256(concat(new TextEncoder().encode(secret), salt));
      if (!constantTimeEquals(candidate, this.authTokenHash)) {
        throw new PrivacyError('Invalid shadow access secret', { code: 'INVALID_SHADOW_SECRET' });
      }
    }

    const tokenBytes = secureRandom(32);
    const token = Buffer.from(tokenBytes).toString('hex');
    const now = Date.now();
    const auth: ShadowAuth = {
      token,
      createdAt: now,
      expiresAt: now + 3600_000, // 1 hour
    };
    this.shadowAuths.set(token, auth);
    return token;
  }

  revokeShadowToken(token: string): boolean {
    return this.shadowAuths.delete(token);
  }

  // -- Internal helpers ---------------------------------------------

  private generateVaultId(isShadow: boolean): string {
    const prefix = isShadow ? 'sv-' : 'v-';
    const random = Buffer.from(secureRandom(16)).toString('hex');
    return `${prefix}${Date.now()}-${random}`;
  }

  private validateShadowToken(token: string): boolean {
    const auth = this.shadowAuths.get(token);
    if (!auth) return false;
    if (Date.now() > auth.expiresAt) {
      this.shadowAuths.delete(token);
      return false;
    }
    return true;
  }

  /** Internal: get total vault count (including burned) */
  getVaultCount(): { normal: number; shadow: number } {
    return {
      normal: this.vaults.size,
      shadow: this.shadowVaults.size,
    };
  }

  /** Internal: check if a vault exists by id */
  hasVault(id: string): boolean {
    return this.vaults.has(id) || this.shadowVaults.has(id);
  }
}

// ------------------------------------------------------------------
// Utilities
// ------------------------------------------------------------------

function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i]! ^ b[i]!;
  }
  return result === 0;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}
