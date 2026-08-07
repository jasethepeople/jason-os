/**
 * ShadowAtlas — Identity Cartography (Identity)
 * Types and interfaces for the visual identity map with emotional state tracking.
 */
/** Represents a single persona in the identity atlas */
export interface Persona {
    /** Unique persona identifier */
    id: string;
    /** Human-readable display name */
    displayName: string;
    /** Optional emotional state attached to this persona */
    emotionalState?: {
        valence: number;
        stress: number;
    };
}
/** Full state snapshot for the ShadowAtlas module */
export interface AtlasState {
    /** All registered personas */
    personas: Persona[];
    /** ID of the currently active persona, or null */
    activePersonaId: string | null;
    /** Overlap score representing persona fragmentation (0–1) */
    overlapScore: number;
}
//# sourceMappingURL=types.d.ts.map