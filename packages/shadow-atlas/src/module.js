/**
 * ShadowAtlas — Identity Cartography (Identity)
 * Module definition and class implementation.
 */
/** Module metadata for the ShadowAtlas identity module */
export const shadow_atlas_module = {
    id: 'shadow-atlas',
    name: 'ShadowAtlas',
    category: 'identity',
    version: '0.1.0',
    permissions: ['identity:read', 'telemetry:read'],
    description: 'Visual identity map with emotional state tracking',
};
/**
 * Manages a visual identity map with emotional state tracking.
 * Registers personas and computes overlap scores indicating identity fragmentation.
 */
export class ShadowAtlas {
    state = {
        personas: [],
        activePersonaId: null,
        overlapScore: 0,
    };
    _bus;
    constructor(bus) {
        this._bus = bus;
        void this._bus;
    }
    /** Initialize the module — no-op for ShadowAtlas */
    async init() {
        /* no-op */
    }
    /**
     * Register a new persona with optional emotional state.
     * Recalculates the overlap score after registration.
     */
    registerPersona(id, displayName, emotionalState) {
        this.state.personas.push({ id, displayName, emotionalState });
        this.computeOverlap();
    }
    /** Set the active persona by ID */
    setActive(id) {
        this.state.activePersonaId = id;
    }
    /** Recalculate overlap score based on number of personas */
    computeOverlap() {
        const count = this.state.personas.length;
        this.state.overlapScore = count > 1 ? (count - 1) * 0.15 : 0;
    }
    /** Return a cloned snapshot of current state */
    getState() {
        return { ...this.state, personas: [...this.state.personas] };
    }
    /** Destroy the module — no-op for ShadowAtlas */
    async destroy() {
        /* no-op */
    }
}
/** Factory function to create a ShadowAtlas module instance */
export function createShadowAtlasModule(bus) {
    return new ShadowAtlas(bus);
}
//# sourceMappingURL=module.js.map