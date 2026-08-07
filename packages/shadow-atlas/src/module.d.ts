/**
 * ShadowAtlas — Identity Cartography (Identity)
 * Module definition and class implementation.
 */
import type { AtlasState } from './types.js';
/** Module metadata for the ShadowAtlas identity module */
export declare const shadow_atlas_module: {
    id: string;
    name: string;
    category: 'identity';
    version: string;
    permissions: readonly ['identity:read', 'telemetry:read'];
    description: string;
};
/**
 * Manages a visual identity map with emotional state tracking.
 * Registers personas and computes overlap scores indicating identity fragmentation.
 */
export declare class ShadowAtlas {
    private state;
    private _bus;
    constructor(bus?: unknown);
    /** Initialize the module — no-op for ShadowAtlas */
    init(): Promise<void>;
    /**
     * Register a new persona with optional emotional state.
     * Recalculates the overlap score after registration.
     */
    registerPersona(id: string, displayName: string, emotionalState?: {
        valence: number;
        stress: number;
    }): void;
    /** Set the active persona by ID */
    setActive(id: string): void;
    /** Recalculate overlap score based on number of personas */
    computeOverlap(): void;
    /** Return a cloned snapshot of current state */
    getState(): AtlasState;
    /** Destroy the module — no-op for ShadowAtlas */
    destroy(): Promise<void>;
}
/** Factory function to create a ShadowAtlas module instance */
export declare function createShadowAtlasModule(bus?: unknown): ShadowAtlas;
//# sourceMappingURL=module.d.ts.map