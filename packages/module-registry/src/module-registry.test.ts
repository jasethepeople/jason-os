// ============================================================
// Module Registry Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ModuleRegistryImpl } from './module-registry.js';
import {
  type ModuleManifest,
  type ModuleCategory,
  type Permission,
  ModuleError,
  ValidationError,
} from '@jason-os/shared';

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

function createManifest(
  id: string,
  overrides: Partial<ModuleManifest> = {}
): ModuleManifest {
  return {
    id,
    name: id
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    version: '1.0.0',
    category: 'PRODUCTIVITY' as ModuleCategory,
    dependencies: [],
    optionalDependencies: [],
    permissions: ['storage'] as Permission[],
    events: {
      emits: [`${id}:started`],
      listens: [`${id}:stop`],
    },
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('ModuleRegistryImpl', () => {
  let registry: ModuleRegistryImpl;

  beforeEach(() => {
    registry = new ModuleRegistryImpl();
  });

  // ---- 1. Register and retrieve a module ----
  it('should register and retrieve a module', () => {
    const manifest = createManifest('test-module');
    registry.register(manifest);

    const retrieved = registry.get('test-module');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-module');
    expect(retrieved?.name).toBe('Test Module');
    expect(retrieved?.version).toBe('1.0.0');
  });

  // ---- 2. List all modules ----
  it('should list all registered modules', () => {
    registry.register(createManifest('mod-a'));
    registry.register(createManifest('mod-b'));
    registry.register(createManifest('mod-c'));

    const list = registry.list();
    expect(list.length).toBe(3);
    expect(list.map((m) => m.id).sort()).toEqual([
      'mod-a',
      'mod-b',
      'mod-c',
    ]);
  });

  // ---- 3. List by category ----
  it('should list modules filtered by category', () => {
    registry.register(
      createManifest('emotion-mod', { category: 'EMOTIONAL' as ModuleCategory })
    );
    registry.register(
      createManifest('identity-mod', {
        category: 'IDENTITY' as ModuleCategory,
      })
    );
    registry.register(
      createManifest('productivity-mod', {
        category: 'PRODUCTIVITY' as ModuleCategory,
      })
    );
    registry.register(
      createManifest('nav-mod', {
        category: 'NAVIGATION' as ModuleCategory,
      })
    );
    registry.register(
      createManifest('privacy-mod', {
        category: 'PRIVACY' as ModuleCategory,
      })
    );

    const emotional = registry.listByCategory('EMOTIONAL' as ModuleCategory);
    expect(emotional.length).toBe(1);
    expect(emotional[0].id).toBe('emotion-mod');

    const productivity = registry.listByCategory(
      'PRODUCTIVITY' as ModuleCategory
    );
    expect(productivity.length).toBe(1);
    expect(productivity[0].id).toBe('productivity-mod');
  });

  // ---- 4. Topological sort gives valid init order ----
  it('should provide valid initialization order via topological sort', () => {
    // Chain: core -> engine -> features -> app
    registry.register(createManifest('core'));
    registry.register(createManifest('engine', { dependencies: ['core'] }));
    registry.register(
      createManifest('features', { dependencies: ['engine'] })
    );
    registry.register(createManifest('app', { dependencies: ['features'] }));

    const order = registry.getInitializationOrder();
    expect(order.length).toBe(4);

    const coreIdx = order.indexOf('core');
    const engineIdx = order.indexOf('engine');
    const featuresIdx = order.indexOf('features');
    const appIdx = order.indexOf('app');

    expect(coreIdx).toBeLessThan(engineIdx);
    expect(engineIdx).toBeLessThan(featuresIdx);
    expect(featuresIdx).toBeLessThan(appIdx);
  });

  // ---- 5. Cycle detection finds circular deps ----
  it('should detect circular dependencies', () => {
    // Circular: a -> b -> c -> a
    registry.register(createManifest('circ-a', { dependencies: ['circ-b'] }));
    registry.register(createManifest('circ-b', { dependencies: ['circ-c'] }));
    registry.register(createManifest('circ-c', { dependencies: ['circ-a'] }));

    const cycles = registry.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);

    const cycle = cycles[0];
    expect(cycle).toContain('circ-a');
    expect(cycle).toContain('circ-b');
    expect(cycle).toContain('circ-c');
  });

  // ---- 6. Cycle detection returns empty when no cycles ----
  it('should return empty array when no cycles exist', () => {
    registry.register(createManifest('mod-a'));
    registry.register(createManifest('mod-b', { dependencies: ['mod-a'] }));
    registry.register(createManifest('mod-c', { dependencies: ['mod-b'] }));

    const cycles = registry.detectCycles();
    expect(cycles).toEqual([]);
  });

  // ---- 7. Dependency resolution includes transitive deps ----
  it('should resolve transitive dependencies', () => {
    // a -> b -> c -> d
    registry.register(createManifest('base-d'));
    registry.register(createManifest('layer-c', { dependencies: ['base-d'] }));
    registry.register(
      createManifest('layer-b', { dependencies: ['layer-c'] })
    );
    registry.register(
      createManifest('layer-a', { dependencies: ['layer-b'] })
    );

    const deps = registry.resolveDependencies('layer-a');
    expect(deps).toContain('layer-b');
    expect(deps).toContain('layer-c');
    expect(deps).toContain('base-d');
    expect(deps.length).toBe(3);
  });

  // ---- 8. Dependent resolution (who depends on me) ----
  it('should resolve transitive dependents', () => {
    // d <- c <- b <- a
    registry.register(createManifest('d'));
    registry.register(createManifest('c', { dependencies: ['d'] }));
    registry.register(createManifest('b', { dependencies: ['c'] }));
    registry.register(createManifest('a', { dependencies: ['b'] }));

    const dependents = registry.resolveDependents('d');
    expect(dependents).toContain('c');
    expect(dependents).toContain('b');
    expect(dependents).toContain('a');
    expect(dependents.length).toBe(3);
  });

  // ---- 9. Validation rejects missing required fields ----
  it('should reject manifest with missing required fields', () => {
    expect(() =>
      registry.validateManifest({ name: 'test', version: '1.0.0' })
    ).toThrow(ValidationError);

    expect(() =>
      registry.validateManifest({
        id: 'test',
        version: '1.0.0',
        category: 'PRODUCTIVITY',
        dependencies: [],
        optionalDependencies: [],
        permissions: [],
        events: { emits: ['x'], listens: ['y'] },
      })
    ).toThrow(ValidationError);
  });

  // ---- 10. Validation rejects invalid version ----
  it('should reject invalid version format', () => {
    expect(() =>
      registry.validateManifest({
        id: 'bad-ver',
        name: 'Bad Version',
        version: 'not-semver',
        category: 'PRODUCTIVITY',
        dependencies: [],
        optionalDependencies: [],
        permissions: [],
        events: { emits: [], listens: [] },
      })
    ).toThrow(ValidationError);
  });

  // ---- 11. Validation rejects invalid category ----
  it('should reject invalid category', () => {
    expect(() =>
      registry.validateManifest({
        id: 'bad-cat',
        name: 'Bad Category',
        version: '1.0.0',
        category: 'INVALID_CATEGORY',
        dependencies: [],
        optionalDependencies: [],
        permissions: [],
        events: { emits: [], listens: [] },
      })
    ).toThrow(ValidationError);
  });

  // ---- 12. Validation rejects duplicate IDs ----
  it('should reject duplicate module IDs', () => {
    registry.register(createManifest('unique-id'));

    expect(() => registry.register(createManifest('unique-id'))).toThrow(
      ValidationError
    );
  });

  // ---- 13. Unregister removes module and updates graph ----
  it('should unregister a module and update the dependency graph', () => {
    registry.register(createManifest('mod-base'));
    registry.register(
      createManifest('mod-dependent', { dependencies: ['mod-base'] })
    );

    expect(registry.isRegistered('mod-dependent')).toBe(true);

    registry.unregister('mod-dependent');

    expect(registry.isRegistered('mod-dependent')).toBe(false);
    expect(registry.get('mod-dependent')).toBeUndefined();
    expect(registry.list().length).toBe(1);

    // mod-base should still be registered
    expect(registry.isRegistered('mod-base')).toBe(true);
  });

  // ---- 14. Optional dependencies do not fail when missing ----
  it('should allow optional dependencies to be missing', () => {
    // Register module with optional dependency that doesn't exist yet
    registry.register(
      createManifest('has-optional', {
        optionalDependencies: ['not-yet-registered'],
      })
    );

    expect(registry.isRegistered('has-optional')).toBe(true);
  });

  // Optional dep warnings don't prevent registration
  it('should register module even when optional dependency is never registered', () => {
    registry.register(
      createManifest('optional-user', {
        dependencies: ['required-dep'],
        optionalDependencies: ['never-registered'],
      })
    );

    // Should have the required dep as missing (since we didn't register it)
    const missing = registry.getMissingDependencies();
    expect(missing.has('optional-user')).toBe(true);
    expect(missing.get('optional-user')).toContain('required-dep');
  });

  // ---- 15. Complex dependency graph (10+ modules with interdependencies) ----
  it('should handle complex dependency graph with 10+ modules', () => {
    // Build a realistic module graph:
    //
    //                    ┌──────────┐
    //                    │  kernel  │
    //                    └────┬─────┘
    //           ┌─────────────┼─────────────┐
    //           ▼             ▼             ▼
    //      ┌────────┐   ┌──────────┐   ┌─────────┐
    //      │ config │   │ eventbus │   │ storage │
    //      └───┬────┘   └────┬─────┘   └────┬────┘
    //          │             │              │
    //          └─────────────┴──────────────┘
    //                        │
    //                        ▼
    //                  ┌──────────┐
    //                  │  identity │
    //                  └────┬─────┘
    //           ┌───────────┼───────────┐
    //           ▼           ▼           ▼
    //      ┌────────┐  ┌────────┐  ┌──────────┐
    //      │ privacy │  │ session │  │ emotional │
    //      └───┬────┘  └────┬───┘  └─────┬────┘
    //          │            │             │
    //          └────────────┴─────────────┘
    //                        │
    //                        ▼
    //                  ┌──────────┐
    //                  │   app    │
    //                  └──────────┘

    registry.register(createManifest('kernel'));
    registry.register(createManifest('config', { dependencies: ['kernel'] }));
    registry.register(createManifest('eventbus', { dependencies: ['kernel'] }));
    registry.register(createManifest('storage', { dependencies: ['kernel'] }));
    registry.register(
      createManifest('identity', {
        dependencies: ['config', 'eventbus', 'storage'],
      })
    );
    registry.register(
      createManifest('privacy', { dependencies: ['identity'] })
    );
    registry.register(
      createManifest('session', { dependencies: ['identity'] })
    );
    registry.register(
      createManifest('emotional', { dependencies: ['identity'] })
    );
    registry.register(
      createManifest('app', {
        dependencies: ['privacy', 'session', 'emotional'],
      })
    );

    expect(registry.list().length).toBe(9);

    // Topological sort should place kernel first
    const order = registry.getInitializationOrder();
    expect(order.length).toBe(9);
    expect(order.indexOf('kernel')).toBe(0);

    // app should be last
    expect(order.indexOf('app')).toBe(8);

    // Verify all dependency constraints
    const kernelIdx = order.indexOf('kernel');
    const configIdx = order.indexOf('config');
    const eventbusIdx = order.indexOf('eventbus');
    const storageIdx = order.indexOf('storage');
    const identityIdx = order.indexOf('identity');
    const privacyIdx = order.indexOf('privacy');
    const sessionIdx = order.indexOf('session');
    const emotionalIdx = order.indexOf('emotional');
    const appIdx = order.indexOf('app');

    expect(kernelIdx).toBeLessThan(configIdx);
    expect(kernelIdx).toBeLessThan(eventbusIdx);
    expect(kernelIdx).toBeLessThan(storageIdx);
    expect(configIdx).toBeLessThan(identityIdx);
    expect(eventbusIdx).toBeLessThan(identityIdx);
    expect(storageIdx).toBeLessThan(identityIdx);
    expect(identityIdx).toBeLessThan(privacyIdx);
    expect(identityIdx).toBeLessThan(sessionIdx);
    expect(identityIdx).toBeLessThan(emotionalIdx);
    expect(privacyIdx).toBeLessThan(appIdx);
    expect(sessionIdx).toBeLessThan(appIdx);
    expect(emotionalIdx).toBeLessThan(appIdx);
  });

  // ---- Additional coverage tests ----

  // isRegistered
  it('should return false for unregistered module', () => {
    expect(registry.isRegistered('not-registered')).toBe(false);
  });

  it('should return true for registered module', () => {
    registry.register(createManifest('registered'));
    expect(registry.isRegistered('registered')).toBe(true);
  });

  // get returns undefined for unknown
  it('should return undefined for unknown module', () => {
    expect(registry.get('unknown')).toBeUndefined();
  });

  // size property
  it('should report correct size', () => {
    expect(registry.size).toBe(0);
    registry.register(createManifest('one'));
    expect(registry.size).toBe(1);
    registry.register(createManifest('two'));
    expect(registry.size).toBe(2);
  });

  // clear
  it('should clear all modules', () => {
    registry.register(createManifest('one'));
    registry.register(createManifest('two'));

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
    expect(registry.isRegistered('one')).toBe(false);
  });

  // Unregister unknown module is a no-op
  it('should handle unregistering unknown module gracefully', () => {
    expect(() => registry.unregister('unknown')).not.toThrow();
  });

  // Re-registration after unregister
  it('should allow re-registration after unregister', () => {
    registry.register(createManifest('re-reg'));
    registry.unregister('re-reg');
    registry.register(createManifest('re-reg'));

    expect(registry.isRegistered('re-reg')).toBe(true);
  });

  // resolveDependencies throws for unregistered module
  it('should throw when resolving deps for unregistered module', () => {
    expect(() => registry.resolveDependencies('unknown')).toThrow(ModuleError);
  });

  // resolveDependents throws for unregistered module
  it('should throw when resolving dependents for unregistered module', () => {
    expect(() => registry.resolveDependents('unknown')).toThrow(ModuleError);
  });

  // Missing dependencies detected
  it('should detect missing required dependencies', () => {
    registry.register(
      createManifest('needs-other', { dependencies: ['other-mod'] })
    );

    const missing = registry.getMissingDependencies();
    expect(missing.has('needs-other')).toBe(true);
    expect(missing.get('needs-other')).toContain('other-mod');
  });

  // validateManifest returns valid manifest
  it('should return validated manifest from validateManifest', () => {
    const manifest = registry.validateManifest({
      id: 'validated',
      name: 'Validated Module',
      version: '2.0.0',
      category: 'PRIVACY',
      dependencies: ['dep1'],
      optionalDependencies: ['opt1'],
      permissions: ['storage', 'network'],
      events: {
        emits: ['validated:start'],
        listens: ['validated:stop'],
      },
    });

    expect(manifest.id).toBe('validated');
    expect(manifest.version).toBe('2.0.0');
    expect(manifest.category).toBe('PRIVACY');
  });

  // Categories work correctly
  it('should support all valid categories', () => {
    const categories: ModuleCategory[] = [
      'EMOTIONAL',
      'IDENTITY',
      'PRODUCTIVITY',
      'NAVIGATION',
      'MEMORY',
      'COMMUNICATION',
      'PRIVACY',
    ];

    for (let i = 0; i < categories.length; i++) {
      registry.register(
        createManifest(`cat-mod-${i}`, { category: categories[i] })
      );
    }

    for (let i = 0; i < categories.length; i++) {
      const list = registry.listByCategory(categories[i]);
      expect(list.length).toBe(1);
      expect(list[0].category).toBe(categories[i]);
    }
  });
});
