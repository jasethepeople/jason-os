// ============================================================
// @jason-os/soft-barrier — Public API
// Emotional boundary setting with configurable limits and cooldown enforcement
// ============================================================

export {
  soft_barrier_module,
  SoftBarrier,
  createSoftBarrierModule,
} from './module.js';

export type {
  Boundary,
  SoftBarrierState,
  BoundaryConfig,
  BoundaryDimension,
  UsageReport,
} from './types.js';
