/**
 * sync-engine.ts — End-to-End Encrypted Sync Engine for Jason-OS
 *
 * Features:
 *   - Offline-first: all changes queued locally first, sync when online
 *   - Delta sync: only changed keys synced, not full dataset
 *   - Conflict resolution: 4 strategies (OURS, THEIRS, MERGE, TIMESTAMP)
 *   - Encryption: changes encrypted with PrivacyKernel before sync
 *   - Queue management: in-memory queue with persistence hooks
 *   - Device ID: unique per-install identifier for tracking changes
 *   - Version vectors: per-key versioning for conflict detection
 *   - Event system: emits sync / conflict / error events
 */
import type { PrivacyKernel } from '@jason-os/shared';
export interface Change {
    key: string;
    value: string;
    timestamp: number;
    deleted: boolean;
    version: number;
}
export interface ChangeSet {
    namespace: string;
    changes: Change[];
    timestamp: number;
    deviceId: string;
}
export interface SyncResult {
    pushed: number;
    pulled: number;
    conflicts: number;
    resolved: number;
    timestamp: number;
}
export type ConflictStrategy = 'OURS' | 'THEIRS' | 'MERGE' | 'TIMESTAMP';
export type SyncEventType = 'sync' | 'conflict' | 'error';
export interface SyncEvent {
    type: SyncEventType;
    namespace?: string;
    result?: SyncResult;
    conflict?: {
        ours: Change;
        theirs: Change;
        resolved: Change;
    };
    error?: Error;
    timestamp: number;
}
export type SyncEventHandler = (event: SyncEvent) => void;
/** Backend abstraction — implemented by the caller (WebSocket, HTTP, etc.) */
export interface SyncBackend {
    /** Send encrypted changes to the server / peer. Returns accepted count. */
    upload(namespace: string, changes: ChangeSet): Promise<number>;
    /** Fetch encrypted changes from the server / peer since the given timestamp. */
    download(namespace: string, since?: number): Promise<ChangeSet>;
    /** Whether the backend is currently reachable. */
    isOnline(): boolean;
}
export declare class SyncEngineImpl {
    private readonly _privacyKernel;
    private readonly _backend;
    private readonly _keyId;
    private readonly _queue;
    private readonly _versions;
    private readonly _deviceId;
    private readonly _handlers;
    private _online;
    constructor(_privacyKernel: PrivacyKernel, _backend: SyncBackend, _keyId: string, deviceId?: string);
    /** Unique device identifier for this sync engine instance */
    get deviceId(): string;
    /** Whether the engine considers itself online */
    get isOnline(): boolean;
    /** Direct access to the backend (for advanced use / testing) */
    get backend(): SyncBackend;
    /**
     * Queue a local change for later sync.
     * If online, the change is also immediately queued for the next push.
     */
    queueChange(namespace: string, key: string, value: unknown): void;
    /** Mark a key as deleted in the queue */
    queueDelete(namespace: string, key: string): void;
    /** Get the number of pending changes across all namespaces */
    getPendingCount(): number;
    /** Get pending changes for a specific namespace */
    getPendingChanges(namespace: string): Change[];
    /** Clear all pending changes (useful for testing / reset) */
    clearQueue(): void;
    /** Encrypt a single change's value */
    private encryptChange;
    /** Decrypt a single change's value */
    private decryptChange;
    /** Encrypt an entire ChangeSet */
    private encryptChangeSet;
    /** Decrypt an entire ChangeSet */
    private decryptChangeSet;
    /**
     * Push queued changes for a namespace to the backend.
     * Returns a SyncResult describing what happened.
     */
    push(namespace: string, changes?: ChangeSet): Promise<SyncResult>;
    /**
     * Pull changes from the backend for a namespace.
     * Decrypts and merges them into the local state.
     */
    pull(namespace: string, since?: number): Promise<ChangeSet>;
    /**
     * Perform a full bidirectional sync for a namespace.
     * 1. Pull remote changes
     * 2. Resolve conflicts between local and remote
     * 3. Push local changes
     */
    sync(namespace: string): Promise<SyncResult>;
    /**
     * Resolve a single conflict between two changes using the given strategy.
     */
    resolveConflict(ours: Change, theirs: Change, strategy: ConflictStrategy): Change;
    /** Subscribe to sync events. Returns an unsubscribe function. */
    on(event: SyncEventType, handler: SyncEventHandler): () => void;
    /** Emit an event to all subscribed handlers */
    private emit;
    /** Export queue state for persistence */
    exportQueue(): Record<string, Change[]>;
    /** Import queue state from persistence */
    importQueue(data: Record<string, Change[]>): void;
    /** Export version vectors for persistence */
    exportVersions(): Record<string, number>;
    /** Import version vectors from persistence */
    importVersions(data: Record<string, number>): void;
    /** Build a ChangeSet from locally queued changes */
    private buildLocalChangeSet;
    /** Get the next version number for a key */
    private nextVersion;
    /** Merge local and remote changes, resolving conflicts */
    private mergeChanges;
}
/** Create a new SyncEngine instance */
export declare function createSyncEngine(privacyKernel: PrivacyKernel, backend: SyncBackend, keyId: string, deviceId?: string): SyncEngineImpl;
//# sourceMappingURL=sync-engine.d.ts.map