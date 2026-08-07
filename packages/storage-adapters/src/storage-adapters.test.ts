/**
 * @jason-os/storage-adapters
 *
 * Comprehensive test suite covering all adapter implementations
 * and the privacy-tier router.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { StorageAdapter } from './storage-adapter.js';
import { MemoryAdapter } from './memory-adapter.js';
import { LocalStorageAdapter } from './localstorage-adapter.js';
import { IndexedDBAdapter } from './indexeddb-adapter.js';
import { StorageRouter } from './storage-router.js';
import type { PrivacyTier } from '@jason-os/shared';

// ------------------------------------------------------------------
// Helper: run the standard adapter contract against any implementation
// ------------------------------------------------------------------
async function adapterContractTests(adapter: StorageAdapter): Promise<void> {
  // Clean slate
  await adapter.clear();

  // get returns null for missing key
  expect(await adapter.get('nonexistent')).toBeNull();

  // set + get round-trip
  await adapter.set('hello', 'world');
  expect(await adapter.get('hello')).toBe('world');

  // set overwrites
  await adapter.set('hello', 'universe');
  expect(await adapter.get('hello')).toBe('universe');

  // delete removes
  await adapter.delete('hello');
  expect(await adapter.get('hello')).toBeNull();

  // list returns keys
  await adapter.set('a', '1');
  await adapter.set('b', '2');
  await adapter.set('c', '3');
  const keys = await adapter.list();
  expect(keys).toContain('a');
  expect(keys).toContain('b');
  expect(keys).toContain('c');

  // list with prefix
  await adapter.set('prefix:one', '1');
  await adapter.set('prefix:two', '2');
  await adapter.set('other', '0');
  const prefixed = await adapter.list('prefix:');
  expect(prefixed).toContain('prefix:one');
  expect(prefixed).toContain('prefix:two');
  expect(prefixed).not.toContain('other');

  // clear removes all
  await adapter.clear();
  expect(await adapter.get('a')).toBeNull();
  expect(await adapter.get('b')).toBeNull();
  expect(await adapter.get('c')).toBeNull();

  // getSize
  await adapter.set('x', '1');
  await adapter.set('y', '2');
  expect(await adapter.getSize()).toBe(2);
  await adapter.clear();
  expect(await adapter.getSize()).toBe(0);
}

// ============================================================================
// 1. Memory adapter: get/set/delete/clear/list
// ============================================================================
describe('MemoryAdapter — CRUD', () => {
  it('supports full get/set/delete/clear/list cycle', async () => {
    const adapter = new MemoryAdapter('test-crud');
    await adapterContractTests(adapter);
  });
});

// ============================================================================
// 2. Memory adapter: namespace isolation
// ============================================================================
describe('MemoryAdapter — namespace isolation', () => {
  it('keeps keys isolated between namespaces', async () => {
    const nsA = new MemoryAdapter('namespace-a');
    const nsB = new MemoryAdapter('namespace-b');

    await nsA.set('shared-key', 'value-from-a');
    await nsB.set('shared-key', 'value-from-b');

    expect(await nsA.get('shared-key')).toBe('value-from-a');
    expect(await nsB.get('shared-key')).toBe('value-from-b');

    // Clearing A should not affect B
    await nsA.clear();
    expect(await nsA.get('shared-key')).toBeNull();
    expect(await nsB.get('shared-key')).toBe('value-from-b');
  });
});

// ============================================================================
// 3. Memory adapter: getSize returns correct count
// ============================================================================
describe('MemoryAdapter — getSize', () => {
  it('returns the exact number of keys in the namespace', async () => {
    const adapter = new MemoryAdapter('test-size');
    await adapter.clear();

    expect(await adapter.getSize()).toBe(0);

    await adapter.set('one', '1');
    expect(await adapter.getSize()).toBe(1);

    await adapter.set('two', '2');
    expect(await adapter.getSize()).toBe(2);

    await adapter.set('three', '3');
    expect(await adapter.getSize()).toBe(3);

    await adapter.delete('two');
    expect(await adapter.getSize()).toBe(2);

    await adapter.clear();
    expect(await adapter.getSize()).toBe(0);
  });
});

// ============================================================================
// 4. StorageRouter: PUBLIC tier selects localStorage (or memory in Node)
// ============================================================================
describe('StorageRouter — PUBLIC tier', () => {
  it('selects localStorage in browser, memory fallback in Node', async () => {
    const router = new StorageRouter();
    const adapter = router.selectAdapter('PUBLIC', 'test-pub');

    // In Node (where window is undefined) it falls back to MemoryAdapter
    const isBrowser =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as Record<string, unknown>).window !== 'undefined';

    if (isBrowser) {
      expect(adapter.type).toBe('localStorage');
    } else {
      expect(adapter.type).toBe('memory');
    }

    // Adapter must satisfy the contract regardless of backing store
    await adapterContractTests(adapter);
  });
});

// ============================================================================
// 5. StorageRouter: GHOST tier selects memory
// ============================================================================
describe('StorageRouter — GHOST tier', () => {
  it('always selects memory adapter', async () => {
    const router = new StorageRouter();
    const adapter = router.selectAdapter('GHOST', 'test-ghost');

    expect(adapter.type).toBe('memory');
    expect(adapter.name).toBe('MemoryAdapter');

    await adapterContractTests(adapter);
  });
});

// ============================================================================
// 6. StorageRouter: SHADOW tier selects IndexedDB (or memory fallback)
// ============================================================================
describe('StorageRouter — SHADOW tier', () => {
  it('selects IndexedDB in browser, memory fallback in Node', async () => {
    const router = new StorageRouter();
    const adapter = router.selectAdapter('SHADOW', 'test-shadow');

    // IndexedDB adapter always returns type 'indexedDB' even when using
    // memory fallback internally — the fallback is transparent to callers.
    expect(adapter.type).toBe('indexedDB');

    await adapterContractTests(adapter);
  });
});

// ============================================================================
// 7. localStorage adapter: namespaced keys
// ============================================================================
describe('LocalStorageAdapter — namespaced keys', () => {
  it('prefixes keys with jason-os:{moduleId}:', () => {
    const adapter = new LocalStorageAdapter('my-module');
    const nsKey = adapter.getNamespacedKey('my-key');
    expect(nsKey).toBe('jason-os:my-module:my-key');
  });

  it('isolates keys between different module namespaces', async () => {
    const modA = new LocalStorageAdapter('module-a');
    const modB = new LocalStorageAdapter('module-b');

    // Only proceed if localStorage is available (skip in Node)
    if (!modA.isAvailable() || !modB.isAvailable()) {
      return;
    }

    await modA.set('key', 'value-a');
    await modB.set('key', 'value-b');

    expect(await modA.get('key')).toBe('value-a');
    expect(await modB.get('key')).toBe('value-b');

    // Clearing A should not affect B
    await modA.clear();
    expect(await modA.get('key')).toBeNull();
    expect(await modB.get('key')).toBe('value-b');

    // Cleanup
    await modB.clear();
  });
});

// ============================================================================
// 8. localStorage adapter: quota detection
// ============================================================================
describe('LocalStorageAdapter — quota detection', () => {
  it('throws when a single value exceeds the 5 MB limit', () => {
    const adapter = new LocalStorageAdapter('quota-test');
    const hugeValue = 'x'.repeat(6 * 1024 * 1024); // 6 MB string

    expect(() => adapter.checkQuota(hugeValue)).toThrow(/quota exceeded/i);
  });

  it('does not throw for values under the 5 MB limit', () => {
    const adapter = new LocalStorageAdapter('quota-test');
    const value = 'safe value';
    expect(() => adapter.checkQuota(value)).not.toThrow();
  });
});

// ============================================================================
// 9. All adapters implement StorageAdapter interface
// ============================================================================
describe('Interface compliance — all adapters implement StorageAdapter', () => {
  it('MemoryAdapter satisfies StorageAdapter', () => {
    const adapter: StorageAdapter = new MemoryAdapter('iface-test');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.type).toBe('string');
    expect(typeof adapter.isAvailable).toBe('function');
    expect(typeof adapter.get).toBe('function');
    expect(typeof adapter.set).toBe('function');
    expect(typeof adapter.delete).toBe('function');
    expect(typeof adapter.list).toBe('function');
    expect(typeof adapter.clear).toBe('function');
    expect(typeof adapter.getSize).toBe('function');
  });

  it('LocalStorageAdapter satisfies StorageAdapter', () => {
    const adapter: StorageAdapter = new LocalStorageAdapter('iface-test');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.type).toBe('string');
    expect(typeof adapter.isAvailable).toBe('function');
    expect(typeof adapter.get).toBe('function');
    expect(typeof adapter.set).toBe('function');
    expect(typeof adapter.delete).toBe('function');
    expect(typeof adapter.list).toBe('function');
    expect(typeof adapter.clear).toBe('function');
    expect(typeof adapter.getSize).toBe('function');
  });

  it('IndexedDBAdapter satisfies StorageAdapter', () => {
    const adapter: StorageAdapter = new IndexedDBAdapter('iface-test');
    expect(typeof adapter.name).toBe('string');
    expect(typeof adapter.type).toBe('string');
    expect(typeof adapter.isAvailable).toBe('function');
    expect(typeof adapter.get).toBe('function');
    expect(typeof adapter.set).toBe('function');
    expect(typeof adapter.delete).toBe('function');
    expect(typeof adapter.list).toBe('function');
    expect(typeof adapter.clear).toBe('function');
    expect(typeof adapter.getSize).toBe('function');
  });
});

// ============================================================================
// 10. IndexedDB adapter: graceful fallback to memory
// ============================================================================
describe('IndexedDBAdapter — graceful fallback', () => {
  it('falls back to memory when IndexedDB is unavailable', async () => {
    const adapter = new IndexedDBAdapter('fallback-test');

    // Wait for init to complete (or fail and set fallback)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // In Node, IndexedDB is unavailable so it must fall back to memory
    const isBrowser =
      typeof globalThis !== 'undefined' &&
      typeof (globalThis as Record<string, unknown>).window !== 'undefined';

    if (!isBrowser) {
      expect((adapter as unknown as { isUsingFallback: () => boolean }).isUsingFallback()).toBe(true);
    }

    // Regardless of fallback, the adapter must satisfy the contract
    await adapterContractTests(adapter);
  });

  it('IndexedDBAdapter reports type "indexedDB" even in fallback mode', async () => {
    const adapter = new IndexedDBAdapter('type-test');
    expect(adapter.type).toBe('indexedDB');
  });
});

// ============================================================================
// 11. StorageRouter: unknown tier defaults to memory
// ============================================================================
describe('StorageRouter — unknown tier fallback', () => {
  it('defaults to MemoryAdapter for unrecognised tiers', () => {
    const router = new StorageRouter();
    const adapter = router.selectAdapter('UNKNOWN_TIER' as PrivacyTier, 'unknown-test');

    expect(adapter.type).toBe('memory');
  });
});

// ============================================================================
// 12. Cross-adapter compatibility
// ============================================================================
describe('Cross-adapter compatibility', () => {
  it('produces identical results across MemoryAdapter and IndexedDBAdapter', async () => {
    const mem = new MemoryAdapter('compat');
    const idb = new IndexedDBAdapter('compat');

    // Seed both adapters with the same data
    const testData: Array<[string, string]> = [
      ['user:profile', '{"name":"Alice"}'],
      ['user:settings', '{"theme":"dark"}'],
      ['app:version', '1.0.0'],
    ];

    for (const [k, v] of testData) {
      await mem.set(k, v);
      await idb.set(k, v);
    }

    // Reads should match
    for (const [k, v] of testData) {
      expect(await mem.get(k)).toBe(v);
      expect(await idb.get(k)).toBe(v);
    }

    // Lists should contain the same keys
    const memKeys = await mem.list();
    const idbKeys = await idb.list();
    expect(memKeys.sort()).toEqual(idbKeys.sort());

    // Sizes should match
    expect(await mem.getSize()).toBe(await idb.getSize());

    // Cleanup
    await mem.clear();
    await idb.clear();
  });

  it('produces identical list results with prefixes across adapters', async () => {
    const mem = new MemoryAdapter('prefix-compat');
    const idb = new IndexedDBAdapter('prefix-compat');

    await mem.set('config:a', '1');
    await mem.set('config:b', '2');
    await mem.set('data:x', '10');

    await idb.set('config:a', '1');
    await idb.set('config:b', '2');
    await idb.set('data:x', '10');

    const memConfig = await mem.list('config:');
    const idbConfig = await idb.list('config:');
    expect(memConfig.sort()).toEqual(idbConfig.sort());

    const memData = await mem.list('data:');
    const idbData = await idb.list('data:');
    expect(memData.sort()).toEqual(idbData.sort());

    // Cleanup
    await mem.clear();
    await idb.clear();
  });
});
