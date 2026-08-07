import type { CalmState, TransitionEntry } from './types.js';
export declare const calm_switch_module: {
    id: string;
    name: string;
    category: 'emotional';
    version: string;
    permissions: readonly ['telemetry:read', 'events:emit'];
    description: string;
};
export declare class CalmSwitch {
    private state;
    private _bus;
    private _techniques;
    private _rng;
    constructor(bus?: unknown);
    init(): Promise<void>;
    /**
     * Activate the calm-switch for a given negative emotional state.
     * Selects an appropriate technique and logs the transition.
     * @param currentState - The current negative emotional state name
     */
    activate(currentState: string): void;
    /**
     * Select an intervention technique for a given emotional state.
     * Randomly picks from the mapped pool of techniques.
     * @param state - Emotional state name
     * @returns Selected technique name
     */
    selectTechnique(state: string): string;
    /**
     * Override the technique mappings.
     * @param techniques - New technique mapping object
     */
    setTechniques(techniques: Record<string, string[]>): void;
    /**
     * Get available techniques for a given emotional state.
     * @param state - Emotional state name
     * @returns Array of technique names
     */
    getTechniquesForState(state: string): string[];
    /**
     * Deactivate the calm-switch.
     */
    deactivate(): void;
    /**
     * Check if the calm-switch is currently active.
     * @returns Whether an intervention is in progress
     */
    isActive(): boolean;
    /**
     * Get the last transition entry, or null if none exists.
     * @returns Last transition log entry
     */
    getLastTransition(): TransitionEntry | null;
    /**
     * Get all transitions for a specific source state.
     * @param fromState - Source emotional state
     * @returns Matching transition entries
     */
    getTransitionsForState(fromState: string): TransitionEntry[];
    /**
     * Get the total number of interventions performed.
     * @returns Intervention count
     */
    getInterventionCount(): number;
    /**
     * Get the full current state of the CalmSwitch instance.
     * @returns Deep-cloned state snapshot
     */
    getState(): CalmState;
    /**
     * Set a custom random number generator (useful for testing).
     * @param rng - Function returning values in [0, 1)
     */
    setRng(rng: () => number): void;
    /**
     * Clear the transition log.
     */
    clearLog(): void;
    destroy(): Promise<void>;
    private emit;
}
export declare function createCalmSwitchModule(bus?: unknown): CalmSwitch;
//# sourceMappingURL=module.d.ts.map