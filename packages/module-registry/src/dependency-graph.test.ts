// ============================================================
// Dependency Graph Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from './dependency-graph.js';
import { ModuleError } from '@jason-os/shared';

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

function createNode(
  id: string,
  dependencies: string[] = [],
  optionalDependencies: string[] = []
) {
  return { id, dependencies, optionalDependencies };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  // 1. Add and retrieve nodes
  it('should add a node and report it exists', () => {
    graph.addNode(createNode('mod-a'));
    expect(graph.hasNode('mod-a')).toBe(true);
    expect(graph.getNodeIds()).toEqual(['mod-a']);
  });

  // 2. Get direct dependencies
  it('should return direct dependencies', () => {
    graph.addNode(createNode('mod-a', ['mod-b', 'mod-c']));
    expect(graph.getDirectDependencies('mod-a')).toEqual(['mod-b', 'mod-c']);
  });

  // 3. Empty dependencies for isolated node
  it('should return empty array for node with no dependencies', () => {
    graph.addNode(createNode('mod-a'));
    expect(graph.getDirectDependencies('mod-a')).toEqual([]);
  });

  // 4. Empty result for unknown node
  it('should return empty array for unknown node', () => {
    expect(graph.getDirectDependencies('nonexistent')).toEqual([]);
    expect(graph.resolveDependencies('nonexistent')).toEqual([]);
  });

  // 5. Resolve transitive dependencies
  it('should resolve transitive dependencies', () => {
    // mod-a -> mod-b -> mod-c
    graph.addNode(createNode('mod-c'));
    graph.addNode(createNode('mod-b', ['mod-c']));
    graph.addNode(createNode('mod-a', ['mod-b']));

    const deps = graph.resolveDependencies('mod-a');
    expect(deps).toContain('mod-b');
    expect(deps).toContain('mod-c');
    expect(deps.length).toBe(2);
  });

  // 6. Resolve dependents (who depends on me)
  it('should resolve transitive dependents', () => {
    // mod-a -> mod-b -> mod-c (mod-c is depended on by mod-b and mod-a transitively)
    graph.addNode(createNode('mod-c'));
    graph.addNode(createNode('mod-b', ['mod-c']));
    graph.addNode(createNode('mod-a', ['mod-b']));

    const dependentsOfC = graph.resolveDependents('mod-c');
    expect(dependentsOfC).toContain('mod-b');
    expect(dependentsOfC).toContain('mod-a');
  });

  // 7. Direct dependents
  it('should return direct dependents', () => {
    graph.addNode(createNode('mod-base'));
    graph.addNode(createNode('mod-a', ['mod-base']));
    graph.addNode(createNode('mod-b', ['mod-base']));

    const dependents = graph.getDirectDependents('mod-base');
    expect(dependents).toContain('mod-a');
    expect(dependents).toContain('mod-b');
    expect(dependents.length).toBe(2);
  });

  // 8. Cycle detection — empty when no cycles
  it('should return empty array when no cycles exist', () => {
    graph.addNode(createNode('mod-c'));
    graph.addNode(createNode('mod-b', ['mod-c']));
    graph.addNode(createNode('mod-a', ['mod-b']));

    expect(graph.detectCycles()).toEqual([]);
  });

  // 9. Cycle detection — simple 2-node cycle
  it('should detect a simple 2-node cycle', () => {
    graph.addNode(createNode('mod-a', ['mod-b']));
    graph.addNode(createNode('mod-b', ['mod-a']));

    const cycles = graph.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  // 10. Cycle detection — 3-node cycle
  it('should detect a 3-node cycle', () => {
    graph.addNode(createNode('mod-a', ['mod-b']));
    graph.addNode(createNode('mod-b', ['mod-c']));
    graph.addNode(createNode('mod-c', ['mod-a']));

    const cycles = graph.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);

    const cycle = cycles[0];
    expect(cycle).toContain('mod-a');
    expect(cycle).toContain('mod-b');
    expect(cycle).toContain('mod-c');
  });

  // 11. Topological sort — valid init order
  it('should produce valid topological order', () => {
    // mod-a depends on mod-b, mod-b depends on mod-c
    graph.addNode(createNode('mod-c'));
    graph.addNode(createNode('mod-b', ['mod-c']));
    graph.addNode(createNode('mod-a', ['mod-b']));

    const order = graph.topologicalSort();
    expect(order).toContain('mod-a');
    expect(order).toContain('mod-b');
    expect(order).toContain('mod-c');

    // mod-c should come before mod-b, mod-b before mod-a
    const indexA = order.indexOf('mod-a');
    const indexB = order.indexOf('mod-b');
    const indexC = order.indexOf('mod-c');

    expect(indexC).toBeLessThan(indexB);
    expect(indexB).toBeLessThan(indexA);
  });

  // 12. Topological sort — dependencies before dependents
  it('should place dependencies before their dependents', () => {
    // diamond: mod-a depends on mod-b and mod-c; both depend on mod-d
    graph.addNode(createNode('mod-d'));
    graph.addNode(createNode('mod-c', ['mod-d']));
    graph.addNode(createNode('mod-b', ['mod-d']));
    graph.addNode(createNode('mod-a', ['mod-b', 'mod-c']));

    const order = graph.topologicalSort();

    const indexA = order.indexOf('mod-a');
    const indexB = order.indexOf('mod-b');
    const indexC = order.indexOf('mod-c');
    const indexD = order.indexOf('mod-d');

    expect(indexD).toBeLessThan(indexB);
    expect(indexD).toBeLessThan(indexC);
    expect(indexB).toBeLessThan(indexA);
    expect(indexC).toBeLessThan(indexA);
  });

  // 13. Topological sort throws on cycle
  it('should throw when topological sort encounters a cycle', () => {
    graph.addNode(createNode('mod-a', ['mod-b']));
    graph.addNode(createNode('mod-b', ['mod-a']));

    expect(() => graph.topologicalSort()).toThrow(ModuleError);
  });

  // 14. Remove node updates graph
  it('should remove a node and its edges', () => {
    graph.addNode(createNode('mod-base'));
    graph.addNode(createNode('mod-a', ['mod-base']));

    expect(graph.hasNode('mod-a')).toBe(true);
    expect(graph.getDirectDependents('mod-base')).toContain('mod-a');

    graph.removeNode('mod-a');

    expect(graph.hasNode('mod-a')).toBe(false);
    expect(graph.getDirectDependents('mod-base')).not.toContain('mod-a');
  });

  // 15. Remove nonexistent node is a no-op
  it('should handle removing a nonexistent node gracefully', () => {
    expect(() => graph.removeNode('nonexistent')).not.toThrow();
  });

  // 16. Clear removes all nodes
  it('should clear all nodes', () => {
    graph.addNode(createNode('mod-a'));
    graph.addNode(createNode('mod-b'));

    graph.clear();

    expect(graph.hasNode('mod-a')).toBe(false);
    expect(graph.hasNode('mod-b')).toBe(false);
    expect(graph.getNodeIds()).toEqual([]);
  });

  // 17. Optional dependencies tracked separately
  it('should track optional dependencies', () => {
    graph.addNode(
      createNode('mod-a', ['mod-required'], ['mod-optional'])
    );

    expect(graph.hasNode('mod-a')).toBe(true);
    expect(graph.getDirectDependencies('mod-a')).toContain('mod-required');
  });

  // 18. Missing required dependencies reported
  it('should report missing required dependencies', () => {
    graph.addNode(createNode('mod-a', ['mod-missing']));

    const missing = graph.getMissingDependencies();
    expect(missing.has('mod-a')).toBe(true);
    expect(missing.get('mod-a')).toContain('mod-missing');
  });

  // 19. Missing optional dependencies not in required missing
  it('should not report missing optional dependencies as required', () => {
    graph.addNode(createNode('mod-a', [], ['mod-optional-missing']));

    const missing = graph.getMissingDependencies();
    expect(missing.has('mod-a')).toBe(false);
  });

  // 20. Unsatisfied optional dependencies tracked
  it('should track unsatisfied optional dependencies', () => {
    graph.addNode(createNode('mod-a', [], ['mod-optional-missing']));

    const unsatisfied = graph.getUnsatisfiedOptionalDependencies();
    expect(unsatisfied.has('mod-a')).toBe(true);
    expect(unsatisfied.get('mod-a')).toContain('mod-optional-missing');
  });

  // 21. Complex graph with 10+ modules
  it('should handle complex graph with 10+ modules', () => {
    // Build a complex dependency graph:
    // infra -> core -> [api, ui]
    // api -> [data, logic]
    // ui -> [components, styling]
    // data -> storage
    // logic -> rules
    // components -> primitives
    // styling -> theme

    graph.addNode(createNode('infra'));
    graph.addNode(createNode('core', ['infra']));
    graph.addNode(createNode('storage'));
    graph.addNode(createNode('rules'));
    graph.addNode(createNode('primitives'));
    graph.addNode(createNode('theme'));
    graph.addNode(createNode('data', ['storage']));
    graph.addNode(createNode('logic', ['rules']));
    graph.addNode(createNode('components', ['primitives']));
    graph.addNode(createNode('styling', ['theme']));
    graph.addNode(createNode('api', ['core', 'data', 'logic']));
    graph.addNode(createNode('ui', ['core', 'components', 'styling']));
    graph.addNode(createNode('app', ['api', 'ui']));

    expect(graph.getNodeIds().length).toBe(13);

    // Verify topological order
    const order = graph.topologicalSort();
    expect(order.length).toBe(13);

    // app should be last (depends on everything)
    expect(order[order.length - 1]).toBe('app');

    // infra and storage should come before core
    const indexInfra = order.indexOf('infra');
    const indexCore = order.indexOf('core');
    expect(indexInfra).toBeLessThan(indexCore);
  });

  // 22. Diamond dependency pattern
  it('should handle diamond dependency pattern', () => {
    //     A
    //    / \
    //   B   C
    //    \ /
    //     D
    graph.addNode(createNode('d'));
    graph.addNode(createNode('b', ['d']));
    graph.addNode(createNode('c', ['d']));
    graph.addNode(createNode('a', ['b', 'c']));

    const order = graph.topologicalSort();
    const indexA = order.indexOf('a');
    const indexB = order.indexOf('b');
    const indexC = order.indexOf('c');
    const indexD = order.indexOf('d');

    expect(indexD).toBeLessThan(indexB);
    expect(indexD).toBeLessThan(indexC);
    expect(indexB).toBeLessThan(indexA);
    expect(indexC).toBeLessThan(indexA);
  });

  // 23. Self-dependency cycle
  it('should detect self-dependency cycle', () => {
    graph.addNode(createNode('mod-a', ['mod-a']));

    const cycles = graph.detectCycles();
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain('mod-a');
  });

  // 24. Shared base module pattern
  it('should handle multiple modules depending on same base', () => {
    graph.addNode(createNode('base'));
    graph.addNode(createNode('feature-a', ['base']));
    graph.addNode(createNode('feature-b', ['base']));
    graph.addNode(createNode('feature-c', ['base']));

    const order = graph.topologicalSort();
    const indexBase = order.indexOf('base');

    expect(indexBase).toBeLessThan(order.indexOf('feature-a'));
    expect(indexBase).toBeLessThan(order.indexOf('feature-b'));
    expect(indexBase).toBeLessThan(order.indexOf('feature-c'));
  });

  // 25. Replace node updates dependencies
  it('should replace node when adding same id again', () => {
    graph.addNode(createNode('mod-a', ['mod-b']));
    graph.addNode(createNode('mod-a', ['mod-c']));

    const deps = graph.getDirectDependencies('mod-a');
    expect(deps).not.toContain('mod-b');
    expect(deps).toContain('mod-c');
  });

  // 26. Dependency resolution order is deterministic
  it('should produce deterministic topological sort', () => {
    graph.addNode(createNode('base'));
    graph.addNode(createNode('layer1', ['base']));
    graph.addNode(createNode('layer2', ['layer1']));

    const order1 = graph.topologicalSort();
    const order2 = graph.topologicalSort();

    expect(order1).toEqual(order2);
  });
});
