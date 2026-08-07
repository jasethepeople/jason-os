export interface GraphNode {
    id: string;
    dependencies: string[];
    optionalDependencies: string[];
}
export declare class DependencyGraph {
    private readonly _graph;
    private readonly _reverseGraph;
    private readonly _nodes;
    private readonly _optionalDeps;
    /**
     * Add a node to the graph. Replaces any existing node with the same id.
     */
    addNode(node: GraphNode): void;
    /**
     * Remove a node and all its edges from the graph.
     */
    removeNode(id: string): void;
    /**
     * Get direct dependencies of a node.
     */
    getDirectDependencies(id: string): string[];
    /**
     * Get direct dependents (nodes that depend on this node).
     */
    getDirectDependents(id: string): string[];
    /**
     * Resolve all transitive dependencies for a node using DFS.
     */
    resolveDependencies(id: string): string[];
    /**
     * Resolve all transitive dependents (who depends on me, directly or transitively).
     */
    resolveDependents(id: string): string[];
    /**
     * Detect all cycles in the graph using Kahn's algorithm-inspired DFS.
     * Returns an array of cycles, where each cycle is an array of node IDs.
     */
    detectCycles(): string[][];
    /**
     * Topological sort using Kahn's algorithm.
     * Returns nodes in initialization order (dependencies first).
     * Throws ModuleError if cycles are detected.
     */
    topologicalSort(): string[];
    /**
     * Get all unregistered dependencies (deps that point to nodes not in the graph).
     * Returns a map of module ID -> array of missing dependency IDs.
     */
    getMissingDependencies(): Map<string, string[]>;
    /**
     * Get optional dependencies that are not satisfied.
     */
    getUnsatisfiedOptionalDependencies(): Map<string, string[]>;
    /**
     * Check if a node exists in the graph.
     */
    hasNode(id: string): boolean;
    /**
     * Get all node IDs in the graph.
     */
    getNodeIds(): string[];
    /**
     * Clear the entire graph.
     */
    clear(): void;
    /**
     * Normalize a cycle so it's always represented starting from
     * the lexicographically smallest node.
     */
    private _normalizeCycle;
    /**
     * Deduplicate cycles that are rotations of each other.
     */
    private _deduplicateCycles;
}
//# sourceMappingURL=dependency-graph.d.ts.map