import type { GhostSpanState, FocusSlot, EmotionDataPoint } from './types.js';
export declare const ghost_span_module: {
    id: string;
    name: string;
    category: 'productivity';
    version: string;
    permissions: readonly ['telemetry:read', 'schedule'];
    description: string;
};
export declare class GhostSpan {
    private state;
    private _bus;
    constructor(bus?: unknown);
    init(): Promise<void>;
    /**
     * Generate a focus schedule from emotion history data.
     * Maps each hour's valence/arousal to an optimal focus score and task type.
     * @param emotionHistory - Array of emotional data points by hour
     */
    generateSchedule(emotionHistory: EmotionDataPoint[]): void;
    /**
     * Compute a focus suitability score from valence and arousal.
     * Optimal focus occurs at moderate positive valence + moderate arousal.
     * @param valence - Emotional valence (-1 to 1)
     * @param arousal - Arousal level (0 to 1)
     * @returns Focus score (0 to 1)
     */
    computeFocusScore(valence: number, arousal: number): number;
    /**
     * Suggest a task type based on emotional state.
     * @param valence - Emotional valence (-1 to 1)
     * @param arousal - Arousal level (0 to 1)
     * @returns Task type recommendation
     */
    suggestTaskType(valence: number, arousal: number): string;
    /**
     * Get the focus slot for a specific hour.
     * @param hour - Hour of day (0-23)
     * @returns The matching focus slot, or null if not found
     */
    getCurrentSlot(hour: number): FocusSlot | null;
    /**
     * Get the best focus slot across the entire schedule.
     * @returns The slot with highest optimalFocus score, or null if no schedule
     */
    getBestSlot(): FocusSlot | null;
    /**
     * Get all slots for a given task type.
     * @param taskType - Task type filter
     * @returns Matching focus slots
     */
    getSlotsByTaskType(taskType: string): FocusSlot[];
    /**
     * Get the average focus score across the full schedule.
     * @returns Average focus score (0-1), or 0 if no schedule
     */
    getAverageFocusScore(): number;
    /**
     * Adjust a specific hour's slot manually.
     * @param hour - Hour to adjust
     * @param overrides - Partial slot data to override
     */
    adjustSlot(hour: number, overrides: Partial<Omit<FocusSlot, 'hour'>>): void;
    /**
     * Get the full current state of the GhostSpan instance.
     * @returns Deep-cloned state snapshot
     */
    getState(): GhostSpanState;
    /**
     * Check whether a schedule has been generated.
     * @returns Whether the module has an active schedule
     */
    isActive(): boolean;
    /**
     * Clear the current schedule and reset state.
     */
    clearSchedule(): void;
    destroy(): Promise<void>;
}
export declare function createGhostSpanModule(bus?: unknown): GhostSpan;
//# sourceMappingURL=module.d.ts.map