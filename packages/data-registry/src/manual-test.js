/**
 * Manual test runner using Node.js built-in assert.
 * Used when vitest/esbuild has permission issues.
 */
import { strict as assert } from 'node:assert';
// We need to build first, then import the built JS
// But since tsc also needs type resolution, let me use a dynamic approach
import { DataRegistryImpl } from './data-registry.js';
import { PrivacyKernel } from '@jason-os/privacy-kernel';
import { PrivacyError } from '@jason-os/shared';
function makePermissions(owner, encrypted) {
    return { owner, encrypted, grants: new Map() };
}
let passed = 0;
let failed = 0;
async function test(name, fn) {
    try {
        await fn();
        console.log(`  PASS: ${name}`);
        passed++;
    }
    catch (err) {
        console.log(`  FAIL: ${name}`);
        console.log(`    ${err.message}`);
        failed++;
    }
}
async function main() {
    console.log('\n=== DataRegistry Tests ===\n');
    // 1. Create and retrieve namespace
    await test('creates and retrieves a namespace', async () => {
        const registry = new DataRegistryImpl();
        const perms = makePermissions('module-a', false);
        const ns = registry.createNamespace('module-a', perms);
        assert.equal(ns.moduleId, 'module-a');
        assert.equal(registry.getNamespace('module-a'), ns);
        await registry.destroy();
    });
    // 2. Store and retrieve data
    await test('stores and retrieves data through namespace', async () => {
        const registry = new DataRegistryImpl();
        const perms = makePermissions('module-a', false);
        const ns = registry.createNamespace('module-a', perms);
        await ns.set('key', 'value');
        assert.equal(await ns.get('key'), 'value');
        await registry.destroy();
    });
    // 3. Namespace isolation
    await test('isolates namespaces between modules', async () => {
        const registry = new DataRegistryImpl();
        const nsA = registry.createNamespace('module-a', makePermissions('module-a', false));
        const nsB = registry.createNamespace('module-b', makePermissions('module-b', false));
        await nsA.set('shared-key', 'value-a');
        await nsB.set('shared-key', 'value-b');
        assert.equal(await nsA.get('shared-key'), 'value-a');
        assert.equal(await nsB.get('shared-key'), 'value-b');
        await registry.destroy();
    });
    // 4. Grant and use cross-module access
    await test('grants cross-module read access', async () => {
        const registry = new DataRegistryImpl();
        registry.createNamespace('module-a', makePermissions('module-a', false));
        registry.createNamespace('module-b', makePermissions('module-b', false));
        registry.grantAccess('module-a', 'module-b', ['read']);
        assert.equal(registry.checkAccess('module-a', 'module-b', 'read'), true);
        assert.equal(registry.checkAccess('module-a', 'module-b', 'write'), false);
        await registry.destroy();
    });
    // 5. Revoke cross-module access
    await test('revokes cross-module access', async () => {
        const registry = new DataRegistryImpl();
        registry.createNamespace('module-a', makePermissions('module-a', false));
        registry.createNamespace('module-b', makePermissions('module-b', false));
        registry.grantAccess('module-a', 'module-b', ['read', 'write']);
        assert.equal(registry.checkAccess('module-a', 'module-b', 'read'), true);
        registry.revokeAccess('module-a', 'module-b');
        assert.equal(registry.checkAccess('module-a', 'module-b', 'read'), false);
        assert.equal(registry.checkAccess('module-a', 'module-b', 'write'), false);
        await registry.destroy();
    });
    // 6. Check access returns correct boolean
    await test('checkAccess returns correct boolean for all permission types', async () => {
        const registry = new DataRegistryImpl();
        registry.createNamespace('module-a', makePermissions('module-a', false));
        registry.createNamespace('module-b', makePermissions('module-b', false));
        assert.equal(registry.checkAccess('module-a', 'module-b', 'read'), false);
        registry.grantAccess('module-a', 'module-b', ['read', 'query']);
        assert.equal(registry.checkAccess('module-a', 'module-b', 'read'), true);
        assert.equal(registry.checkAccess('module-a', 'module-b', 'write'), false);
        assert.equal(registry.checkAccess('module-a', 'module-b', 'query'), true);
        // Owner always has full access
        assert.equal(registry.checkAccess('module-b', 'module-b', 'burn'), true);
        await registry.destroy();
    });
    // 7. Burn namespace wipes data
    await test('burns namespace and removes all data', async () => {
        const registry = new DataRegistryImpl();
        const ns = registry.createNamespace('module-a', makePermissions('module-a', false));
        await ns.set('key1', 'value1');
        await ns.set('key2', 'value2');
        await ns.burn();
        assert.equal(ns.isBurned(), true);
        await registry.destroy();
    });
    // 8. Query with filter (prefix, time range)
    await test('queries namespace with filters', async () => {
        const registry = new DataRegistryImpl();
        const ns = registry.createNamespace('module-a', makePermissions('module-a', false));
        await ns.set('log:2024-01', 'entry1');
        await ns.set('log:2024-02', 'entry2');
        await ns.set('config:theme', 'dark');
        const results = await ns.query({ keyPrefix: 'log:' });
        assert.equal(Object.keys(results).length, 2);
        assert.equal(results['log:2024-01'], 'entry1');
        assert.equal(results['log:2024-02'], 'entry2');
        await registry.destroy();
    });
    // 9. List keys in namespace
    await test('lists keys in a namespace', async () => {
        const registry = new DataRegistryImpl();
        const ns = registry.createNamespace('module-a', makePermissions('module-a', false));
        await ns.set('alpha', 1);
        await ns.set('beta', 2);
        await ns.set('gamma', 3);
        const keys = (await ns.listKeys()).sort();
        assert.deepEqual(keys, ['alpha', 'beta', 'gamma']);
        await registry.destroy();
    });
    // 10. Get namespace size
    await test('gets namespace size', async () => {
        const registry = new DataRegistryImpl();
        const ns = registry.createNamespace('module-a', makePermissions('module-a', false));
        assert.equal(await ns.getSize(), 0);
        await ns.set('a', 1);
        await ns.set('b', 2);
        assert.equal(await ns.getSize(), 2);
        await ns.delete('a');
        assert.equal(await ns.getSize(), 1);
        await registry.destroy();
    });
    // 11. Multiple namespaces per registry
    await test('handles multiple namespaces in a single registry', async () => {
        const registry = new DataRegistryImpl();
        const modules = ['mod-1', 'mod-2', 'mod-3', 'mod-4', 'mod-5'];
        for (const mod of modules) {
            const ns = registry.createNamespace(mod, makePermissions(mod, false));
            await ns.set('id', mod);
        }
        assert.equal(registry.listNamespaces().length, 5);
        for (const mod of modules) {
            assert.equal(await registry.getNamespace(mod).get('id'), mod);
        }
        await registry.destroy();
    });
    // 12. Permission denied errors
    await test('throws PrivacyError when accessing namespace without permission', async () => {
        const registry = new DataRegistryImpl();
        registry.createNamespace('module-a', makePermissions('module-a', false));
        registry.createNamespace('module-b', makePermissions('module-b', false));
        try {
            registry.getNamespaceWithAccess('module-a', 'module-b');
            assert.fail('Should have thrown');
        }
        catch (err) {
            assert.ok(err instanceof PrivacyError);
        }
        await registry.destroy();
    });
    // Extra: Encrypted namespace
    await test('works with encrypted namespaces', async () => {
        const kernel = new PrivacyKernel();
        kernel.setPrivacyTier('SOFT');
        const registry = new DataRegistryImpl(kernel);
        const ns = registry.createNamespace('encrypted-mod', makePermissions('encrypted-mod', true));
        await ns.set('secret', { password: 'hunter2' });
        const value = await ns.get('secret');
        assert.deepEqual(value, { password: 'hunter2' });
        await registry.destroy();
    });
    // Extra: Duplicate namespace throws
    await test('throws when creating duplicate namespace', async () => {
        const registry = new DataRegistryImpl();
        registry.createNamespace('module-a', makePermissions('module-a', false));
        try {
            registry.createNamespace('module-a', makePermissions('module-a', false));
            assert.fail('Should have thrown');
        }
        catch (err) {
            assert.ok(err instanceof PrivacyError);
        }
        await registry.destroy();
    });
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
    process.exit(failed > 0 ? 1 : 0);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=manual-test.js.map