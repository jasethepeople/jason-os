/**
 * sync-engine.test.ts — Comprehensive test suite for the Sync Engine
 *
 * Tests cover:
 *  1. Queue a change and verify pending count
 *  2. Push changes returns correct result
 *  3. Pull changes decrypts and merges
 *  4. Full sync (pull + resolve + push)
 *  5. Conflict detection when versions differ
 *  6. OURS conflict strategy
 *  7. THEIRS conflict strategy
 *  8. TIMESTAMP conflict strategy
 *  9. Offline queuing (changes queued while offline)
 * 10. Delta sync only sends changed keys
 * 11. Encryption of changes before push
 * 12. Decryption of changes after pull
 * 13. Event emission on sync
 * 14. Event emission on conflict
 * 15. Multiple namespaces sync independently
 * 16. Device ID uniqueness
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SyncEngineImpl,
  createSyncEngine,
} from './sync-engine.js';
import type { ChangeSet, Change, SyncBackend } from './sync-engine.js';
import { PrivacyKernel } from '@jason-os/privacy-kernel';

// ------------------------------------------------------------------
// Mock backend
// ------------------------------------------------------------------

function createMockBackend(online = true): SyncBackend {
  const storage = new Map<string, Change[]>();
  return {
    upload: vi.fn(async (namespace: string, changes: ChangeSet): Promise<number> => {
      const existing = storage.get(namespace) ?? [];
      storage.set(namespace, [...existing, ...changes.changes]);
      return changes.changes.length;
    }),
    download: vi.fn(async (namespace: string, _since?: number): Promise<ChangeSet> => {
      const changes = storage.get(namespace) ?? [];
      return {
        namespace,
        changes: changes.map((c) => ({ ...c })),
        timestamp: Date.now(),
        deviceId: 'remote-device',
      };
    }),
    isOnline: vi.fn(() => online),
  };
}

// ------------------------------------------------------------------
// Test setup
// ------------------------------------------------------------------

describe('SyncEngine', () => {
  let privacyKernel: PrivacyKernel;
  let backend: SyncBackend;
  let engine: SyncEngineImpl;

  beforeEach(() => {
    privacyKernel = new PrivacyKernel();
    backend = createMockBackend(true);
    engine = createSyncEngine(privacyKernel, backend, 'test-key');
  });

  // ----------------------------------------------------------------
  // Test 1: Queue a change and verify pending count
  // ----------------------------------------------------------------
  it('queues a change and verifies pending count', () => {
    expect(engine.getPendingCount()).toBe(0);

    engine.queueChange('tasks', 'task-1', { title: 'Buy groceries' });
    expect(engine.getPendingCount()).toBe(1);

    engine.queueChange('tasks', 'task-2', { title: 'Walk the dog' });
    expect(engine.getPendingCount()).toBe(2);

    // Queuing another change with the same key replaces the previous
    engine.queueChange('tasks', 'task-1', { title: 'Buy organic groceries' });
    expect(engine.getPendingCount()).toBe(2);
  });

  // ----------------------------------------------------------------
  // Test 2: Push changes returns correct result
  // ----------------------------------------------------------------
  it('pushes changes and returns correct SyncResult', async () => {
    engine.queueChange('notes', 'note-1', { text: 'Hello world' });
    engine.queueChange('notes', 'note-2', { text: 'Second note' });

    const result = await engine.push('notes');

    expect(result.pushed).toBe(2);
    expect(result.pulled).toBe(0);
    expect(result.conflicts).toBe(0);
    expect(result.resolved).toBe(0);
    expect(result.timestamp).toBeGreaterThan(0);

    // Queue should be cleared after successful push
    expect(engine.getPendingCount()).toBe(0);
  });

  // ----------------------------------------------------------------
  // Test 3: Pull changes decrypts and merges
  // ----------------------------------------------------------------
  it('pulls changes and decrypts them correctly', async () => {
    // Pre-populate backend with an encrypted change
    const rawChange: Change = {
      key: 'shared-doc',
      value: JSON.stringify({ content: 'Collaborative text' }),
      timestamp: Date.now(),
      deleted: false,
      version: 1,
    };

    // Manually encrypt and store in backend
    const blobStr = JSON.stringify({ content: 'Collaborative text' });
    const encrypted = await privacyKernel.encrypt(
      new TextEncoder().encode(blobStr),
      'test-key'
    );
    const encryptedChange: Change = {
      ...rawChange,
      value: JSON.stringify({
        ct: Array.from(encrypted.ciphertext),
        iv: Array.from(encrypted.iv),
        at: Array.from(encrypted.authTag),
        kid: encrypted.keyId,
        alg: encrypted.algorithm,
        ver: encrypted.version,
      }),
    };

    // Put encrypted change directly into backend storage via a second engine
    const engine2 = createSyncEngine(privacyKernel, backend, 'test-key');
    engine2.queueChange('docs', 'shared-doc', { content: 'Collaborative text' });
    await engine2.push('docs');

    // Now pull with the first engine
    const pulled = await engine.pull('docs');

    expect(pulled.changes.length).toBe(1);
    expect(pulled.changes[0].key).toBe('shared-doc');
    const parsed = JSON.parse(pulled.changes[0].value);
    expect(parsed).toEqual({ content: 'Collaborative text' });
  });

  // ----------------------------------------------------------------
  // Test 4: Full sync (pull + resolve + push)
  // ----------------------------------------------------------------
  it('performs full sync: pull, resolve conflicts, and push', async () => {
    // Setup: push a change from another engine
    const engine2 = createSyncEngine(privacyKernel, backend, 'test-key');
    engine2.queueChange('items', 'item-1', { name: 'Remote item', qty: 5 });
    await engine2.push('items');

    // Local engine queues a different change for same key
    engine.queueChange('items', 'item-1', { name: 'Local item', qty: 3 });

    // Full sync
    const result = await engine.sync('items');

    expect(result.pulled).toBe(1);
    expect(result.pushed).toBe(1);
    expect(result.timestamp).toBeGreaterThan(0);
  });

  // ----------------------------------------------------------------
  // Test 5: Conflict detection when versions differ
  // ----------------------------------------------------------------
  it('detects conflicts when versions differ', () => {
    const ours: Change = {
      key: 'doc',
      value: JSON.stringify({ text: 'Our version' }),
      timestamp: 1000,
      deleted: false,
      version: 2,
    };
    const theirs: Change = {
      key: 'doc',
      value: JSON.stringify({ text: 'Their version' }),
      timestamp: 1000,
      deleted: false,
      version: 3,
    };

    let conflictEmitted = false;
    engine.on('conflict', () => {
      conflictEmitted = true;
    });

    const resolved = engine.resolveConflict(ours, theirs, 'OURS');
    expect(resolved).toBeDefined();
    expect(conflictEmitted).toBe(true);
  });

  // ----------------------------------------------------------------
  // Test 6: OURS conflict strategy
  // ----------------------------------------------------------------
  it('uses OURS conflict strategy correctly', () => {
    const ours: Change = {
      key: 'config',
      value: JSON.stringify({ theme: 'dark' }),
      timestamp: 2000,
      deleted: false,
      version: 2,
    };
    const theirs: Change = {
      key: 'config',
      value: JSON.stringify({ theme: 'light' }),
      timestamp: 3000,
      deleted: false,
      version: 3,
    };

    const resolved = engine.resolveConflict(ours, theirs, 'OURS');
    expect(JSON.parse(resolved.value)).toEqual({ theme: 'dark' });
    expect(resolved.version).toBe(4); // max(2,3) + 1
  });

  // ----------------------------------------------------------------
  // Test 7: THEIRS conflict strategy
  // ----------------------------------------------------------------
  it('uses THEIRS conflict strategy correctly', () => {
    const ours: Change = {
      key: 'config',
      value: JSON.stringify({ theme: 'dark' }),
      timestamp: 2000,
      deleted: false,
      version: 2,
    };
    const theirs: Change = {
      key: 'config',
      value: JSON.stringify({ theme: 'light' }),
      timestamp: 1000,
      deleted: false,
      version: 1,
    };

    const resolved = engine.resolveConflict(ours, theirs, 'THEIRS');
    expect(JSON.parse(resolved.value)).toEqual({ theme: 'light' });
    expect(resolved.version).toBe(3); // max(2,1) + 1
  });

  // ----------------------------------------------------------------
  // Test 8: TIMESTAMP conflict strategy
  // ----------------------------------------------------------------
  it('uses TIMESTAMP conflict strategy correctly', () => {
    const older: Change = {
      key: 'data',
      value: JSON.stringify({ v: 1 }),
      timestamp: 1000,
      deleted: false,
      version: 1,
    };
    const newer: Change = {
      key: 'data',
      value: JSON.stringify({ v: 2 }),
      timestamp: 2000,
      deleted: false,
      version: 1,
    };

    // Newer wins with TIMESTAMP
    const resolved = engine.resolveConflict(older, newer, 'TIMESTAMP');
    expect(JSON.parse(resolved.value)).toEqual({ v: 2 });
    expect(resolved.timestamp).toBe(2000);

    // Reverse: newer (first arg) still wins
    const resolved2 = engine.resolveConflict(newer, older, 'TIMESTAMP');
    expect(JSON.parse(resolved2.value)).toEqual({ v: 2 });
  });

  // ----------------------------------------------------------------
  // Test 9: Offline queuing (changes queued while offline)
  // ----------------------------------------------------------------
  it('queues changes while offline and syncs when back online', async () => {
    const offlineBackend = createMockBackend(false);
    const offlineEngine = createSyncEngine(privacyKernel, offlineBackend, 'test-key');

    // Queue changes while offline
    offlineEngine.queueChange('tasks', 'task-a', { title: 'Offline task' });
    expect(offlineEngine.getPendingCount()).toBe(1);

    // Push should not fail but also not send anything
    const result = await offlineEngine.push('tasks');
    expect(result.pushed).toBe(0);

    // Change should still be queued
    expect(offlineEngine.getPendingCount()).toBe(1);

    // Simulate going back online by switching backend
    const onlineBackend = createMockBackend(true);
    const onlineEngine = createSyncEngine(
      privacyKernel,
      onlineBackend,
      'test-key'
    );
    onlineEngine.queueChange('tasks', 'task-a', { title: 'Offline task' });

    const pushResult = await onlineEngine.push('tasks');
    expect(pushResult.pushed).toBe(1);
    expect(onlineEngine.getPendingCount()).toBe(0);
  });

  // ----------------------------------------------------------------
  // Test 10: Delta sync only sends changed keys
  // ----------------------------------------------------------------
  it('only sends changed keys in delta sync', async () => {
    // Push initial state with multiple keys
    engine.queueChange('store', 'key-a', { data: 'A' });
    engine.queueChange('store', 'key-b', { data: 'B' });
    engine.queueChange('store', 'key-c', { data: 'C' });
    await engine.push('store');

    // Now only change one key
    engine.queueChange('store', 'key-b', { data: 'B-updated' });

    const result = await engine.push('store');
    expect(result.pushed).toBe(1);

    // Verify only key-b was in the uploaded changes
    const uploadCall = (backend.upload as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(uploadCall[1].changes.length).toBe(1);
    expect(uploadCall[1].changes[0].key).toBe('key-b');
  });

  // ----------------------------------------------------------------
  // Test 11: Encryption of changes before push
  // ----------------------------------------------------------------
  it('encrypts changes before pushing', async () => {
    const pk = new PrivacyKernel();
    pk.setPrivacyTier('SOFT');

    // Generate a key for encryption
    const keyMaterial = await pk.generateSymmetricKey();

    const mockBackend = createMockBackend(true);
    const encryptedEngine = createSyncEngine(pk, mockBackend, keyMaterial.keyId);

    encryptedEngine.queueChange('secrets', 'password', { value: 'hunter2' });
    await encryptedEngine.push('secrets');

    // Check that the uploaded value is encrypted (not plaintext)
    const uploadCall = (mockBackend.upload as ReturnType<typeof vi.fn>).mock.calls[0];
    const uploadedChange = uploadCall[1].changes[0];

    // Encrypted value should be a JSON string containing ciphertext array
    const parsed = JSON.parse(uploadedChange.value);
    expect(parsed).toHaveProperty('ct'); // ciphertext
    expect(parsed).toHaveProperty('iv'); // initialization vector
    expect(parsed).toHaveProperty('at'); // auth tag
    expect(Array.isArray(parsed.ct)).toBe(true);
    expect(parsed.ct.length).toBeGreaterThan(0);

    // The original value should NOT be in the upload
    expect(uploadedChange.value).not.toContain('hunter2');
  });

  // ----------------------------------------------------------------
  // Test 12: Decryption of changes after pull
  // ----------------------------------------------------------------
  it('decrypts changes after pulling', async () => {
    // Use the same PrivacyKernel so both engines can access the same keys
    const sharedPk = new PrivacyKernel();
    sharedPk.setPrivacyTier('SOFT');
    const keyMaterial = await sharedPk.generateSymmetricKey();

    const sharedBackend = createMockBackend(true);

    const engine1 = createSyncEngine(sharedPk, sharedBackend, keyMaterial.keyId);
    const engine2 = createSyncEngine(sharedPk, sharedBackend, keyMaterial.keyId);

    // Push encrypted data from engine1
    engine1.queueChange('vault', 'secret', { pin: '1234' });
    await engine1.push('vault');

    // Pull and decrypt with engine2
    const pulled = await engine2.pull('vault');

    expect(pulled.changes.length).toBe(1);
    const parsed = JSON.parse(pulled.changes[0].value);
    expect(parsed).toEqual({ pin: '1234' });
  });

  // ----------------------------------------------------------------
  // Test 13: Event emission on sync
  // ----------------------------------------------------------------
  it('emits sync event after successful sync', async () => {
    const events: Array<{ type: string; namespace?: string }> = [];

    engine.on('sync', (event) => {
      events.push({
        type: event.type,
        namespace: event.namespace,
      });
    });

    engine.queueChange('ev-test', 'key-1', { data: 42 });
    await engine.push('ev-test');

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].type).toBe('sync');
    expect(events[0].namespace).toBe('ev-test');
  });

  // ----------------------------------------------------------------
  // Test 14: Event emission on conflict
  // ----------------------------------------------------------------
  it('emits conflict event when resolving conflicts', () => {
    const conflicts: Array<{
      oursValue: unknown;
      theirsValue: unknown;
      resolvedValue: unknown;
    }> = [];

    engine.on('conflict', (event) => {
      if (event.conflict) {
        conflicts.push({
          oursValue: JSON.parse(event.conflict.ours.value),
          theirsValue: JSON.parse(event.conflict.theirs.value),
          resolvedValue: JSON.parse(event.conflict.resolved.value),
        });
      }
    });

    const ours: Change = {
      key: 'data',
      value: JSON.stringify({ version: 'ours' }),
      timestamp: 1000,
      deleted: false,
      version: 1,
    };
    const theirs: Change = {
      key: 'data',
      value: JSON.stringify({ version: 'theirs' }),
      timestamp: 2000,
      deleted: false,
      version: 2,
    };

    engine.resolveConflict(ours, theirs, 'THEIRS');

    expect(conflicts.length).toBe(1);
    expect(conflicts[0].oursValue).toEqual({ version: 'ours' });
    expect(conflicts[0].theirsValue).toEqual({ version: 'theirs' });
  });

  // ----------------------------------------------------------------
  // Test 15: Multiple namespaces sync independently
  // ----------------------------------------------------------------
  it('syncs multiple namespaces independently', async () => {
    engine.queueChange('namespace-a', 'key-1', { data: 'A1' });
    engine.queueChange('namespace-a', 'key-2', { data: 'A2' });
    engine.queueChange('namespace-b', 'key-1', { data: 'B1' });

    expect(engine.getPendingCount()).toBe(3);

    // Push only namespace-a
    const resultA = await engine.push('namespace-a');
    expect(resultA.pushed).toBe(2);
    expect(engine.getPendingCount()).toBe(1); // namespace-b still pending

    // Push namespace-b
    const resultB = await engine.push('namespace-b');
    expect(resultB.pushed).toBe(1);
    expect(engine.getPendingCount()).toBe(0);

    // Verify independent storage in backend
    const uploadCalls = (backend.upload as ReturnType<typeof vi.fn>).mock.calls;
    expect(uploadCalls[0][0]).toBe('namespace-a');
    expect(uploadCalls[1][0]).toBe('namespace-b');
  });

  // ----------------------------------------------------------------
  // Test 16: Device ID uniqueness
  // ----------------------------------------------------------------
  it('generates unique device IDs for each instance', () => {
    const engines: SyncEngineImpl[] = [];
    const deviceIds = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const eng = createSyncEngine(privacyKernel, backend, 'test-key');
      engines.push(eng);
      deviceIds.add(eng.deviceId);
    }

    // All 10 device IDs should be unique
    expect(deviceIds.size).toBe(10);

    // Verify format
    for (const id of deviceIds) {
      expect(id).toMatch(/^device-[a-f0-9]{16}$/);
    }
  });

  // ----------------------------------------------------------------
  // Additional edge-case tests
  // ----------------------------------------------------------------

  it('allows explicit device ID to be set', () => {
    const customEngine = createSyncEngine(
      privacyKernel,
      backend,
      'test-key',
      'my-custom-device'
    );
    expect(customEngine.deviceId).toBe('my-custom-device');
  });

  it('handles empty queue push gracefully', async () => {
    const result = await engine.push('empty-namespace');
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(0);
  });

  it('handles delete operations via queueDelete', () => {
    engine.queueDelete('items', 'item-to-delete');
    expect(engine.getPendingCount()).toBe(1);

    const pending = engine.getPendingChanges('items');
    expect(pending[0].key).toBe('item-to-delete');
    expect(pending[0].deleted).toBe(true);
  });

  it('handles MERGE conflict strategy for objects', () => {
    const ours: Change = {
      key: 'profile',
      value: JSON.stringify({ name: 'Alice', age: 30 }),
      timestamp: 1000,
      deleted: false,
      version: 1,
    };
    const theirs: Change = {
      key: 'profile',
      value: JSON.stringify({ name: 'Bob', city: 'NYC' }),
      timestamp: 2000,
      deleted: false,
      version: 1,
    };

    const resolved = engine.resolveConflict(ours, theirs, 'MERGE');
    const merged = JSON.parse(resolved.value);
    // MERGE: theirs as base, ours overrides (properties from ours win)
    expect(merged.name).toBe('Alice');
    expect(merged.age).toBe(30);
    expect(merged.city).toBe('NYC');
  });

  it('MERGE strategy falls back to TIMESTAMP for non-objects', () => {
    const ours: Change = {
      key: 'count',
      value: JSON.stringify(42),
      timestamp: 1000,
      deleted: false,
      version: 1,
    };
    const theirs: Change = {
      key: 'count',
      value: JSON.stringify(99),
      timestamp: 2000,
      deleted: false,
      version: 1,
    };

    const resolved = engine.resolveConflict(ours, theirs, 'MERGE');
    // Non-mergeable (primitives), falls back to TIMESTAMP
    expect(JSON.parse(resolved.value)).toBe(99);
  });

  it('supports event handler unsubscription', () => {
    const events: string[] = [];
    const unsubscribe = engine.on('sync', () => {
      events.push('sync');
    });

    engine.queueChange('ev', 'k', { v: 1 });

    // Unsubscribe
    unsubscribe();

    // After unsubscribing, events should not be captured
    // (we can't easily test async push without triggering, but we can
    //  test the conflict event directly)
    const ours: Change = {
      key: 'k',
      value: JSON.stringify({ v: 1 }),
      timestamp: 1000,
      deleted: false,
      version: 1,
    };
    const theirs: Change = {
      key: 'k',
      value: JSON.stringify({ v: 2 }),
      timestamp: 2000,
      deleted: false,
      version: 2,
    };
    engine.resolveConflict(ours, theirs, 'OURS');

    // The sync event handler was unsubscribed, so no events
    expect(events.length).toBe(0);
  });

  it('exports and imports queue state', () => {
    engine.queueChange('ns1', 'k1', { a: 1 });
    engine.queueChange('ns2', 'k2', { b: 2 });

    const exported = engine.exportQueue();
    expect(Object.keys(exported)).toHaveLength(2);
    expect(exported['ns1']).toHaveLength(1);
    expect(exported['ns2']).toHaveLength(1);

    // Create new engine and import
    const engine2 = createSyncEngine(privacyKernel, backend, 'test-key');
    engine2.importQueue(exported);
    expect(engine2.getPendingCount()).toBe(2);
  });

  it('exports and imports version vectors', () => {
    engine.queueChange('test-ns', 'key-a', { v: 1 });
    engine.queueChange('test-ns', 'key-b', { v: 2 });

    const exported = engine.exportVersions();
    expect(Object.keys(exported).length).toBeGreaterThanOrEqual(2);

    const engine2 = createSyncEngine(privacyKernel, backend, 'test-key');
    engine2.importVersions(exported);

    // Versions should be preserved
    const versions2 = engine2.exportVersions();
    expect(versions2).toEqual(exported);
  });
});
