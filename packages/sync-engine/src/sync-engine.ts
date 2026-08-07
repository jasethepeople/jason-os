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

// ------------------------------------------------------------------
// Public types
// ------------------------------------------------------------------

export interface Change {
  key: string;
  value: string; // encrypted JSON
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
  conflict?: { ours: Change; theirs: Change; resolved: Change };
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

// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------

/** Encode a string to Uint8Array */
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Decode a Uint8Array to string */
function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Generate a random hex string of given byte length */
function randomHex(byteLength: number): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ------------------------------------------------------------------
// SyncEngine implementation
// ------------------------------------------------------------------

export class SyncEngineImpl {
  // Pending changes per namespace
  private readonly _queue = new Map<string, Change[]>();

  // Last known version per key (key format: `${namespace}:${key}`)
  private readonly _versions = new Map<string, number>();

  // Unique device identifier
  private readonly _deviceId: string;

  // Event handlers
  private readonly _handlers = new Map<SyncEventType, SyncEventHandler[]>();

  // Online state tracking
  private _online = true;

  // Constructor dependencies
  constructor(
    private readonly _privacyKernel: PrivacyKernel,
    private readonly _backend: SyncBackend,
    private readonly _keyId: string,
    deviceId?: string
  ) {
    this._deviceId = deviceId ?? `device-${randomHex(8)}`;
  }

  // ----------------------------------------------------------------
  // Properties
  // ----------------------------------------------------------------

  /** Unique device identifier for this sync engine instance */
  get deviceId(): string {
    return this._deviceId;
  }

  /** Whether the engine considers itself online */
  get isOnline(): boolean {
    return this._online && this._backend.isOnline();
  }

  /** Direct access to the backend (for advanced use / testing) */
  get backend(): SyncBackend {
    return this._backend;
  }

  // ----------------------------------------------------------------
  // Queue management
  // ----------------------------------------------------------------

  /**
   * Queue a local change for later sync.
   * If online, the change is also immediately queued for the next push.
   */
  queueChange(namespace: string, key: string, value: unknown): void {
    const version = this.nextVersion(namespace, key);
    const change: Change = {
      key,
      value: JSON.stringify(value),
      timestamp: Date.now(),
      deleted: value === undefined || value === null,
      version,
    };

    const existing = this._queue.get(namespace) ?? [];
    // Remove any earlier queued change for the same key
    const filtered = existing.filter((c) => c.key !== key);
    filtered.push(change);
    this._queue.set(namespace, filtered);
  }

  /** Mark a key as deleted in the queue */
  queueDelete(namespace: string, key: string): void {
    this.queueChange(namespace, key, null);
  }

  /** Get the number of pending changes across all namespaces */
  getPendingCount(): number {
    let count = 0;
    for (const changes of this._queue.values()) {
      count += changes.length;
    }
    return count;

  }

  /** Get pending changes for a specific namespace */
  getPendingChanges(namespace: string): Change[] {
    return this._queue.get(namespace) ? [...this._queue.get(namespace)!] : [];
  }

  /** Clear all pending changes (useful for testing / reset) */
  clearQueue(): void {
    this._queue.clear();
  }

  // ----------------------------------------------------------------
  // Encryption helpers
  // ----------------------------------------------------------------

  /** Encrypt a single change's value */
  private async encryptChange(change: Change): Promise<Change> {
    const encrypted = await this._privacyKernel.encrypt(
      encode(change.value),
      this._keyId
    );
    // Serialize EncryptedBlob to a base64 string
    const blobStr = JSON.stringify({
      ct: Array.from(encrypted.ciphertext),
      iv: Array.from(encrypted.iv),
      at: Array.from(encrypted.authTag),
      kid: encrypted.keyId,
      alg: encrypted.algorithm,
      ver: encrypted.version,
    });
    return { ...change, value: blobStr };
  }

  /** Decrypt a single change's value */
  private async decryptChange(change: Change): Promise<Change> {
    const parsed = JSON.parse(change.value);
    const blob = {
      ciphertext: new Uint8Array(parsed.ct),
      iv: new Uint8Array(parsed.iv),
      authTag: new Uint8Array(parsed.at),
      keyId: parsed.kid,
      algorithm: parsed.alg as 'AES-256-GCM',
      version: parsed.ver,
    };
    const decrypted = await this._privacyKernel.decrypt(blob, this._keyId);
    return { ...change, value: decode(decrypted) };
  }

  /** Encrypt an entire ChangeSet */
  private async encryptChangeSet(cs: ChangeSet): Promise<ChangeSet> {
    const encrypted = await Promise.all(
      cs.changes.map((c) => this.encryptChange(c))
    );
    return { ...cs, changes: encrypted };
  }

  /** Decrypt an entire ChangeSet */
  private async decryptChangeSet(cs: ChangeSet): Promise<ChangeSet> {
    const decrypted = await Promise.all(
      cs.changes.map((c) => this.decryptChange(c))
    );
    return { ...cs, changes: decrypted };
  }

  // ----------------------------------------------------------------
  // Push — upload local changes
  // ----------------------------------------------------------------

