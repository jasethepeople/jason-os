export type BoundaryDimension = 'time' | 'emotional' | 'social' | 'digital';
export interface Boundary {
    /** Unique identifier for the boundary */
    id: string;
    /** Dimension of the boundary */
    dimension: BoundaryDimension;
    /** Maximum allowed value */
    limit: number;
    /** Current usage/value */
    current: number;
    /** Whether the boundary is currently breached */
    breached: boolean;
    /** Cooldown period in milliseconds after breach */
    cooldownMs: number;
    /** Timestamp of last breach, or null */
    lastBreachedAt: number | null;
}
export interface SoftBarrierState {
    /** All configured boundaries */
    boundaries: Boundary[];
    /** Whether global enforcement is active */
    globalEnforcement: boolean;
    /** Total number of breaches */
    breachCount: number;
}
export interface BoundaryConfig {
    /** Boundary dimension */
    dimension: BoundaryDimension;
    /** Maximum allowed value */
    limit: number;
    /** Cooldown period in ms (default: 60000) */
    cooldownMs?: number;
    /** Initial current value (default: 0) */
    initialCurrent?: number;
}
export interface UsageReport {
    /** Whether the usage is within limits */
    withinLimits: boolean;
    /** Whether a breach was detected */
    breached: boolean;
    /** Remaining allowance before limit */
    remaining: number;
    /** Whether boundary is in cooldown */
    inCooldown: boolean;
    /** Cooldown remaining in ms (0 if not in cooldown) */
    cooldownRemaining: number;
    /** Current usage value */
    current: number;
}
//# sourceMappingURL=types.d.ts.map