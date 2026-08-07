import type { DataPoint, Pattern, UndercurrentState, UndercurrentOptions } from './types.js';
export declare const undercurrent_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['telemetry:read', 'history:read', 'events:emit'];
    description: string;
};
export declare class Undercurrent {
    private state;
    private _bus;
    private _confidenceThreshold;
    private _scanDepth;
    private _minOccurrences;
    constructor(bus?: unknown, options?: UndercurrentOptions);
    init(): Promise<void>;
    /**
     * Scan a set of emotional data points for patterns.
     * @param dataPoints - Array of emotional data points to analyze
     */
    scan(dataPoints: DataPoint[]): void;
    /**
     * Detect correlation patterns between emotional dimensions.
     * E.g., high stress always follows low valence.
     * @param dataPoints - Data points to analyze
     */
    detectPattern(dataPoints: DataPoint[]): Pattern | null;
    /**
     * Generate human-readable insights from detected patterns.
     * @returns Array of insight strings
     */
    generateInsights(): string[];
    /**
     * Get a specific pattern by ID.
     * @param id - Pattern ID
     * @returns Pattern copy, or null if not found
     */
    getPattern(id: string): Pattern | null;
    /**
     * Get all detected patterns.
     * @returns Array of pattern copies
     */
    getPatterns(): Pattern[];
    /**
     * Get current insights.
     * @returns Array of insight strings
     */
    getInsights(): string[];
    /**
     * Get the full current state.
     * @returns Deep-cloned state snapshot
     */
    getState(): UndercurrentState;
    destroy(): Promise<void>;
    /**
     * Detect correlation: does high stress follow low valence?
     */
    private detectCorrelation;
    private buildCorrelationPattern;
    /**
     * Detect cyclical patterns in valence over time.
     */
    private detectCycle;
    private buildCyclePattern;
    /**
     * Detect clusters of stress spikes.
     */
    private detectSpikeCluster;
    private buildSpikeClusterPattern;
    /**
     * Detect baseline drift in emotional dimensions.
     */
    private detectBaselineDrift;
    private buildBaselineDriftPattern;
    /**
     * Add a pattern to state, avoiding duplicates by type+dimensions.
     */
    private addPattern;
    private arraysEqual;
}
export declare function createUndercurrentModule(bus?: unknown, options?: UndercurrentOptions): Undercurrent;
//# sourceMappingURL=module.d.ts.map