  /**
   * Push queued changes for a namespace to the backend.
   * Returns a SyncResult describing what happened.
   */
  async push(namespace: string, changes?: ChangeSet): Promise<SyncResult> {
    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      resolved: 0,
      timestamp: Date.now(),
    };

    try {
      const changeSet =
        changes ?? this.buildLocalChangeSet(namespace);

      if (changeSet.changes.length === 0) {
        return result;
      }

      // Encrypt before sending
      const encrypted = await this.encryptChangeSet(changeSet);

      if (!this.isOnline) {
        // Offline: changes remain queued, will retry later
        this._online = false;
        return result;
      }

      const accepted = await this._backend.upload(namespace, encrypted);
      result.pushed = accepted;

      // Remove successfully pushed changes from the queue
      if (accepted > 0 && !changes) {
        const pending = this._queue.get(namespace) ?? [];
        const pushedKeys = new Set(changeSet.changes.map((c) => c.key));
        const remaining = pending.filter((c) => !pushedKeys.has(c.key));
        if (remaining.length > 0) {
          this._queue.set(namespace, remaining);
        } else {
          this._queue.delete(namespace);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', { error, namespace });
      throw error;
    }

    this.emit('sync', { result, namespace });
    return result;
  }

  // ----------------------------------------------------------------
  // Pull — download remote changes
  // ----------------------------------------------------------------

  /**
   * Pull changes from the backend for a namespace.
   * Decrypts and merges them into the local state.
   */
  async pull(namespace: string, since?: number): Promise<ChangeSet> {
    try {
      if (!this.isOnline) {
        return this.buildLocalChangeSet(namespace);
      }

      const remote = await this._backend.download(namespace, since);
      if (remote.changes.length === 0) {
        return this.buildLocalChangeSet(namespace);
      }

      // Decrypt remote changes
      const decrypted = await this.decryptChangeSet(remote);

      // Merge remote changes into local version tracking
      for (const change of decrypted.changes) {
        const vKey = `${namespace}:${change.key}`;
        const localVersion = this._versions.get(vKey) ?? 0;
        if (change.version > localVersion) {
          this._versions.set(vKey, change.version);
        }
      }

      return decrypted;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', { error, namespace });
      throw error;
    }
  }

  // ----------------------------------------------------------------
  // Full sync — pull + resolve conflicts + push
  // ----------------------------------------------------------------

  /**
   * Perform a full bidirectional sync for a namespace.
   * 1. Pull remote changes
   * 2. Resolve conflicts between local and remote
   * 3. Push local changes
   */
  async sync(namespace: string): Promise<SyncResult> {
    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      resolved: 0,
      timestamp: Date.now(),
    };

    try {
      // Step 1: Pull remote changes
      const remote = await this.pull(namespace);
      result.pulled = remote.changes.length;

      // Step 2: Detect and resolve conflicts
      const local = this.buildLocalChangeSet(namespace);
      const merged = await this.mergeChanges(
        namespace,
        local,
        remote,
        result
      );

      // Step 3: Push merged changes
      if (merged.changes.length > 0) {
        const pushResult = await this.push(namespace, merged);
        result.pushed = pushResult.pushed;
      }

      // Update version tracking for all merged changes
      for (const change of merged.changes) {
        const vKey = `${namespace}:${change.key}`;
        const current = this._versions.get(vKey) ?? 0;
        if (change.version > current) {
          this._versions.set(vKey, change.version);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', { error, namespace });
      throw error;
    }

    result.timestamp = Date.now();
    this.emit('sync', { result, namespace });
    return result;
  }

  // ----------------------------------------------------------------
  // Conflict resolution
  // ----------------------------------------------------------------

  /**
   * Resolve a single conflict between two changes using the given strategy.
   */
  resolveConflict(
    ours: Change,
    theirs: Change,
    strategy: ConflictStrategy
  ): Change {
    if (ours.version === theirs.version && ours.timestamp === theirs.timestamp) {
      // Identical changes — no real conflict
      return ours;
    }

    let resolved: Change;

    switch (strategy) {
      case 'OURS':
        resolved = { ...ours, version: Math.max(ours.version, theirs.version) + 1 };
        break;

      case 'THEIRS':
        resolved = { ...theirs, version: Math.max(ours.version, theirs.version) + 1 };
        break;

      case 'TIMESTAMP':
        resolved =
          ours.timestamp >= theirs.timestamp
            ? { ...ours, version: Math.max(ours.version, theirs.version) + 1 }
            : { ...theirs, version: Math.max(ours.version, theirs.version) + 1 };
        break;

      case 'MERGE': {
        // Attempt deep merge of JSON values
        try {
          const oursVal = JSON.parse(ours.value);
          const theirsVal = JSON.parse(theirs.value);
          if (
            typeof oursVal === 'object' &&
            !Array.isArray(oursVal) &&
            oursVal !== null &&
            typeof theirsVal === 'object' &&
            !Array.isArray(theirsVal) &&
            theirsVal !== null
          ) {
            const mergedVal = { ...theirsVal, ...oursVal };
            resolved = {
              ...ours,
              value: JSON.stringify(mergedVal),
              timestamp: Math.max(ours.timestamp, theirs.timestamp),
              version: Math.max(ours.version, theirs.version) + 1,
            };
          } else {
            // Non-mergeable types — fall back to TIMESTAMP
            resolved =
              ours.timestamp >= theirs.timestamp
                ? { ...ours, version: Math.max(ours.version, theirs.version) + 1 }
                : { ...theirs, version: Math.max(ours.version, theirs.version) + 1 };
          }
        } catch {
          // Invalid JSON — fall back to TIMESTAMP
          resolved =
            ours.timestamp >= theirs.timestamp
              ? { ...ours, version: Math.max(ours.version, theirs.version) + 1 }
              : { ...theirs, version: Math.max(ours.version, theirs.version) + 1 };
        }
        break;
      }

      default:
        // Exhaustive check — should never reach here
        resolved = { ...ours, version: Math.max(ours.version, theirs.version) + 1 };
    }

    this.emit('conflict', { conflict: { ours, theirs, resolved }, namespace: ours.key });
    return resolved;
  }

  // ----------------------------------------------------------------
  // Event system
  // ----------------------------------------------------------------

  /** Subscribe to sync events. Returns an unsubscribe function. */
  on(event: SyncEventType, handler: SyncEventHandler): () => void {
    const list = this._handlers.get(event) ?? [];
    list.push(handler);
    this._handlers.set(event, list);
    return () => {
      const updated = (this._handlers.get(event) ?? []).filter(
        (h) => h !== handler
      );
      if (updated.length > 0) {
        this._handlers.set(event, updated);
      } else {
        this._handlers.delete(event);
      }
    };
  }

  /** Emit an event to all subscribed handlers */
  private emit(
    type: SyncEventType,
    partial: Omit<Partial<SyncEvent>, 'type' | 'timestamp'>
  ): void {
    const event: SyncEvent = {
      type,
      timestamp: Date.now(),
      ...partial,
    } as SyncEvent;

    const handlers = this._handlers.get(type) ?? [];
    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // Handler errors must not break the engine
      }
    }
  }

