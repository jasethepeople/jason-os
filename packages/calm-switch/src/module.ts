// ============================================================
// CalmSwitch Module — Emotional State Transition
// Rapid emotional state transition tool \u2014 emergency brake for negative states
// ============================================================

import type { CalmState, TransitionEntry } from './types.js';

// ------------------------------------------------------------------
// Module Definition
// ------------------------------------------------------------------

export const calm_switch_module = {
  id: 'calm-switch',
  name: 'CalmSwitch',
  category: 'emotional' as const,
  version: '0.1.0',
  permissions: ['telemetry:read', 'events:emit'] as const,
  description:
    'Rapid emotional state transition tool \u2014 emergency brake for negative states',
};

// ------------------------------------------------------------------
// Default Technique Mappings
// ------------------------------------------------------------------

const DEFAULT_TECHNIQUES: Readonly<Record<string, string[]>> = {
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
  private state: CalmState = {
    active: false,
    interventions: 0,
    lastActivatedAt: null,
    currentTechnique: null,
    transitionLog: [],
  };

  private _bus: unknown;
  private _techniques: Record<string, string[]>;
  private _rng: () => number;

  constructor(bus?: unknown) {
    this._bus = bus;
    void this._bus; // referenced to satisfy noUnusedLocals
    this._techniques = { ...DEFAULT_TECHNIQUES };
    this._rng = Math.random;
  }

  async init(): Promise<void> {
    // Lifecycle hook for module loader integration
    return Promise.resolve();
  }

  /**
   * Activate the calm-switch for a given negative emotional state.
   * Selects an appropriate technique and logs the transition.
   * @param currentState - The current negative emotional state name
   */
  activate(currentState: string): void {
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
  selectTechnique(state: string): string {
    const pool = this._techniques[state] ?? this._techniques['default']!;
    return pool[Math.floor(this._rng() * pool.length)]!;
  }

  /**
   * Override the technique mappings.
   * @param techniques - New technique mapping object
   */
  setTechniques(techniques: Record<string, string[]>): void {
    this._techniques = { ...techniques };
  }

  /**
   * Get available techniques for a given emotional state.
   * @param state - Emotional state name
   * @returns Array of technique names
   */
  getTechniquesForState(state: string): string[] {
    return [...(this._techniques[state] ?? this._techniques['default']!)];
  }

  /**
   * Deactivate the calm-switch.
   */
  deactivate(): void {
    this.state.active = false;
    this.state.currentTechnique = null;
  }

  /**
   * Check if the calm-switch is currently active.
   * @returns Whether an intervention is in progress
   */
  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Get the last transition entry, or null if none exists.
   * @returns Last transition log entry
   */
  getLastTransition(): TransitionEntry | null {
    if (this.state.transitionLog.length === 0) return null;
    return { ...this.state.transitionLog[this.state.transitionLog.length - 1]! };
  }

  /**
   * Get all transitions for a specific source state.
   * @param fromState - Source emotional state
   * @returns Matching transition entries
   */
  getTransitionsForState(fromState: string): TransitionEntry[] {
    return this.state.transitionLog
      .filter((t) => t.from === fromState)
      .map((t) => ({ ...t }));
  }

  /**
   * Get the total number of interventions performed.
   * @returns Intervention count
   */
  getInterventionCount(): number {
    return this.state.interventions;
  }

  /**
   * Get the full current state of the CalmSwitch instance.
   * @returns Deep-cloned state snapshot
   */
  getState(): CalmState {
    return {
      ...this.state,
      transitionLog: [...this.state.transitionLog],
    };
  }

  /**
   * Set a custom random number generator (useful for testing).
   * @param rng - Function returning values in [0, 1)
   */
  setRng(rng: () => number): void {
    this._rng = rng;
  }

  /**
   * Clear the transition log.
   */
  clearLog(): void {
    this.state.transitionLog = [];
  }

  async destroy(): Promise<void> {
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

  private emit(type: string, data: Record<string, unknown>): void {
    if (
      this._bus &&
      typeof this._bus === 'object' &&
      this._bus !== null
    ) {
      const b = this._bus as Record<string, unknown>;
      if (b.emit && typeof b.emit === 'function') {
        (b.emit as (event: unknown) => void)({ type, data, source: 'calm-switch' });
      }
    }
  }
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createCalmSwitchModule(bus?: unknown): CalmSwitch {
  return new CalmSwitch(bus);
}
