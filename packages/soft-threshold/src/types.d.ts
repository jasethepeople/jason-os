/**
 * SoftThreshold — Stress Boundary + Affiliate Suppression (Emotional)
 * Types and interfaces for stress boundary detection with affiliate offer suppression.
 */
/** State snapshot for the SoftThreshold module */
export interface ThresholdState {
    /** Whether the stress threshold is currently breached */
    active: boolean;
    /** The configured stress threshold (0–1) */
    threshold: number;
    /** The last checked stress level */
    currentStress: number;
    /** Whether affiliate offers are currently suppressed */
    suppressed: boolean;
    /** Unix timestamp of last warning, or null */
    lastWarningAt: number | null;
}
//# sourceMappingURL=types.d.ts.map