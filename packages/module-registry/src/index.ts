// ============================================================
// Module Registry — Exports
// ============================================================

export { ModuleRegistryImpl } from './module-registry.js';
export { DependencyGraph } from './dependency-graph.js';
export { ManifestValidator } from './manifest-validator.js';

// Re-export shared types for convenience
export type {
  ModuleManifest,
  ModuleCategory,
  ModuleRegistry,
  Permission,
} from '@jason-os/shared';
