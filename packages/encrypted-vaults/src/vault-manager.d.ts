/**
 * vault-manager.ts — Vault manager for creating, retrieving, and managing
 * encrypted vaults including shadow vaults with plausible deniability.
 */
import { Vault, VaultOptions, VaultMetadata } from './vault.js';
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
export declare class EncryptedVaultManager implements VaultManager {
    private vaults;
    private shadowVaults;
    private defaultVaultId;
    private shadowAuths;
    private authTokenHash;
    /**
     * Create a new vault manager.
     * @param shadowAccessSecret — secret used to derive shadow vault access tokens.
     *    If not provided, shadow vault access tokens can be generated via `generateShadowToken()`.
     */
    constructor(shadowAccessSecret?: string);
    createVault(name: string, password: string, options?: VaultOptions): Vault;
    createShadowVault(name: string, password: string, options?: VaultOptions): Vault;
    getVault(id: string): Vault | undefined;
    listVaults(): VaultMetadata[];
    listShadowVaults(authToken: string): VaultMetadata[];
    deleteVault(id: string): Promise<void>;
    setDefaultVault(id: string): void;
    getDefaultVault(): Vault | undefined;
    /**
     * Generate an access token for listing shadow vaults.
     * Requires the shadow access secret if one was configured at construction.
     */
    generateShadowToken(secret?: string): string;
    revokeShadowToken(token: string): boolean;
    private generateVaultId;
    private validateShadowToken;
    /** Internal: get total vault count (including burned) */
    getVaultCount(): {
        normal: number;
        shadow: number;
    };
    /** Internal: check if a vault exists by id */
    hasVault(id: string): boolean;
}
//# sourceMappingURL=vault-manager.d.ts.map