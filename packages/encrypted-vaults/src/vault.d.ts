/**
 * vault.ts — Individual encrypted vault with shadow mode, plausible deniability,
 * and self-destruct capabilities.
 */
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
export declare class EncryptedVault implements Vault {
    readonly id: string;
    readonly isShadow: boolean;
    readonly createdAt: number;
    private _name;
    private salt;
    private verificationTag;
    private itemStore;
    private key;
    private locked;
    private failedAttempts;
    private selfDestruct;
    private lastAccessedAt;
    private burnTimer;
    private _burned;
    constructor(id: string, name: string, password: string, options?: VaultOptions);
    get name(): string;
    unlock(password: string): Promise<boolean>;
    lock(): void;
    isLocked(): boolean;
    store<T>(key: string, value: T): Promise<void>;
    retrieve<T>(key: string): Promise<T | undefined>;
    delete(key: string): Promise<void>;
    list(): Promise<string[]>;
    burn(): Promise<void>;
    getMetadata(): VaultMetadata;
    private ensureUnlocked;
    private resetBurnTimer;
    private clearBurnTimer;
    /** Get raw salt bytes (for plausible deniability — looks like random data) */
    getSalt(): Uint8Array;
    /** Get verification tag bytes */
    getVerificationTag(): Uint8Array;
    /** Internal: check if burned */
    isBurned(): boolean;
    /** Internal: get self-destruct policy */
    getSelfDestructPolicy(): SelfDestructPolicy | undefined;
    /** Internal: get failed attempts count */
    getFailedAttempts(): number;
}
//# sourceMappingURL=vault.d.ts.map