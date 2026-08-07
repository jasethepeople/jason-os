import type { VitalSigns, PulseCheckState, EmotionInput, OverallStatus, TrendDirection, PulseCheckOptions } from './types.js';
export declare const pulse_check_os_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['telemetry:read', 'events:emit', 'history:write'];
    description: string;
};
export declare class PulseCheckOS {
    private state;
    private _bus;
    private _maxHistory;
    private _enableTrendDetection;
    private _enableAlerts;
    constructor(bus?: unknown, options?: PulseCheckOptions);
    init(): Promise<void>;
    /**
     * Process a new emotion input, compute vital signs, update state.
     * @param emotion - Raw emotion input with VAD+stress values
     * @returns Computed vital signs
     */
    checkVitals(emotion: EmotionInput): VitalSigns;
    /**
     * Compute overall status from emotion input.
     * Mapping: stress<0.3 + valence>0.3 = thriving,
     *          stress<0.6 = stable,
     *          stress<0.8 = declining,
     *          else critical.
     * @param emotion - Emotion input with stress and valence
     * @returns Overall status category
     */
    computeOverall(emotion: Pick<EmotionInput, 'stress' | 'valence'>): OverallStatus;
    private clamp;
    /**
     * Detect trend direction from history.
     * Compares recent stress values to earlier ones.
     * @returns Trend direction: improving, stable, or worsening
     */
    detectTrend(): TrendDirection;
    /**
     * Generate alerts based on current and recent vital signs.
     * @returns Array of alert messages
     */
    getAlerts(): string[];
    /**
     * Get the current vital signs, or null.
     * @returns Current vital signs copy
     */
    getCurrentVitals(): VitalSigns | null;
    /**
     * Get the full vital signs history.
     * @returns Array of vital signs copies
     */
    getHistory(): VitalSigns[];
    /**
     * Get the current trend direction.
     * @returns Current trend
     */
    getTrendDirection(): TrendDirection;
    /**
     * Get the number of history entries.
     * @returns History count
     */
    getHistoryCount(): number;
    /**
     * Get the full current state.
     * @returns Deep-cloned state snapshot
     */
    getState(): PulseCheckState;
    destroy(): Promise<void>;
}
export declare function createPulseCheckOSModule(bus?: unknown, options?: PulseCheckOptions): PulseCheckOS;
//# sourceMappingURL=module.d.ts.map