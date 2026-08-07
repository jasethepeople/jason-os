import type { Boundary, SoftBarrierState, BoundaryConfig, BoundaryDimension, UsageReport } from './types.js';
export declare const soft_barrier_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['events:emit', 'events:listen'];
    description: string;
};
export declare class SoftBarrier {
    private state;
    private _bus;
    constructor(bus?: unknown);
    init(): Promise<void>;
    /**
     * Define a new boundary for a dimension.
     * @param config - Boundary configuration
     * @returns The created boundary
     */
    setBoundary(config: BoundaryConfig): Boundary;
    /**
     * Report usage for a dimension and check if within limits.
     * @param dimension - Dimension to report usage for
     * @param amount - Amount to add to current usage
     * @returns Usage report with breach status
     */
    reportUsage(dimension: BoundaryDimension, amount: number): UsageReport;
    /**
     * Check current usage for a dimension without modifying it.
     * @param dimension - Dimension to check
     * @returns Usage report
     */
    checkUsage(dimension: BoundaryDimension): UsageReport;
    /**
     * Check if a boundary is currently breached.
     * @param dimension - Dimension to check
     * @returns Whether the boundary is breached
     */
    isBreached(dimension: BoundaryDimension): boolean;
    /**
     * Check if a dimension is currently in cooldown.
     * @param dimension - Dimension to check
     * @returns Whether in cooldown period
     */
    isInCooldown(dimension: BoundaryDimension): boolean;
    /**
     * Get remaining cooldown time in milliseconds.
     * @param dimension - Dimension to check
     * @returns Cooldown remaining in ms (0 if not in cooldown)
     */
    getCooldownRemaining(dimension: BoundaryDimension): number;
    /**
     * Reset current usage for a dimension to zero.
     * @param dimension - Dimension to reset
     */
    resetUsage(dimension: BoundaryDimension): void;
    /**
     * Remove a boundary for a dimension.
     * @param dimension - Dimension to remove
     */
    removeBoundary(dimension: BoundaryDimension): void;
    /**
     * Enable global enforcement.
     */
    enableEnforcement(): void;
    /**
     * Disable global enforcement.
     */
    disableEnforcement(): void;
    /**
     * Check if global enforcement is enabled.
     * @returns Whether enforcement is globally active
     */
    isEnforcementEnabled(): boolean;
    /**
     * Get all configured boundary dimensions.
     * @returns Array of dimensions
     */
    getDimensions(): BoundaryDimension[];
    /**
     * Get a specific boundary.
     * @param dimension - Dimension to get
     * @returns Boundary copy or undefined
     */
    getBoundary(dimension: BoundaryDimension): Boundary | undefined;
    /**
     * Get total breach count.
     * @returns Number of breaches
     */
    getBreachCount(): number;
    /**
     * Get the full current state.
     * @returns Deep-cloned state snapshot
     */
    getState(): SoftBarrierState;
    destroy(): Promise<void>;
    private emit;
}
export declare function createSoftBarrierModule(bus?: unknown): SoftBarrier;
//# sourceMappingURL=module.d.ts.map