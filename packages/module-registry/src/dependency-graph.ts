// ============================================================
// Dependency Graph — DAG builder, cycle detection, topo sort
// ============================================================

import { ModuleError } from '@jason-os/shared';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface GraphNode {
  id: string;
  dependencies: string[];
  optionalDependencies: string[];
}

// ------------------------------------------------------------------
// Dependency Graph
// ------------------------------------------------------------------

export class DependencyGraph {
  private readonly _graph: Map<string, Set<string>> = new Map();
  private readonly _reverseGraph: Map<string, Set<string>> = new Map();
  private readonly _nodes: Map<string, GraphNode> = new Map();
  private readonly _optionalDeps: Map<string, Set<string>> = new Map();

  /**
   * Add a node to the graph. Replaces any existing node with the same id.
   */
  addNode(node: GraphNode): void {
    // Remove existing node first to ensure clean state
    this.removeNode(node.id);

    this._nodes.set(node.id, node);
    this._graph.set(node.id, new Set());
    this._reverseGraph.set(node.id, new Set());
    this._optionalDeps.set(node.id, new Set(node.optionalDependencies));

    // Add dependency edges
    for (const dep of node.dependencies) {
      this._graph.get(node.id)?.add(dep);
      // Ensure the dependency itself exists as a node in _graph (even if not registered)
      if (!this._graph.has(dep)) {
        this._graph.set(dep, new Set());
      }
      if (!this._reverseGraph.has(dep)) {
        this._reverseGraph.set(dep, new Set());
      }
      this._reverseGraph.get(dep)?.add(node.id);
    }
  }

  /**
   * Remove a node and all its edges from the graph.
   */
  removeNode(id: string): void {
    if (!this._nodes.has(id)) {
      return;
    }

    // Remove outgoing edges from reverse graph
    const deps = this._graph.get(id);
    if (deps) {
      for (const dep of deps) {
        this._reverseGraph.get(dep)?.delete(id);
      }
    }

    // Remove incoming edges from forward graph
    const dependents = this._reverseGraph.get(id);
    if (dependents) {
      for (const dependent of dependents) {
        this._graph.get(dependent)?.delete(id);
      }
    }

    this._nodes.delete(id);
    this._graph.delete(id);
    this._reverseGraph.delete(id);
    this._optionalDeps.delete(id);
  }

  /**
   * Get direct dependencies of a node.
   */
  getDirectDependencies(id: string): string[] {
    const deps = this._graph.get(id);
    return deps ? [...deps] : [];
  }

  /**
   * Get direct dependents (nodes that depend on this node).
   */
  getDirectDependents(id: string): string[] {
    const dependents = this._reverseGraph.get(id);
    return dependents ? [...dependents] : [];
  }