  // ----------------------------------------------------------------
  // Persistence hooks (for future use)
  // ----------------------------------------------------------------

  /** Export queue state for persistence */
  exportQueue(): Record<string, Change[]> {
    const result: Record<string, Change[]> = {};
    for (const [ns, changes] of this._queue.entries()) {
      result[ns] = [...changes];
    }
    return result;
  }

  /** Import queue state from persistence */
  importQueue(data: Record<string, Change[]>): void {
    for (const [ns, changes] of Object.entries(data)) {
      this._queue.set(ns, [...changes]);
    }
  }

  /** Export version vectors for persistence */
  exportVersions(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, version] of this._versions.entries()) {
      result[key] = version;
    }
    return result;
  }

  /** Import version vectors from persistence */
  importVersions(data: Record<string, number>): void {
    for (const [key, version] of Object.entries(data)) {
      this._versions.set(key, version);
    }
  }

  // ----------------------------------------------------------------
  // Private helpers
  // ----------------------------------------------------------------

  /** Build a ChangeSet from locally queued changes */
  private buildLocalChangeSet(namespace: string): ChangeSet {
    const changes = this._queue.get(namespace) ?? [];
    return {
      namespace,
      changes: [...changes],
      timestamp: Date.now(),
      deviceId: this._deviceId,
    };
  }

  /** Get the next version number for a key */
  private nextVersion(namespace: string, key: string): number {
    const vKey = `${namespace}:${key}`;
    const current = this._versions.get(vKey) ?? 0;
    const next = current + 1;
    this._versions.set(vKey, next);
    return next;
  }

  /** Merge local and remote changes, resolving conflicts */
  private async mergeChanges(
    namespace: string,
    local: ChangeSet,
    remote: ChangeSet,
    result: SyncResult
  ): Promise<ChangeSet> {
    const merged = new Map<string, Change>();
    const conflicts: Array<{ ours: Change; theirs: Change }> = [];

    // Add all local changes
    for (const change of local.changes) {
      merged.set(change.key, change);
    }

    // Merge remote changes
    for (const change of remote.changes) {
      const existing = merged.get(change.key);
      if (existing) {
        // Potential conflict — compare versions
        if (change.version !== existing.version) {
          result.conflicts++;
          conflicts.push({ ours: existing, theirs: change });
          // Default to TIMESTAMP strategy for auto-merge
          const resolved = this.resolveConflict(existing, change, 'TIMESTAMP');
          result.resolved++;
          merged.set(change.key, resolved);
        }
        // If same version, keep local (OURS by default)
      } else {
        merged.set(change.key, change);
      }
    }

    return {
      namespace,
      changes: Array.from(merged.values()),
      timestamp: Date.now(),
      deviceId: this._deviceId,
    };
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

/** Create a new SyncEngine instance */
export function createSyncEngine(
  privacyKernel: PrivacyKernel,
  backend: SyncBackend,
  keyId: string,
  deviceId?: string
): SyncEngineImpl {
  return new SyncEngineImpl(privacyKernel, backend, keyId, deviceId);
}
