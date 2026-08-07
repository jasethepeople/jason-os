/**
 * data-registry.test.ts — Comprehensive tests for DataRegistry and DataNamespace
 *
 * Covers namespace lifecycle, encryption, ACL grants/revocation, querying,
 * burning, and permission denial.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataRegistryImpl } from './data-registry.js';
import { DataNamespaceImpl } from './data-namespace.js';
import { PrivacyKernel } from '@jason-os/privacy-kernel';
import type { NamespacePermissions, DataPermission } from '@jason-os/shared';
import { PrivacyError } from '@jason-os/shared';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makePermissions(
  owner: string,
  encrypted: boolean,
  grants?: Map<string, DataPermission[]>
): NamespacePermissions {
  return {
    owner,
    encrypted,
    grants: grants ?? new Map(),
  };
}

// ------------------------------------------------------------------
// DataNamespaceImpl — standalone tests
// ------------------------------------------------------------------

describe('DataNamespaceImpl', () => {
  let kernel: PrivacyKernel;

  beforeEach(() => {
    kernel = new PrivacyKernel();
  });

  afterEach(() => {
    kernel.destroy();
  });

  it('stores and retrieves unencrypted data', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('name', 'Alice');
    const value = await ns.get<string>('name');

    expect(value).toBe('Alice');
  });

  it('stores and retrieves encrypted data', async () => {
    const perms = makePermissions('test-mod', true);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('secret', { password: 'hunter2' });
    const value = await ns.get<{ password: string }>('secret');

    expect(value).toEqual({ password: 'hunter2' });
    expect(ns.getKeyId()).toBeDefined();
  });

  it('returns undefined for missing keys', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    const value = await ns.get('nonexistent');
    expect(value).toBeUndefined();
  });

  it('overwrites existing keys', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('key', 'first');
    await ns.set('key', 'second');
    const value = await ns.get<string>('key');

    expect(value).toBe('second');
  });

  it('deletes a key', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('temp', 42);
    await ns.delete('temp');
    const value = await ns.get('temp');

    expect(value).toBeUndefined();
  });

  it('lists all keys', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('a', 1);
    await ns.set('b', 2);
    await ns.set('c', 3);
    const keys = await ns.listKeys();

    expect(keys.sort()).toEqual(['a', 'b', 'c']);
  });

  it('reports correct size', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    expect(await ns.getSize()).toBe(0);
    await ns.set('x', 1);
    expect(await ns.getSize()).toBe(1);
    await ns.set('y', 2);
    expect(await ns.getSize()).toBe(2);
    await ns.delete('x');
    expect(await ns.getSize()).toBe(1);
  });

  it('burns all data and rejects further access', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('key', 'value');
    await ns.burn();

    expect(ns.isBurned()).toBe(true);
    await expect(ns.get('key')).rejects.toThrow(PrivacyError);
    await expect(ns.set('key', 'value')).rejects.toThrow(PrivacyError);
    await expect(ns.getSize()).rejects.toThrow(PrivacyError);
  });

  it('queries with prefix filter', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('user:1', { name: 'Alice' });
    await ns.set('user:2', { name: 'Bob' });
    await ns.set('settings:theme', 'dark');

    const results = await ns.query({ keyPrefix: 'user:' });

    expect(Object.keys(results)).toHaveLength(2);
    expect(results['user:1']).toEqual({ name: 'Alice' });
    expect(results['user:2']).toEqual({ name: 'Bob' });
  });

  it('queries with time range filter', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    const before = Date.now();
    await ns.set('key1', 'value1');
    await new Promise((r) => setTimeout(r, 10));
    const middle = Date.now();
    await new Promise((r) => setTimeout(r, 10));
    await ns.set('key2', 'value2');
    await new Promise((r) => setTimeout(r, 10));
    const after = Date.now();

    const resultsSince = await ns.query({ since: middle });
    expect(Object.keys(resultsSince)).toEqual(['key2']);

    const resultsUntil = await ns.query({ until: middle });
    expect(Object.keys(resultsUntil)).toEqual(['key1']);

    const resultsRange = await ns.query({ since: before, until: after });
    expect(Object.keys(resultsRange).sort()).toEqual(['key1', 'key2']);
  });

  it('queries with limit and offset', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('a', 1);
    await ns.set('b', 2);
    await ns.set('c', 3);
    await ns.set('d', 4);

    const limited = await ns.query({ limit: 2 });
    expect(Object.keys(limited)).toHaveLength(2);

    const offset = await ns.query({ offset: 1, limit: 2 });
    expect(Object.keys(offset)).toHaveLength(2);
  });

  it('query returns empty object when nothing matches', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('key', 'value');
    const results = await ns.query({ keyPrefix: 'nonexistent' });

    expect(results).toEqual({});
  });

  it('stores complex objects and arrays', async () => {
    const perms = makePermissions('test-mod', false);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    const complex = {
      nested: { deep: { value: 42 } },
      array: [1, 2, 3],
      bool: true,
      nullField: null,
    };

    await ns.set('complex', complex);
    const retrieved = await ns.get<typeof complex>('complex');

    expect(retrieved).toEqual(complex);
  });

  it('encrypts values differently from plaintext', async () => {
    kernel.setPrivacyTier('SOFT');
    const perms = makePermissions('test-mod', true);
    const ns = new DataNamespaceImpl('test-mod', perms, kernel);

    await ns.set('secret', 'my-password');
    const internal = ns as unknown as {
      _data: Map<string, { value: string }>;
    };
    const stored = internal._data.get('secret')?.value ?? '';

    // Stored value should be JSON-serialized EncryptedBlob, not plain string
    expect(() => JSON.parse(stored)).not.toThrow();
    const parsed = JSON.parse(stored) as { ciphertext?: string; iv?: string; authTag?: string };
    expect(parsed.ciphertext).toBeDefined();
    expect(parsed.iv).toBeDefined();
    expect(parsed.authTag).toBeDefined();
  });
});

// ------------------------------------------------------------------
// DataRegistryImpl — integration tests
// ------------------------------------------------------------------

describe('DataRegistryImpl', () => {
  let registry: DataRegistryImpl;

  beforeEach(() => {
    registry = new DataRegistryImpl();
  });

  afterEach(async () => {
    await registry.destroy();
  });

  // 1. Create and retrieve namespace
  it('creates and retrieves a namespace', () => {
    const perms = makePermissions('module-a', false);
    const ns = registry.createNamespace('module-a', perms);

    expect(ns).toBeDefined();
    expect(ns.moduleId).toBe('module-a');

    const retrieved = registry.getNamespace('module-a');
    expect(retrieved).toBe(ns);
  });

  // 2. Store and retrieve data through namespace
  it('stores and retrieves data through namespace', async () => {
    const perms = makePermissions('module-a', false);
    const ns = registry.createNamespace('module-a', perms);

    await ns.set('key', 'value');
    const value = await ns.get<string>('key');

    expect(value).toBe('value');
  });

  // 3. Namespace isolation (module A cannot see module B)
  it('isolates namespaces between modules', async () => {
    const permsA = makePermissions('module-a', false);
    const permsB = makePermissions('module-b', false);
    const nsA = registry.createNamespace('module-a', permsA);
    const nsB = registry.createNamespace('module-b', permsB);

    await nsA.set('shared-key', 'value-a');
    await nsB.set('shared-key', 'value-b');

    expect(await nsA.get<string>('shared-key')).toBe('value-a');
    expect(await nsB.get<string>('shared-key')).toBe('value-b');
  });

  // 4. Grant and use cross-module access
  it('grants cross-module read access', async () => {
    const permsA = makePermissions('module-a', false);
    const permsB = makePermissions('module-b', false);
    registry.createNamespace('module-a', permsA);
    registry.createNamespace('module-b', permsB);

    registry.grantAccess('module-a', 'module-b', ['read']);

    expect(registry.checkAccess('module-a', 'module-b', 'read')).toBe(true);
    expect(registry.checkAccess('module-a', 'module-b', 'write')).toBe(false);
  });

  // 5. Revoke cross-module access
  it('revokes cross-module access', async () => {
    const permsA = makePermissions('module-a', false);
    const permsB = makePermissions('module-b', false);
    registry.createNamespace('module-a', permsA);
    registry.createNamespace('module-b', permsB);

    registry.grantAccess('module-a', 'module-b', ['read', 'write']);
    expect(registry.checkAccess('module-a', 'module-b', 'read')).toBe(true);

    registry.revokeAccess('module-a', 'module-b');
    expect(registry.checkAccess('module-a', 'module-b', 'read')).toBe(false);
    expect(registry.checkAccess('module-a', 'module-b', 'write')).toBe(false);
  });

  // 6. Check access returns correct boolean
  it('checkAccess returns correct boolean for all permission types', () => {
    const permsA = makePermissions('module-a', false);
    const permsB = makePermissions('module-b', false);
    registry.createNamespace('module-a', permsA);
    registry.createNamespace('module-b', permsB);

    // No grants yet
    expect(registry.checkAccess('module-a', 'module-b', 'read')).toBe(false);
    expect(registry.checkAccess('module-a', 'module-b', 'write')).toBe(false);
    expect(registry.checkAccess('module-a', 'module-b', 'delete')).toBe(false);
    expect(registry.checkAccess('module-a', 'module-b', 'query')).toBe(false);
    expect(registry.checkAccess('module-a', 'module-b', 'burn')).toBe(false);

    // Grant read and query
    registry.grantAccess('module-a', 'module-b', ['read', 'query']);
    expect(registry.checkAccess('module-a', 'module-b', 'read')).toBe(true);
    expect(registry.checkAccess('module-a', 'module-b', 'write')).toBe(false);
    expect(registry.checkAccess('module-a', 'module-b', 'query')).toBe(true);

    // Owner always has full access
    expect(registry.checkAccess('module-b', 'module-b', 'read')).toBe(true);
    expect(registry.checkAccess('module-b', 'module-b', 'burn')).toBe(true);
    expect(registry.checkAccess('module-b', 'module-b', 'write')).toBe(true);
  });

  // 7. Burn namespace wipes data
  it('burns namespace and removes all data', async () => {
    const perms = makePermissions('module-a', false);
    const ns = registry.createNamespace('module-a', perms);

    await ns.set('key1', 'value1');
    await ns.set('key2', 'value2');
    await ns.burn();

    expect(await ns.getSize().catch(() => -1)).toBe(-1); // throws after burn
    expect((ns as DataNamespaceImpl).isBurned()).toBe(true);
  });

  // 8. Query with filter (prefix, time range)
  it('queries namespace with filters through registry', async () => {
    const perms = makePermissions('module-a', false);
    const ns = registry.createNamespace('module-a', perms);

    await ns.set('log:2024-01', 'entry1');
    await ns.set('log:2024-02', 'entry2');
    await ns.set('config:theme', 'dark');

    const results = await ns.query({ keyPrefix: 'log:' });

    expect(Object.keys(results)).toHaveLength(2);
    expect(results['log:2024-01']).toBe('entry1');
    expect(results['log:2024-02']).toBe('entry2');
  });

  // 9. List keys in namespace
  it('lists keys in a namespace', async () => {
    const perms = makePermissions('module-a', false);
    const ns = registry.createNamespace('module-a', perms);

    await ns.set('alpha', 1);
    await ns.set('beta', 2);
    await ns.set('gamma', 3);

    const keys = await ns.listKeys();
    expect(keys.sort()).toEqual(['alpha', 'beta', 'gamma']);
  });

  // 10. Get namespace size
  it('gets namespace size', async () => {
    const perms = makePermissions('module-a', false);
    const ns = registry.createNamespace('module-a', perms);

    expect(await ns.getSize()).toBe(0);
    await ns.set('a', 1);
    await ns.set('b', 2);
    expect(await ns.getSize()).toBe(2);
  });

  // 11. Multiple namespaces per registry
  it('handles multiple namespaces in a single registry', async () => {
    const modules = ['mod-1', 'mod-2', 'mod-3', 'mod-4', 'mod-5'];

    for (const mod of modules) {
      const perms = makePermissions(mod, false);
      const ns = registry.createNamespace(mod, perms);
      await ns.set('id', mod);
    }

    expect(registry.listNamespaces()).toHaveLength(5);
    expect(registry.listNamespaces().sort()).toEqual(modules);

    for (const mod of modules) {
      const ns = registry.getNamespace(mod);
      expect(ns).toBeDefined();
      expect(await ns!.get<string>('id')).toBe(mod);
    }
  });

  // 12. Permission denied errors
  it('throws PrivacyError when accessing namespace without permission', () => {
    const permsA = makePermissions('module-a', false);
    const permsB = makePermissions('module-b', false);
    registry.createNamespace('module-a', permsA);
    registry.createNamespace('module-b', permsB);

    expect(() =>
      registry.getNamespaceWithAccess('module-a', 'module-b')
    ).toThrow(PrivacyError);
  });

  it('throws PrivacyError for namespace not found', () => {
    expect(() =>
      registry.getNamespaceWithAccess('module-a', 'nonexistent')
    ).toThrow(PrivacyError);
  });

  // Additional edge cases

  it('throws when creating duplicate namespace', () => {
    const perms = makePermissions('module-a', false);
    registry.createNamespace('module-a', perms);

    expect(() => registry.createNamespace('module-a', perms)).toThrow(PrivacyError);
  });

  it('deduplicates permissions when granting access multiple times', () => {
    const permsA = makePermissions('module-a', false);
    const permsB = makePermissions('module-b', false);
    registry.createNamespace('module-a', permsA);
    registry.createNamespace('module-b', permsB);

    registry.grantAccess('module-a', 'module-b', ['read']);
    registry.grantAccess('module-a', 'module-b', ['read', 'write']);

    const acl = registry.getAclForModule('module-b');
    const perms = acl?.get('module-a') ?? [];
    expect(perms).toEqual(['read', 'write']);
  });

  it('deletes a namespace and cleans up ACL', async () => {
    const permsA = makePermissions('module-a', false);
    const permsB = makePermissions('module-b', false);
    registry.createNamespace('module-a', permsA);
    registry.createNamespace('module-b', permsB);

    registry.grantAccess('module-a', 'module-b', ['read']);
    expect(registry.hasNamespace('module-a')).toBe(true);

    await registry.deleteNamespace('module-a');
    expect(registry.hasNamespace('module-a')).toBe(false);

    // ACL entries from module-a should be cleaned up
    const acl = registry.getAclForModule('module-b');
    expect(acl?.has('module-a')).toBe(false);
  });

  it('works with encrypted namespaces in the same registry', async () => {
    const kernel = registry.getKernel();
    kernel.setPrivacyTier('SOFT');

    const permsPlain = makePermissions('plain-mod', false);
    const permsEncrypted = makePermissions('encrypted-mod', true);
    const nsPlain = registry.createNamespace('plain-mod', permsPlain);
    const nsEncrypted = registry.createNamespace('encrypted-mod', permsEncrypted);

    await nsPlain.set('key', 'plaintext-value');
    await nsEncrypted.set('key', 'encrypted-value');

    expect(await nsPlain.get<string>('key')).toBe('plaintext-value');
    expect(await nsEncrypted.get<string>('key')).toBe('encrypted-value');

    // Internal representation should differ
    const plainImpl = registry.getNamespaceImpl('plain-mod');
    const encryptedImpl = registry.getNamespaceImpl('encrypted-mod');
    expect(plainImpl?.isEncrypted()).toBe(false);
    expect(encryptedImpl?.isEncrypted()).toBe(true);
  });

  it('returns empty list for listNamespaces when none exist', () => {
    expect(registry.listNamespaces()).toEqual([]);
  });

  it('correctly reports hasNamespace', () => {
    expect(registry.hasNamespace('nonexistent')).toBe(false);
    const perms = makePermissions('module-a', false);
    registry.createNamespace('module-a', perms);
    expect(registry.hasNamespace('module-a')).toBe(true);
  });

  it('query on empty namespace returns empty object', async () => {
    const perms = makePermissions('module-a', false);
    const ns = registry.createNamespace('module-a', perms);
    const results = await ns.query({});
    expect(results).toEqual({});
  });

  it('handles numeric and boolean values', async () => {
    const perms = makePermissions('module-a', false);
    const ns = registry.createNamespace('module-a', perms);

    await ns.set('number', 42);
    await ns.set('boolean', true);
    await ns.set('float', 3.14);

    expect(await ns.get<number>('number')).toBe(42);
    expect(await ns.get<boolean>('boolean')).toBe(true);
    expect(await ns.get<number>('float')).toBe(3.14);
  });
});
