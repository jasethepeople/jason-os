/**
 * SoftThreshold — Stress Boundary + Affiliate Suppression (Emotional)
 * Module definition and class implementation.
 */
import type { ThresholdState } from './types.js';
/** Module metadata for the SoftThreshold emotional module */
export declare const soft_threshold_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['telemetry:read', 'events:emit'];
    description: string;
};
/**
 * Detects when stress levels breach a configurable threshold and
 * suppresses affiliate offers for a cooldown period when breached.
 * Emits events via the event bus for threshold breaches and affiliate actions.
 */
export declare class SoftThreshold {
    private state;
    private _bus;
    private _suppressionTimer;
    constructor(bus?: unknown);
    /** Initialize the module — no-op for SoftThreshold */
    init(): Promise<void>;
    /**
     * Check whether the given stress level breaches the threshold.
     * If breached, activates suppression and emits events.
     */
    checkBoundary(stress: number): void;
    /**
     * Activate affiliate suppression for 120 seconds.
     * Emits 'affiliate:suppress' immediately and 'affiliate:release' after cooldown.
     */
    suppressAffiliate(): void;
    /**
     * Set the stress threshold, clamped to [0.1, 1.0].
     */
    setThreshold(t: number): void;
    /** Return a cloned snapshot of current state */
    getState(): ThresholdState;
    /** Destroy the module, clearing any active suppression timer */
    destroy(): Promise<void>;
    /** Emit an event to the event bus, if available */
    private emit;
}
/** Factory function to create a SoftThreshold module instance */
export declare function createSoftThresholdModule(bus?: unknown): SoftThreshold;
//# sourceMappingURL=module.d.ts.map