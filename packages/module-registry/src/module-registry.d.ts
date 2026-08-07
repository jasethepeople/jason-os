import { type ModuleCategory, type ModuleManifest, type ModuleRegistry } from '@jason-os/shared';
export declare class ModuleRegistryImpl implements ModuleRegistry {
    private readonly _modules;
    private readonly _dependencyGraph;
    private readonly _validator;
    /**
     * Register a new module in the registry.
     * Validates the manifest, checks for duplicates, and updates the dependency graph.
     */
    register(manifest: ModuleManifest): void;
    /**
     * Unregister a module and clean up its dependency graph edges.
     */
    unregister(moduleId: string): void;
    /**
     * Get a module manifest by ID.
     */
    get(moduleId: string): ModuleManifest | undefined;
    /**
     * List all registered modules.
     */
    list(): ModuleManifest[];
    /**
     * List modules filtered by category.
     */
    listByCategory(category: ModuleCategory): ModuleManifest[];
    /**
     * Resolve all transitive dependencies for a module.
     * Returns dependency IDs in topological order (dependencies first).
     */
    resolveDependencies(moduleId: string): string[];
    /**
     * Resolve all modules that depend on the given module (transitive dependents).
     */
    resolveDependents(moduleId: string): string[];
    /**
     * Detect all cycles in the dependency graph.
     * Returns an array of cycles, each cycle being an array of module IDs.
     */
    detectCycles(): string[][];
    /**
     * Check if a module is registered.
     */
    isRegistered(moduleId: string): boolean;
    /**
     * Validate a manifest. Returns the validated manifest or throws ValidationError.
     */
    validateManifest(manifest: unknown): ModuleManifest;
    /**
     * Get the initialization order for all modules using topological sort.
     * Dependencies are initialized before their dependents.
     */
    getInitializationOrder(): string[];
    /**
     * Get modules with missing (required) dependencies.
     */
    getMissingDependencies(): Map<string, string[]>;
    /**
     * Get the count of registered modules.
     */
    get size(): number;
    /**
     * Clear all modules and reset the registry.
     */
    clear(): void;
}
//# sourceMappingURL=module-registry.d.ts.map