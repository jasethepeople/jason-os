// ============================================================
// Module Registry — Core implementation
// Manages module manifests, dependencies, and lifecycle
// ============================================================

import {
  type ModuleCategory,
  type ModuleManifest,
  type ModuleRegistry,
  ModuleError,
} from '@jason-os/shared';

import { DependencyGraph } from './dependency-graph.js';
import { ManifestValidator } from './manifest-validator.js';

// ------------------------------------------------------------------
// ModuleRegistryImpl
// ------------------------------------------------------------------

export class ModuleRegistryImpl implements ModuleRegistry {
  private readonly _modules: Map<string, ModuleManifest> = new Map();
  private readonly _dependencyGraph: DependencyGraph = new DependencyGraph();
  private readonly _validator: ManifestValidator = new ManifestValidator();

  /**
   * Register a new module in the registry.
   * Validates the manifest, checks for duplicates, and updates the dependency graph.
   */
  register(manifest: ModuleManifest): void {
    // Step 1: Validate the manifest schema
    const validated = this._validator.validate(manifest, new Set(this._modules.keys()));

    // Step 2: Check for duplicate registration
    if (this._modules.has(validated.id)) {
      throw new ModuleError(
        `Module "${validated.id}" is already registered`,
        { moduleId: validated.id }
      );
    }

    // Step 3: Store the module
    this._modules.set(validated.id, validated);
    this._validator.registerId(validated.id);

    // Step 4: Update dependency graph
    this._dependencyGraph.addNode({
      id: validated.id,
      dependencies: validated.dependencies,
      optionalDependencies: validated.optionalDependencies,
    });

    // Step 5: Warn about unsatisfied optional dependencies
    const unsatisfiedOptional = this._dependencyGraph.getUnsatisfiedOptionalDependencies();
    const thisModuleUnsatisfied = unsatisfiedOptional.get(validated.id);
    if (thisModuleUnsatisfied && thisModuleUnsatisfied.length > 0) {
      // This is a warning scenario — optional deps are not available yet.
      // In a real system, we'd emit a warning event here.
      console.warn(
        `[ModuleRegistry] Module "${validated.id}" has unsatisfied optional dependencies: ${thisModuleUnsatisfied.join(', ')}`
      );
    }
  }

  /**
   * Unregister a module and clean up its dependency graph edges.
   */
  unregister(moduleId: string): void {
    if (!this._modules.has(moduleId)) {
      return;
    }

    this._modules.delete(moduleId);
    this._validator.unregisterId(moduleId);
    this._dependencyGraph.removeNode(moduleId);
  }

  /**
   * Get a module manifest by ID.
   */
  get(moduleId: string): ModuleManifest | undefined {
    return this._modules.get(moduleId);
  }

  /**
   * List all registered modules.
   */
  list(): ModuleManifest[] {
    return [...this._modules.values()];
  }

  /**
   * List modules filtered by category.
   */
  listByCategory(category: ModuleCategory): ModuleManifest[] {
    return [...this._modules.values()].filter(
      (manifest) => manifest.category === category
    );
  }

  /**
   * Resolve all transitive dependencies for a module.
   * Returns dependency IDs in topological order (dependencies first).
   */
  resolveDependencies(moduleId: string): string[] {
    if (!this._modules.has(moduleId)) {
      throw new ModuleError(
        `Cannot resolve dependencies: module "${moduleId}" is not registered`,
        { moduleId }
      );
    }

    return this._dependencyGraph.resolveDependencies(moduleId);
  }

  /**
   * Resolve all modules that depend on the given module (transitive dependents).
   */
  resolveDependents(moduleId: string): string[] {
    if (!this._modules.has(moduleId)) {
      throw new ModuleError(
        `Cannot resolve dependents: module "${moduleId}" is not registered`,
        { moduleId }
      );
    }

    return this._dependencyGraph.resolveDependents(moduleId);
  }

  /**
   * Detect all cycles in the dependency graph.
   * Returns an array of cycles, each cycle being an array of module IDs.
   */
  detectCycles(): string[][] {
    return this._dependencyGraph.detectCycles();
  }

  /**
   * Check if a module is registered.
   */
  isRegistered(moduleId: string): boolean {
    return this._modules.has(moduleId);
  }

  /**
   * Validate a manifest. Returns the validated manifest or throws ValidationError.
   */
  validateManifest(manifest: unknown): ModuleManifest {
    return this._validator.validate(manifest, new Set(this._modules.keys()));
  }

  /**
   * Get the initialization order for all modules using topological sort.
   * Dependencies are initialized before their dependents.
   */
  getInitializationOrder(): string[] {
    return this._dependencyGraph.topologicalSort();
  }

  /**
   * Get modules with missing (required) dependencies.
   */
  getMissingDependencies(): Map<string, string[]> {
    return this._dependencyGraph.getMissingDependencies();
  }

  /**
   * Get the count of registered modules.
   */
  get size(): number {
    return this._modules.size;
  }

  /**
   * Clear all modules and reset the registry.
   */
  clear(): void {
    this._modules.clear();
    this._dependencyGraph.clear();
    this._validator.reset();
  }
}
