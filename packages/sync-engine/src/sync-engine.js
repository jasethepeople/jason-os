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
// ------------------------------------------------------------------
// Internal helpers
// ------------------------------------------------------------------
/** Encode a string to Uint8Array */
function encode(text) {
    return new TextEncoder().encode(text);
}
/** Decode a Uint8Array to string */
function decode(bytes) {
    return new TextDecoder().decode(bytes);
}
/** Generate a random hex string of given byte length */
function randomHex(byteLength) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(byteLength));
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
// ------------------------------------------------------------------
// SyncEngine implementation
// ------------------------------------------------------------------
export class SyncEngineImpl {
    _privacyKernel;
    _backend;
    _keyId;
    // Pending changes per namespace
    _queue = new Map();
    // Last known version per key (key format: `${namespace}:${key}`)
    _versions = new Map();
    // Unique device identifier
    _deviceId;
    // Event handlers
    _handlers = new Map();
    // Online state tracking
    _online = true;
    // Constructor dependencies
    constructor(_privacyKernel, _backend, _keyId, deviceId) {
        this._privacyKernel = _privacyKernel;
        this._backend = _backend;
        this._keyId = _keyId;
        this._deviceId = deviceId ?? `device-${randomHex(8)}`;
    }
    // ----------------------------------------------------------------
    // Properties
    // ----------------------------------------------------------------
    /** Unique device identifier for this sync engine instance */
    get deviceId() {
        return this._deviceId;
    }
    /** Whether the engine considers itself online */
    get isOnline() {
        return this._online && this._backend.isOnline();
    }
    /** Direct access to the backend (for advanced use / testing) */
    get backend() {
        return this._backend;
    }
    // ----------------------------------------------------------------
    // Queue management
    // ----------------------------------------------------------------
    /**
     * Queue a local change for later sync.
     * If online, the change is also immediately queued for the next push.
     */
    queueChange(namespace, key, value) {
        const version = this.nextVersion(namespace, key);
        const change = {
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
    queueDelete(namespace, key) {
        this.queueChange(namespace, key, null);
    }
    /** Get the number of pending changes across all namespaces */
    getPendingCount() {
        let count = 0;
        for (const changes of this._queue.values()) {
            count += changes.length;
        }
        return count;
    }
    /** Get pending changes for a specific namespace */
    getPendingChanges(namespace) {
        return this._queue.get(namespace) ? [...this._queue.get(namespace)] : [];
    }
    /** Clear all pending changes (useful for testing / reset) */
    clearQueue() {
        this._queue.clear();
    }
    // ----------------------------------------------------------------
    // Encryption helpers
    // ----------------------------------------------------------------
    /** Encrypt a single change's value */
    async encryptChange(change) {
        const encrypted = await this._privacyKernel.encrypt(encode(change.value), this._keyId);
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
    async decryptChange(change) {
        const parsed = JSON.parse(change.value);
        const blob = {
            ciphertext: new Uint8Array(parsed.ct),
            iv: new Uint8Array(parsed.iv),
            authTag: new Uint8Array(parsed.at),
            keyId: parsed.kid,
            algorithm: parsed.alg,
            version: parsed.ver,
        };
        const decrypted = await this._privacyKernel.decrypt(blob, this._keyId);
        return { ...change, value: decode(decrypted) };
    }
    /** Encrypt an entire ChangeSet */
    async encryptChangeSet(cs) {
        const encrypted = await Promise.all(cs.changes.map((c) => this.encryptChange(c)));
        return { ...cs, changes: encrypted };
    }
    /** Decrypt an entire ChangeSet */
    async decryptChangeSet(cs) {
        const decrypted = await Promise.all(cs.changes.map((c) => this.decryptChange(c)));
        return { ...cs, changes: decrypted };
    }
    // ----------------------------------------------------------------
    // Push — upload local changes
    // ----------------------------------------------------------------
    /**
     * Push queued changes for a namespace to the backend.
     * Returns a SyncResult describing what happened.
     */
    async push(namespace, changes) {
        const result = {
            pushed: 0,
            pulled: 0,
            conflicts: 0,
            resolved: 0,
            timestamp: Date.now(),
        };
        try {
            const changeSet = changes ?? this.buildLocalChangeSet(namespace);
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
                }
                else {
                    this._queue.delete(namespace);
                }
            }
        }
        catch (err) {
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
    async pull(namespace, since) {
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
        }
        catch (err) {
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
    async sync(namespace) {
        const result = {
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
            const merged = await this.mergeChanges(namespace, local, remote, result);
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
        }
        catch (err) {
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
    resolveConflict(ours, theirs, strategy) {
        if (ours.version === theirs.version && ours.timestamp === theirs.timestamp) {
            // Identical changes — no real conflict
            return ours;
        }
        let resolved;
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
                    if (typeof oursVal === 'object' &&
                        !Array.isArray(oursVal) &&
                        oursVal !== null &&
                        typeof theirsVal === 'object' &&
                        !Array.isArray(theirsVal) &&
                        theirsVal !== null) {
                        const mergedVal = { ...theirsVal, ...oursVal };
                        resolved = {
                            ...ours,
                            value: JSON.stringify(mergedVal),
                            timestamp: Math.max(ours.timestamp, theirs.timestamp),
                            version: Math.max(ours.version, theirs.version) + 1,
                        };
                    }
                    else {
                        // Non-mergeable types — fall back to TIMESTAMP
                        resolved =
                            ours.timestamp >= theirs.timestamp
                                ? { ...ours, version: Math.max(ours.version, theirs.version) + 1 }
                                : { ...theirs, version: Math.max(ours.version, theirs.version) + 1 };
                    }
                }
                catch {
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
    on(event, handler) {
        const list = this._handlers.get(event) ?? [];
        list.push(handler);
        this._handlers.set(event, list);
        return () => {
            const updated = (this._handlers.get(event) ?? []).filter((h) => h !== handler);
            if (updated.length > 0) {
                this._handlers.set(event, updated);
            }
            else {
                this._handlers.delete(event);
            }
        };
    }
    /** Emit an event to all subscribed handlers */
    emit(type, partial) {
        const event = {
            type,
            timestamp: Date.now(),
            ...partial,
        };
        const handlers = this._handlers.get(type) ?? [];
        for (const handler of handlers) {
            try {
                handler(event);
            }
            catch {
                // Handler errors must not break the engine
            }
        }
    }
    // ----------------------------------------------------------------
    // Persistence hooks (for future use)
    // ----------------------------------------------------------------
    /** Export queue state for persistence */
    exportQueue() {
        const result = {};
        for (const [ns, changes] of this._queue.entries()) {
            result[ns] = [...changes];
        }
        return result;
    }
    /** Import queue state from persistence */
    importQueue(data) {
        for (const [ns, changes] of Object.entries(data)) {
            this._queue.set(ns, [...changes]);
        }
    }
    /** Export version vectors for persistence */
    exportVersions() {
        const result = {};
        for (const [key, version] of this._versions.entries()) {
            result[key] = version;
        }
        return result;
    }
    /** Import version vectors from persistence */
    importVersions(data) {
        for (const [key, version] of Object.entries(data)) {
            this._versions.set(key, version);
        }
    }
    // ----------------------------------------------------------------
    // Private helpers
    // ----------------------------------------------------------------
    /** Build a ChangeSet from locally queued changes */
    buildLocalChangeSet(namespace) {
        const changes = this._queue.get(namespace) ?? [];
        return {
            namespace,
            changes: [...changes],
            timestamp: Date.now(),
            deviceId: this._deviceId,
        };
    }
    /** Get the next version number for a key */
    nextVersion(namespace, key) {
        const vKey = `${namespace}:${key}`;
        const current = this._versions.get(vKey) ?? 0;
        const next = current + 1;
        this._versions.set(vKey, next);
        return next;
    }
    /** Merge local and remote changes, resolving conflicts */
    async mergeChanges(namespace, local, remote, result) {
        const merged = new Map();
        const conflicts = [];
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
            }
            else {
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
export function createSyncEngine(privacyKernel, backend, keyId, deviceId) {
    return new SyncEngineImpl(privacyKernel, backend, keyId, deviceId);
}
//# sourceMappingURL=sync-engine.js.map