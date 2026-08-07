// ============================================================
// SoftBarrier Module — Emotional Boundary Setting
// Track usage across dimensions and enforce configurable limits with cooldown
// ============================================================

import type {
  Boundary,
  SoftBarrierState,
  BoundaryConfig,
  BoundaryDimension,
  UsageReport,
} from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const soft_barrier_module = {
  id: 'soft-barrier',
  name: 'SoftBarrier',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['events:emit', 'events:listen'] as const,
  description: 'Emotional boundary setting with configurable limits and cooldown enforcement',
};

// ------------------------------------------------------------------
// Defaults
// ------------------------------------------------------------------

const DEFAULT_COOLDOWN_MS = 60000;

// ------------------------------------------------------------------
// SoftBarrier Implementation
// ------------------------------------------------------------------

export class SoftBarrier {
  private state: SoftBarrierState = {
    boundaries: [],
    globalEnforcement: true,
    breachCount: 0,
  };

  private _bus: unknown;

  constructor(bus?: unknown) {
    this._bus = bus;
    void this._bus;
  }

  async init(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Define a new boundary for a dimension.
   * @param config - Boundary configuration
   * @returns The created boundary
   */
  setBoundary(config: BoundaryConfig): Boundary {
    const existingIdx = this.state.boundaries.findIndex(
      (b) => b.dimension === config.dimension
    );

    const boundary: Boundary = {
      id: `boundary-${config.dimension}-${Date.now()}`,
      dimension: config.dimension,
      limit: config.limit,
      current: config.initialCurrent ?? 0,
      breached: false,
      cooldownMs: config.cooldownMs ?? DEFAULT_COOLDOWN_MS,
      lastBreachedAt: null,
    };

    if (existingIdx >= 0) {
      // Preserve lastBreachedAt when reconfiguring
      boundary.lastBreachedAt = this.state.boundaries[existingIdx]!.lastBreachedAt;
      this.state.boundaries[existingIdx] = boundary;
    } else {
      this.state.boundaries.push(boundary);
    }

    return { ...boundary };
  }

  /**
   * Report usage for a dimension and check if within limits.
   * @param dimension - Dimension to report usage for
   * @param amount - Amount to add to current usage
   * @returns Usage report with breach status
   */
  reportUsage(dimension: BoundaryDimension, amount: number): UsageReport {
    const boundary = this.state.boundaries.find((b) => b.dimension === dimension);
    if (!boundary) {
      throw new Error(`No boundary configured for dimension "${dimension}"`);
    }

    boundary.current += amount;

    const wasBreached = boundary.breached;
    const now = Date.now();
    const inCooldown = this.isInCooldown(dimension);

    if (boundary.current > boundary.limit && !inCooldown) {
      boundary.breached = true;
      boundary.lastBreachedAt = now;
      this.state.breachCount++;

      this.emit('barrier:breached', {
        dimension: boundary.dimension,
        limit: boundary.limit,
        current: boundary.current,
        boundaryId: boundary.id,
      });

      this.emit('barrier:cooldown-started', {
        dimension: boundary.dimension,
        cooldownMs: boundary.cooldownMs,
        startedAt: now,
        endsAt: now + boundary.cooldownMs,
      });
    }

    return {
      withinLimits: boundary.current <= boundary.limit,
      breached: boundary.breached && !wasBreached,
      remaining: Math.max(0, boundary.limit - boundary.current),
      inCooldown: this.isInCooldown(dimension),
      cooldownRemaining: this.getCooldownRemaining(dimension),
      current: boundary.current,
    };
  }

  /**
   * Check current usage for a dimension without modifying it.
   * @param dimension - Dimension to check
   * @returns Usage report
   */
  checkUsage(dimension: BoundaryDimension): UsageReport {
    const boundary = this.state.boundaries.find((b) => b.dimension === dimension);
    if (!boundary) {
      throw new Error(`No boundary configured for dimension "${dimension}"`);
    }

    return {
      withinLimits: boundary.current <= boundary.limit,
      breached: boundary.breached,
      remaining: Math.max(0, boundary.limit - boundary.current),
      inCooldown: this.isInCooldown(dimension),
      cooldownRemaining: this.getCooldownRemaining(dimension),
      current: boundary.current,
    };
  }

  /**
   * Check if a boundary is currently breached.
   * @param dimension - Dimension to check
   * @returns Whether the boundary is breached
   */
  isBreached(dimension: BoundaryDimension): boolean {
    const boundary = this.state.boundaries.find((b) => b.dimension === dimension);
    if (!boundary) {
      throw new Error(`No boundary configured for dimension "${dimension}"`);
    }
    return boundary.breached;
  }

  /**
   * Check if a dimension is currently in cooldown.
   * @param dimension - Dimension to check
   * @returns Whether in cooldown period
   */
  isInCooldown(dimension: BoundaryDimension): boolean {
    const boundary = this.state.boundaries.find((b) => b.dimension === dimension);
    if (!boundary || boundary.lastBreachedAt === null) return false;
    return Date.now() < boundary.lastBreachedAt + boundary.cooldownMs;
  }

  /**
   * Get remaining cooldown time in milliseconds.
   * @param dimension - Dimension to check
   * @returns Cooldown remaining in ms (0 if not in cooldown)
   */
  getCooldownRemaining(dimension: BoundaryDimension): number {
    const boundary = this.state.boundaries.find((b) => b.dimension === dimension);
    if (!boundary || boundary.lastBreachedAt === null) return 0;
    const remaining = boundary.lastBreachedAt + boundary.cooldownMs - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Reset current usage for a dimension to zero.
   * @param dimension - Dimension to reset
   */
  resetUsage(dimension: BoundaryDimension): void {
    const boundary = this.state.boundaries.find((b) => b.dimension === dimension);
    if (!boundary) {
      throw new Error(`No boundary configured for dimension "${dimension}"`);
    }
    boundary.current = 0;
    boundary.breached = false;
  }

  /**
   * Remove a boundary for a dimension.
   * @param dimension - Dimension to remove
   */
  removeBoundary(dimension: BoundaryDimension): void {
    const idx = this.state.boundaries.findIndex((b) => b.dimension === dimension);
    if (idx === -1) {
      throw new Error(`No boundary configured for dimension "${dimension}"`);
    }
    this.state.boundaries.splice(idx, 1);
  }

  /**
   * Enable global enforcement.
   */
  enableEnforcement(): void {
    this.state.globalEnforcement = true;
  }

  /**
   * Disable global enforcement.
   */
  disableEnforcement(): void {
    this.state.globalEnforcement = false;
  }

  /**
   * Check if global enforcement is enabled.
   * @returns Whether enforcement is globally active
   */
  isEnforcementEnabled(): boolean {
    return this.state.globalEnforcement;
  }

  /**
   * Get all configured boundary dimensions.
   * @returns Array of dimensions
   */
  getDimensions(): BoundaryDimension[] {
    return this.state.boundaries.map((b) => b.dimension);
  }

  /**
   * Get a specific boundary.
   * @param dimension - Dimension to get
   * @returns Boundary copy or undefined
   */
  getBoundary(dimension: BoundaryDimension): Boundary | undefined {
    const boundary = this.state.boundaries.find((b) => b.dimension === dimension);
    return boundary ? { ...boundary } : undefined;
  }

  /**
   * Get total breach count.
   * @returns Number of breaches
   */
  getBreachCount(): number {
    return this.state.breachCount;
  }

  /**
   * Get the full current state.
   * @returns Deep-cloned state snapshot
   */
  getState(): SoftBarrierState {
    return {
      boundaries: this.state.boundaries.map((b) => ({ ...b })),
      globalEnforcement: this.state.globalEnforcement,
      breachCount: this.state.breachCount,
    };
  }

  async destroy(): Promise<void> {
    this.state = {
      boundaries: [],
      globalEnforcement: true,
      breachCount: 0,
    };
    this._bus = undefined;
    return Promise.resolve();
  }

  // ------------------------------------------------------------------
  // Event emission helper
  // ------------------------------------------------------------------

  private emit(type: string, data: Record<string, unknown>): void {
    if (
      this._bus &&
      typeof this._bus === 'object' &&
      this._bus !== null
    ) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (event: unknown) => void)({ type, data, source: 'soft-barrier' });
      }
    }
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createSoftBarrierModule(bus?: unknown): SoftBarrier {
  return new SoftBarrier(bus);
}
