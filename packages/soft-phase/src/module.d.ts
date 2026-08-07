import type { PhaseState, CyclePhase, EmotionalCorrelation, EmotionInput } from './types.js';
export declare const soft_phase_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['telemetry:read', 'storage:write'];
    description: string;
};
export declare class SoftPhase {
    private state;
    private _bus;
    constructor(bus?: unknown);
    init(): Promise<void>;
    /**
     * Set the current cycle day and infer the phase.
     * @param day - Day in cycle (1-28+)
     */
    setDay(day: number): void;
    /**
     * Infer cycle phase from day number.
     * @param day - Day in cycle (1-28+)
     * @returns Inferred phase
     */
    inferPhase(day: number): CyclePhase;
    /**
     * Correlate current emotional state with cycle phase.
     * Sets the emotional correlation based on the current phase.
     * @param emotion - Current emotional state
     */
    correlateEmotion(_emotion: EmotionInput): void;
    /**
     * Get the raw emotional correlation for a specific phase without changing state.
     * @param phase - The cycle phase to query
     * @returns Emotional correlation for that phase
     */
    getPhaseCorrelation(phase: CyclePhase): EmotionalCorrelation;
    /**
     * Generate predictions for upcoming days.
     * @param daysAhead - Number of days to predict (default 28)
     */
    predict(daysAhead?: number): void;
    /**
     * Get the current cycle phase.
     * @returns Current phase
     */
    getPhase(): CyclePhase;
    /**
     * Get the current cycle day.
     * @returns Current day (1-28+)
     */
    getDay(): number;
    /**
     * Get the full current state of the SoftPhase instance.
     * @returns Deep-cloned state snapshot
     */
    getState(): PhaseState;
    /**
     * Reset all state to initial values.
     */
    reset(): void;
    destroy(): Promise<void>;
    private emit;
}
export declare function createSoftPhaseModule(bus?: unknown): SoftPhase;
//# sourceMappingURL=module.d.ts.map