  /**
   * Resolve all transitive dependencies for a node using DFS.
   */
  resolveDependencies(id: string): string[] {
    if (!this._nodes.has(id)) {
      return [];
    }

    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (currentId: string): void => {
      const deps = this._graph.get(currentId);
      if (!deps) return;

      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          result.push(dep);
          visit(dep);
        }
      }
    };

    visit(id);
    return result;
  }

  /**
   * Resolve all transitive dependents (who depends on me, directly or transitively).
   */
  resolveDependents(id: string): string[] {
    if (!this._reverseGraph.has(id)) {
      return [];
    }

    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (currentId: string): void => {
      const dependents = this._reverseGraph.get(currentId);
      if (!dependents) return;

      for (const dependent of dependents) {
        if (!visited.has(dependent)) {
          visited.add(dependent);
          result.push(dependent);
          visit(dependent);
        }
      }
    };

    visit(id);
    return result;
  }

  /**
   * Detect all cycles in the graph using Kahn's algorithm-inspired DFS.
   * Returns an array of cycles, where each cycle is an array of node IDs.
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // We need to check all nodes (including those that only appear as dependencies)
    const allNodes = new Set<string>();
    for (const [node, deps] of this._graph) {
      allNodes.add(node);
      for (const dep of deps) {
        allNodes.add(dep);
      }
    }

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle — extract it from the path
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart);
          // Normalize: start from the lexicographically smallest node
          cycles.push(this._normalizeCycle(cycle));
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = this._graph.get(node);
      if (deps) {
        for (const dep of deps) {
          dfs(dep, [...path]);
        }
      }

      recursionStack.delete(node);
    };

    for (const node of allNodes) {
      if (!visited.has(node)) {
        visited.clear();
        recursionStack.clear();
        for (const n of allNodes) {
          if (!this._graph.has(n) || (this._graph.get(n)?.size === 0 && this._reverseGraph.get(n)?.size === 0)) {
            // Isolated nodes - skip them in cycle detection
          }
        }
        dfs(node, []);
      }
    }

    // Deduplicate cycles
    return this._deduplicateCycles(cycles);
  }

  /**
   * Topological sort using Kahn's algorithm.
   * Returns nodes in initialization order (dependencies first).
   * Throws ModuleError if cycles are detected.
   */
  topologicalSort(): string[] {
    const inDegree = new Map<string, number>();

    // Collect all nodes (both keys and values in the graph)
    const allNodes = new Set<string>();
    for (const [node, deps] of this._graph) {
      allNodes.add(node);
      for (const dep of deps) {
        allNodes.add(dep);
      }
    }

    // Initialize in-degree for all nodes to 0
    for (const node of allNodes) {
      inDegree.set(node, 0);
    }

    // Count in-degree: number of dependencies each node has
    for (const [node, deps] of this._graph) {
      inDegree.set(node, deps.size);
    }

    // Filter to only registered nodes (nodes explicitly added via addNode)
    const registeredNodes = new Set(this._nodes.keys());

    // Find all nodes with in-degree 0
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0 && registeredNodes.has(node)) {
        queue.push(node);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      // For all dependents of this node, decrement their in-degree
      const dependents = this._reverseGraph.get(node);
      if (dependents) {
        for (const dependent of dependents) {
          // Only process registered nodes
          if (!registeredNodes.has(dependent)) continue;
          const newDegree = (inDegree.get(dependent) ?? 1) - 1;
          inDegree.set(dependent, newDegree);
          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    // Check if we processed all registered nodes
    if (result.length !== registeredNodes.size) {
      const cycles = this.detectCycles();
      const cycleStr = cycles.map(c => c.join(' -> ')).join('; ');
      throw new ModuleError(
        `Cannot perform topological sort: cycle detected in dependency graph. Cycles: ${cycleStr}`,
        { cycles }
      );
    }

    return result;
  }

  /**
   * Get all unregistered dependencies (deps that point to nodes not in the graph).
   * Returns a map of module ID -> array of missing dependency IDs.
   */
  getMissingDependencies(): Map<string, string[]> {
    const missing = new Map<string, string[]>();

    for (const [nodeId, deps] of this._graph) {
      const missingDeps: string[] = [];
      for (const dep of deps) {
        if (!this._nodes.has(dep)) {
          // Check if it's an optional dependency
          const isOptional = this._optionalDeps.get(nodeId)?.has(dep) ?? false;
          if (!isOptional) {
            missingDeps.push(dep);
          }
        }
      }
      if (missingDeps.length > 0) {
        missing.set(nodeId, missingDeps);
      }
    }

    return missing;
  }

  /**
   * Get optional dependencies that are not satisfied.
   */
  getUnsatisfiedOptionalDependencies(): Map<string, string[]> {
    const unsatisfied = new Map<string, string[]>();

    for (const [nodeId, optionalDeps] of this._optionalDeps) {
      const missing: string[] = [];
      for (const dep of optionalDeps) {
        if (!this._nodes.has(dep)) {
          missing.push(dep);
        }
      }
      if (missing.length > 0) {
        unsatisfied.set(nodeId, missing);
      }
    }

    return unsatisfied;
  }

  /**
   * Check if a node exists in the graph.
   */
  hasNode(id: string): boolean {
    return this._nodes.has(id);
  }

  /**
   * Get all node IDs in the graph.
   */
  getNodeIds(): string[] {
    return [...this._nodes.keys()];
  }

  /**
   * Clear the entire graph.
   */
  clear(): void {
    this._graph.clear();
    this._reverseGraph.clear();
    this._nodes.clear();
    this._optionalDeps.clear();
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  /**
   * Normalize a cycle so it's always represented starting from
   * the lexicographically smallest node.
   */
  private _normalizeCycle(cycle: string[]): string[] {
    if (cycle.length === 0) return cycle;

    let minIndex = 0;
    for (let i = 1; i < cycle.length; i++) {
      if (cycle[i]! < cycle[minIndex]!) {
        minIndex = i;
      }
    }

    return [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
  }

  /**
   * Deduplicate cycles that are rotations of each other.
   */
  private _deduplicateCycles(cycles: string[][]): string[][] {
    const seen = new Set<string>();
    const result: string[][] = [];

    for (const cycle of cycles) {
      const key = cycle.join('|');
      if (!seen.has(key)) {
        seen.add(key);
        result.push(cycle);
      }
    }

    return result;
  }
}
