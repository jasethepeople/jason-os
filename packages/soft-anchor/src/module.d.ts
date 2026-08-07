/**
 * SoftAnchor — Emotional Re-anchoring (Emotional)
 * Module definition and class implementation.
 */
import type { AnchorState } from './types.js';
/** Module metadata for the SoftAnchor emotional module */
export declare const soft_anchor_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['telemetry:read', 'storage:write'];
    description: string;
};
/**
 * Provides emotional re-anchoring when stress spikes are detected.
 * Emits events via the event bus when re-anchoring occurs.
 */
export declare class SoftAnchor {
    private state;
    private _bus;
    constructor(bus?: unknown);
    /** Initialize the module — no-op for SoftAnchor */
    init(): Promise<void>;
    /**
     * Perform a re-anchor operation, resetting stability and recording the trigger.
     * Emits a 'soft-anchor:reanchored' event on the event bus.
     */
    reanchor(trigger: string): void;
    /** Return a shallow-cloned snapshot of current state */
    getState(): AnchorState;
    /** Destroy the module — no-op for SoftAnchor */
    destroy(): Promise<void>;
    /** Emit an event to the event bus, if available */
    private emit;
}
/** Factory function to create a SoftAnchor module instance */
export declare function createSoftAnchorModule(bus?: unknown): SoftAnchor;
//# sourceMappingURL=module.d.ts.map