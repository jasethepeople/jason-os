/**
 * SoftThreshold — Stress Boundary + Affiliate Suppression (Emotional)
 * Module definition and class implementation.
 */

import type { ThresholdState } from './types.js';

/** Module metadata for the SoftThreshold emotional module */
export const soft_threshold_module = {
  id: 'soft-threshold',
  name: 'SoftThreshold',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['telemetry:read', 'events:emit'] as const,
  description: 'Stress boundary detection with affiliate offer suppression',
};

/**
 * Detects when stress levels breach a configurable threshold and
 * suppresses affiliate offers for a cooldown period when breached.
 * Emits events via the event bus for threshold breaches and affiliate actions.
 */
export class SoftThreshold {
  private state: ThresholdState = {
    active: false,
    threshold: 0.75,
    currentStress: 0,
    suppressed: false,
    lastWarningAt: null,
  };

  private _bus: unknown;
  private _suppressionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(bus?: unknown) {
    this._bus = bus;
  }

  /** Initialize the module — no-op for SoftThreshold */
  async init(): Promise<void> {
    /* no-op */
  }

  /**
   * Check whether the given stress level breaches the threshold.
   * If breached, activates suppression and emits events.
   */
  checkBoundary(stress: number): void {
    this.state.currentStress = stress;
    if (stress > this.state.threshold) {
      this.state.active = true;
      this.state.lastWarningAt = Date.now();
      this.suppressAffiliate();
      this.emit('soft-threshold:breached', {
        stress,
        threshold: this.state.threshold,
      });
    } else {
      this.state.active = false;
    }
  }

  /**
   * Activate affiliate suppression for 120 seconds.
   * Emits 'affiliate:suppress' immediately and 'affiliate:release' after cooldown.
   */
  suppressAffiliate(): void {
    this.state.suppressed = true;
    this.emit('affiliate:suppress', {
      reason: 'stress-threshold',
      duration: 120000,
    });
    if (this._suppressionTimer) {
      clearTimeout(this._suppressionTimer);
    }
    this._suppressionTimer = setTimeout(() => {
      this.state.suppressed = false;
      this.emit('affiliate:release', {});
    }, 120000);
  }

  /**
   * Set the stress threshold, clamped to [0.1, 1.0].
   */
  setThreshold(t: number): void {
    this.state.threshold = Math.max(0.1, Math.min(1.0, t));
  }

  /** Return a cloned snapshot of current state */
  getState(): ThresholdState {
    return { ...this.state };
  }

  /** Destroy the module, clearing any active suppression timer */
  async destroy(): Promise<void> {
    if (this._suppressionTimer) {
      clearTimeout(this._suppressionTimer);
    }
  }

  /** Emit an event to the event bus, if available */
  private emit(type: string, data: unknown): void {
    if (
      this._bus &&
      typeof this._bus === 'object' &&
      this._bus !== null
    ) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (payload: { type: string; data: unknown; source: string }) => void)({
          type,
          data,
          source: 'soft-threshold',
        });
      }
    }
  }
}

/** Factory function to create a SoftThreshold module instance */
export function createSoftThresholdModule(bus?: unknown): SoftThreshold {
  return new SoftThreshold(bus);
}
