// ============================================================
// Jason-OS Shared Types — Single Source of Truth
// Phase 0 + Phase 1 Foundation
// Reconstructed from dist/index.d.ts — all packages depend on this
// ============================================================

// ------------------------------------------------------------------
// Core Primitives
// ------------------------------------------------------------------

export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';

export type PrivacyTier = 'PUBLIC' | 'SOFT' | 'SHADOW' | 'GHOST';

export type ModuleCategory =
  | 'EMOTIONAL'
  | 'IDENTITY'
  | 'PRODUCTIVITY'
  | 'NAVIGATION'
  | 'MEMORY'
  | 'COMMUNICATION'
  | 'PRIVACY';

export type Permission =
  | 'storage'
  | 'network'
  | 'telemetry'
  | 'clipboard'
  | 'filesystem'
  | 'llm'
  | 'notifications';

export type IdentityType = 'CORE' | 'BURNER' | 'SHADOW';

// ------------------------------------------------------------------
// Identity
// ------------------------------------------------------------------

export interface Identity {
  id: string;
  type: IdentityType;
  displayName: string;
  avatar?: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

// ------------------------------------------------------------------
// Session
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Event Bus
// ------------------------------------------------------------------

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
  on<T>(type: string, handler: EventHandler<T>, options?: { priority?: Priority; once?: boolean }): Subscription;
  once<T>(type: string, handler: EventHandler<T>, options?: { priority?: Priority }): Subscription;
  off(subscription: Subscription): void;
  broadcast<T>(event: Omit<EventPayload<T>, 'timestamp' | 'traceId'> & Partial<Pick<EventPayload<T>, 'timestamp' | 'traceId'>>): void;
  subscribe<T>(pattern: string, handler: EventHandler<T>, options?: { priority?: Priority }): Subscription;
  unsubscribe(subscription: Subscription): void;
  getSubscriberCount(type: string): number;
  clear(): void;
}

// ------------------------------------------------------------------
// Privacy / Encryption
// ------------------------------------------------------------------

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

// NOTE: expiresAt uses number | undefined (not optional ?) because
// exactOptionalPropertyTypes is enabled. Use explicit undefined when
// there's no expiration, or omit the key entirely.
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

// ------------------------------------------------------------------
// Module Registry
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Data Registry
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Session Manager
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Emotional Telemetry (placeholder for Phase 3)
// ------------------------------------------------------------------

export interface EmotionalVector {
  valence: number;
  arousal: number;
  dominance: number;
  stress: number;
  timestamp: number;
}

// ------------------------------------------------------------------
// Errors
// ------------------------------------------------------------------

export class JasonOSError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'JasonOSError';
  }
}

export class PrivacyError extends JasonOSError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'PRIVACY_VIOLATION', context);
    this.name = 'PrivacyError';
  }
}

export class ModuleError extends JasonOSError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MODULE_ERROR', context);
    this.name = 'ModuleError';
  }
}

export class ValidationError extends JasonOSError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}
