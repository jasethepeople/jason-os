// ============================================================
// CalmSwitch Module — Emotional State Transition
// Rapid emotional state transition tool \u2014 emergency brake for negative states
// ============================================================
// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------
export const calm_switch_module = {
    id: 'calm-switch',
    name: 'CalmSwitch',
    category: 'emotional',
    version: '0.1.0',
    permissions: ['telemetry:read', 'events:emit'],
    description: 'Rapid emotional state transition tool \u2014 emergency brake for negative states',
};
// ------------------------------------------------------------------
// Default Technique Mappings
// ------------------------------------------------------------------
const DEFAULT_TECHNIQUES = {
    angry: ['box-breathing', 'cold-water-face', 'progressive-relaxation'],
    anxious: ['grounding-5-4-3-2-1', 'tapping', 'vagus-nerve'],
    sad: ['compassion-focus', 'behavioral-activation', 'gratitude-list'],
    overwhelmed: ['triage-sort', 'one-thing-next', 'sensory-reduction'],
    default: ['box-breathing', 'soft-anchor', 'quiet-moment'],
};
// ------------------------------------------------------------------
// CalmSwitch Implementation
// ------------------------------------------------------------------
export class CalmSwitch {
    state = {
        active: false,
        interventions: 0,
        lastActivatedAt: null,
        currentTechnique: null,
        transitionLog: [],
    };
    _bus;
    _techniques;
    _rng;
    constructor(bus) {
        this._bus = bus;
        void this._bus; // referenced to satisfy noUnusedLocals
        this._techniques = { ...DEFAULT_TECHNIQUES };
        this._rng = Math.random;
    }
    async init() {
        // Lifecycle hook for module loader integration
        return Promise.resolve();
    }
    /**
     * Activate the calm-switch for a given negative emotional state.
     * Selects an appropriate technique and logs the transition.
     * @param currentState - The current negative emotional state name
     */
    activate(currentState) {
        this.state.active = true;
        this.state.interventions++;
        this.state.lastActivatedAt = Date.now();
        const technique = this.selectTechnique(currentState);
        this.state.currentTechnique = technique;
        this.state.transitionLog.push({
            from: currentState,
            to: 'calm',
            technique,
            at: Date.now(),
        });
        this.emit('calm-switch:activated', { technique, state: currentState });
    }
    /**
     * Select an intervention technique for a given emotional state.
     * Randomly picks from the mapped pool of techniques.
     * @param state - Emotional state name
     * @returns Selected technique name
     */
    selectTechnique(state) {
        const pool = this._techniques[state] ?? this._techniques['default'];
        return pool[Math.floor(this._rng() * pool.length)];
    }
    /**
     * Override the technique mappings.
     * @param techniques - New technique mapping object
     */
    setTechniques(techniques) {
        this._techniques = { ...techniques };
    }
    /**
     * Get available techniques for a given emotional state.
     * @param state - Emotional state name
     * @returns Array of technique names
     */
    getTechniquesForState(state) {
        return [...(this._techniques[state] ?? this._techniques['default'])];
    }
    /**
     * Deactivate the calm-switch.
     */
    deactivate() {
        this.state.active = false;
        this.state.currentTechnique = null;
    }
    /**
     * Check if the calm-switch is currently active.
     * @returns Whether an intervention is in progress
     */
    isActive() {
        return this.state.active;
    }
    /**
     * Get the last transition entry, or null if none exists.
     * @returns Last transition log entry
     */
    getLastTransition() {
        if (this.state.transitionLog.length === 0)
            return null;
        return { ...this.state.transitionLog[this.state.transitionLog.length - 1] };
    }
    /**
     * Get all transitions for a specific source state.
     * @param fromState - Source emotional state
     * @returns Matching transition entries
     */
    getTransitionsForState(fromState) {
        return this.state.transitionLog
            .filter((t) => t.from === fromState)
            .map((t) => ({ ...t }));
    }
    /**
     * Get the total number of interventions performed.
     * @returns Intervention count
     */
    getInterventionCount() {
        return this.state.interventions;
    }
    /**
     * Get the full current state of the CalmSwitch instance.
     * @returns Deep-cloned state snapshot
     */
    getState() {
        return {
            ...this.state,
            transitionLog: [...this.state.transitionLog],
        };
    }
    /**
     * Set a custom random number generator (useful for testing).
     * @param rng - Function returning values in [0, 1)
     */
    setRng(rng) {
        this._rng = rng;
    }
    /**
     * Clear the transition log.
     */
    clearLog() {
        this.state.transitionLog = [];
    }
    async destroy() {
        this.state = {
            active: false,
            interventions: 0,
            lastActivatedAt: null,
            currentTechnique: null,
            transitionLog: [],
        };
        this._bus = undefined;
        this._rng = Math.random;
        return Promise.resolve();
    }
    // ------------------------------------------------------------------
    // Event emission helper
    // ------------------------------------------------------------------
    emit(type, data) {
        if (this._bus &&
            typeof this._bus === 'object' &&
            this._bus !== null) {
            const b = this._bus;
            if (b.emit && typeof b.emit === 'function') {
                b.emit({ type, data, source: 'calm-switch' });
            }
        }
    }
}
// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------
export function createCalmSwitchModule(bus) {
    return new CalmSwitch(bus);
}
//# sourceMappingURL=module.js.map