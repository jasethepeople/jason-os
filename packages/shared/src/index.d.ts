export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';
export type PrivacyTier = 'PUBLIC' | 'SOFT' | 'SHADOW' | 'GHOST';
export type ModuleCategory = 'EMOTIONAL' | 'IDENTITY' | 'PRODUCTIVITY' | 'NAVIGATION' | 'MEMORY' | 'COMMUNICATION' | 'PRIVACY';
export type Permission = 'storage' | 'network' | 'telemetry' | 'clipboard' | 'filesystem' | 'llm' | 'notifications';
export type IdentityType = 'CORE' | 'BURNER' | 'SHADOW';
export interface Identity {
    id: string;
    type: IdentityType;
    displayName: string;
    avatar?: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
}
export interface Session {
    id: string;
    token: string;
    identity: Identity;
    createdAt: number;
    expiresAt: number;
    privacyTier: PrivacyTier;
    isBurner: boolean;
    deviceFingerprint?: string;
}
export interface EventPayload<T = unknown> {
    type: string;
    payload: T;
    priority: Priority;
    timestamp: number;
    source: string;
    traceId: string;
}
export type EventHandler<T = unknown> = (event: EventPayload<T>) => void | Promise<void>;
export interface Subscription {
    id: string;
    type: string;
    handler: EventHandler;
    priority: Priority;
    once: boolean;
}
export interface EventBus {
    emit<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void;
    on<T>(type: string, handler: EventHandler<T>, options?: {
        priority?: Priority;
        once?: boolean;
    }): Subscription;
    once<T>(type: string, handler: EventHandler<T>, options?: {
        priority?: Priority;
    }): Subscription;
    off(subscription: Subscription): void;
    broadcast<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void;
    subscribe<T>(pattern: string, handler: EventHandler<T>, options?: {
        priority?: Priority;
    }): Subscription;
    unsubscribe(subscription: Subscription): void;
    getSubscriberCount(type: string): number;
    clear(): void;
}
export interface EncryptedBlob {
    ciphertext: Uint8Array;
    iv: Uint8Array;
    authTag: Uint8Array;
    keyId: string;
    algorithm: 'AES-256-GCM';
    version: number;
}
export interface KeyPair {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
    keyId: string;
}
export interface KeyMaterial {
    keyId: string;
    key: CryptoKey;
    createdAt: number;
    expiresAt?: number | undefined;
    metadata?: Record<string, unknown>;
}
export interface PrivacyKernel {
    encrypt(data: Uint8Array, keyId: string): Promise<EncryptedBlob>;
    decrypt(blob: EncryptedBlob, keyId: string): Promise<Uint8Array>;
    deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey>;
    generateKeyPair(): Promise<KeyPair>;
    generateSymmetricKey(): Promise<KeyMaterial>;
    importKey(rawKey: Uint8Array, algorithm: string): Promise<CryptoKey>;
    exportKey(key: CryptoKey): Promise<Uint8Array>;
    hash(data: Uint8Array): Promise<Uint8Array>;
    getPrivacyTier(): PrivacyTier;
    setPrivacyTier(tier: PrivacyTier): void;
    onTierChange(handler: (tier: PrivacyTier) => void): () => void;
}
export interface ModuleManifest {
    id: string;
    name: string;
    version: string;
    category: ModuleCategory;
    description?: string;
    author?: string;
    dependencies: string[];
    optionalDependencies: string[];
    permissions: Permission[];
    events: {
        emits: string[];
        listens: string[];
    };
    ui?: {
        entryPoint: string;
        icon: string;
        panelMode?: 'tabbed' | 'split' | 'overlay' | 'fullscreen';
    };
}
export interface ModuleRegistry {
    register(manifest: ModuleManifest): void;
    unregister(moduleId: string): void;
    get(moduleId: string): ModuleManifest | undefined;
    list(): ModuleManifest[];
    listByCategory(category: ModuleCategory): ModuleManifest[];
    resolveDependencies(moduleId: string): string[];
    resolveDependents(moduleId: string): string[];
    detectCycles(): string[][];
    isRegistered(moduleId: string): boolean;
    validateManifest(manifest: unknown): ModuleManifest;
}
export type DataPermission = 'read' | 'write' | 'delete' | 'query' | 'burn';
export interface NamespacePermissions {
    owner: string;
    grants: Map<string, DataPermission[]>;
    encrypted: boolean;
    retentionPolicy?: RetentionPolicy;
}
export interface RetentionPolicy {
    maxAge?: number;
    maxSize?: number;
    autoBurn?: boolean;
    burnTrigger?: 'age' | 'size' | 'manual' | 'event';
}
export interface DataFilter {
    keyPrefix?: string;
    since?: number;
    until?: number;
    limit?: number;
    offset?: number;
}
export interface DataNamespace {
    readonly moduleId: string;
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
    query(filter: DataFilter): Promise<Record<string, unknown>>;
    listKeys(): Promise<string[]>;
    burn(): Promise<void>;
    getSize(): Promise<number>;
}
export interface DataRegistry {
    createNamespace(moduleId: string, permissions: NamespacePermissions): DataNamespace;
    getNamespace(moduleId: string): DataNamespace | undefined;
    hasNamespace(moduleId: string): boolean;
    grantAccess(fromModule: string, toModule: string, permissions: DataPermission[]): void;
    revokeAccess(fromModule: string, toModule: string): void;
    checkAccess(fromModule: string, toModule: string, permission: DataPermission): boolean;
    listNamespaces(): string[];
    deleteNamespace(moduleId: string): Promise<void>;
}
export interface SessionManager {
    createSession(identity: Identity): Promise<Session>;
    resumeSession(token: string): Promise<Session | null>;
    expireSession(sessionId: string): Promise<void>;
    getActiveSession(): Session | null;
    listActiveSessions(): Session[];
    createBurnerSession(): Promise<Session>;
    switchIdentity(sessionId: string, identity: Identity): Promise<Session>;
    extendSession(sessionId: string, durationMs: number): Promise<void>;
    onSessionExpire(handler: (session: Session) => void): () => void;
}
export interface EmotionalVector {
    valence: number;
    arousal: number;
    dominance: number;
    stress: number;
    timestamp: number;
}
export declare class JasonOSError extends Error {
    readonly code: string;
    readonly context?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, context?: Record<string, unknown> | undefined);
}
export declare class PrivacyError extends JasonOSError {
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class ModuleError extends JasonOSError {
    constructor(message: string, context?: Record<string, unknown>);
}
export declare class ValidationError extends JasonOSError {
    constructor(message: string, context?: Record<string, unknown>);
}
//# sourceMappingURL=index.d.ts.map