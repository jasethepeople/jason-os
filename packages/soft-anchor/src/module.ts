/**
 * SoftAnchor — Emotional Re-anchoring (Emotional)
 * Module definition and class implementation.
 */

import type { AnchorState } from './types.js';

/** Module metadata for the SoftAnchor emotional module */
export const soft_anchor_module = {
  id: 'soft-anchor',
  name: 'SoftAnchor',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['telemetry:read', 'storage:write'] as const,
  description: 'Emotional re-anchoring system on stress spikes',
};

/**
 * Provides emotional re-anchoring when stress spikes are detected.
 * Emits events via the event bus when re-anchoring occurs.
 */
export class SoftAnchor {
  private state: AnchorState = {
    stable: true,
    trigger: null,
    reanchoredAt: null,
    anchorCount: 0,
  };

  private _bus: unknown;

  constructor(bus?: unknown) {
    this._bus = bus;
  }

  /** Initialize the module — no-op for SoftAnchor */
  async init(): Promise<void> {
    /* no-op */
  }

  /**
   * Perform a re-anchor operation, resetting stability and recording the trigger.
   * Emits a 'soft-anchor:reanchored' event on the event bus.
   */
  reanchor(trigger: string): void {
    this.state.stable = true;
    this.state.trigger = trigger;
    this.state.reanchoredAt = Date.now();
    this.state.anchorCount++;
    this.emit('soft-anchor:reanchored', { trigger });
  }

  /** Return a shallow-cloned snapshot of current state */
  getState(): AnchorState {
    return { ...this.state };
  }

  /** Destroy the module — no-op for SoftAnchor */
  async destroy(): Promise<void> {
    /* no-op */
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
          source: 'soft-anchor',
        });
      }
    }
  }
}

/** Factory function to create a SoftAnchor module instance */
export function createSoftAnchorModule(bus?: unknown): SoftAnchor {
  return new SoftAnchor(bus);
}
